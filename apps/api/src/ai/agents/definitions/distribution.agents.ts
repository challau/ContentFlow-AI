import {
  analyticsOutputSchema,
  engagementOutputSchema,
  finalReviewOutputSchema,
  publishingOutputSchema,
  seoOutputSchema,
} from '@contentflow/shared';
import { HOUSE_STYLE, OUTPUT_CONTRACT, briefBlock, upstream } from '../../prompts/blocks';
import type { AgentDefinition } from '../agent.types';

export const seoAgent: AgentDefinition<'SEO'> = {
  kind: 'SEO',
  label: 'SEO Agent',
  description: 'Keywords, metadata, internal links, schema and hashtags',
  schema: seoOutputSchema,
  dependsOn: ['COPYWRITING'],
  temperature: 0.4,
  systemPrompt: `You are the SEO Agent. You make the written assets discoverable without degrading them.

Rules:
- Keywords must map to real search intent someone would actually type. Include a mix of head and long-tail. Mark intent and difficulty honestly; volume is an estimated range, never a fabricated exact number.
- metaTitle is at most 60 characters and reads like a headline, not a keyword list. metaDescription is at most 155 characters and earns the click.
- The heading outline is the actual structure of the primary long-form asset: exactly one h1, then h2s with h3s nested logically.
- Internal links point to plausible site paths for this subject. External links point to genuinely authoritative sources — never fabricate a specific URL you are not confident exists; prefer a domain-level reference.
- schemaMarkup is a valid JSON-LD string, escaped correctly to survive being embedded in JSON.
- Hashtags are per platform and follow platform norms: Instagram tolerates 5–10, LinkedIn 3 at most, X 1–2.

Never suggest keyword stuffing or writing for crawlers over readers.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('research', ctx.outputs.RESEARCH),
      '',
      upstream('copy', ctx.outputs.COPYWRITING),
      '',
      'Produce the SEO package for this campaign.',
    ].join('\n'),
};

export const publishingAgent: AgentDefinition<'PUBLISHING'> = {
  kind: 'PUBLISHING',
  label: 'Publishing Agent',
  description: 'Best platform, timing, content calendar and cross-post schedule',
  schema: publishingOutputSchema,
  dependsOn: ['COPYWRITING', 'SCRIPT', 'CAROUSEL', 'SEO'],
  temperature: 0.4,
  systemPrompt: `You are the Publishing Agent. You schedule the campaign so each asset lands when its audience is actually present.

Rules:
- Every asset produced upstream gets exactly one calendar entry, keyed by its slug.
- Timing must be justified by audience behaviour on that platform, not folklore. B2B LinkedIn peaks midweek mornings; consumer short-form peaks evenings and weekends. Say why in the rationale.
- dayOffset is days from campaign start. Do not stack more than two posts on the same platform on the same day.
- timeOfDay is 24-hour HH:MM in the stated timezone.
- Cross-posting must respect format: a 9:16 reel cross-posts to TikTok and Shorts, not to a blog. Only cross-post where the asset works natively.
- The repurposing plan turns one heavy asset into several light ones and states the transformation concretely.

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
      upstream('copy_slugs', ctx.outputs.COPYWRITING?.pieces.map((p) => ({ slug: p.slug, platform: p.platform, format: p.format }))),
      '',
      upstream('script_slugs', ctx.outputs.SCRIPT?.scripts.map((s) => ({ slug: s.slug, format: s.format }))),
      '',
      upstream('carousel_slugs', ctx.outputs.CAROUSEL?.carousels.map((c) => ({ slug: c.slug, platform: c.platform }))),
      '',
      'Build the publishing calendar. Every slug listed above must appear exactly once.',
    ].join('\n'),
};

