import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Dashboard rollup: projects, runs, credits and recent activity' })
  async overview(@CurrentUser() user: AuthenticatedUser) {
    const orgId = user.organizationId;
    const scope = { project: { organizationId: orgId } };

    const [
      organization,
      projectCount,
      runCount,
      assetCount,
      runStatuses,
      recentProjects,
      recentRuns,
      tokenTotals,
      assetsByPlatform,
      unreadNotifications,
    ] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: orgId },
        select: { id: true, name: true, plan: true, credits: true },
      }),
      this.prisma.project.count({ where: { organizationId: orgId, archivedAt: null } }),
      this.prisma.pipelineRun.count({ where: scope }),
      this.prisma.contentAsset.count({ where: scope }),
      this.prisma.pipelineRun.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.project.findMany({
        where: { organizationId: orgId, archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          name: true,
          topic: true,
          updatedAt: true,
          _count: { select: { runs: true, assets: true } },
        },
      }),
      this.prisma.pipelineRun.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          status: true,
          progress: true,
          createdAt: true,
          durationMs: true,
          costUsd: true,
          project: { select: { id: true, name: true } },
        },
      }),
      this.prisma.pipelineRun.aggregate({
        where: scope,
        _sum: { tokensIn: true, tokensOut: true, costUsd: true },
      }),
      this.prisma.contentAsset.groupBy({
        by: ['platform'],
        where: scope,
        _count: { _all: true },
      }),
      this.prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return {
      organization,
      counts: {
        projects: projectCount,
        runs: runCount,
        assets: assetCount,
        unreadNotifications,
      },
      runsByStatus: Object.fromEntries(runStatuses.map((r) => [r.status, r._count._all])),
      assetsByPlatform: Object.fromEntries(
        assetsByPlatform.map((a) => [a.platform, a._count._all]),
      ),
      usage: {
        tokensIn: tokenTotals._sum.tokensIn ?? 0,
        tokensOut: tokenTotals._sum.tokensOut ?? 0,
        costUsd: Number(tokenTotals._sum.costUsd ?? 0),
      },
      recentProjects,
      recentRuns,
    };
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Predicted and recorded metrics for a project' })
  async analytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('projectId') projectId?: string,
  ) {
    const where = {
      project: { organizationId: user.organizationId },
      ...(projectId ? { projectId } : {}),
    };

    const [records, byPlatform] = await Promise.all([
      this.prisma.analyticsRecord.findMany({
        where,
        orderBy: { recordedFor: 'desc' },
        take: 200,
        select: {
          id: true,
          metric: true,
          value: true,
          unit: true,
          platform: true,
          dimension: true,
          recordedFor: true,
          source: true,
        },
      }),
      this.prisma.analyticsRecord.groupBy({
        by: ['platform', 'metric'],
        where,
        _avg: { value: true },
        _count: { _all: true },
      }),
    ]);

    return {
      records,
      summary: byPlatform.map((row) => ({
        platform: row.platform,
        metric: row.metric,
        average: Number(row._avg.value ?? 0),
        samples: row._count._all,
      })),
    };
  }

  @Get('credits')
  @ApiOperation({ summary: 'AI credit balance and recent ledger entries' })
  async credits(@CurrentUser() user: AuthenticatedUser) {
    const [organization, transactions] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: user.organizationId },
        select: { credits: true, plan: true },
      }),
      this.prisma.creditTransaction.findMany({
        where: { organizationId: user.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    return { balance: organization.credits, plan: organization.plan, transactions };
  }
}
