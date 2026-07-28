import { z } from 'zod';
import { AGENT_KINDS, PLATFORMS, SOURCE_KINDS } from './domain';

export const platformSchema = z.enum(PLATFORMS);
export const agentKindSchema = z.enum(AGENT_KINDS);
export const sourceKindSchema = z.enum(SOURCE_KINDS);

/** The user-supplied brief that seeds an entire pipeline run. */
export const pipelineInputSchema = z.object({
  topic: z.string().min(3).max(500),
  sourceKind: sourceKindSchema.default('TOPIC'),
  sourceUrl: z.string().url().optional(),
  audience: z.string().max(500).optional(),
  goal: z.string().max(500).optional(),
  tone: z.string().max(200).optional(),
  platforms: z.array(platformSchema).min(1).max(13).optional(),
  language: z.string().min(2).max(32).default('English'),
  extraContext: z.string().max(20000).optional(),
});
export type PipelineInput = z.infer<typeof pipelineInputSchema>;

// ---------------------------------------------------------------------------
// Agent output contracts
// ---------------------------------------------------------------------------

export const researchOutputSchema = z.object({
  summary: z.string(),
  category: z.string(),
  valueProposition: z.string(),
  targetAudiences: z.array(
    z.object({
      segment: z.string(),
      demographics: z.string(),
      motivations: z.array(z.string()),
      objections: z.array(z.string()),
      whereTheyHangOut: z.array(z.string()),
    }),
  ).min(1),
  painPoints: z.array(z.object({ pain: z.string(), severity: z.enum(['low', 'medium', 'high']), evidence: z.string() })).min(1),
  competitors: z.array(
    z.object({
      name: z.string(),
      positioning: z.string(),
      strengths: z.array(z.string()),
      weaknesses: z.array(z.string()),
      contentAngle: z.string(),
    }),
  ),
  trends: z.array(z.object({ trend: z.string(), relevance: z.string(), momentum: z.enum(['emerging', 'growing', 'peaking', 'declining']) })),
  differentiators: z.array(z.string()),
  risks: z.array(z.string()),
  keyStatistics: z.array(z.object({ claim: z.string(), confidence: z.enum(['low', 'medium', 'high']) })),
});
export type ResearchOutput = z.infer<typeof researchOutputSchema>;

export const strategyOutputSchema = z.object({
  campaignName: z.string(),
  objective: z.string(),
  positioningStatement: z.string(),
  recommendedPlatforms: z.array(
    z.object({
      platform: platformSchema,
      priority: z.enum(['primary', 'secondary', 'experimental']),
      rationale: z.string(),
      contentMix: z.string(),
    }),
  ).min(1),
  contentPillars: z.array(z.object({ name: z.string(), description: z.string(), percentage: z.number().min(0).max(100) })).min(3),
  funnel: z.object({
    awareness: z.array(z.string()),
    consideration: z.array(z.string()),
    conversion: z.array(z.string()),
    retention: z.array(z.string()),
  }),
  toneOfVoice: z.string(),
  messagingHierarchy: z.array(z.string()),
  postingCadence: z.string(),
  successMetrics: z.array(z.string()),
}).refine(
  (v) => {
    const total = v.contentPillars.reduce((n, p) => n + p.percentage, 0);
    return Math.abs(total - 100) < 0.5;
  },
  {
    message: 'contentPillars percentages must sum to 100',
    path: ['contentPillars'],
  },
);
export type StrategyOutput = z.infer<typeof strategyOutputSchema>;

