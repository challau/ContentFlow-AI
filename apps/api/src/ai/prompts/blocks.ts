import { PLATFORM_LIMITS } from '@contentflow/shared';
import type { AgentContext } from '../agents/agent.types';

/** Shared brief block prepended to every agent's user turn. */
export function briefBlock(ctx: AgentContext): string {
  const { input, brand } = ctx;
  const lines = [
    '<brief>',
    `<topic>${input.topic}</topic>`,
    `<source_kind>${input.sourceKind}</source_kind>`,
  ];

  if (input.sourceUrl) lines.push(`<source_url>${input.sourceUrl}</source_url>`);
  lines.push(`<audience>${input.audience ?? 'not specified — infer it'}</audience>`);
  lines.push(`<goal>${input.goal ?? 'not specified — infer it'}</goal>`);
  lines.push(`<tone>${input.tone ?? 'not specified — choose and stay consistent'}</tone>`);
  lines.push(`<language>${input.language}</language>`);

  if (input.platforms?.length) {
    lines.push(`<target_platforms>${input.platforms.join(', ')}</target_platforms>`);
  }
  if (input.extraContext) {
    lines.push(`<extra_context>\n${input.extraContext}\n</extra_context>`);
  }
  lines.push('</brief>');

  if (brand) {
    lines.push(
      '<brand_kit>',
      `<name>${brand.name}</name>`,
      `<colors>primary ${brand.primaryColor}, secondary ${brand.secondaryColor}, accent ${brand.accentColor}</colors>`,
      `<fonts>heading ${brand.headingFont}, body ${brand.bodyFont}</fonts>`,
      brand.toneOfVoice ? `<tone_of_voice>${brand.toneOfVoice}</tone_of_voice>` : '',
      brand.writingGuidelines ? `<writing_guidelines>${brand.writingGuidelines}</writing_guidelines>` : '',
      brand.bannedWords.length ? `<never_use>${brand.bannedWords.join(', ')}</never_use>` : '',
      '</brand_kit>',
    );
  }

  return lines.filter(Boolean).join('\n');
}

/** Serialises an upstream agent result for downstream consumption. */
export function upstream(label: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  return `<${label}>\n${JSON.stringify(value, null, 2)}\n</${label}>`;
}

/** Platform character ceilings, so copy is generated in-bounds rather than trimmed after. */
export function platformLimitsBlock(platforms: string[]): string {
  const rows = platforms
    .map((p) => {
      const limit = PLATFORM_LIMITS[p as keyof typeof PLATFORM_LIMITS];
      return limit ? `- ${limit.label}: hard maximum ${limit.maxChars} characters` : '';
    })
    .filter(Boolean);
  return rows.length ? `<platform_limits>\n${rows.join('\n')}\n</platform_limits>` : '';
}

/**
 * Every agent shares this contract. Output discipline is enforced by the
 * provider's structured-output mode where available and by this instruction
 * everywhere else.
 */
export const OUTPUT_CONTRACT = `
<output_rules>
Return exactly one JSON object matching the provided schema. No prose before or after it, no markdown code fences.
Every string must be finished, specific prose — never a placeholder, never "TBD", "example", "lorem ipsum", or "[insert X]".
Ground every claim in the brief. If you infer something not stated, make it plausible and internally consistent with the rest of your output.
Write in the requested language.
</output_rules>`.trim();

export const HOUSE_STYLE = `
<house_style>
You write like a senior strategist at a top-tier agency, not like a chatbot.
- Specific over generic: name the workflow, the number, the moment. "Cuts invoice reconciliation from 4 hours to 6 minutes" beats "saves time".
- No filler openers ("In today's fast-paced world", "Are you tired of"), no hype adjectives stacked three deep, no emoji unless the platform genuinely calls for it.
- Vary sentence length. Short sentences carry weight.
- Never invent statistics or customer names presented as real. If a number is illustrative, frame it as an estimate.
- Respect the platform: LinkedIn is not Instagram, an X thread is not a blog post.
</house_style>`.trim();
