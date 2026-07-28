import { Module } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { OrchestratorModule } from '../../orchestrator/orchestrator.module';
import { HealthController } from './health.controller';

@Module({
  imports: [AiModule, OrchestratorModule],
  controllers: [HealthController],
})
export class HealthModule {}