export const plannerOutputSchema = z.object({
  campaignDurationDays: z.number().int().min(1).max(365),
  items: z.array(
    z.object({
      slug: z.string(),
      platform: platformSchema,
      format: z.string(),
      pillar: z.string(),
      workingTitle: z.string(),
      angle: z.string(),
      objective: z.string(),
      funnelStage: z.enum(['awareness', 'consideration', 'conversion', 'retention']),
      dayOffset: z.number().int().min(0),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ).min(1),
  notes: z.array(z.string()),
});
export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

export const copywritingOutputSchema = z.object({
  pieces: z.array(
    z.object({
      slug: z.string(),
      platform: platformSchema,
      format: z.string(),
      headline: z.string(),
      body: z.string(),
      hook: z.string(),
      cta: z.string(),
      hashtags: z.array(z.string()),
      characterCount: z.number().int().nonnegative(),
      variants: z.array(z.object({ label: z.string(), body: z.string() })),
    }),
  ).min(1),
});
export type CopywritingOutput = z.infer<typeof copywritingOutputSchema>;

export const scriptOutputSchema = z.object({
  scripts: z.array(
    z.object({
      slug: z.string(),
      format: z.enum(['reel', 'short', 'youtube_long', 'podcast', 'webinar', 'tiktok']),
      title: z.string(),
      durationSeconds: z.number().int().positive(),
      hook: z.string(),
      beats: z.array(z.object({ timestamp: z.string(), spoken: z.string(), onScreenText: z.string(), visual: z.string() })).min(1),
      cta: z.string(),
      retentionTactics: z.array(z.string()),
    }),
  ).min(1),
});
export type ScriptOutput = z.infer<typeof scriptOutputSchema>;

export const carouselOutputSchema = z.object({
  carousels: z.array(
    z.object({
      slug: z.string(),
      platform: platformSchema,
      title: z.string(),
      slides: z.array(
        z.object({
          index: z.number().int().min(1),
          headline: z.string(),
          body: z.string(),
          visualDirection: z.string(),
          designNote: z.string(),
        }),
      ).min(3),
      caption: z.string(),
    }),
  ).min(1),
});
export type CarouselOutput = z.infer<typeof carouselOutputSchema>;

export const creativeOutputSchema = z.object({
  colorPalette: z.array(z.object({ name: z.string(), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/), usage: z.string() })).min(3),
  typography: z.object({ headingFont: z.string(), bodyFont: z.string(), rationale: z.string(), pairingNotes: z.string() }),
  artDirection: z.string(),
  imagePrompts: z.array(z.object({ slug: z.string(), purpose: z.string(), prompt: z.string(), negativePrompt: z.string(), aspectRatio: z.string() })).min(1),
  thumbnailPrompts: z.array(z.object({ slug: z.string(), prompt: z.string(), textOverlay: z.string() })),
  bannerPrompts: z.array(z.object({ slug: z.string(), placement: z.string(), prompt: z.string() })),
  infographicIdeas: z.array(z.object({ title: z.string(), dataPoints: z.array(z.string()), layout: z.string() })),
});
export type CreativeOutput = z.infer<typeof creativeOutputSchema>;

export const videoOutputSchema = z.object({
  productions: z.array(
    z.object({
      slug: z.string(),
      title: z.string(),
      storyboard: z.array(z.object({ scene: z.number().int().min(1), description: z.string(), shotType: z.string(), cameraMovement: z.string(), durationSeconds: z.number() })).min(1),
      bRoll: z.array(z.string()),
      animations: z.array(z.string()),
      musicSuggestions: z.array(z.object({ mood: z.string(), reference: z.string(), bpm: z.string() })),
      editingTimeline: z.array(z.object({ segment: z.string(), startSeconds: z.number(), endSeconds: z.number(), notes: z.string() })),
      equipment: z.array(z.string()),
    }),
  ).min(1),
});
export type VideoOutput = z.infer<typeof videoOutputSchema>;

export const seoOutputSchema = z.object({
  primaryKeyword: z.string(),
  keywords: z.array(z.object({ keyword: z.string(), intent: z.enum(['informational', 'commercial', 'transactional', 'navigational']), difficulty: z.enum(['low', 'medium', 'high']), volumeEstimate: z.string() })).min(3),
  metaTitle: z.string().max(70),
  metaDescription: z.string().max(180),
  slug: z.string(),
  headingOutline: z.array(z.object({ level: z.enum(['h1', 'h2', 'h3']), text: z.string() })).min(3),
  internalLinks: z.array(z.object({ anchor: z.string(), target: z.string() })),
  externalLinks: z.array(z.object({ anchor: z.string(), target: z.string() })),
  schemaMarkup: z.string(),
  hashtagsByPlatform: z.array(z.object({ platform: platformSchema, hashtags: z.array(z.string()) })),
});
export type SeoOutput = z.infer<typeof seoOutputSchema>;

export const publishingOutputSchema = z.object({
  timezone: z.string(),
  calendar: z.array(
    z.object({
      slug: z.string(),
      platform: platformSchema,
      dayOffset: z.number().int().min(0),
      timeOfDay: z.string(),
      rationale: z.string(),
      crossPostTo: z.array(platformSchema),
    }),
  ).min(1),
  bestPlatform: platformSchema,
  cadenceSummary: z.string(),
  repurposingPlan: z.array(z.object({ from: z.string(), to: z.string(), transformation: z.string() })),
});
export type PublishingOutput = z.infer<typeof publishingOutputSchema>;

export const engagementOutputSchema = z.object({
  firstComments: z.array(z.object({ slug: z.string(), comment: z.string() })).min(1),
  replyTemplates: z.array(z.object({ scenario: z.string(), reply: z.string(), tone: z.string() })).min(3),
  pollIdeas: z.array(z.object({ question: z.string(), options: z.array(z.string()), platform: platformSchema })),
  ctaVariants: z.array(z.object({ stage: z.string(), cta: z.string() })),
  communityTactics: z.array(z.string()),
});
export type EngagementOutput = z.infer<typeof engagementOutputSchema>;

export const analyticsOutputSchema = z.object({
  kpis: z.array(z.object({ name: z.string(), target: z.string(), why: z.string(), measurement: z.string() })).min(3),
  engagementForecast: z.array(z.object({ platform: platformSchema, expectedReach: z.string(), expectedEngagementRate: z.string(), confidence: z.enum(['low', 'medium', 'high']) })).min(1),
  abTests: z.array(z.object({ hypothesis: z.string(), variantA: z.string(), variantB: z.string(), metric: z.string(), minimumSampleSize: z.string() })).min(1),
  growthRecommendations: z.array(z.string()).min(3),
  riskFlags: z.array(z.string()),
});
export type AnalyticsOutput = z.infer<typeof analyticsOutputSchema>;

export const finalReviewOutputSchema = z.object({
  readinessScore: z.number().min(0).max(100),
  verdict: z.enum(['ship', 'revise', 'block']),
  strengths: z.array(z.string()).min(1),
  issues: z.array(z.object({ severity: z.enum(['low', 'medium', 'high']), area: z.string(), issue: z.string(), fix: z.string() })),
  brandConsistency: z.string(),
  factCheckFlags: z.array(z.string()),
  executiveSummary: z.string(),
});
export type FinalReviewOutput = z.infer<typeof finalReviewOutputSchema>;

/** Registry mapping each agent to the schema its output must satisfy. */
export const AGENT_OUTPUT_SCHEMAS = {
  RESEARCH: researchOutputSchema,
  STRATEGY: strategyOutputSchema,
  PLANNER: plannerOutputSchema,
  COPYWRITING: copywritingOutputSchema,
  SCRIPT: scriptOutputSchema,
  CAROUSEL: carouselOutputSchema,
  CREATIVE: creativeOutputSchema,
  VIDEO: videoOutputSchema,
  SEO: seoOutputSchema,
  PUBLISHING: publishingOutputSchema,
  ENGAGEMENT: engagementOutputSchema,
  ANALYTICS: analyticsOutputSchema,
  FINAL_REVIEW: finalReviewOutputSchema,
} as const;

export type AgentOutputMap = {
  [K in keyof typeof AGENT_OUTPUT_SCHEMAS]: z.infer<(typeof AGENT_OUTPUT_SCHEMAS)[K]>;
};
