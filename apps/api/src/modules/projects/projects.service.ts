import { Injectable, NotFoundException } from '@nestjs/common';
import { AGENT_KINDS, DEFAULT_AGENT_GRAPH, type Platform } from '@contentflow/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateProjectDto) {
    // Fall back to the org's default brand kit so runs always have brand context.
    const brandKitId =
      dto.brandKitId ??
      (
        await this.prisma.brandKit.findFirst({
          where: { organizationId, isDefault: true },
          select: { id: true },
        })
      )?.id;

    const project = await this.prisma.project.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        topic: dto.topic,
        sourceKind: dto.sourceKind ?? 'TOPIC',
        sourceUrl: dto.sourceUrl,
        audience: dto.audience,
        goal: dto.goal,
        tone: dto.tone,
        language: dto.language ?? 'English',
        targetPlatforms: (dto.targetPlatforms ?? []) as Platform[],
        brandKitId,
        teamId: dto.teamId,
      },
    });

    // Every project gets a runnable default pipeline immediately.
    await this.prisma.pipeline.create({
      data: {
        projectId: project.id,
        createdById: userId,
        name: 'Full Campaign Pipeline',
        description: 'All 13 agents in the default dependency order',
        graph: buildDefaultGraphJson(),
      },
    });

    return this.findOne(organizationId, project.id);
  }

  async findAll(organizationId: string, params: { skip?: number; take?: number; search?: string }) {
    const where: Prisma.ProjectWhereInput = {
      organizationId,
      archivedAt: null,
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { topic: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 20, 100),
        include: {
          _count: { select: { runs: true, assets: true, campaigns: true } },
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, status: true, progress: true, createdAt: true },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, skip: params.skip ?? 0, take: params.take ?? 20 };
  }

  async findOne(organizationId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, organizationId },
      include: {
        brandKit: true,
        team: true,
        pipelines: { orderBy: { createdAt: 'asc' } },
        _count: { select: { runs: true, assets: true, campaigns: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(organizationId: string, id: string, dto: UpdateProjectDto) {
    await this.assertExists(organizationId, id);
    await this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        targetPlatforms: dto.targetPlatforms as Platform[] | undefined,
      },
    });
    return this.findOne(organizationId, id);
  }

  /** Soft delete: runs and assets stay queryable for audit. */
  async archive(organizationId: string, id: string) {
    await this.assertExists(organizationId, id);
    await this.prisma.project.update({
      where: { id },
      data: { archivedAt: new Date() },
    });
    return { id, archived: true };
  }

  private async assertExists(organizationId: string, id: string): Promise<void> {
    const found = await this.prisma.project.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Project not found');
  }
}

/** The visual builder's node/edge representation of the default graph. */
export function buildDefaultGraphJson(): Prisma.InputJsonValue {
  const nodes = AGENT_KINDS.map((kind, index) => ({
    id: kind,
    agentKind: kind,
    position: { x: (index % 4) * 260, y: Math.floor(index / 4) * 180 },
  }));

  const edges = AGENT_KINDS.flatMap((kind) =>
    (DEFAULT_AGENT_GRAPH[kind] ?? []).map((dep) => ({
      id: `${dep}->${kind}`,
      source: dep,
      target: kind,
    })),
  );

  return { nodes, edges } as unknown as Prisma.InputJsonValue;
}
