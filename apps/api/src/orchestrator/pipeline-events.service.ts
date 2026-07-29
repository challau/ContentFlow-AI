import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import IORedis from 'ioredis';
import type { PipelineEvent } from '@contentflow/shared';
import type { Env } from '../common/config/env';
import { redisOptions } from './queue/redis.provider';
import { PipelineGateway } from './pipeline.gateway';

/** Redis pub/sub channel carrying run events between API and worker processes. */
export const PIPELINE_EVENT_CHANNEL = 'contentflow:pipeline-events';

interface EventEnvelope {
  runId: string;
  event: PipelineEvent;
}

/**
 * Fans run events out across processes.
 *
 * Runs execute in the worker process, but the WebSocket server lives in the API
 * process — so emitting straight to the gateway drops every event whenever the
 * two are split (the production topology). Publishing through Redis instead
 * lets whichever API process holds the client socket do the actual emit, and
 * keeps behaviour identical when the worker runs in-process.
 */
@Injectable()
export class PipelineEventBus implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PipelineEventBus.name);
  private readonly publisher: IORedis;
  private readonly subscriber: IORedis;

  constructor(
    config: ConfigService<Env, true>,
    private readonly gateway: PipelineGateway,
  ) {
    this.publisher = new IORedis(redisOptions(config));
    this.subscriber = new IORedis(redisOptions(config));
    for (const client of [this.publisher, this.subscriber]) {
      client.on('error', (err) => this.logger.error(`Redis error: ${err.message}`));
    }
  }

  async onModuleInit(): Promise<void> {
    // Worker processes have no socket server, so their emits are no-ops; the
    // subscription is still cheap and keeps this service topology-agnostic.
    await this.subscriber.subscribe(PIPELINE_EVENT_CHANNEL);
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const { runId, event } = JSON.parse(raw) as EventEnvelope;
        this.gateway.emitLocal(runId, event);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Discarded malformed pipeline event: ${message}`);
      }
    });
    this.logger.log(`Subscribed to "${PIPELINE_EVENT_CHANNEL}"`);
  }

  /**
   * Broadcasts an event to every subscribed API process. Fire-and-forget: a
   * dropped progress update must never fail the run that produced it.
   */
  publish(runId: string, event: PipelineEvent): void {
    const payload = JSON.stringify({ runId, event } satisfies EventEnvelope);
    this.publisher.publish(PIPELINE_EVENT_CHANNEL, payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to publish ${event.type} for run ${runId}: ${message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit().catch(() => undefined);
    await this.publisher.quit().catch(() => undefined);
  }
}
