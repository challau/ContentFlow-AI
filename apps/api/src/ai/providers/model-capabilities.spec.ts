import {
  canDisableThinking,
  capabilitiesFor,
  effortForTemperature,
} from './model-capabilities';

describe('model capabilities', () => {
  it('withholds sampling params from models that reject them', () => {
    for (const model of ['claude-opus-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-fable-5']) {
      expect(capabilitiesFor(model).samplingParams).toBe(false);
    }
  });

  it('allows sampling params on older models', () => {
    expect(capabilitiesFor('claude-haiku-4-5').samplingParams).toBe(true);
  });

  it('advertises adaptive thinking on current models', () => {
    expect(capabilitiesFor('claude-opus-5').adaptiveThinking).toBe(true);
    expect(capabilitiesFor('claude-sonnet-5').adaptiveThinking).toBe(true);
  });

  it('advertises structured output where it is supported', () => {
    expect(capabilitiesFor('claude-opus-5').structuredOutput).toBe(true);
    expect(capabilitiesFor('claude-haiku-4-5').structuredOutput).toBe(true);
  });

  it('caps disabled thinking at high effort on Claude Opus 5', () => {
    expect(canDisableThinking('claude-opus-5', 'high')).toBe(true);
    expect(canDisableThinking('claude-opus-5', 'xhigh')).toBe(false);
    expect(canDisableThinking('claude-opus-5', 'max')).toBe(false);
  });

  it('never allows disabling thinking on Fable 5', () => {
    expect(canDisableThinking('claude-fable-5', 'low')).toBe(false);
  });

  it('maps temperature onto an effort level', () => {
    expect(effortForTemperature(0.2)).toBe('low');
    expect(effortForTemperature(0.6)).toBe('medium');
    expect(effortForTemperature(0.9)).toBe('high');
  });

  it('matches dated model ids by prefix', () => {
    expect(capabilitiesFor('claude-haiku-4-5-20251001').structuredOutput).toBe(true);
  });
});
