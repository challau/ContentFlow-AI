import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type ChatAction } from '@prisma/client';
import type { Env } from '../../common/config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/providers/llm.service';
import type { LlmMessage } from '../../ai/providers/provider.interface';
import type { SendMessageDto } from './chat.dto';

/** Turns spent on chat are cheap relative to a 13-agent run. */
const CHAT_COST_CREDITS = 1;
/** How much prior conversation to replay to the model. */
const HISTORY_LIMIT = 20;

const ACTION_INSTRUCTIONS: Record<ChatAction, string> = {
  CHAT: 'Answer the user directly and concisely.',
  REWRITE: 'Rewrite the supplied content, preserving meaning while improving clarity and flow.',
  EXPAND: 'Expand the supplied content with concrete detail. Do not pad with filler.',
  SHORTEN: 'Shorten the supplied content, keeping every load-bearing idea.',
  CHANGE_TONE: 'Rewrite the supplied content in the requested tone without changing the facts.',
  TRANSLATE: 'Translate the supplied content into the requested language, preserving tone.',
  IDEAS: 'Produce a numbered list of distinct, specific content angles.',
};

export interface ChatContext {
  projectNames: string[];
  brief?: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async createConversation(args: {
    organizationId: string;
    userId: string;
    title?: string;
    projectId?: string;
  }) {
    if (args.projectId) await this.assertProject(args.organizationId, args.projectId);

    return this.prisma.conversation.create({
      data: {
        organizationId: args.organizationId,
        userId: args.userId,
        projectId: args.projectId,
        title: args.title ?? 'New chat',
      },
      include: { messages: true },
    });
  }

  async listConversations(args: {
    organizationId: string;
    skip?: number;
    take?: number;
    includeArchived?: boolean;
  }) {
    const where: Prisma.ConversationWhereInput = {
      organizationId: args.organizationId,
      ...(args.includeArchived ? {} : { archivedAt: null }),
    };
    const take = Math.min(args.take ?? 30, 100);
    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: args.skip ?? 0,
        take,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return { items, total, skip: args.skip ?? 0, take };
  }

