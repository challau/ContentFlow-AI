import { computeCostUsd, resolveRate } from './pricing';

describe('pricing', () => {
  it('prices Claude Opus 5 at $5/$25 per million tokens', () => {
    expect(computeCostUsd('anthropic', 'claude-opus-5', 1_000_000, 1_000_000)).toBeCloseTo(30, 6);
  });

  it('prices Claude Sonnet 5 at $3/$15 per million tokens', () => {
    expect(computeCostUsd('anthropic', 'claude-sonnet-5', 1_000_000, 0)).toBeCloseTo(3, 6);
  });

  it('matches the longest known prefix for dated model ids', () => {
    expect(resolveRate('anthropic', 'claude-haiku-4-5-20251001')).toEqual({ input: 1, output: 5 });
  });

  it('falls back for an unknown model rather than throwing', () => {
    expect(computeCostUsd('anthropic', 'claude-unreleased-9', 1_000_000, 0)).toBeCloseTo(3, 6);
  });

  it('charges nothing for the offline provider', () => {
    expect(computeCostUsd('local', 'anything', 9_999_999, 9_999_999)).toBe(0);
  });

  it('scales linearly below a million tokens', () => {
    expect(computeCostUsd('openai', 'gpt-4o-mini', 500_000, 250_000)).toBeCloseTo(0.225, 6);
  });
});
