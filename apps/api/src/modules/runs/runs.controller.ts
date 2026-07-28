import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AGENT_KINDS, type AgentKind } from '@contentflow/shared';
import { BadRequestException } from '@nestjs/common';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { OrchestratorService } from '../../orchestrator/orchestrator.service';
import { PipelineQueue } from '../../orchestrator/queue/pipeline.queue';

@ApiTags('runs')
@ApiBearerAuth()
@Controller('runs')
export class RunsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orchestrator: OrchestratorService,
    private readonly queue: PipelineQueue,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List runs for the organization' })
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
    @Query('skip', new ParseIntPipe({ optional: true })) skip = 0,
    @Query('take', new ParseIntPipe({ optional: true })) take = 20,
  ) {
    const where = {
      project: { organizationId: user.organizationId },
      ...(projectId ? { projectId } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.pipelineRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: Math.min(take, 100),
        select: {
          id: true,
          status: true,
          progress: true,
          totalAgents: true,
          tokensIn: true,
          tokensOut: true,
          costUsd: true,
          durationMs: true,
          createdAt: true,
          finishedAt: true,
          provider: true,
          model: true,
          project: { select: { id: true, name: true } },
          triggeredBy: { select: { id: true, name: true } },
        },
      }),
      this.prisma.pipelineRun.count({ where }),
    ]);

    return { items, total, skip, take };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a run with per-agent execution status' })
  async findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id, project: { organizationId: user.organizationId } },
      include: {
        executions: { orderBy: { createdAt: 'asc' } },
        project: { select: { id: true, name: true, topic: true } },
        pipeline: { select: { id: true, name: true } },
        _count: { select: { assets: true } },
      },
    });
    if (!run) throw new NotFoundException('Run not found');
    return run;
  }

  @Get(':id/executions/:agent')
  @ApiOperation({ summary: 'Get one agent execution including its full output' })
  async execution(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('agent') agent: string,
  ) {
    const kind = this.parseAgent(agent);
    const execution = await this.prisma.agentExecution.findFirst({
      where: {
        runId: id,
        agentKind: kind,
        run: { project: { organizationId: user.organizationId } },
      },
    });
    if (!execution) throw new NotFoundException('Execution not found');
    return execution;
  }

  @Post(':id/cancel')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({ summary: 'Cancel a queued or running pipeline' })
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertRun(user.organizationId, id);
    await this.queue.cancel(id);
    await this.orchestrator.cancelRun(id);
    return { id, status: 'CANCELLED' };
  }

  @Post(':id/agents/:agent/rerun')
  @Roles('OWNER', 'ADMIN', 'EDITOR')
  @ApiOperation({
    summary: 'Re-run a single agent against the outputs already stored on this run',
  })
  async rerun(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('agent') agent: string,
  ) {
    await this.assertRun(user.organizationId, id);
    const kind = this.parseAgent(agent);
    const output = await this.orchestrator.rerunAgent(id, kind);
    return { runId: id, agent: kind, output };
  }

  private parseAgent(value: string): AgentKind {
    const kind = value.toUpperCase() as AgentKind;
    if (!AGENT_KINDS.includes(kind)) {
      throw new BadRequestException(
        `Unknown agent "${value}". Expected one of: ${AGENT_KINDS.join(', ')}`,
      );
    }
    return kind;
  }

  private async assertRun(organizationId: string, id: string): Promise<void> {
    const run = await this.prisma.pipelineRun.findFirst({
      where: { id, project: { organizationId } },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Run not found');
  }
}
