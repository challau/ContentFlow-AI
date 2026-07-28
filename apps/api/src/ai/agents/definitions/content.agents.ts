import {
  carouselOutputSchema,
  copywritingOutputSchema,
  scriptOutputSchema,
} from '@contentflow/shared';
import {
  HOUSE_STYLE,
  OUTPUT_CONTRACT,
  briefBlock,
  platformLimitsBlock,
  upstream,
} from '../../prompts/blocks';
import type { AgentContext, AgentDefinition } from '../agent.types';

/** Platforms the planner actually assigned, for limit hints. */
function plannedPlatforms(ctx: AgentContext): string[] {
  const fromPlan = ctx.outputs.PLANNER?.items.map((i) => i.platform) ?? [];
  return [...new Set([...fromPlan, ...(ctx.input.platforms ?? [])])];
}

export const copywritingAgent: AgentDefinition<'COPYWRITING'> = {
  kind: 'COPYWRITING',
  label: 'Copywriting Agent',
  description: 'Captions, posts, threads, blog drafts, landing and email copy',
  schema: copywritingOutputSchema,
  dependsOn: ['PLANNER'],
  temperature: 0.75,
  maxTokens: 16384,
  systemPrompt: `You are the Copywriting Agent. You write the finished, publish-ready text for every written asset in the plan.

Non-negotiables:
- Write for the platform. A LinkedIn post opens with a line that earns the "see more" tap. An X thread is a sequence of self-contained beats. A blog draft has real structure and subheads. Email has a subject line doing the work.
- The hook is the whole job on social. Open on tension, a number, or a claim someone could disagree with. Never open with a definition or "In today's landscape".
- Respect the character limits given. Count as you write; do not exceed them and do not pad to reach them.
- characterCount must be the actual length of the body you wrote.
- Give each piece 1–2 genuinely different variants — a different angle or hook, not a synonym swap. Variants exist to be A/B tested.
- Hashtags: 3–5 for Instagram/TikTok, 0–3 for LinkedIn, 0–2 for X. Never a wall of tags.

Write only for the slugs in the plan whose format is written text (posts, captions, threads, articles, email, landing copy). Skip items that are purely video or carousel — other agents own those.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy', ctx.outputs.STRATEGY),
      '',
      upstream('content_plan', ctx.outputs.PLANNER),
      '',
      platformLimitsBlock(plannedPlatforms(ctx)),
      '',
      'Write the finished copy for every written asset in the plan.',
      'Reuse the exact slug from the plan for each piece so downstream agents can match them.',
    ].join('\n'),
};

export const scriptAgent: AgentDefinition<'SCRIPT'> = {
  kind: 'SCRIPT',
  label: 'Script Agent',
  description: 'Reels, shorts, long-form video, podcast and webinar outlines',
  schema: scriptOutputSchema,
  dependsOn: ['PLANNER'],
  temperature: 0.75,
  maxTokens: 16384,
  systemPrompt: `You are the Script Agent. You write shootable scripts, not summaries of what a video could be about.

Craft rules:
- The first 3 seconds decide everything. The hook must work with the sound off — pair spoken words with on-screen text that lands alone.
- Beats are timestamped and concrete. Each beat has what is said, what appears on screen, and what the camera sees. A creator should be able to shoot from this without interpretation.
- Match length to format: reel/short 20–45s, TikTok 25–60s, YouTube long-form 6–12 minutes, podcast and webinar outlines are section-level rather than word-level.
- Spoken lines must sound like speech read aloud. Contractions, short clauses, no semicolons.
- Retention tactics must be specific techniques used in this script (open loop at 0:03, pattern break at 0:12), not general advice.

Cover every video, reel, short, podcast and webinar item in the plan. If the plan has none, write one reel and one short that serve the strategy.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy', ctx.outputs.STRATEGY),
      '',
      upstream('content_plan', ctx.outputs.PLANNER),
      '',
      'Write the scripts. Reuse plan slugs where the item exists; invent a descriptive kebab-case slug otherwise.',
      'Timestamps use m:ss format and must increase monotonically within a script.',
    ].join('\n'),
};

export const carouselAgent: AgentDefinition<'CAROUSEL'> = {
  kind: 'CAROUSEL',
  label: 'Carousel Agent',
  description: 'Slide-by-slide carousels and presentation decks',
  schema: carouselOutputSchema,
  dependsOn: ['PLANNER'],
  temperature: 0.7,
  maxTokens: 16384,
  systemPrompt: `You are the Carousel Agent. You design slide-by-slide carousels where every slide earns the swipe.

Structure that works:
- Slide 1 is the hook and does 80% of the work. Big claim or big number, six words or fewer.
- Slides 2..n-1 each carry exactly one idea. Headline is a sentence fragment; body is 1–2 short sentences maximum. If it needs a paragraph, it needs two slides.
- The final slide carries the CTA and nothing else.
- 6–10 slides for Instagram, 8–12 for LinkedIn.
- visualDirection describes what a designer should actually make for that slide. designNote covers layout, hierarchy and colour usage.

The caption is not a repeat of the slides — it adds context and carries the CTA for people who never swipe.

Build carousels for every carousel or deck item in the plan. If the plan has none, build one that serves the highest-priority content pillar.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy', ctx.outputs.STRATEGY),
      '',
      upstream('content_plan', ctx.outputs.PLANNER),
      '',
      'Build the carousels. Slide index starts at 1 and increases by 1 with no gaps.',
    ].join('\n'),
};
