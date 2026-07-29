import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/providers/llm.service';
import { PipelineQueue } from '../../orchestrator/queue/pipeline.queue';

const PROBE_TIMEOUT_MS = 3_000;

/**
 * Bounds a dependency check.
 *
 * ioredis is configured with `maxRetriesPerRequest: null` for BullMQ, which
 * makes commands queue forever instead of rejecting — so an unreachable Redis
 * would hang this endpoint indefinitely rather than reporting itself down.
 */
function withTimeout<T>(work: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_resolve, reject) =>
      setTimeout(
        () => reject(new Error(`${label} check timed out after ${PROBE_TIMEOUT_MS}ms`)),
        PROBE_TIMEOUT_MS,
      ).unref(),
    ),
  ]);
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly queue: PipelineQueue,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return { status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — checks database, queue and LLM provider' })
  async ready(@Res({ passthrough: true }) res: Response) {
    const checks: Record<string, { status: 'up' | 'down'; detail?: string }> = {};

    try {
      await withTimeout(this.prisma.ping(), 'database');
      checks.database = { status: 'up' };
    } catch (error) {
      checks.database = { status: 'down', detail: (error as Error).message };
    }

    try {
      const counts = await withTimeout(this.queue.stats(), 'queue');
      checks.queue = { status: 'up', detail: JSON.stringify(counts) };
    } catch (error) {
      checks.queue = { status: 'down', detail: (error as Error).message };
    }

    checks.llm = {
      status: 'up',
      detail: `${this.llm.activeProvider}${this.llm.isLive() ? '' : ' (offline synthesis)'}`,
    };

    const healthy = Object.values(checks).every((c) => c.status === 'up');

    // Probes key off the status code, so a degraded dependency must not be a
    // 200. Set it directly rather than throwing, which would let the exception
    // filter replace the per-check detail with a generic error body.
    res.status(healthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return { status: healthy ? 'ok' : 'degraded', checks };
  }
}
