import { Rng } from './rng';

/**
 * Deterministic chat synthesis for the offline provider.
 *
 * The local provider cannot understand language, so it does not pretend to.
 * Instead it performs the *mechanical* part of each editing action honestly —
 * shortening really drops sentences, expansion really adds structure — and
 * says plainly when an action (translation, open-ended reasoning) needs a real
 * model. That keeps the whole chat surface exercisable with no API key while
 * never passing template output off as model output.
 */

export type ChatAction =
  | 'chat'
  | 'rewrite'
  | 'expand'
  | 'shorten'
  | 'change_tone'
  | 'translate'
  | 'ideas';

export interface LocalChatInput {
  action: ChatAction;
  /** The user's latest message. */
  prompt: string;
  /** Content being acted on, when the action targets existing text. */
  content?: string;
  /** Target tone for change_tone, or target language for translate. */
  target?: string;
  /** Names of the user's projects, used to ground generic replies. */
  projectNames?: string[];
  seed?: string;
}

// User-facing, so it names no internal config. The developer-facing wiring
// ("set ANTHROPIC_API_KEY / LLM_PROVIDER=anthropic") lives in docs/API.md.
const OFFLINE_NOTE = '_Demo mode · responses are basic. Connect a full AI model for richer output._';

export function synthesizeChat(input: LocalChatInput): string {
  const rng = new Rng(input.seed ?? `${input.action}:${input.prompt}`);
  const source = (input.content ?? '').trim();

  switch (input.action) {
    case 'shorten':
      return withNote(shorten(source), source);
    case 'expand':
      return withNote(expand(source, rng), source);
    case 'rewrite':
      return withNote(rewrite(source), source);
    case 'change_tone':
      return withNote(changeTone(source, input.target), source);
    case 'translate':
      return translateUnsupported(input.target);
    case 'ideas':
      return withNote(ideas(input.prompt, input.projectNames, rng), 'x');
    case 'chat':
    default:
      return conversational(input.prompt, input.projectNames, rng);
  }
}

function withNote(body: string, source: string): string {
  if (!source) return `I need some content to work with — paste the text or pick an asset first.`;
  return `${body}\n\n${OFFLINE_NOTE}`;
}

/** Splits on sentence terminators while keeping the terminator attached. */
export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function shorten(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  // Keep roughly the first 40%, always at least one sentence.
  const keep = Math.max(1, Math.ceil(sentences.length * 0.4));
  return sentences.slice(0, keep).join(' ');
}

function expand(text: string, rng: Rng): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  const lead = sentences[0];
  const angles = [
    'What this means in practice',
    'Why it matters right now',
    'A concrete example',
    'The objection worth pre-empting',
  ];
  const chosen = rng.sample(angles, 3);
  const body = chosen.map((a) => `**${a}.** ${lead.replace(/[.!?]$/, '')} — expand this point with a specific detail from your own data.`);
  return [text, '', ...body].join('\n');
}

function rewrite(text: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  // Reordering into hook / body / close is a real structural change.
  const [first, ...rest] = sentences;
  const close = rest.length > 1 ? rest[rest.length - 1] : '';
  const middle = rest.slice(0, Math.max(0, rest.length - 1));
  return [first, ...middle, close].filter(Boolean).join(' ');
}

function changeTone(text: string, tone?: string): string {
  const sentences = splitSentences(text);
  if (sentences.length === 0) return '';
  const label = (tone ?? 'neutral').toLowerCase();
  const openers: Record<string, string> = {
    professional: 'A practical note:',
    casual: "Quick thought —",
    friendly: 'Here is the short version:',
    bold: 'Let us be direct:',
    formal: 'Please note the following:',
    skeptical: 'Worth questioning:',
  };
  const opener = openers[label] ?? `Rewritten for a ${label} tone:`;
  return `${opener} ${sentences.join(' ')}`;
}

function translateUnsupported(target?: string): string {
  return (
    `Translation${target ? ` into ${target}` : ''} isn't available in demo mode. ` +
    'Connect a full AI model to translate content accurately.'
  );
}

/** Common shorthand users type for platforms, mapped to their proper name. */
const PLATFORM_ALIASES: Record<string, string> = {
  insta: 'Instagram', ig: 'Instagram', instagram: 'Instagram',
  fb: 'Facebook', facebook: 'Facebook',
  yt: 'YouTube', youtube: 'YouTube',
  li: 'LinkedIn', linkedin: 'LinkedIn',
  twitter: 'X', x: 'X', tweet: 'X', tweets: 'X',
  tiktok: 'TikTok', tik: 'TikTok',
  reddit: 'Reddit', blog: 'a blog', newsletter: 'a newsletter',
};

