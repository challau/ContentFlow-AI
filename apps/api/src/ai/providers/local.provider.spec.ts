import { z } from 'zod';
import { AGENT_OUTPUT_SCHEMAS, AGENT_KINDS, type AgentKind } from '@contentflow/shared';
import { LocalProvider } from './local.provider';
import type { LlmCompletionRequest } from './provider.interface';

const provider = new LocalProvider();

function requestFor(kind: AgentKind, userPrompt: string): LlmCompletionRequest {
  return {
    system: 'system prompt',
    messages: [{ role: 'user', content: userPrompt }],
    model: 'local',
    maxTokens: 4096,
    temperature: 0.7,
    intent: kind,
    jsonSchema: z.toJSONSchema(AGENT_OUTPUT_SCHEMAS[kind], {
      io: 'output',
      unrepresentable: 'any',
    }) as Record<string, unknown>,
  };
}

const BRIEF = [
  '<brief>',
  '<topic>AI note taking app for clinicians</topic>',
  '<audience>hospital clinicians drowning in documentation</audience>',
  '<target_platforms>LINKEDIN, X, INSTAGRAM</target_platforms>',
  '</brief>',
].join('\n');

describe('LocalProvider', () => {
  it.each(AGENT_KINDS)('produces output satisfying the %s contract', async (kind) => {
    const response = await provider.complete(requestFor(kind, BRIEF));
    const parsed = AGENT_OUTPUT_SCHEMAS[kind].safeParse(JSON.parse(response.text));

    if (!parsed.success) {
      throw new Error(
        `${kind} failed its contract:\n${parsed.error.issues
          .map((i) => `  ${i.path.join('.')}: ${i.message}`)
          .join('\n')}`,
      );
    }
    expect(parsed.success).toBe(true);
  });

  it('is deterministic for the same brief', async () => {
    const a = await provider.complete(requestFor('RESEARCH', BRIEF));
    const b = await provider.complete(requestFor('RESEARCH', BRIEF));
    expect(a.text).toEqual(b.text);
  });

  it('produces different output for a different topic', async () => {
    const a = await provider.complete(requestFor('RESEARCH', BRIEF));
    const b = await provider.complete(
      requestFor('RESEARCH', BRIEF.replace('AI note taking app for clinicians', 'dog grooming van')),
    );
    expect(a.text).not.toEqual(b.text);
  });

  it('grounds copy in the supplied topic', async () => {
    const response = await provider.complete(requestFor('RESEARCH', BRIEF));
    expect(response.text.toLowerCase()).toContain('note taking');
  });

  it('never echoes the "not specified" placeholder into output', async () => {
    const sparse = '<brief>\n<topic>coffee subscription</topic>\n<audience>not specified — infer it</audience>\n</brief>';
    const response = await provider.complete(requestFor('STRATEGY', sparse));
    expect(response.text).not.toContain('not specified');
  });

  it('honours the requested platforms', async () => {
    const response = await provider.complete(requestFor('STRATEGY', BRIEF));
    const output = JSON.parse(response.text) as {
      recommendedPlatforms: Array<{ platform: string }>;
    };
    const platforms = output.recommendedPlatforms.map((p) => p.platform);

    expect(platforms.every((p) => ['LINKEDIN', 'X', 'INSTAGRAM'].includes(p))).toBe(true);
    expect(new Set(platforms).size).toBe(platforms.length);
  });

  it('emits content pillars that sum to 100', async () => {
    const response = await provider.complete(requestFor('STRATEGY', BRIEF));
    const output = JSON.parse(response.text) as {
      contentPillars: Array<{ percentage: number }>;
    };
    const total = output.contentPillars.reduce((n, p) => n + p.percentage, 0);
    expect(Math.abs(total - 100)).toBeLessThan(0.5);
  });

  it('reports zero cost', () => {
    expect(provider.estimateCostUsd('local', { promptTokens: 5000, outputTokens: 5000 })).toBe(0);
  });

  it('refuses unstructured calls', async () => {
    await expect(
      provider.complete({ ...requestFor('RESEARCH', BRIEF), jsonSchema: undefined }),
    ).rejects.toThrow(/schema-constrained/);
  });
});
