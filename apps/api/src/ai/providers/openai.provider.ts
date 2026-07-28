import type { LlmProvider } from '@contentflow/shared';
import { computeCostUsd } from './pricing';
import {
  FatalLlmError,
  RetryableLlmError,
  type LlmCompletionRequest,
  type LlmCompletionResponse,
  type LlmProviderAdapter,
  type LlmUsage,
} from './provider.interface';

/**
 * Talks to any OpenAI-compatible /chat/completions endpoint (OpenAI, Azure,
 * Together, Groq, vLLM, LM Studio) over fetch, so no extra SDK is required.
 */
export class OpenAiProvider implements LlmProviderAdapter {
  readonly name: LlmProvider = 'openai';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly baseUrl: string = 'https://api.openai.com/v1',
    private readonly timeoutMs: number = 180_000,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!this.apiKey) {
      throw new FatalLlmError('OPENAI_API_KEY is not configured', 'openai');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    request.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens,
          temperature: request.temperature,
          messages: [
            { role: 'system', content: request.system },
            ...request.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
          ...(request.jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: 'agent_output',
                    strict: false,
                    schema: request.jsonSchema,
                  },
                },
              }
            : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        const message = `OpenAI ${response.status}: ${body.slice(0, 500)}`;
        const retryable =
          response.status === 408 || response.status === 429 || response.status >= 500;
        throw retryable
          ? new RetryableLlmError(message, 'openai')
          : new FatalLlmError(message, 'openai');
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        model?: string;
      };

      const text = payload.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new RetryableLlmError('OpenAI returned an empty completion', 'openai');
      }

      return {
        text,
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          outputTokens: payload.usage?.completion_tokens ?? 0,
        },
        model: payload.model ?? request.model,
        provider: 'openai',
        stopReason: payload.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      if (error instanceof FatalLlmError || error instanceof RetryableLlmError) throw error;
      throw new RetryableLlmError(
        error instanceof Error ? error.message : 'Unknown OpenAI error',
        'openai',
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  estimateCostUsd(model: string, usage: LlmUsage): number {
    return computeCostUsd('openai', model, usage.promptTokens, usage.outputTokens);
  }
}
