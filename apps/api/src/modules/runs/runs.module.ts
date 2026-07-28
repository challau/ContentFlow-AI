import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../../orchestrator/orchestrator.module';
import { RunsController } from './runs.controller';

@Module({
  imports: [OrchestratorModule],
  controllers: [RunsController],
})
export class RunsModule {}
