import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type AssetStatus, type Platform } from '@prisma/client';
import { PLATFORM_LIMITS } from '@contentflow/shared';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    params: {
      projectId?: string;
      runId?: string;
      platform?: Platform;
      status?: AssetStatus;
      skip?: number;
      take?: number;
    },
  ) {
    const where: Prisma.ContentAssetWhereInput = {
      project: { organizationId },
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.runId ? { runId: params.runId } : {}),
      ...(params.platform ? { platform: params.platform } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contentAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 200),
        include: {
          _count: { select: { comments: true, versions: true } },
          schedules: { select: { id: true, scheduledFor: true, status: true } },
        },
      }),
      this.prisma.contentAsset.count({ where }),
    ]);

    return { items, total, skip: params.skip ?? 0, take: params.take ?? 50 };
  }

  async findOne(organizationId: string, id: string) {
    const asset = await this.prisma.contentAsset.findFirst({
      where: { id, project: { organizationId } },
      include: {
        versions: { orderBy: { version: 'desc' }, take: 20 },
        comments: {
          where: { parentId: null },
          orderBy: { createdAt: 'desc' },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
            replies: {
              orderBy: { createdAt: 'asc' },
              include: { author: { select: { id: true, name: true, avatarUrl: true } } },
            },
          },
        },
        schedules: true,
        project: { select: { id: true, name: true } },
      },
    });
    if (!asset) throw new NotFoundException('Content asset not found');
    return asset;
  }

  /**
   * ContentVersion holds every version of the body, including the current one:
   * version 1 is written when the pipeline materializes the asset, and each
   * edit appends the next version. `asset.version` always points at the latest,
   * so history is complete and restoring is just another append.
   */
  async update(
    organizationId: string,
    id: string,
    userId: string,
    dto: { title?: string; body?: string; hashtags?: string[]; status?: AssetStatus; changeNote?: string },
  ) {
    const existing = await this.prisma.contentAsset.findFirst({
      where: { id, project: { organizationId } },
    });
    if (!existing) throw new NotFoundException('Content asset not found');

    const bodyChanged = dto.body !== undefined && dto.body !== existing.body;

    return this.prisma.$transaction(async (tx) => {
      if (!bodyChanged) {
        return tx.contentAsset.update({
          where: { id },
          data: { title: dto.title, hashtags: dto.hashtags, status: dto.status },
        });
      }

      // Guard against a gap if an earlier write left history ahead of the asset.
      const latest = await tx.contentVersion.findFirst({
        where: { assetId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const nextVersion = Math.max(existing.version, latest?.version ?? 0) + 1;

      await tx.contentVersion.create({
        data: {
          assetId: id,
          version: nextVersion,
          body: dto.body!,
          bodyJson: existing.bodyJson ?? Prisma.JsonNull,
          changeNote: dto.changeNote ?? 'Edited in workspace',
          authorId: userId,
        },
      });

      return tx.contentAsset.update({
        where: { id },
        data: {
          title: dto.title,
          body: dto.body,
          hashtags: dto.hashtags,
          status: dto.status,
          version: nextVersion,
          characterCount: dto.body!.length,
        },
      });
    });
  }

  async restoreVersion(organizationId: string, id: string, version: number, userId: string) {
    const asset = await this.prisma.contentAsset.findFirst({
      where: { id, project: { organizationId } },
    });
    if (!asset) throw new NotFoundException('Content asset not found');

    const snapshot = await this.prisma.contentVersion.findUnique({
      where: { assetId_version: { assetId: id, version } },
    });
    if (!snapshot) throw new NotFoundException(`Version ${version} not found`);

    return this.update(organizationId, id, userId, {
      body: snapshot.body,
      changeNote: `Restored from version ${version}`,
    });
  }

  async addComment(
    organizationId: string,
    assetId: string,
    userId: string,
    dto: { body: string; parentId?: string; mentions?: string[] },
  ) {
    const asset = await this.prisma.contentAsset.findFirst({
      where: { id: assetId, project: { organizationId } },
      select: { id: true },
    });
    if (!asset) throw new NotFoundException('Content asset not found');

    const comment = await this.prisma.comment.create({
      data: {
        assetId,
        authorId: userId,
        body: dto.body,
        parentId: dto.parentId,
        mentions: dto.mentions ?? [],
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    if (dto.mentions?.length) {
      await this.prisma.notification.createMany({
        data: dto.mentions.map((userIdMentioned) => ({
          userId: userIdMentioned,
          kind: 'COMMENT_MENTION' as const,
          title: 'You were mentioned in a comment',
          body: dto.body.slice(0, 200),
          link: `/assets/${assetId}`,
        })),
        skipDuplicates: true,
      });
    }

    return comment;
  }

  async resolveComment(organizationId: string, commentId: string) {
    const comment = await this.prisma.comment.findFirst({
      where: { id: commentId, asset: { project: { organizationId } } },
      select: { id: true, resolved: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { resolved: !comment.resolved },
    });
  }

  /** Flags assets that exceed their platform's hard character limit. */
  async validatePlatformLimits(organizationId: string, projectId: string) {
    const assets = await this.prisma.contentAsset.findMany({
      where: { projectId, project: { organizationId } },
      select: { id: true, slug: true, platform: true, characterCount: true },
    });

    return assets
      .map((asset) => {
        const limit = PLATFORM_LIMITS[asset.platform as keyof typeof PLATFORM_LIMITS];
        if (!limit || asset.characterCount <= limit.maxChars) return null;
        return {
          assetId: asset.id,
          slug: asset.slug,
          platform: asset.platform,
          characterCount: asset.characterCount,
          maxChars: limit.maxChars,
          over: asset.characterCount - limit.maxChars,
        };
      })
      .filter(Boolean);
  }
}
