import { Rng } from './rng';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'for', 'and', 'or', 'of', 'to', 'in', 'on', 'with', 'that',
  'this', 'my', 'our', 'your', 'is', 'are', 'be', 'app', 'platform', 'tool',
]);

export interface Brief {
  topic: string;
  /** Two or three meaningful words, e.g. "note taking doctors". */
  shortTopic: string;
  /** Title-cased product-ish name derived from the topic. */
  brand: string;
  keywords: string[];
  audience: string;
  goal: string;
  tone: string;
  category: string;
  /** Platforms the brief asked for; generators prefer these over random ones. */
  platforms: string[];
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const CATEGORIES: Array<[RegExp, string]> = [
  [/\b(saas|platform|dashboard|api|developer|devtool|infra)\b/i, 'B2B SaaS'],
  [/\b(health|clinic|doctor|patient|medical|therapy|wellness)\b/i, 'Health & Care'],
  [/\b(finance|fintech|bank|invest|payment|budget|tax)\b/i, 'Fintech'],
  [/\b(course|learn|educat|student|training|bootcamp|tutor)\b/i, 'Education'],
  [/\b(shop|ecommerce|store|retail|brand|product launch)\b/i, 'Commerce'],
  [/\b(ai|ml|agent|llm|automation|model)\b/i, 'AI & Automation'],
  [/\b(travel|hotel|trip|tour|flight)\b/i, 'Travel'],
  [/\b(food|restaurant|recipe|cafe|kitchen)\b/i, 'Food & Beverage'],
  [/\b(fitness|gym|workout|run|yoga)\b/i, 'Fitness'],
  [/\b(game|gaming|esports)\b/i, 'Gaming'],
];

/**
 * Extracts the reusable facts every local generator interpolates, so a brief
 * about "AI note taking for doctors" never produces copy about something else.
 */
export function deriveBrief(input: {
  topic: string;
  audience?: string;
  goal?: string;
  tone?: string;
  platforms?: string[];
}): Brief {
  const topic = input.topic.trim();
  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const keywords = words.length > 0 ? words : [topic.toLowerCase() || 'the product'];
  const shortTopic = keywords.slice(0, 3).join(' ');
  const brand = titleCase(keywords.slice(0, 2).join(' ')) || titleCase(topic);

  const category =
    CATEGORIES.find(([pattern]) => pattern.test(topic))?.[1] ?? 'Modern Digital Brand';

  const rng = new Rng(`brief:${topic}`);
  const audience =
    input.audience?.trim() ||
    rng.pick([
      `founders and operators evaluating ${shortTopic}`,
      `practitioners who deal with ${shortTopic} every week`,
      `teams currently solving ${shortTopic} manually`,
    ]);

  return {
    topic,
    shortTopic,
    brand,
    keywords,
    audience,
    goal: input.goal?.trim() || `drive qualified signups for ${topic}`,
    tone: input.tone?.trim() || 'confident, specific, jargon-free',
    category,
    platforms: input.platforms?.filter(Boolean) ?? [],
  };
}
