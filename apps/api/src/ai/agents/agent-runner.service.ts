import { Injectable, Logger } from '@nestjs/common';
import type { AgentKind, AgentOutputMap } from '@contentflow/shared';
import { z } from 'zod';
import { LlmService } from '../providers/llm.service';
import { getAgent } from './agent.registry';
import { MissingDependencyError, type AgentContext } from './agent.types';

export interface AgentRunResult<K extends AgentKind = AgentKind> {
  kind: K;
  output: AgentOutputMap[K];
  raw: string;
  provider: string;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  attempts: number;
  durationMs: number;
}

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  /** JSON Schema derivation is pure, so cache it per agent. */
  private readonly jsonSchemaCache = new Map<AgentKind, Record<string, unknown>>();

  constructor(private readonly llm: LlmService) {}

  private jsonSchemaFor(kind: AgentKind, schema: z.ZodType<unknown>): Record<string, unknown> {
    const cached = this.jsonSchemaCache.get(kind);
    if (cached) return cached;

    // `io: 'output'` resolves defaults so the schema describes what the model
    // must return, not what the parser will accept.
    const jsonSchema = z.toJSONSchema(schema, {
      io: 'output',
      unrepresentable: 'any',
    }) as Record<string, unknown>;

    this.jsonSchemaCache.set(kind, jsonSchema);
    return jsonSchema;
  }

  async run<K extends AgentKind>(
    kind: K,
    ctx: AgentContext,
    signal?: AbortSignal,
  ): Promise<AgentRunResult<K>> {
    const agent = getAgent(kind);

    const missing = agent.dependsOn.filter((dep) => ctx.outputs[dep] === undefined);
    if (missing.length > 0) {
      throw new MissingDependencyError(kind, missing);
    }

    const startedAt = Date.now();
    const jsonSchema = this.jsonSchemaFor(kind, agent.schema);

    const result = await this.llm.completeStructured({
      system: agent.systemPrompt,
      user: agent.buildUserPrompt(ctx),
      schema: agent.schema,
      jsonSchema,
      intent: kind,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      signal,
    });

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `${kind} completed in ${durationMs}ms (${result.attempts} attempt(s), ` +
        `${result.promptTokens}+${result.outputTokens} tokens, $${result.costUsd.toFixed(4)})`,
    );

    return {
      kind,
      output: result.data as AgentOutputMap[K],
      raw: result.raw,
      provider: result.provider,
      model: result.model,
      promptTokens: result.promptTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
      attempts: result.attempts,
      durationMs,
    };
  }
}
