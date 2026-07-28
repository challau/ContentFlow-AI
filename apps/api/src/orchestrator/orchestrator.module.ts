import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AssetMaterializerService } from './asset-materializer.service';
import { OrchestratorService } from './orchestrator.service';
import { PipelineEngineService } from './pipeline-engine.service';
import { PipelineGateway } from './pipeline.gateway';
import { PipelineQueue } from './queue/pipeline.queue';
import { PipelineWorker } from './queue/pipeline.worker';

@Module({
  imports: [AiModule],
  providers: [
    PipelineEngineService,
    AssetMaterializerService,
    OrchestratorService,
    PipelineGateway,
    PipelineQueue,
    PipelineWorker,
  ],
  exports: [OrchestratorService, PipelineEngineService, PipelineQueue, PipelineGateway],
})
export class OrchestratorModule {}
