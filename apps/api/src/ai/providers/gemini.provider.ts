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

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/** Google Gemini via the generateContent REST endpoint. */
export class GeminiProvider implements LlmProviderAdapter {
  readonly name: LlmProvider = 'gemini';

  constructor(
    private readonly apiKey: string | undefined,
    private readonly timeoutMs: number = 180_000,
  ) {}

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!this.apiKey) {
      throw new FatalLlmError('GEMINI_API_KEY is not configured', 'gemini');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    request.signal?.addEventListener('abort', () => controller.abort(), { once: true });

    try {
      const response = await fetch(
        `${BASE_URL}/models/${encodeURIComponent(request.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: request.messages.map((m) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }],
            })),
            generationConfig: {
              temperature: request.temperature,
              maxOutputTokens: request.maxTokens,
              ...(request.jsonSchema
                ? { responseMimeType: 'application/json' }
                : {}),
            },
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text();
        const message = `Gemini ${response.status}: ${body.slice(0, 500)}`;
        const retryable =
          response.status === 408 || response.status === 429 || response.status >= 500;
        throw retryable
          ? new RetryableLlmError(message, 'gemini')
          : new FatalLlmError(message, 'gemini');
      }

      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
        }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };

      const text = payload.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('')
        .trim();

      if (!text) {
        throw new RetryableLlmError('Gemini returned an empty completion', 'gemini');
      }

      return {
        text,
        usage: {
          promptTokens: payload.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: payload.usageMetadata?.candidatesTokenCount ?? 0,
        },
        model: request.model,
        provider: 'gemini',
        stopReason: payload.candidates?.[0]?.finishReason,
      };
    } catch (error) {
      if (error instanceof FatalLlmError || error instanceof RetryableLlmError) throw error;
      throw new RetryableLlmError(
        error instanceof Error ? error.message : 'Unknown Gemini error',
        'gemini',
        error,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  estimateCostUsd(model: string, usage: LlmUsage): number {
    return computeCostUsd('gemini', model, usage.promptTokens, usage.outputTokens);
  }
}
