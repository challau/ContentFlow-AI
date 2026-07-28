import { Module } from '@nestjs/common';
import { AgentRunnerService } from './agents/agent-runner.service';
import { LlmService } from './providers/llm.service';

@Module({
  providers: [LlmService, AgentRunnerService],
  exports: [LlmService, AgentRunnerService],
})
export class AiModule {}
