/**
 * Per-model API-surface differences that the request builder must respect.
 *
 * These are hard 400s, not preferences: current Claude models reject the
 * sampling parameters and the legacy `budget_tokens` thinking config that
 * older models accepted, so the adapter has to know which family it is
 * talking to before it builds a request.
 */

/** Models that reject `temperature` / `top_p` / `top_k` outright. */
const REJECTS_SAMPLING_PARAMS = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-5',
];

/** Models supporting `thinking: { type: 'adaptive' }`. */
const SUPPORTS_ADAPTIVE_THINKING = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
];

/** Models supporting `output_config.format` (structured JSON output). */
const SUPPORTS_STRUCTURED_OUTPUT = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-sonnet-5',
  'claude-haiku-4-5',
  'claude-opus-4-5',
  'claude-opus-4-1',
];

/** Models supporting `output_config.effort`. */
const SUPPORTS_EFFORT = [
  'claude-fable-5',
  'claude-mythos-5',
  'claude-opus-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-opus-4-6',
  'claude-opus-4-5',
  'claude-sonnet-5',
  'claude-sonnet-4-6',
];

/** Thinking cannot be disabled above this effort on Claude Opus 5. */
const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORT_ORDER)[number];

const matches = (model: string, list: string[]): boolean =>
  list.some((prefix) => model.startsWith(prefix));

export interface ModelCapabilities {
  samplingParams: boolean;
  adaptiveThinking: boolean;
  structuredOutput: boolean;
  effort: boolean;
  /** Above this effort, Claude Opus 5 rejects `thinking: { type: 'disabled' }`. */
  maxEffortWithThinkingDisabled: Effort | null;
}

export function capabilitiesFor(model: string): ModelCapabilities {
  return {
    samplingParams: !matches(model, REJECTS_SAMPLING_PARAMS),
    adaptiveThinking: matches(model, SUPPORTS_ADAPTIVE_THINKING),
    structuredOutput: matches(model, SUPPORTS_STRUCTURED_OUTPUT),
    effort: matches(model, SUPPORTS_EFFORT),
    maxEffortWithThinkingDisabled: model.startsWith('claude-opus-5') ? 'high' : null,
  };
}

/** True when `thinking: { type: 'disabled' }` is legal at this effort. */
export function canDisableThinking(model: string, effort: Effort): boolean {
  if (model.startsWith('claude-fable-5') || model.startsWith('claude-mythos-5')) {
    return false; // thinking is always on
  }
  const cap = capabilitiesFor(model).maxEffortWithThinkingDisabled;
  if (!cap) return true;
  return EFFORT_ORDER.indexOf(effort) <= EFFORT_ORDER.indexOf(cap);
}

/**
 * Agent work is structured extraction, not open-ended reasoning, so map the
 * configured temperature onto an effort level for models where `temperature`
 * is no longer accepted.
 */
export function effortForTemperature(temperature: number): Effort {
  if (temperature <= 0.3) return 'low';
  if (temperature <= 0.7) return 'medium';
  return 'high';
}
