import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type AgentKind as PrismaAgentKind } from '@prisma/client';
import {
  pipelineInputSchema,
  type AgentKind,
  type AgentOutputMap,
  type PipelineInput,
} from '@contentflow/shared';
import type { Env } from '../common/config/env';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../ai/providers/llm.service';
import type { BrandContext } from '../ai/agents/agent.types';
import { AssetMaterializerService } from './asset-materializer.service';
import { PipelineEngineService } from './pipeline-engine.service';
import { PipelineEventBus } from './pipeline-events.service';
import { buildGraph, validateGraph, type AgentGraph } from './dag';

export interface StartRunArgs {
  pipelineId: string;
  userId: string;
  organizationId: string;
  campaignId?: string | null;
  /** Overrides the project's stored brief for this run only. */
  inputOverride?: Partial<PipelineInput>;
}

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: PipelineEngineService,
    private readonly materializer: AssetMaterializerService,
    private readonly events: PipelineEventBus,
    private readonly llm: LlmService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Creates the run row and its per-agent execution rows up front, so a client
   * polling immediately sees the full agent list rather than an empty run.
   */
  async createRun(args: StartRunArgs): Promise<{ runId: string; agents: AgentKind[] }> {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id: args.pipelineId, project: { organizationId: args.organizationId } },
      include: { project: { include: { brandKit: true } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');

    const graph = this.resolveGraph(pipeline.graph);
    const agents = Object.keys(graph) as AgentKind[];
    const input = this.resolveInput(pipeline.project, args.inputOverride);

    const cost = this.config.get('RUN_COST_CREDITS', { infer: true });
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: args.organizationId },
      select: { credits: true },
    });
    if (org.credits < cost) {
      throw new BadRequestException(
        `Insufficient AI credits: ${org.credits} available, ${cost} required`,
      );
    }

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pipelineRun.create({
        data: {
          pipelineId: pipeline.id,
          projectId: pipeline.projectId,
          triggeredById: args.userId,
          status: 'QUEUED',
          input: input as unknown as Prisma.InputJsonValue,
          totalAgents: agents.length,
          provider: this.llm.activeProvider,
          model: this.config.get('LLM_MODEL', { infer: true }),
        },
      });

      await tx.agentExecution.createMany({
        data: agents.map((kind) => ({
          runId: created.id,
          agentKind: kind as PrismaAgentKind,
          status: 'PENDING' as const,
        })),
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
          reason: 'PIPELINE_RUN',
          description: `Pipeline run for ${pipeline.project.name}`,
          referenceId: created.id,
        },
      });

      return created;
    });

    return { runId: run.id, agents };
  }

  /** Executes a previously created run. Safe to call from an HTTP request or a worker. */
  async executeRun(runId: string, signal?: AbortSignal): Promise<void> {
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        pipeline: true,
        project: { include: { brandKit: true } },
      },
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status === 'RUNNING') {
      throw new BadRequestException(`Run ${runId} is already running`);
    }

    const graph = this.resolveGraph(run.pipeline.graph);
    const input = pipelineInputSchema.parse(run.input);
    const brand = toBrandContext(run.project.brandKit);
    const startedAt = new Date();

    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt, progress: 0 },
    });

    this.events.publish(runId, {
      type: 'run.started',
      runId,
      pipelineId: run.pipelineId,
      totalAgents: Object.keys(graph).length,
      at: startedAt.toISOString(),
    });

    try {
      const result = await this.engine.execute({
        input,
        brand,
        graph,
        concurrency: this.config.get('AGENT_CONCURRENCY', { infer: true }),
        signal,
        hooks: {
          onAgentStart: async (kind) => {
            const exec = await this.upsertExecution(runId, kind, {
              status: 'RUNNING',
              startedAt: new Date(),
              attempt: { increment: 1 },
            });
            this.events.publish(runId, {
              type: 'agent.status',
              runId,
              executionId: exec.id,
              agent: kind,
              status: 'RUNNING',
              attempt: exec.attempt,
              at: new Date().toISOString(),
            });
          },
          onAgentSuccess: async (r) => {
            const exec = await this.upsertExecution(runId, r.kind, {
              status: 'COMPLETED',
              finishedAt: new Date(),
              durationMs: r.durationMs,
              output: r.output as unknown as Prisma.InputJsonValue,
              rawResponse: r.raw.slice(0, 100_000),
              promptTokens: r.promptTokens,
              outputTokens: r.outputTokens,
              costUsd: new Prisma.Decimal(r.costUsd),
              model: r.model,
              provider: r.provider,
              error: null,
            });
            this.events.publish(runId, {
              type: 'agent.status',
              runId,
              executionId: exec.id,
              agent: r.kind,
              status: 'COMPLETED',
              attempt: exec.attempt,
              durationMs: r.durationMs,
              tokensIn: r.promptTokens,
              tokensOut: r.outputTokens,
              at: new Date().toISOString(),
            });
          },
          onAgentFailure: async (kind, error) => {
            const exec = await this.upsertExecution(runId, kind, {
              status: 'FAILED',
              finishedAt: new Date(),
              error: error.message.slice(0, 4000),
            });
            this.events.publish(runId, {
              type: 'agent.status',
              runId,
              executionId: exec.id,
              agent: kind,
              status: 'FAILED',
              attempt: exec.attempt,
              error: error.message,
              at: new Date().toISOString(),
            });
          },
          onAgentSkipped: async (kind, reason) => {
            const exec = await this.upsertExecution(runId, kind, {
              status: 'SKIPPED',
              finishedAt: new Date(),
              error: reason,
            });
            this.events.publish(runId, {
              type: 'agent.status',
              runId,
              executionId: exec.id,
              agent: kind,
              status: 'SKIPPED',
              attempt: exec.attempt,
              error: reason,
              at: new Date().toISOString(),
            });
          },
          onProgress: async (completed, total) => {
            const percent = Math.round((completed / total) * 100);
            await this.prisma.pipelineRun.update({
              where: { id: runId },
              data: { progress: percent },
            });
            this.events.publish(runId, {
              type: 'run.progress',
              runId,
              completed,
              total,
              percent,
              at: new Date().toISOString(),
            });
          },
        },
      });

      const materialized = await this.materializer.materialize({
        runId,
        projectId: run.projectId,
        campaignId: null,
        outputs: result.outputs,
      });

      const status = result.failures.length > 0 ? 'FAILED' : 'COMPLETED';
      const finishedAt = new Date();

      await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status,
          finishedAt,
          durationMs: result.totals.durationMs,
          progress: 100,
          tokensIn: result.totals.promptTokens,
          tokensOut: result.totals.outputTokens,
          costUsd: new Prisma.Decimal(result.totals.costUsd),
          output: {
            summary: {
              agentsCompleted: result.results.length,
              agentsFailed: result.failures.length,
              agentsSkipped: result.skipped.length,
              ...materialized,
            },
            outputs: result.outputs,
          } as unknown as Prisma.InputJsonValue,
          error:
            result.failures.length > 0
              ? result.failures.map((f) => `${f.kind}: ${f.error}`).join('; ').slice(0, 4000)
              : null,
        },
      });

      await this.notify(run.triggeredById, runId, status, run.project.name);

      this.events.publish(runId, {
        type: 'run.finished',
        runId,
        status,
        durationMs: result.totals.durationMs,
        totalTokensIn: result.totals.promptTokens,
        totalTokensOut: result.totals.outputTokens,
        totalCostUsd: result.totals.costUsd,
        at: finishedAt.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Run ${runId} aborted: ${message}`);

      await this.prisma.pipelineRun.update({
        where: { id: runId },
        data: {
          status: signal?.aborted ? 'CANCELLED' : 'FAILED',
          finishedAt: new Date(),
          error: message.slice(0, 4000),
        },
      });

      this.events.publish(runId, {
        type: 'run.finished',
        runId,
        status: signal?.aborted ? 'CANCELLED' : 'FAILED',
        durationMs: Date.now() - startedAt.getTime(),
        totalTokensIn: 0,
        totalTokensOut: 0,
        totalCostUsd: 0,
        at: new Date().toISOString(),
      });

      throw error;
    }
  }

  /** Re-runs one agent against the outputs already stored on the run. */
  async rerunAgent(runId: string, kind: AgentKind): Promise<AgentOutputMap[AgentKind]> {
    const run = await this.prisma.pipelineRun.findUnique({
      where: { id: runId },
      include: {
        project: { include: { brandKit: true } },
        executions: true,
      },
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);

    const outputs: Partial<AgentOutputMap> = {};
    for (const exec of run.executions) {
      if (exec.status === 'COMPLETED' && exec.output && exec.agentKind !== kind) {
        (outputs as Record<string, unknown>)[exec.agentKind] = exec.output;
      }
    }

    const result = await this.engine.execute({
      input: pipelineInputSchema.parse(run.input),
      brand: toBrandContext(run.project.brandKit),
      graph: { [kind]: [] },
      seedOutputs: outputs,
      continueOnError: false,
      hooks: {
        onAgentSuccess: async (r) => {
          await this.upsertExecution(runId, r.kind, {
            status: 'COMPLETED',
            finishedAt: new Date(),
            durationMs: r.durationMs,
            output: r.output as unknown as Prisma.InputJsonValue,
            rawResponse: r.raw.slice(0, 100_000),
            promptTokens: r.promptTokens,
            outputTokens: r.outputTokens,
            costUsd: new Prisma.Decimal(r.costUsd),
            model: r.model,
            provider: r.provider,
            error: null,
          });
        },
      },
    });

    const output = result.outputs[kind];
    if (!output) {
      throw new BadRequestException(
        result.failures[0]?.error ?? `Agent ${kind} produced no output`,
      );
    }
    return output;
  }

  async cancelRun(runId: string): Promise<void> {
    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: { status: 'CANCELLED', finishedAt: new Date() },
    });
  }

  private async upsertExecution(
    runId: string,
    kind: AgentKind,
    data: Prisma.AgentExecutionUncheckedUpdateInput,
  ) {
    return this.prisma.agentExecution.upsert({
      where: { runId_agentKind: { runId, agentKind: kind as PrismaAgentKind } },
      update: data,
      create: {
        runId,
        agentKind: kind as PrismaAgentKind,
        status: 'PENDING',
      },
    });
  }

  private async notify(
    userId: string,
    runId: string,
    status: string,
    projectName: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: {
        userId,
        kind: status === 'COMPLETED' ? 'RUN_COMPLETED' : 'RUN_FAILED',
        title:
          status === 'COMPLETED'
            ? `Pipeline finished for ${projectName}`
            : `Pipeline failed for ${projectName}`,
        body:
          status === 'COMPLETED'
            ? 'Your content is ready to review.'
            : 'One or more agents failed. Open the run to see details.',
        link: `/runs/${runId}`,
      },
    });
  }

  private resolveGraph(stored: Prisma.JsonValue): AgentGraph {
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const record = stored as Record<string, unknown>;
      // A builder-authored graph stores { nodes: [...], edges: [...] }.
      if (Array.isArray(record.nodes)) {
        const nodes = (record.nodes as Array<{ agentKind?: string }>)
          .map((n) => n.agentKind)
          .filter(Boolean) as AgentKind[];
        const graph = buildGraph(nodes);
        validateGraph(graph);
        return graph;
      }
      // Or a plain adjacency map.
      const graph = record as AgentGraph;
      if (Object.keys(graph).length > 0) {
        validateGraph(graph);
        return graph;
      }
    }
    return buildGraph(ALL_AGENT_KINDS);
  }

  private resolveInput(
    project: { topic: string; audience: string | null; goal: string | null; tone: string | null; language: string; sourceKind: string; sourceUrl: string | null; targetPlatforms: string[] },
    override?: Partial<PipelineInput>,
  ): PipelineInput {
    return pipelineInputSchema.parse({
      topic: override?.topic ?? project.topic,
      sourceKind: override?.sourceKind ?? project.sourceKind,
      sourceUrl: override?.sourceUrl ?? project.sourceUrl ?? undefined,
      audience: override?.audience ?? project.audience ?? undefined,
      goal: override?.goal ?? project.goal ?? undefined,
      tone: override?.tone ?? project.tone ?? undefined,
      language: override?.language ?? project.language,
      platforms:
        override?.platforms ??
        (project.targetPlatforms.length > 0 ? project.targetPlatforms : undefined),
      extraContext: override?.extraContext,
    });
  }
}

function toBrandContext(
  kit: {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    headingFont: string;
    bodyFont: string;
    toneOfVoice: string | null;
    writingGuidelines: string | null;
    bannedWords: string[];
  } | null,
): BrandContext | null {
  if (!kit) return null;
  return {
    name: kit.name,
    primaryColor: kit.primaryColor,
    secondaryColor: kit.secondaryColor,
    accentColor: kit.accentColor,
    headingFont: kit.headingFont,
    bodyFont: kit.bodyFont,
    toneOfVoice: kit.toneOfVoice,
    writingGuidelines: kit.writingGuidelines,
    bannedWords: kit.bannedWords,
  };
}

const ALL_AGENT_KINDS: AgentKind[] = [
  'RESEARCH',
  'STRATEGY',
  'PLANNER',
  'COPYWRITING',
  'SCRIPT',
  'CAROUSEL',
  'CREATIVE',
  'VIDEO',
  'SEO',
  'PUBLISHING',
  'ENGAGEMENT',
  'ANALYTICS',
  'FINAL_REVIEW',
];
