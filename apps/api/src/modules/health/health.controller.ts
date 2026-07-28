import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../../ai/providers/llm.service';
import { PipelineQueue } from '../../orchestrator/queue/pipeline.queue';

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
  async ready() {
    const checks: Record<string, { status: 'up' | 'down'; detail?: string }> = {};

    try {
      await this.prisma.ping();
      checks.database = { status: 'up' };
    } catch (error) {
      checks.database = { status: 'down', detail: (error as Error).message };
    }

    try {
      const counts = await this.queue.stats();
      checks.queue = { status: 'up', detail: JSON.stringify(counts) };
    } catch (error) {
      checks.queue = { status: 'down', detail: (error as Error).message };
    }

    checks.llm = {
      status: 'up',
      detail: `${this.llm.activeProvider}${this.llm.isLive() ? '' : ' (offline synthesis)'}`,
    };

    const healthy = Object.values(checks).every((c) => c.status === 'up');
    return { status: healthy ? 'ok' : 'degraded', checks };
  }
}
