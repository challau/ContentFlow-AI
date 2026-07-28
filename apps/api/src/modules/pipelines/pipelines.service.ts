import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AGENT_KINDS, type AgentKind } from '@contentflow/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { buildGraph, validateGraph } from '../../orchestrator/dag';
import { listAgents } from '../../ai/agents/agent.registry';

export interface PipelineGraphInput {
  nodes: Array<{ id?: string; agentKind: AgentKind; position?: { x: number; y: number } }>;
  edges?: Array<{ source: AgentKind; target: AgentKind }>;
}

@Injectable()
export class PipelinesService {
  constructor(private readonly prisma: PrismaService) {}

  /** The agent catalogue the visual builder renders in its palette. */
  catalogue() {
    return listAgents().map((agent) => ({
      kind: agent.kind,
      label: agent.label,
      description: agent.description,
      dependsOn: agent.dependsOn,
    }));
  }

  async findAll(organizationId: string, projectId?: string) {
    return this.prisma.pipeline.findMany({
      where: {
        project: { organizationId },
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { runs: true } },
        runs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, status: true, progress: true, createdAt: true },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const pipeline = await this.prisma.pipeline.findFirst({
      where: { id, project: { organizationId } },
      include: { project: { select: { id: true, name: true, topic: true } } },
    });
    if (!pipeline) throw new NotFoundException('Pipeline not found');
    return pipeline;
  }

  async create(
    organizationId: string,
    userId: string,
    dto: { projectId: string; name: string; description?: string; graph: PipelineGraphInput },
  ) {
    await this.assertProject(organizationId, dto.projectId);
    const graph = this.normalizeGraph(dto.graph);

    return this.prisma.pipeline.create({
      data: {
        projectId: dto.projectId,
        createdById: userId,
        name: dto.name,
        description: dto.description,
        graph: graph as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: { name?: string; description?: string; graph?: PipelineGraphInput },
  ) {
    await this.findOne(organizationId, id);
    const data: Prisma.PipelineUpdateInput = {
      name: dto.name,
      description: dto.description,
    };

    if (dto.graph) {
      data.graph = this.normalizeGraph(dto.graph) as unknown as Prisma.InputJsonValue;
      // Editing the topology is a new version, not an in-place mutation.
      data.version = { increment: 1 };
    }

    return this.prisma.pipeline.update({ where: { id }, data });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    await this.prisma.pipeline.delete({ where: { id } });
    return { id, deleted: true };
  }

  /**
   * Validates a builder graph and stores it in node/edge form. Explicit edges
   * win; when a node has none, its default dependencies are used.
   */
  private normalizeGraph(input: PipelineGraphInput): PipelineGraphInput {
    if (!input?.nodes?.length) {
      throw new BadRequestException('A pipeline needs at least one agent node');
    }

    const kinds = input.nodes.map((n) => n.agentKind);
    for (const kind of kinds) {
      if (!AGENT_KINDS.includes(kind)) {
        throw new BadRequestException(`Unknown agent kind: ${kind}`);
      }
    }
    if (new Set(kinds).size !== kinds.length) {
      throw new BadRequestException('Each agent may appear at most once in a pipeline');
    }

    const adjacency = buildGraph(kinds);
    if (input.edges?.length) {
      for (const kind of kinds) adjacency[kind] = [];
      for (const edge of input.edges) {
        if (!kinds.includes(edge.source) || !kinds.includes(edge.target)) {
          throw new BadRequestException(
            `Edge ${edge.source} -> ${edge.target} references an agent not in this pipeline`,
          );
        }
        adjacency[edge.target] = [...(adjacency[edge.target] ?? []), edge.source];
      }
    }

    validateGraph(adjacency); // throws on cycles or unknown agents

    return {
      nodes: input.nodes.map((n, i) => ({
        id: n.id ?? n.agentKind,
        agentKind: n.agentKind,
        position: n.position ?? { x: (i % 4) * 260, y: Math.floor(i / 4) * 180 },
      })),
      edges: Object.entries(adjacency).flatMap(([target, sources]) =>
        (sources ?? []).map((source) => ({
          source: source as AgentKind,
          target: target as AgentKind,
        })),
      ),
    };
  }

  private async assertProject(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException('Project not found');
  }
}
