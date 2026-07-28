import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker, type Job } from 'bullmq';
import type { Env } from '../../common/config/env';
import { OrchestratorService } from '../orchestrator.service';
import { PIPELINE_QUEUE, redisOptions } from './redis.provider';
import type { PipelineJobData } from './pipeline.queue';

/**
 * Consumes queued runs. Started in-process by default so a single `npm run dev`
 * is fully functional; set WORKER_ENABLED=false to run workers separately.
 */
@Injectable()
export class PipelineWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineWorker.name);
  private worker?: Worker<PipelineJobData>;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly orchestrator: OrchestratorService,
  ) {}

  onModuleInit(): void {
    if (process.env.WORKER_ENABLED === 'false') {
      this.logger.log('Worker disabled by WORKER_ENABLED=false');
      return;
    }

    this.worker = new Worker<PipelineJobData>(
      PIPELINE_QUEUE,
      async (job: Job<PipelineJobData>) => {
        this.logger.log(`Processing run ${job.data.runId} (attempt ${job.attemptsMade + 1})`);
        await this.orchestrator.executeRun(job.data.runId);
      },
      {
        connection: redisOptions(this.config),
        concurrency: this.config.get('PIPELINE_CONCURRENCY', { infer: true }),
      },
    );

    this.worker.on('completed', (job) => this.logger.log(`Run ${job.data.runId} completed`));
    this.worker.on('failed', (job, err) =>
      this.logger.error(`Run ${job?.data.runId} failed: ${err.message}`),
    );
    this.worker.on('error', (err) => this.logger.error(`Worker error: ${err.message}`));

    this.logger.log(`Pipeline worker listening on "${PIPELINE_QUEUE}"`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
