import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider } from '@contentflow/shared';
import { computeCostUsd } from './pricing';
import { capabilitiesFor, effortForTemperature } from './model-capabilities';
import {
  FatalLlmError,
  RetryableLlmError,
  type LlmCompletionRequest,
  type LlmCompletionResponse,
  type LlmProviderAdapter,
  type LlmUsage,
} from './provider.interface';

/** Above this ceiling a non-streaming request risks an HTTP timeout. */
const STREAMING_THRESHOLD = 16_000;

export class AnthropicProvider implements LlmProviderAdapter {
  readonly name: LlmProvider = 'anthropic';
  private readonly client: Anthropic | null;

  constructor(
    private readonly apiKey: string | undefined,
    baseUrl: string | undefined,
    private readonly timeoutMs: number,
  ) {
    this.client = apiKey
      ? new Anthropic({
          apiKey,
          ...(baseUrl ? { baseURL: baseUrl } : {}),
          timeout: timeoutMs,
          maxRetries: 0, // retries are owned by LlmService so they are observable
        })
      : null;
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    if (!this.client) {
      throw new FatalLlmError('ANTHROPIC_API_KEY is not configured', 'anthropic');
    }

    const params = this.buildParams(request);

    try {
      const message =
        request.maxTokens > STREAMING_THRESHOLD
          ? await this.client.messages
              .stream(params, { signal: request.signal })
              .finalMessage()
          : await this.client.messages.create(params, { signal: request.signal });

      if (message.stop_reason === 'refusal') {
        throw new FatalLlmError(
          `Claude declined this request (${message.stop_details?.category ?? 'unspecified'}). ` +
            'Rephrase the topic or supply different source material.',
          'anthropic',
        );
      }

      const text = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n')
        .trim();

      if (!text) {
        throw new RetryableLlmError(
          `Claude returned no text content (stop_reason=${message.stop_reason})`,
          'anthropic',
        );
      }

      return {
        text,
        usage: {
          promptTokens: message.usage.input_tokens,
          outputTokens: message.usage.output_tokens,
        },
        model: message.model,
        provider: 'anthropic',
        stopReason: message.stop_reason ?? undefined,
      };
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  /**
   * Builds a request that respects the target model's API surface. Current
   * models reject `temperature` and only accept adaptive thinking, so the
   * configured temperature is translated into an effort level instead.
   */
  private buildParams(
    request: LlmCompletionRequest,
  ): Anthropic.MessageCreateParamsNonStreaming {
    const caps = capabilitiesFor(request.model);
    const effort = effortForTemperature(request.temperature);

    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model: request.model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    };

    if (caps.samplingParams) {
      params.temperature = request.temperature;
    }

    // Thinking stays on and cost is controlled with effort instead. Disabling
    // it on current models can leak `<thinking>` tags into the visible response,
    // which would corrupt the JSON every agent contract depends on.
    if (caps.adaptiveThinking) {
      params.thinking = { type: 'adaptive', display: 'omitted' };
    }

    const outputConfig: Anthropic.OutputConfig = {};
    if (caps.effort) outputConfig.effort = effort;
    if (caps.structuredOutput && request.jsonSchema) {
      outputConfig.format = { type: 'json_schema', schema: request.jsonSchema };
    }
    if (Object.keys(outputConfig).length > 0) {
      params.output_config = outputConfig;
    }

    return params;
  }

  private normalizeError(error: unknown): Error {
    if (error instanceof FatalLlmError || error instanceof RetryableLlmError) {
      return error;
    }
    if (error instanceof Anthropic.APIError) {
      const status = error.status ?? 0;
      const retryable = status === 408 || status === 409 || status === 429 || status >= 500;
      const message = `Anthropic ${status}: ${error.message}`;
      return retryable
        ? new RetryableLlmError(message, 'anthropic', error)
        : new FatalLlmError(message, 'anthropic', error);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return new RetryableLlmError('Anthropic connection failed', 'anthropic', error);
    }
    return new RetryableLlmError(
      error instanceof Error ? error.message : 'Unknown Anthropic error',
      'anthropic',
      error,
    );
  }

  estimateCostUsd(model: string, usage: LlmUsage): number {
    return computeCostUsd('anthropic', model, usage.promptTokens, usage.outputTokens);
  }
}
