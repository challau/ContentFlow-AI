import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import IORedis, { type RedisOptions } from 'ioredis';
import type { Env } from '../../common/config/env';

// BullMQ rejects ':' in queue names — it is the key separator in Redis.
export const PIPELINE_QUEUE = 'contentflow-pipeline';
export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

export function redisOptions(config: ConfigService<Env, true>): RedisOptions {
  return {
    host: config.get('REDIS_HOST', { infer: true }),
    port: config.get('REDIS_PORT', { infer: true }),
    password: config.get('REDIS_PASSWORD', { infer: true }) || undefined,
    db: config.get('REDIS_DB', { infer: true }),
    // BullMQ requires this to be null so blocking commands are not aborted.
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

export function createRedis(config: ConfigService<Env, true>): IORedis {
  const logger = new Logger('Redis');
  const client = new IORedis(redisOptions(config));
  client.on('error', (err) => logger.error(`Redis error: ${err.message}`));
  client.on('connect', () => logger.log('Connected to Redis'));
  return client;
}