  async getConversation(organizationId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, organizationId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async updateConversation(
    organizationId: string,
    id: string,
    data: { title?: string; archived?: boolean },
  ) {
    await this.getConversation(organizationId, id);
    return this.prisma.conversation.update({
      where: { id },
      data: {
        title: data.title,
        ...(data.archived === undefined ? {} : { archivedAt: data.archived ? new Date() : null }),
      },
    });
  }

  async deleteConversation(organizationId: string, id: string) {
    await this.getConversation(organizationId, id);
    await this.prisma.conversation.delete({ where: { id } });
  }

  /**
   * Appends the user turn, calls the model with project-grounded context, and
   * persists the reply. Credits are charged only after a successful completion
   * so a provider outage never silently bills the user.
   */
  async sendMessage(args: {
    organizationId: string;
    userId: string;
    conversationId: string;
    dto: SendMessageDto;
  }) {
    const conversation = await this.getConversation(args.organizationId, args.conversationId);

    const cost = CHAT_COST_CREDITS;
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: args.organizationId },
      select: { credits: true },
    });
    if (org.credits < cost) {
      throw new BadRequestException(
        `Insufficient AI credits: ${org.credits} available, ${cost} required`,
      );
    }

    const action = (args.dto.action ?? 'CHAT') as ChatAction;
    const sourceContent = await this.resolveSource(args.organizationId, args.dto);

    if (action !== 'CHAT' && action !== 'IDEAS' && !sourceContent) {
      throw new BadRequestException(
        `The ${action} action needs content to work on — pass sourceContent or assetId`,
      );
    }

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        action,
        content: args.dto.content,
        sourceContent,
        target: args.dto.target,
      },
    });

    const context = await this.buildContext(args.organizationId, conversation.projectId);
    const history = await this.recentHistory(conversation.id);

    const result = await this.llm.completeText({
      system: this.systemPrompt(action, context),
      messages: this.renderMessages(history, args.dto, sourceContent, context),
      intent: `chat:${action.toLowerCase()}`,
    });

    const assistantMessage = await this.prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'ASSISTANT',
          action,
          content: result.text,
          provider: result.provider,
          model: result.model,
          promptTokens: result.promptTokens,
          outputTokens: result.outputTokens,
          costUsd: new Prisma.Decimal(result.costUsd),
        },
      });

      const updated = await tx.organization.update({
        where: { id: args.organizationId },
        data: { credits: { decrement: cost } },
        select: { credits: true },
      });

      await tx.creditTransaction.create({
        data: {
          organizationId: args.organizationId,
          amount: -cost,
          balanceAfter: updated.credits,
          reason: 'CHAT_MESSAGE',
          description: `Chat (${action.toLowerCase()})`,
          referenceId: created.id,
        },
      });

      // Title the conversation from its first user turn.
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          updatedAt: new Date(),
          ...(conversation.messages.length === 0
            ? { title: truncate(args.dto.content, 60) }
            : {}),
        },
      });

      return created;
    });

    return { userMessage, assistantMessage, provider: result.provider };
  }

  /** Loads the asset body when the caller referenced one instead of pasting text. */
  private async resolveSource(
    organizationId: string,
    dto: SendMessageDto,
  ): Promise<string | undefined> {
    if (dto.sourceContent) return dto.sourceContent;
    if (!dto.assetId) return undefined;

    const asset = await this.prisma.contentAsset.findFirst({
      where: { id: dto.assetId, project: { organizationId } },
      select: { body: true },
    });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset.body;
  }

  private async assertProject(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }

  /**
   * Grounds the assistant in the caller's own workspace. Scoped to the
   * conversation's project when it has one, so a focused chat is not distracted
   * by unrelated work.
   */
  private async buildContext(
    organizationId: string,
    projectId: string | null,
  ): Promise<ChatContext> {
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, organizationId },
        select: { name: true, topic: true, audience: true, goal: true, tone: true },
      });
      if (!project) return { projectNames: [] };
      return {
        projectNames: [project.name],
        brief: [
          `Project: ${project.name}`,
          `Topic: ${project.topic}`,
          project.audience ? `Audience: ${project.audience}` : null,
          project.goal ? `Goal: ${project.goal}` : null,
          project.tone ? `Tone: ${project.tone}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      };
    }

    const projects = await this.prisma.project.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: { name: true },
    });
    return { projectNames: projects.map((p) => p.name) };
  }

  private async recentHistory(conversationId: string): Promise<LlmMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    return rows
      .reverse()
      .map((r) => ({ role: r.role === 'USER' ? 'user' : 'assistant', content: r.content }));
  }

  private systemPrompt(action: ChatAction, context: ChatContext): string {
    return [
      'You are the ContentFlow AI assistant. You help marketers plan, write and refine',
      'content for social platforms. Be concrete and concise; never invent statistics.',
      '',
      ACTION_INSTRUCTIONS[action],
      context.brief ? `\nThe user is working on:\n${context.brief}` : '',
      context.projectNames.length && !context.brief
        ? `\nThe user's projects: ${context.projectNames.join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /**
   * The tagged blocks are load-bearing: the offline provider parses them to
   * decide what to operate on. Keep the tag names in sync with local/chat.ts.
   */
  private renderMessages(
    history: LlmMessage[],
    dto: SendMessageDto,
    sourceContent: string | undefined,
    context: ChatContext,
  ): LlmMessage[] {
    const parts = [dto.content];
    if (sourceContent) parts.push(`<content>${sourceContent}</content>`);
    if (dto.target) parts.push(`<target>${dto.target}</target>`);
    if (context.projectNames.length) {
      parts.push(`<projects>${context.projectNames.join(', ')}</projects>`);
    }

    // History already ends with the user turn we just stored; replace its bare
    // text with the tagged render so the provider sees the full instruction.
    const prior = history.slice(0, -1);
    return [...prior, { role: 'user', content: parts.join('\n\n') }];
  }
}

function truncate(s: string, n: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length <= n ? clean : `${clean.slice(0, n - 1)}…`;
}