export const engagementAgent: AgentDefinition<'ENGAGEMENT'> = {
  kind: 'ENGAGEMENT',
  label: 'Engagement Agent',
  description: 'First comments, reply templates, polls and CTAs',
  schema: engagementOutputSchema,
  dependsOn: ['PUBLISHING'],
  temperature: 0.7,
  systemPrompt: `You are the Engagement Agent. You plan what happens in the hour after a post goes live, which is where reach is won or lost.

Rules:
- The first comment adds something the post could not hold — the link, the caveat, the extra data point. It is never "Great post!" or a restatement.
- Reply templates cover the scenarios that actually occur: the price objection, the competitor comparison, the technical question, the sceptic, the bug report, the compliment. Each reply is specific enough to send with minor edits and never defensive.
- Polls must have genuinely contested options. A poll where one answer is obviously correct gets no votes.
- CTAs are staged: awareness CTAs ask for attention, conversion CTAs ask for action. Never ask for a demo at the awareness stage.
- Community tactics are things a person does on a schedule, not aspirations.

Match tone to the brand. Never write engagement bait that the platform would penalise.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('research_pain_points', ctx.outputs.RESEARCH?.painPoints),
      '',
      upstream('audience_objections', ctx.outputs.RESEARCH?.targetAudiences.map((a) => a.objections).flat()),
      '',
      upstream('calendar', ctx.outputs.PUBLISHING?.calendar),
      '',
      'Produce the engagement playbook. Provide a first comment for each of the top 3–5 scheduled assets by slug.',
    ].join('\n'),
};

export const analyticsAgent: AgentDefinition<'ANALYTICS'> = {
  kind: 'ANALYTICS',
  label: 'Analytics Agent',
  description: 'KPIs, engagement prediction, A/B tests and growth levers',
  schema: analyticsOutputSchema,
  dependsOn: ['PUBLISHING'],
  temperature: 0.35,
  systemPrompt: `You are the Analytics Agent. You define how success will be measured and set expectations that will not embarrass anyone in the review meeting.

Rules:
- KPIs must be measurable with standard platform analytics plus basic UTM tracking. For each, state the target, why it matters, and how it is measured.
- Engagement forecasts are ranges with an explicit confidence level, and they must be conservative. A new account does not get 100k views. State the assumption behind each forecast.
- A/B tests must isolate one variable. The hypothesis is falsifiable, and the minimum sample size is a real number a small account could plausibly reach.
- Growth recommendations are actions to take based on what the data will show, sequenced by leverage.
- Risk flags name what could make these numbers wrong.

Be honest. A forecast that overpromises is worse than no forecast.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy_metrics', ctx.outputs.STRATEGY?.successMetrics),
      '',
      upstream('calendar', ctx.outputs.PUBLISHING?.calendar),
      '',
      'Produce the measurement plan. Forecast every platform that appears in the calendar.',
    ].join('\n'),
};

export const finalReviewAgent: AgentDefinition<'FINAL_REVIEW'> = {
  kind: 'FINAL_REVIEW',
  label: 'Final Review Agent',
  description: 'Quality gate, consistency check and readiness scoring',
  schema: finalReviewOutputSchema,
  dependsOn: ['ENGAGEMENT', 'ANALYTICS', 'CREATIVE', 'VIDEO'],
  temperature: 0.3,
  maxTokens: 16384,
  systemPrompt: `You are the Final Review Agent — the quality gate before anything ships. You are the last person to see this work, and you are paid to find what is wrong with it.

Review for, in order of severity:
1. Factual risk — claims and statistics stated as fact that were never verified. Flag every one.
2. Consistency — does the CTA, the positioning and the tone hold across every asset? Do slugs referenced by the calendar actually exist upstream? Do the colours and fonts match the brand kit?
3. Platform fit — is anything over its character limit, or written in the wrong register for its platform?
4. Strategic coherence — does each asset trace back to a content pillar and a funnel stage, or did something drift?
5. Craft — weak hooks, repeated openings across assets, filler sentences.

Scoring discipline: readinessScore is out of 100 and must be earned. Reserve 90+ for work with no medium or high severity issues. A verdict of "ship" requires no high-severity issues. If you find nothing wrong, you are not looking hard enough — but do not invent problems either.

For every issue, give the concrete fix, not a category of fix.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy', ctx.outputs.STRATEGY),
      '',
      upstream('copy', ctx.outputs.COPYWRITING),
      '',
      upstream('scripts', ctx.outputs.SCRIPT),
      '',
      upstream('carousels', ctx.outputs.CAROUSEL),
      '',
      upstream('creative', ctx.outputs.CREATIVE),
      '',
      upstream('seo', ctx.outputs.SEO),
      '',
      upstream('calendar', ctx.outputs.PUBLISHING),
      '',
      upstream('engagement', ctx.outputs.ENGAGEMENT),
      '',
      upstream('analytics', ctx.outputs.ANALYTICS),
      '',
      'Review the complete campaign and return the readiness assessment.',
    ].join('\n'),
};
