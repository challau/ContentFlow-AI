/**
 * Standalone pipeline worker.
 *
 * Runs the BullMQ consumer without an HTTP listener, so API pods and worker
 * pods scale independently. The API sets WORKER_ENABLED=false in that topology.
 */
import 'reflect-metadata';
import { Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppConfigModule } from './common/config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { AiModule } from './ai/ai.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';

@Module({
  imports: [AppConfigModule, PrismaModule, AiModule, OrchestratorModule],
})
class WorkerModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('worker');
  // The worker is registered by OrchestratorModule's onModuleInit.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();

  logger.log('ContentFlow AI pipeline worker started');

  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, draining in-flight runs…`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Worker failed to start:', error);
  process.exit(1);
});
