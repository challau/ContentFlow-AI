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
      return conversational(input.prompt, input.projectNames);
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

function ideas(prompt: string, projectNames: string[] | undefined, rng: Rng): string {
  const subject = prompt.replace(/^(give me |generate |some )?ideas?( for| about)?/i, '').trim() || 'your topic';
  const frames = [
    `A myth about ${subject} that costs people time`,
    `What changed about ${subject} in the last year`,
    `The smallest useful thing someone can do about ${subject} today`,
    `A before/after built around ${subject}`,
    `What people get wrong when they first meet ${subject}`,
    `A teardown of one real example of ${subject}`,
  ];
  const picked = rng.sample(frames, 5);
  const context = projectNames?.length ? `\n\nGrounded in your projects: ${projectNames.join(', ')}.` : '';
  return `Angles for **${subject}**:\n\n${picked.map((f, i) => `${i + 1}. ${f}`).join('\n')}${context}`;
}

function conversational(prompt: string, projectNames?: string[]): string {
  const known = projectNames?.length
    ? `I can see your projects: ${projectNames.join(', ')}.`
    : 'You have no projects yet — create one and I can work from its brief.';
  return (
    `${known}\n\n` +
    `You asked: "${truncate(prompt, 200)}"\n\n` +
    'In demo mode I can shorten, expand, rewrite and restructure content you paste in, ' +
    'and suggest angles. Connect a full AI model for open-ended answers.'
  );
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
