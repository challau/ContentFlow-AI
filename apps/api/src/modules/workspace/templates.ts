import { AGENT_KINDS, type AgentKind, type Platform } from '@contentflow/shared';

export interface BuiltInTemplate {
  slug: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  agents: AgentKind[];
  platforms: Platform[];
  defaultInput: {
    goal: string;
    tone: string;
    audience?: string;
  };
}

const ALL: AgentKind[] = [...AGENT_KINDS];

/** Curated starting points shipped with the product. */
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    slug: 'product-launch',
    name: 'Product Launch',
    description: 'Full launch campaign: teaser, launch day, proof and follow-up across every major channel.',
    category: 'Launch',
    icon: '🚀',
    agents: ALL,
    platforms: ['LINKEDIN', 'X', 'INSTAGRAM', 'YOUTUBE', 'PRODUCT_HUNT', 'EMAIL'],
    defaultInput: {
      goal: 'Drive launch-day signups and sustain momentum for two weeks',
      tone: 'confident, specific, energetic without hype',
    },
  },
  {
    slug: 'startup-story',
    name: 'Startup',
    description: 'Founder-led narrative campaign built around the problem, the insight and the traction.',
    category: 'Brand',
    icon: '🌱',
    agents: ALL,
    platforms: ['LINKEDIN', 'X', 'BLOG', 'NEWSLETTER'],
    defaultInput: {
      goal: 'Build founder credibility and inbound interest',
      tone: 'candid, first-person, evidence-led',
    },
  },
  {
    slug: 'personal-branding',
    name: 'Personal Branding',
    description: 'Consistent point-of-view content that compounds authority in one niche.',
    category: 'Brand',
    icon: '👤',
    agents: ['RESEARCH', 'STRATEGY', 'PLANNER', 'COPYWRITING', 'CAROUSEL', 'SEO', 'PUBLISHING', 'ENGAGEMENT', 'ANALYTICS', 'FINAL_REVIEW'],
    platforms: ['LINKEDIN', 'X', 'INSTAGRAM'],
    defaultInput: {
      goal: 'Grow an engaged audience of peers and potential clients',
      tone: 'opinionated, generous, plain-spoken',
    },
  },
  {
    slug: 'saas-growth',
    name: 'SaaS',
    description: 'Product-led growth content mapped to a full acquisition funnel.',
    category: 'Growth',
    icon: '📈',
    agents: ALL,
    platforms: ['LINKEDIN', 'X', 'BLOG', 'EMAIL', 'YOUTUBE'],
    defaultInput: {
      goal: 'Increase qualified trial signups from organic channels',
      tone: 'practical, technical, no fluff',
    },
  },
  {
    slug: 'course-launch',
    name: 'Course Launch',
    description: 'Pre-launch teaching, open-cart sequence and social proof for a cohort or self-paced course.',
    category: 'Launch',
    icon: '🎓',
    agents: ALL,
    platforms: ['INSTAGRAM', 'LINKEDIN', 'EMAIL', 'YOUTUBE', 'TIKTOK'],
    defaultInput: {
      goal: 'Fill the next cohort and build a waitlist for the following one',
      tone: 'warm, credible, teacher-first',
    },
  },
  {
    slug: 'hackathon',
    name: 'Hackathon',
    description: 'Build-in-public content for an intense build sprint, ending in a demo.',
    category: 'Community',
    icon: '⚡',
    agents: ['RESEARCH', 'STRATEGY', 'PLANNER', 'COPYWRITING', 'SCRIPT', 'CREATIVE', 'VIDEO', 'PUBLISHING', 'ENGAGEMENT', 'FINAL_REVIEW'],
    platforms: ['X', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE'],
    defaultInput: {
      goal: 'Attract collaborators, judges and early users during the build',
      tone: 'fast, scrappy, in-the-moment',
    },
  },
  {
    slug: 'job-update',
    name: 'Job Update',
    description: 'Announce a role change in a way that reads as a story, not a status update.',
    category: 'Personal',
    icon: '💼',
    agents: ['RESEARCH', 'STRATEGY', 'PLANNER', 'COPYWRITING', 'SEO', 'PUBLISHING', 'ENGAGEMENT', 'FINAL_REVIEW'],
    platforms: ['LINKEDIN', 'X'],
    defaultInput: {
      goal: 'Share the news and open doors to relevant conversations',
      tone: 'grateful without being saccharine, specific about the work',
    },
  },
  {
    slug: 'portfolio',
    name: 'Portfolio',
    description: 'Turn finished work into a body of evidence across social and long-form.',
    category: 'Personal',
    icon: '🎨',
    agents: ['RESEARCH', 'STRATEGY', 'PLANNER', 'COPYWRITING', 'CAROUSEL', 'CREATIVE', 'SEO', 'PUBLISHING', 'FINAL_REVIEW'],
    platforms: ['INSTAGRAM', 'LINKEDIN', 'BLOG'],
    defaultInput: {
      goal: 'Convert portfolio views into enquiries',
      tone: 'visual-first, process-led, quietly confident',
    },
  },
  {
    slug: 'case-study',
    name: 'Case Study',
    description: 'One customer result, expanded into a full multi-channel proof campaign.',
    category: 'Proof',
    icon: '📊',
    agents: ALL,
    platforms: ['LINKEDIN', 'BLOG', 'EMAIL', 'X'],
    defaultInput: {
      goal: 'Give prospects concrete evidence at the consideration stage',
      tone: 'measured, numbers-first, no superlatives',
    },
  },
];
