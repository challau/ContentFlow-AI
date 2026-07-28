import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import type { Env } from '../../common/config/env';
import { PIPELINE_QUEUE, redisOptions } from './redis.provider';

export interface PipelineJobData {
  runId: string;
  organizationId: string;
  userId: string;
}

@Injectable()
export class PipelineQueue implements OnModuleDestroy {
  private readonly logger = new Logger(PipelineQueue.name);
  private readonly queue: Queue<PipelineJobData>;
  private readonly events: QueueEvents;

  constructor(private readonly config: ConfigService<Env, true>) {
    const connection = redisOptions(config);
    this.queue = new Queue<PipelineJobData>(PIPELINE_QUEUE, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 86_400, count: 1_000 },
        removeOnFail: { age: 604_800 },
      },
    });
    this.events = new QueueEvents(PIPELINE_QUEUE, { connection });
    this.events.on('failed', ({ jobId, failedReason }) =>
      this.logger.error(`Job ${jobId} failed: ${failedReason}`),
    );
  }

  async enqueue(data: PipelineJobData): Promise<string> {
    const job = await this.queue.add('run', data, { jobId: `run-${data.runId}` });
    this.logger.log(`Enqueued run ${data.runId} as job ${job.id}`);
    return job.id ?? `run-${data.runId}`;
  }

  async cancel(runId: string): Promise<boolean> {
    const job = await this.queue.getJob(`run-${runId}`);
    if (!job) return false;
    await job.remove();
    return true;
  }

  async stats(): Promise<Record<string, number>> {
    return this.queue.getJobCounts('wait', 'active', 'completed', 'failed', 'delayed');
  }

  async onModuleDestroy(): Promise<void> {
    await this.events.close();
    await this.queue.close();
  }
}