/** Genuinely useful, beginner-oriented angles per platform. */
const PLATFORM_IDEAS: Record<string, string[]> = {
  Instagram: [
    'Your first 9 grid posts: one theme shown nine different ways',
    'Reels vs carousels — which format to lead with as a brand-new account',
    'A 30-day posting cadence you can actually keep up',
    '3 hooks that stop the scroll in the first second',
    'Turn one idea into a carousel, a Reel, and a Story',
    'A "before I knew this / after" post to build instant relatability',
  ],
  YouTube: [
    'A 5-video starter series that answers your audience\'s top questions',
    'Thumbnail + title pairs that earn the click without clickbait',
    'Short vs long form — where a new channel should start',
    'Turn one long video into 5 Shorts',
    'A repeatable video structure: hook, promise, payoff, CTA',
  ],
  LinkedIn: [
    'A "lesson I learned the hard way" post to open your first week',
    'Document your work in public: one post per milestone',
    'A contrarian take on your industry that invites comments',
    'Turn a win into a step-by-step others can copy',
    'A short story post — problem, turning point, takeaway',
  ],
  X: [
    'A 5-tweet thread teaching one thing you know well',
    'A single strong opinion, stated plainly, to spark replies',
    'Build in public: share one small update a day for a week',
    'Turn a long idea into a punchy 3-tweet thread',
    'A useful list post people will bookmark',
  ],
  TikTok: [
    'A 3-second hook + payoff format you can repeat daily',
    'A "day in the life" that shows, not tells',
    'Jump on one trending sound with your own spin',
    'Answer the one question every beginner in your niche asks',
    'A quick before/after or transformation clip',
  ],
};

const GENERIC_IDEAS = (s: string): string[] => [
  `A myth about ${s} that quietly costs people time`,
  `The one thing you wish you'd known about ${s} on day one`,
  `The smallest useful step someone can take on ${s} today`,
  `A before/after built around ${s}`,
  `A teardown of one real example of ${s}, good or bad`,
  `The mistake almost everyone makes with ${s} — and the fix`,
];

/** Expands aliases, strips "I want to start content on…" style lead-ins. */
export function normalizeSubject(raw: string): string {
  let s = raw.trim();
  for (const [alias, full] of Object.entries(PLATFORM_ALIASES)) {
    s = s.replace(new RegExp(`\\b${alias}\\b`, 'gi'), full);
  }
  const strips = [
    /^\s*i\s+(?:want|need|would\s+like|wanna)\s+to\s+/i,
    /^\s*how\s+(?:do\s+i|to|can\s+i)\s+/i,
    /^\s*(?:help\s+me\s+(?:with\s+)?|please\s+|can\s+you\s+|give\s+me\s+(?:some\s+)?|let'?s\s+)/i,
    /^\s*(?:start(?:ing)?|create|creating|make|making|write|writing|build(?:ing)?|grow(?:ing)?|get(?:ting)?\s+into|do(?:ing)?)\s+/i,
    /^\s*(?:content|posts?|posting|videos?|reels?)\s+(?:in|on|for|about|with|at)\s+/i,
    /^\s*(?:ideas?|some\s+ideas?)\s+(?:for|about|on)?\s*/i,
    /^\s*(?:in|on|for|about|with|at)\s+/i,
  ];
  let prev;
  do {
    prev = s;
    for (const re of strips) s = s.replace(re, '');
    s = s.trim();
  } while (s !== prev && s.length > 0);
  return s.replace(/[.?!]+$/, '').trim() || raw.trim();
}

function detectPlatform(text: string): string | null {
  for (const [alias, full] of Object.entries(PLATFORM_ALIASES)) {
    if (new RegExp(`\\b${alias}\\b`, 'i').test(text) && PLATFORM_IDEAS[full]) return full;
  }
  return null;
}

function ideas(prompt: string, projectNames: string[] | undefined, rng: Rng): string {
  const platform = detectPlatform(prompt);
  const subject = normalizeSubject(prompt) || 'your topic';
  const bank = platform ? PLATFORM_IDEAS[platform] : GENERIC_IDEAS(subject);
  const picked = rng.sample(bank, 5);
  const heading = platform ? `Content ideas for ${platform}` : `Angles for **${subject}**`;
  const context = projectNames?.length ? `\n\nTip: tie these to your project "${projectNames[0]}" for a consistent voice.` : '';
  return `${heading}:\n\n${picked.map((f, i) => `${i + 1}. ${f}`).join('\n')}${context}`;
}

const CONTENT_ASK =
  /\b(start|create|creating|grow|growing|post|posting|content|ideas?|write|writing|make|making|caption|hook|reels?|videos?|thread|insta|instagram|ig|youtube|yt|tiktok|linkedin|twitter|blog|newsletter)\b/i;

function conversational(prompt: string, projectNames: string[] | undefined, rng: Rng): string {
  // A plain-chat message that reads like a content request still deserves a
  // useful answer, so route it through the same platform-aware idea bank
  // rather than a canned deflection.
  if (CONTENT_ASK.test(prompt)) {
    return `${ideas(prompt, projectNames, rng)}\n\n${OFFLINE_NOTE}`;
  }
  const known = projectNames?.length
    ? `I can see your projects: ${projectNames.join(', ')}.`
    : 'You have no projects yet — create one and I can work from its brief.';
  return (
    `${known}\n\n` +
    `You asked: "${truncate(prompt, 200)}"\n\n` +
    'In demo mode I can shorten, expand, rewrite and restructure content you paste in, ' +
    'and suggest content angles. Connect a full AI model for open-ended answers.'
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
