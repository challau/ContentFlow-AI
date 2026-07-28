import type { Brief } from './brief';
import type { Rng } from './rng';

export interface GenContext {
  brief: Brief;
  rng: Rng;
  /** Property name being generated, e.g. `metaDescription`. */
  key: string;
  /** Zero-based position when generating an array element. */
  index: number;
}

type FieldGen = (ctx: GenContext) => string;

const HEX_PALETTE = [
  '#4F46E5', '#7C3AED', '#0EA5E9', '#059669', '#EA580C',
  '#DC2626', '#DB2777', '#0F172A', '#F59E0B', '#14B8A6',
];

const HEADING_FONTS = ['Satoshi', 'Clash Display', 'Inter Tight', 'Sora', 'General Sans'];
const BODY_FONTS = ['Inter', 'Source Sans 3', 'IBM Plex Sans', 'Karla', 'Public Sans'];

const PLATFORM_TIMES = ['07:30', '09:15', '11:00', '12:45', '17:30', '19:00', '20:15'];

/** Slug roles, indexed positionally so every agent derives the same slug. */
const SLUG_ROLES = [
  'hook', 'proof', 'demo', 'story', 'offer',
  'insight', 'compare', 'faq', 'behind-the-scenes', 'recap',
  'objection', 'metric', 'teardown', 'checklist',
] as const;

/**
 * Field-name keyed writers. Every one interpolates the brief so output stays
 * on-topic instead of reading like lorem ipsum.
 */
