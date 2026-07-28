import { Module } from '@nestjs/common';
import { OrchestratorModule } from '../../orchestrator/orchestrator.module';
import { PipelinesController } from './pipelines.controller';
import { PipelinesService } from './pipelines.service';

@Module({
  imports: [OrchestratorModule],
  controllers: [PipelinesController],
  providers: [PipelinesService],
  exports: [PipelinesService],
})
export class PipelinesModule {}
