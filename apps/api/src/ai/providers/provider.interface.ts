import type { LlmProvider } from '@contentflow/shared';

export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LlmCompletionRequest {
  system: string;
  messages: LlmMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  /**
   * When set, the provider is instructed to emit a single JSON object matching
   * this JSON-Schema-ish shape. Providers that support native structured output
   * use it directly; others fall back to prompt-level enforcement.
   */
  jsonSchema?: Record<string, unknown>;
  /** Free-form hint used by the deterministic local provider. */
  intent?: string;
  signal?: AbortSignal;
}

export interface LlmUsage {
  promptTokens: number;
  outputTokens: number;
}

export interface LlmCompletionResponse {
  text: string;
  usage: LlmUsage;
  model: string;
  provider: LlmProvider;
  stopReason?: string;
}

export interface LlmProviderAdapter {
  readonly name: LlmProvider;
  /** False when the adapter has no credentials configured. */
  isConfigured(): boolean;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
  /** USD cost for a completed call, used for per-run cost accounting. */
  estimateCostUsd(model: string, usage: LlmUsage): number;
}

/** Raised when a provider fails in a way that is worth retrying. */
export class RetryableLlmError extends Error {
  constructor(
    message: string,
    readonly provider: LlmProvider,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RetryableLlmError';
  }
}

/** Raised when retrying cannot possibly help (bad key, bad request). */
export class FatalLlmError extends Error {
  constructor(
    message: string,
    readonly provider: LlmProvider,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'FatalLlmError';
  }
}