const FIELD_WRITERS: Record<string, FieldGen> = {
  summary: ({ brief }) =>
    `${brief.topic} sits in the ${brief.category} space, aimed at ${brief.audience}. ` +
    `The opportunity is that most alternatives treat ${brief.shortTopic} as a feature rather than the core workflow, ` +
    `which leaves a gap for a focused, opinionated product.`,

  executiveSummary: ({ brief }) =>
    `This campaign positions ${brief.topic} against a crowded ${brief.category} field by leading with a single ` +
    `concrete outcome rather than a feature list. Assets are consistent in tone, the funnel has a clear entry point, ` +
    `and every platform variant traces back to the same core promise.`,

  category: ({ brief }) => brief.category,

  valueProposition: ({ brief }) =>
    `${brief.brand} turns ${brief.shortTopic} from a recurring chore into a background process, so ${brief.audience} ` +
    `get the outcome without owning the busywork.`,

  positioningStatement: ({ brief }) =>
    `For ${brief.audience} who are tired of stitching tools together, ${brief.brand} is the ${brief.category} product ` +
    `that handles ${brief.shortTopic} end to end — unlike point solutions that stop at the easy half.`,

  segment: ({ brief, rng }) =>
    rng.pick([
      `Hands-on operators working directly on ${brief.shortTopic}`,
      `Team leads accountable for ${brief.shortTopic} outcomes`,
      `Solo practitioners scaling ${brief.shortTopic} without headcount`,
    ]),

  demographics: ({ rng }) =>
    rng.pick([
      '26–40, urban, majority mobile-first, high tool literacy',
      '30–48, mixed metro and remote, spends 4+ hours daily in software',
      '24–35, early-career and fast-promoting, discovers tools socially',
    ]),

  motivations: ({ brief, rng }) =>
    rng.pick([
      `Reclaim hours currently lost to ${brief.shortTopic}`,
      'Look credible and prepared in front of stakeholders',
      'Stop context-switching between four half-solutions',
      'Ship faster without hiring',
    ]),

  objections: ({ brief, rng }) =>
    rng.pick([
      'We already pay for something that half-does this',
      `Migrating our existing ${brief.shortTopic} process sounds painful`,
      'Hard to justify the spend without proof it sticks',
      'Worried about data handling and compliance',
    ]),

  whereTheyHangOut: ({ brief, rng }) =>
    rng.pick([
      'LinkedIn (long-form + comments)',
      `Niche subreddits about ${brief.shortTopic}`,
      'Industry newsletters and Slack communities',
      'YouTube deep-dives and comparison videos',
    ]),

  pain: ({ brief, rng }) =>
    rng.pick([
      `${brief.shortTopic} eats hours every week with nothing reusable at the end`,
      `No single source of truth for ${brief.shortTopic}, so work gets redone`,
      `Quality swings wildly depending on who handles ${brief.shortTopic}`,
      `Handoffs around ${brief.shortTopic} drop details constantly`,
    ]),

  evidence: ({ rng }) =>
    rng.pick([
      'Recurring theme in community threads and review-site complaints',
      'Consistently cited in support tickets and churn interviews',
      'Shows up in competitor review one-stars as the top gripe',
    ]),

  name: ({ brief, rng, index }) =>
    rng.pick([
      `${brief.category} incumbent ${index + 1}`,
      `Established ${brief.shortTopic} suite`,
      `Fast-growing ${brief.category} challenger`,
      'DIY spreadsheet + manual process',
    ]),

  positioning: ({ rng }) =>
    rng.pick([
      'Broad all-in-one suite, priced for enterprise',
      'Cheap and simple, but shallow past the first use case',
      'Developer-first, strong API, weak onboarding',
      'Free and ubiquitous, zero workflow support',
    ]),

  strengths: ({ rng }) =>
    rng.pick([
      'Strong brand recall and category ownership',
      'Deep integration catalogue',
      'Aggressive free tier drives top-of-funnel',
      'Established trust with procurement',
    ]),

  weaknesses: ({ brief, rng }) =>
    rng.pick([
      `Treats ${brief.shortTopic} as a checkbox feature`,
      'Onboarding takes weeks before value shows up',
      'Pricing scales badly for small teams',
      'UI hasn’t moved in years; feels dated',
    ]),

  contentAngle: ({ brief }) =>
    `Show the specific ${brief.shortTopic} workflow they handle badly, side by side, with real timings.`,

  differentiators: ({ brief, rng }) =>
    rng.pick([
      `Purpose-built for ${brief.shortTopic} rather than retrofitted`,
      'Value visible in the first session, not the first quarter',
      'Opinionated defaults so there is nothing to configure',
      'Transparent pricing with no seat-count penalty',
    ]),

  risks: ({ brief, rng }) =>
    rng.pick([
      'Category is noisy — undifferentiated messaging will be ignored',
      `Buyers may see ${brief.shortTopic} as nice-to-have in a tight budget cycle`,
      'Incumbents can copy surface features quickly',
      'Trust and data-handling questions can stall deals',
    ]),

  trend: ({ brief, rng }) =>
    rng.pick([
      `Consolidation: buyers replacing three tools with one for ${brief.shortTopic}`,
      'Shift from feature marketing to outcome marketing',
      'Short-form video outperforming static for consideration-stage content',
      'Rising demand for transparent, self-serve pricing',
    ]),

  relevance: ({ brief }) =>
    `Directly shapes how ${brief.topic} should be framed in the first five seconds of any asset.`,

  claim: ({ brief, rng }) =>
    rng.pick([
      `Teams report multiple hours per week lost to ${brief.shortTopic}`,
      'Outcome-led headlines consistently outperform feature-led ones',
      'Most buyers evaluate three or more options before deciding',
    ]),

  campaignName: ({ brief }) => `${brief.brand}: Ship the Outcome`,

  objective: ({ brief }) => brief.goal,

  toneOfVoice: ({ brief }) => brief.tone,

  messagingHierarchy: ({ brief, rng }) =>
    rng.pick([
      `Primary: ${brief.brand} removes ${brief.shortTopic} from your week`,
      'Secondary: works on day one, no migration project',
      'Tertiary: transparent pricing, cancel whenever',
      'Proof: side-by-side timings and customer quotes',
    ]),

  postingCadence: ({ rng }) =>
    rng.pick([
      '5 posts/week: 2 LinkedIn, 2 short-form video, 1 long-form',
      '4 posts/week plus one newsletter send',
      'Daily short-form, twice-weekly long-form, weekly email',
    ]),

  successMetrics: ({ rng }) =>
    rng.pick([
      'Qualified signups per week',
      'Landing-page visit → trial conversion rate',
      'Engagement rate on consideration-stage posts',
      'Cost per qualified lead',
    ]),

  rationale: ({ brief }) =>
    `This is where ${brief.audience} already research options, and the format supports proof rather than claims.`,

  contentMix: ({ rng }) =>
    rng.pick([
      '50% education, 30% proof, 20% direct offer',
      '40% short-form video, 40% written insight, 20% CTA-led',
      '60% workflow demos, 25% customer stories, 15% announcements',
    ]),

  description: ({ brief, rng }) =>
    rng.pick([
      `Practical, repeatable takes on ${brief.shortTopic} that stand alone without the product.`,
      `Behind-the-scenes proof that ${brief.brand} does what the headline says.`,
      `Opinionated positions on how ${brief.category} teams should work.`,
    ]),

  // Deterministic in the brief and the index only — never the RNG. Agents are
  // seeded separately, so a random slug would stop the Publishing calendar from
  // resolving the assets that Copywriting and Carousel produced.
  slug: ({ brief, index }) =>
    `${brief.keywords[0] ?? 'asset'}-${SLUG_ROLES[index % SLUG_ROLES.length]}-${index + 1}`,

  format: ({ rng }) => rng.pick(['single-image post', 'text post', 'carousel', 'short video', 'article']),

  pillar: ({ rng }) => rng.pick(['Education', 'Proof', 'Point of view', 'Product']),

  workingTitle: ({ brief, rng }) =>
    rng.pick([
      `The real cost of manual ${brief.shortTopic}`,
      `We rebuilt ${brief.shortTopic} from scratch — here’s what changed`,
      `Three things everyone gets wrong about ${brief.shortTopic}`,
      `${brief.brand} in 60 seconds`,
    ]),

  angle: ({ brief }) => `Lead with the measurable outcome of fixing ${brief.shortTopic}, not the feature list.`,

  notes: ({ brief }) => `Keep every asset traceable to the same promise about ${brief.shortTopic}.`,

  headline: ({ brief, rng }) =>
    rng.pick([
      `Stop losing your week to ${brief.shortTopic}`,
      `${brief.brand} handles ${brief.shortTopic} so you don’t have to`,
      `${brief.shortTopic}, done before you open your laptop`,
    ]),

  hook: ({ brief, rng }) =>
    rng.pick([
      `Most teams lose hours a week to ${brief.shortTopic} and never measure it.`,
      `We timed ${brief.shortTopic} for a month. The number was worse than expected.`,
      `If ${brief.shortTopic} still lives in a spreadsheet, this is for you.`,
    ]),

  body: ({ brief }) =>
    `${brief.shortTopic} is one of those tasks nobody owns, so it quietly expands until it fills the gaps in everyone's week.\n\n` +
    `${brief.brand} takes the whole loop: capture, structure, and hand-off — without a migration project or a config marathon. ` +
    `You keep the judgement calls, it takes the repetitive half.\n\n` +
    `Built for ${brief.audience}, and useful in the first session rather than the first quarter.`,

  cta: ({ brief, rng }) =>
    rng.pick([
      `Try ${brief.brand} free — no card, no call.`,
      'See the 90-second walkthrough.',
      'Grab the template and run it yourself.',
    ]),

  caption: ({ brief }) =>
    `Everything we learned building ${brief.brand} for ${brief.shortTopic}, condensed. Save this one.`,

  spoken: ({ brief, rng }) =>
    rng.pick([
      `Here's the part of ${brief.shortTopic} nobody budgets for.`,
      `We tried three tools before building ${brief.brand}. This is why they failed.`,
      `Watch how long this takes manually — then watch the same thing here.`,
      'That’s the whole workflow. No setup, no migration.',
    ]),

  onScreenText: ({ brief, rng }) =>
    rng.pick([`${brief.shortTopic.toUpperCase()}`, 'BEFORE', 'AFTER', '4 HRS → 6 MIN', 'NO SETUP']),

  visual: ({ brief, rng }) =>
    rng.pick([
      'Tight screen recording, cursor highlighted, 1.5x speed',
      'Talking head, shallow depth of field, natural window light',
      `Split screen: manual ${brief.shortTopic} vs ${brief.brand}`,
      'Timer overlay counting up on the manual side',
    ]),

  retentionTactics: ({ rng }) =>
    rng.pick([
      'Open on the result, then rewind to the process',
      'Hard cut every 2.5s in the first 10 seconds',
      'On-screen timer creates an open loop',
      'Withhold the payoff number until the final beat',
    ]),

  visualDirection: ({ brief, rng }) =>
    rng.pick([
      'Bold single statistic, tight type, high contrast background',
      `Annotated screenshot of the ${brief.shortTopic} view`,
      'Two-column before/after with a single accent colour',
      'Full-bleed quote card, generous whitespace',
    ]),

  designNote: ({ rng }) =>
    rng.pick([
      'Keep to one idea per slide; no paragraph blocks',
      'Accent colour used once per slide, never twice',
      'Type scale steps by 1.5x for hierarchy',
    ]),

  artDirection: ({ brief }) =>
    `Clean, high-contrast, editorial. Product-first imagery over stock photography. ` +
    `Every visual should make the ${brief.shortTopic} outcome legible at thumbnail size.`,

  usage: ({ rng }) =>
    rng.pick(['Primary CTA and links', 'Backgrounds and surfaces', 'Accent and highlights', 'Body text and icons']),

  headingFont: ({ rng }) => rng.pick(HEADING_FONTS),
  bodyFont: ({ rng }) => rng.pick(BODY_FONTS),

  pairingNotes: () =>
    'Geometric display paired with a neutral grotesque body keeps headlines loud without hurting readability.',

  purpose: ({ brief, rng }) =>
    rng.pick([
      'Hero image for the landing page',
      `Thumbnail for the ${brief.shortTopic} explainer`,
      'Social share card',
      'In-app empty state',
    ]),

  prompt: ({ brief }) =>
    `Editorial product photograph representing ${brief.topic}, clean studio lighting, shallow depth of field, ` +
    `high contrast, muted background, single accent colour, negative space on the right for type, 35mm, sharp focus`,

  negativePrompt: () =>
    'text, watermark, logo, cluttered background, low contrast, distorted hands, stock-photo smiling, oversaturated',

  aspectRatio: ({ rng }) => rng.pick(['1:1', '4:5', '16:9', '9:16']),

  textOverlay: ({ brief, rng }) =>
    rng.pick([`${brief.shortTopic}, solved`, '4 hrs → 6 min', 'Before / After', 'No setup required']),

  placement: ({ rng }) => rng.pick(['Website hero', 'Email header', 'LinkedIn banner', 'Ad placement']),

  layout: ({ rng }) =>
    rng.pick([
      'Vertical timeline with milestone markers',
      'Three-column comparison grid',
      'Single big number with supporting captions',
    ]),

  shotType: ({ rng }) => rng.pick(['Wide establishing', 'Medium two-shot', 'Tight close-up', 'Over-the-shoulder screen', 'Macro detail']),

  cameraMovement: ({ rng }) => rng.pick(['Locked off', 'Slow push in', 'Handheld drift', 'Whip pan transition', 'Slider left-to-right']),

  bRoll: ({ brief, rng }) =>
    rng.pick([
      'Hands on keyboard, shallow focus',
      `Screen capture of the ${brief.shortTopic} flow`,
      'Notebook and coffee, morning light',
      'Team whiteboard session, out of focus background',
    ]),

  animations: ({ rng }) =>
    rng.pick([
      'Kinetic type on the key statistic',
      'Cursor spotlight with soft vignette',
      'Number counter ticking up',
      'Wipe transition matched to the beat',
    ]),

  mood: ({ rng }) => rng.pick(['Focused and driving', 'Warm and human', 'Tense then resolving', 'Bright and optimistic']),
  reference: ({ rng }) => rng.pick(['Minimal lo-fi percussion', 'Ambient synth pad', 'Muted indie guitar', 'Clean electronic pulse']),
  bpm: ({ rng }) => rng.pick(['90-100 bpm', '100-115 bpm', '115-125 bpm']),

  equipment: ({ rng }) =>
    rng.pick(['Mirrorless body, 35mm prime', 'Lav mic + backup shotgun', 'Two-point soft key lighting', 'Screen capture at 60fps']),

  primaryKeyword: ({ brief }) => brief.keywords.slice(0, 2).join(' '),
  keyword: ({ brief, rng, index }) =>
    [brief.keywords.slice(0, 2).join(' '), rng.pick(['software', 'tool', 'for teams', 'alternative', 'pricing', 'guide'])]
      .join(' ')
      .trim() + (index > 2 ? ` ${index}` : ''),

  volumeEstimate: ({ rng }) => rng.pick(['100–500/mo', '500–2k/mo', '2k–8k/mo', '8k+/mo']),

  metaTitle: ({ brief }) => truncate(`${brief.brand} — ${brief.shortTopic} without the busywork`, 68),
  metaDescription: ({ brief }) =>
    truncate(
      `${brief.brand} handles ${brief.shortTopic} end to end for ${brief.audience}. Works from day one, no migration project.`,
      175,
    ),

  text: ({ brief, rng }) =>
    rng.pick([
      `What ${brief.shortTopic} actually costs you`,
      'How the workflow works',
      'Before and after, measured',
      'Pricing and what’s included',
      'Frequently asked questions',
    ]),

  anchor: ({ brief, rng }) => rng.pick([`${brief.shortTopic} guide`, 'pricing', 'customer stories', 'product tour']),
  target: ({ brief, rng }) => `/${rng.pick(['guide', 'pricing', 'stories', 'tour'])}/${brief.keywords[0] ?? 'index'}`,

  schemaMarkup: ({ brief }) =>
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: brief.brand,
      applicationCategory: brief.category,
      description: `${brief.brand} handles ${brief.shortTopic} for ${brief.audience}.`,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    }),

  timezone: () => 'UTC',
  timeOfDay: ({ rng }) => rng.pick(PLATFORM_TIMES),

  cadenceSummary: () =>
    'Front-load proof assets in week one, sustain with education, and reserve direct-offer posts for the back half.',

  transformation: ({ rng }) =>
    rng.pick([
      'Cut to a 30s vertical with burned-in captions',
      'Expand into a long-form article with the same spine',
      'Split into a five-slide carousel, one idea per slide',
      'Reduce to a single quote card',
    ]),

  from: ({ rng }) => rng.pick(['Long-form video', 'Blog article', 'Customer interview', 'Webinar recording']),
  to: ({ rng }) => rng.pick(['Short-form vertical', 'Carousel', 'Email section', 'Quote card']),

  comment: ({ brief }) =>
    `Wrote up the full breakdown of how we handle ${brief.shortTopic} — link in the thread if it's useful.`,

  scenario: ({ rng }) =>
    rng.pick([
      'Someone asks how it compares to the incumbent',
      'Someone says the price is too high',
      'Someone asks about data handling',
      'Someone shares a competing tool',
      'Someone reports a bug in the comments',
    ]),

  reply: ({ brief }) =>
    `Fair question — the short version is ${brief.brand} owns the whole ${brief.shortTopic} loop rather than one step. ` +
    `Happy to show the side-by-side if that's useful.`,

  question: ({ brief, rng }) =>
    rng.pick([
      `How much time does ${brief.shortTopic} cost you weekly?`,
      `What's your current ${brief.shortTopic} setup?`,
      'What would you fix first if you could?',
    ]),

  stage: ({ rng }) => rng.pick(['awareness', 'consideration', 'conversion', 'retention']),

  communityTactics: ({ brief, rng }) =>
    rng.pick([
      'Reply to every comment in the first 60 minutes',
      `Share the raw numbers behind ${brief.shortTopic} claims when asked`,
      'Feature a customer workflow weekly',
      'Run a monthly open office-hours session',
    ]),

  why: ({ brief }) => `Directly tracks whether the ${brief.shortTopic} message is converting rather than just reaching.`,
  measurement: ({ rng }) =>
    rng.pick([
      'Platform analytics, weekly rollup',
      'UTM-tagged links into product analytics',
      'Attribution survey on signup',
    ]),

  expectedReach: ({ rng }) => rng.pick(['2k–6k', '6k–15k', '15k–40k', '40k+']),
  expectedEngagementRate: ({ rng }) => rng.pick(['1.8%–2.6%', '2.5%–4.0%', '4.0%–6.5%']),

  hypothesis: ({ brief, rng }) =>
    rng.pick([
      `An outcome-led hook outperforms a feature-led hook for ${brief.shortTopic}`,
      'A specific number in the first line lifts completion rate',
      'A soft CTA converts better than a hard CTA at awareness stage',
    ]),

  variantA: ({ brief }) => `Feature-led: "${brief.brand} now supports ${brief.shortTopic}"`,
  variantB: ({ brief }) => `Outcome-led: "Get your week back from ${brief.shortTopic}"`,
  metric: ({ rng }) => rng.pick(['Click-through rate', 'Signup conversion', '3s video retention', 'Save rate']),
  minimumSampleSize: ({ rng }) => rng.pick(['~1,200 impressions per arm', '~800 sessions per arm', '~2,000 impressions per arm']),

  growthRecommendations: ({ brief, rng }) =>
    rng.pick([
      'Double down on the two formats that carry the highest save rate',
      `Turn the best-performing ${brief.shortTopic} post into a permanent landing page`,
      'Build a repeatable customer-story format and run it monthly',
      'Move the strongest organic hook into paid once CPL is known',
    ]),

  riskFlags: ({ rng }) =>
    rng.pick([
      'Forecasts are directional until two weeks of first-party data exist',
      'Single-channel dependence if LinkedIn underperforms',
      'Claims need substantiation before paid amplification',
    ]),

  brandConsistency: ({ brief }) =>
    `Tone holds across all assets — ${brief.tone}. Palette and type usage are consistent, and every CTA points to the same next step.`,

  factCheckFlags: ({ brief }) =>
    `Quantified claims about ${brief.shortTopic} are directional and need first-party data before publication.`,

  area: ({ rng }) => rng.pick(['Copy', 'Design', 'SEO', 'Scheduling', 'Compliance']),
  issue: ({ brief, rng }) =>
    rng.pick([
      'Two assets open with near-identical hooks',
      `Statistical claim about ${brief.shortTopic} lacks a cited source`,
      'CTA differs slightly between platforms, weakening recall',
    ]),
  fix: ({ rng }) =>
    rng.pick([
      'Rewrite the weaker hook to lead with a different angle',
      'Replace with a first-party number or soften the claim',
      'Standardise CTA wording across every variant',
    ]),

  title: ({ brief, rng }) =>
    rng.pick([
      `${brief.shortTopic}: the honest breakdown`,
      `How ${brief.brand} works`,
      `Why we rebuilt ${brief.shortTopic}`,
    ]),
};

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Generic fallback for property names with no dedicated writer. */
function genericSentence(ctx: GenContext): string {
  const { brief, rng, key } = ctx;
  const readable = key.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  return rng.pick([
    `${capitalize(readable)} for ${brief.topic}, framed around the ${brief.shortTopic} outcome.`,
    `Applies to ${brief.audience} evaluating ${brief.topic}.`,
    `Keep this aligned with the core ${brief.shortTopic} promise.`,
  ]);
}

function capitalize(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function writeString(ctx: GenContext, constraints: { maxLength?: number; pattern?: string }): string {
  if (constraints.pattern) {
    // The only regex-constrained field in the contracts is a hex colour.
    if (/#\[0-9a-fA-F\]|#\?\[/.test(constraints.pattern) || constraints.pattern.includes('0-9a-fA-F')) {
      return ctx.rng.pick(HEX_PALETTE);
    }
  }
  const writer = FIELD_WRITERS[ctx.key];
  const value = writer ? writer(ctx) : genericSentence(ctx);
  return constraints.maxLength ? truncate(value, constraints.maxLength) : value;
}

export { HEX_PALETTE };
