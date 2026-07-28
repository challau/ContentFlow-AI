/**
 * Canonical domain vocabulary for ContentFlow AI.
 * Shared by the API, the worker and (later) the web client so that agent
 * identifiers, platform slugs and status values can never drift apart.
 */

export const AGENT_KINDS = [
  'RESEARCH',
  'STRATEGY',
  'PLANNER',
  'COPYWRITING',
  'SCRIPT',
  'CAROUSEL',
  'CREATIVE',
  'VIDEO',
  'SEO',
  'PUBLISHING',
  'ENGAGEMENT',
  'ANALYTICS',
  'FINAL_REVIEW',
] as const;

export type AgentKind = (typeof AGENT_KINDS)[number];

export const PLATFORMS = [
  'INSTAGRAM',
  'LINKEDIN',
  'X',
  'FACEBOOK',
  'TIKTOK',
  'YOUTUBE',
  'BLOG',
  'EMAIL',
  'NEWSLETTER',
  'PRODUCT_HUNT',
  'REDDIT',
  'WHATSAPP',
  'TELEGRAM',
] as const;

export type Platform = (typeof PLATFORMS)[number];

/** How a user described the thing they want content about. */
export const SOURCE_KINDS = [
  'TOPIC',
  'PRODUCT',
  'STARTUP',
  'PROJECT',
  'YOUTUBE_VIDEO',
  'BLOG',
  'WEBSITE',
  'PDF',
  'GITHUB_REPO',
  'RESEARCH_PAPER',
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const RUN_STATUSES = [
  'QUEUED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const EXECUTION_STATUSES = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
] as const;

export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const LLM_PROVIDERS = ['anthropic', 'openai', 'gemini', 'local'] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/**
 * Default execution graph. Edges are "depends on" — an agent runs once every
 * agent it lists has completed. Agents at the same depth run concurrently,
 * which is why CAROUSEL/CREATIVE/SEO fan out from the planner together.
 */
export const DEFAULT_AGENT_GRAPH: Record<AgentKind, AgentKind[]> = {
  RESEARCH: [],
  STRATEGY: ['RESEARCH'],
  PLANNER: ['STRATEGY'],
  COPYWRITING: ['PLANNER'],
  SCRIPT: ['PLANNER'],
  CAROUSEL: ['PLANNER'],
  CREATIVE: ['PLANNER'],
  VIDEO: ['SCRIPT'],
  SEO: ['COPYWRITING'],
  PUBLISHING: ['COPYWRITING', 'SCRIPT', 'CAROUSEL', 'SEO'],
  ENGAGEMENT: ['PUBLISHING'],
  ANALYTICS: ['PUBLISHING'],
  FINAL_REVIEW: ['ENGAGEMENT', 'ANALYTICS', 'CREATIVE', 'VIDEO'],
};

export const AGENT_LABELS: Record<AgentKind, string> = {
  RESEARCH: 'Research Agent',
  STRATEGY: 'Strategy Agent',
  PLANNER: 'Content Planner',
  COPYWRITING: 'Copywriting Agent',
  SCRIPT: 'Script Agent',
  CAROUSEL: 'Carousel Agent',
  CREATIVE: 'Creative Design Agent',
  VIDEO: 'Video Production Agent',
  SEO: 'SEO Agent',
  PUBLISHING: 'Publishing Agent',
  ENGAGEMENT: 'Engagement Agent',
  ANALYTICS: 'Analytics Agent',
  FINAL_REVIEW: 'Final Review Agent',
};

export const AGENT_DESCRIPTIONS: Record<AgentKind, string> = {
  RESEARCH: 'Market, competitor and audience research with pain points and trends',
  STRATEGY: 'Platform selection, campaign goals, funnel and content pillars',
  PLANNER: 'Turns strategy into a concrete per-platform content plan',
  COPYWRITING: 'Captions, posts, threads, blog drafts, landing and email copy',
  SCRIPT: 'Reels, shorts, long-form video, podcast and webinar outlines',
  CAROUSEL: 'Slide-by-slide carousels and presentation decks',
  CREATIVE: 'Image/thumbnail/banner prompts, palette and typography direction',
  VIDEO: 'Storyboard, shot list, b-roll, music and an editing timeline',
  SEO: 'Keywords, metadata, internal links, schema and hashtags',
  PUBLISHING: 'Best platform, timing, content calendar and cross-post schedule',
  ENGAGEMENT: 'First comments, reply templates, polls and CTAs',
  ANALYTICS: 'KPIs, engagement prediction, A/B tests and growth levers',
  FINAL_REVIEW: 'Quality gate, consistency check and readiness scoring',
};

/** Hard character ceilings enforced on generated copy, per platform. */
export const PLATFORM_LIMITS: Record<Platform, { maxChars: number; label: string }> = {
  INSTAGRAM: { maxChars: 2200, label: 'Instagram' },
  LINKEDIN: { maxChars: 3000, label: 'LinkedIn' },
  X: { maxChars: 280, label: 'X' },
  FACEBOOK: { maxChars: 63206, label: 'Facebook' },
  TIKTOK: { maxChars: 2200, label: 'TikTok' },
  YOUTUBE: { maxChars: 5000, label: 'YouTube' },
  BLOG: { maxChars: 100000, label: 'Blog' },
  EMAIL: { maxChars: 20000, label: 'Email' },
  NEWSLETTER: { maxChars: 40000, label: 'Newsletter' },
  PRODUCT_HUNT: { maxChars: 5000, label: 'Product Hunt' },
  REDDIT: { maxChars: 40000, label: 'Reddit' },
  WHATSAPP: { maxChars: 4096, label: 'WhatsApp' },
  TELEGRAM: { maxChars: 4096, label: 'Telegram' },
};
