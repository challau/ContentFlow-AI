import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { LlmProvider } from '@contentflow/shared';
import { z } from 'zod';
import type { Env } from '../../common/config/env';
import { AnthropicProvider } from './anthropic.provider';
import { GeminiProvider } from './gemini.provider';
import { LocalProvider } from './local.provider';
import { OpenAiProvider } from './openai.provider';
import { extractJson } from './json-extract';
import {
  FatalLlmError,
  RetryableLlmError,
  type LlmCompletionRequest,
  type LlmCompletionResponse,
  type LlmMessage,
  type LlmProviderAdapter,
} from './provider.interface';

export interface StructuredCallOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  intent: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface TextCallOptions {
  system: string;
  /** Full conversation history, oldest first. */
  messages: LlmMessage[];
  /** Namespaced as `chat:<action>` so the offline provider can route it. */
  intent: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface TextCallResult {
  text: string;
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface StructuredCallResult<T> {
  data: T;
  raw: string;
  provider: LlmProvider;
  model: string;
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  attempts: number;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly adapters = new Map<LlmProvider, LlmProviderAdapter>();
  private readonly defaultProvider: LlmProvider;

  constructor(private readonly config: ConfigService<Env, true>) {
    const timeout = this.config.get('LLM_TIMEOUT_MS', { infer: true });

    this.adapters.set(
      'anthropic',
      new AnthropicProvider(
        this.config.get('ANTHROPIC_API_KEY', { infer: true }),
        this.config.get('ANTHROPIC_BASE_URL', { infer: true }),
        timeout,
      ),
    );
    this.adapters.set(
      'openai',
      new OpenAiProvider(
        this.config.get('OPENAI_API_KEY', { infer: true }),
        this.config.get('OPENAI_BASE_URL', { infer: true }) || undefined,
        timeout,
      ),
    );
    this.adapters.set(
      'gemini',
      new GeminiProvider(this.config.get('GEMINI_API_KEY', { infer: true }), timeout),
    );
    this.adapters.set('local', new LocalProvider());

    this.defaultProvider = this.resolveDefaultProvider();
  }

  /**
   * Falls back to the offline provider when the configured one has no
   * credentials, so a missing key degrades to a runnable pipeline with a loud
   * warning instead of a hard boot failure.
   */
  private resolveDefaultProvider(): LlmProvider {
    const configured = this.config.get('LLM_PROVIDER', { infer: true });
    const adapter = this.adapters.get(configured);
    if (adapter?.isConfigured()) return configured;

    this.logger.warn(
      `LLM_PROVIDER=${configured} has no credentials configured — falling back to the ` +
        'deterministic local provider. Set the matching API key to use real models.',
    );
    return 'local';
  }

  get activeProvider(): LlmProvider {
    return this.defaultProvider;
  }

  isLive(): boolean {
    return this.defaultProvider !== 'local';
  }

  /**
   * Runs a free-form, multi-turn completion for the chat assistant.
   *
   * Unlike completeStructured there is no schema to repair against, so a
   * transient failure is retried verbatim with backoff and nothing else.
   */
  async completeText(options: TextCallOptions): Promise<TextCallResult> {
    const provider = this.adapters.get(this.defaultProvider);
    if (!provider) {
      throw new FatalLlmError(`Unknown provider ${this.defaultProvider}`, this.defaultProvider);
    }

    const maxRetries = this.config.get('LLM_MAX_RETRIES', { infer: true });
    const request: LlmCompletionRequest = {
      system: options.system,
      messages: options.messages,
      model: options.model ?? this.config.get('LLM_MODEL', { infer: true }),
      maxTokens: options.maxTokens ?? this.config.get('LLM_MAX_TOKENS', { infer: true }),
      temperature: options.temperature ?? this.config.get('LLM_TEMPERATURE', { infer: true }),
      intent: options.intent,
      signal: options.signal,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const response = await provider.complete(request);
        return {
          text: response.text,
          provider: response.provider,
          model: response.model,
          promptTokens: response.usage.promptTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: provider.estimateCostUsd(response.model, response.usage),
        };
      } catch (error) {
        lastError = error;
        if (error instanceof FatalLlmError) throw error;
        this.logger.warn(
          `[${options.intent}] attempt ${attempt} failed: ${(error as Error).message}`,
        );
        if (attempt <= maxRetries) {
          await sleep(Math.min(2 ** attempt * 250, 8000) + Math.random() * 250);
        }
      }
    }

    throw new RetryableLlmError(
      `[${options.intent}] exhausted ${maxRetries + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      this.defaultProvider,
      lastError,
    );
  }

  /**
   * Runs a schema-constrained completion, retrying transient failures and
   * asking the model to repair output that does not satisfy the contract.
   */
  async completeStructured<T>(options: StructuredCallOptions<T>): Promise<StructuredCallResult<T>> {
    const provider = this.adapters.get(this.defaultProvider);
    if (!provider) {
      throw new FatalLlmError(`Unknown provider ${this.defaultProvider}`, this.defaultProvider);
    }

    const maxRetries = this.config.get('LLM_MAX_RETRIES', { infer: true });
    const request: LlmCompletionRequest = {
      system: options.system,
      messages: [{ role: 'user', content: options.user }],
      model: options.model ?? this.config.get('LLM_MODEL', { infer: true }),
      maxTokens: options.maxTokens ?? this.config.get('LLM_MAX_TOKENS', { infer: true }),
      temperature: options.temperature ?? this.config.get('LLM_TEMPERATURE', { infer: true }),
      jsonSchema: options.jsonSchema,
      intent: options.intent,
      signal: options.signal,
    };

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      let response: LlmCompletionResponse | undefined;
      try {
        response = await provider.complete(request);
        const parsed = options.schema.safeParse(extractJson(response.text));

        if (parsed.success) {
          return {
            data: parsed.data,
            raw: response.text,
            provider: response.provider,
            model: response.model,
            promptTokens: response.usage.promptTokens,
            outputTokens: response.usage.outputTokens,
            costUsd: provider.estimateCostUsd(response.model, response.usage),
            attempts: attempt,
          };
        }

        const issues = parsed.error.issues
          .slice(0, 12)
          .map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');

        lastError = new Error(`Output failed contract validation:\n${issues}`);
        this.logger.warn(
          `[${options.intent}] attempt ${attempt} failed schema validation, repairing`,
        );

        // Feed the invalid output back so the next attempt is a repair, not a
        // blind retry of the same prompt.
        request.messages = [
          { role: 'user', content: options.user },
          { role: 'assistant', content: response.text.slice(0, 8000) },
          {
            role: 'user',
            content:
              `That response did not satisfy the required schema:\n${issues}\n\n` +
              'Return the corrected JSON object only. No prose, no code fences.',
          },
        ];
      } catch (error) {
        lastError = error;

        if (error instanceof FatalLlmError) throw error;

        this.logger.warn(
          `[${options.intent}] attempt ${attempt} failed: ${(error as Error).message}`,
        );

        if (error instanceof SyntaxError && response) {
          request.messages = [
            { role: 'user', content: options.user },
            {
              role: 'user',
              content:
                'Your previous response was not parseable JSON. Return a single valid ' +
                'JSON object matching the schema. No prose, no code fences.',
            },
          ];
        }
      }

      if (attempt <= maxRetries) {
        await sleep(Math.min(2 ** attempt * 250, 8000) + Math.random() * 250);
      }
    }

    throw new RetryableLlmError(
      `[${options.intent}] exhausted ${maxRetries + 1} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
      this.defaultProvider,
      lastError,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
