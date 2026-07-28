import type { LlmProvider } from '@contentflow/shared';
import { deriveBrief } from './local/brief';
import { generateForSchema } from './local/schema-generator';
import { hashString } from './local/rng';
import {
  FatalLlmError,
  type LlmCompletionRequest,
  type LlmCompletionResponse,
  type LlmProviderAdapter,
  type LlmUsage,
} from './provider.interface';

/**
 * Deterministic, offline provider.
 *
 * It does not call a model — it synthesises a value that satisfies the agent's
 * JSON Schema, interpolating the brief so the result is on-topic and coherent.
 * That makes the entire orchestrator, persistence and event pipeline runnable
 * and testable with no API key, and keeps CI hermetic.
 */
export class LocalProvider implements LlmProviderAdapter {
  readonly name: LlmProvider = 'local';

  isConfigured(): boolean {
    return true;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!request.jsonSchema) {
      throw new FatalLlmError(
        'The local provider only serves schema-constrained agent calls',
        'local',
      );
    }

    const brief = deriveBrief({
      topic: extractTagged(request, 'topic') ?? firstUserLine(request) ?? 'the product',
      audience: extractTagged(request, 'audience'),
      goal: extractTagged(request, 'goal'),
      tone: extractTagged(request, 'tone'),
      platforms: extractPlatforms(request),
    });

    const seed = `${request.intent ?? 'agent'}:${brief.topic}:${request.model}`;
    const value = generateForSchema(request.jsonSchema, brief, seed);
    const text = JSON.stringify(value, null, 2);

    // Approximate token accounting keeps dashboards and budgeting meaningful
    // even when running offline. ~4 characters per token.
    const promptChars =
      request.system.length + request.messages.reduce((n, m) => n + m.content.length, 0);

    return {
      text,
      usage: {
        promptTokens: Math.ceil(promptChars / 4),
        outputTokens: Math.ceil(text.length / 4),
      },
      model: `local-deterministic-${hashString(seed) % 1000}`,
      provider: 'local',
      stopReason: 'end_turn',
    };
  }

  estimateCostUsd(_model: string, _usage: LlmUsage): number {
    return 0;
  }
}

/**
 * Pulls `<topic>…</topic>` style fields out of the rendered user prompt.
 * The brief block writes "not specified — infer it" for absent fields, which
 * must be treated as absent rather than echoed back into the copy.
 */
function extractTagged(request: LlmCompletionRequest, tag: string): string | undefined {
  const haystack = request.messages.map((m) => m.content).join('\n');
  const match = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i').exec(haystack);
  const value = match?.[1]?.trim();
  if (!value || /^not specified/i.test(value)) return undefined;
  return value;
}

/** Reads the platforms the brief actually asked for, if any. */
function extractPlatforms(request: LlmCompletionRequest): string[] {
  const raw = extractTagged(request, 'target_platforms');
  return raw
    ? raw
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean)
    : [];
}

function firstUserLine(request: LlmCompletionRequest): string | undefined {
  return request.messages.find((m) => m.role === 'user')?.content.split('\n')[0]?.trim();
}
