import type { LlmProvider } from '@contentflow/shared';

/** USD per 1M tokens. */
interface Rate {
  input: number;
  output: number;
}

const ANTHROPIC_RATES: Record<string, Rate> = {
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5': { input: 10, output: 50 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

const OPENAI_RATES: Record<string, Rate> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

const GEMINI_RATES: Record<string, Rate> = {
  'gemini-2.0-flash': { input: 0.1, output: 0.4 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

const TABLES: Record<LlmProvider, Record<string, Rate>> = {
  anthropic: ANTHROPIC_RATES,
  openai: OPENAI_RATES,
  gemini: GEMINI_RATES,
  local: {},
};

const FALLBACK: Rate = { input: 3, output: 15 };

/**
 * Model ids often carry a dated suffix (`claude-sonnet-5-20260101`), so match on
 * the longest known prefix rather than requiring an exact key.
 */
export function resolveRate(provider: LlmProvider, model: string): Rate {
  const table = TABLES[provider] ?? {};
  if (table[model]) return table[model];

  const match = Object.keys(table)
    .filter((key) => model.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];

  return match ? table[match] : FALLBACK;
}

export function computeCostUsd(
  provider: LlmProvider,
  model: string,
  promptTokens: number,
  outputTokens: number,
): number {
  if (provider === 'local') return 0;
  const rate = resolveRate(provider, model);
  const cost = (promptTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output;
  return Number(cost.toFixed(6));
}
