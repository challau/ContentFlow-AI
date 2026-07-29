import { normalizeSubject, splitSentences, synthesizeChat } from './chat';

const PARAGRAPH =
  'AI note taking saves clinicians time. It removes the after-hours documentation tail. ' +
  'Most teams never measure how much time it costs them. The fix starts with one clinic. ' +
  'Roll it out once the numbers hold.';

describe('splitSentences', () => {
  it('keeps terminators attached', () => {
    expect(splitSentences('One. Two! Three?')).toEqual(['One.', 'Two!', 'Three?']);
  });

  it('collapses whitespace and drops empties', () => {
    expect(splitSentences('  A.\n\n  B.  ')).toEqual(['A.', 'B.']);
  });

  it('returns nothing for empty input', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('synthesizeChat', () => {
  it('is deterministic for the same seed', () => {
    const args = { action: 'ideas' as const, prompt: 'ideas for onboarding', seed: 'fixed' };
    expect(synthesizeChat(args)).toBe(synthesizeChat(args));
  });

  describe('shorten', () => {
    it('produces strictly fewer sentences', () => {
      const out = synthesizeChat({ action: 'shorten', prompt: 'shorten', content: PARAGRAPH });
      const before = splitSentences(PARAGRAPH).length;
      const after = splitSentences(out.split('\n\n')[0]).length;
      expect(after).toBeLessThan(before);
      expect(after).toBeGreaterThan(0);
    });

    it('keeps at least one sentence for a single-sentence input', () => {
      const out = synthesizeChat({ action: 'shorten', prompt: 'shorten', content: 'Only one.' });
      expect(out).toContain('Only one.');
    });
  });

  describe('expand', () => {
    it('returns more text than it was given', () => {
      const out = synthesizeChat({ action: 'expand', prompt: 'expand', content: PARAGRAPH });
      expect(out.length).toBeGreaterThan(PARAGRAPH.length);
      expect(out).toContain(PARAGRAPH);
    });
  });

  describe('change_tone', () => {
    it('applies a known tone opener', () => {
      const out = synthesizeChat({
        action: 'change_tone',
        prompt: 'make it professional',
        content: PARAGRAPH,
        target: 'professional',
      });
      expect(out).toContain('A practical note:');
    });

    it('falls back gracefully for an unknown tone', () => {
      const out = synthesizeChat({
        action: 'change_tone',
        prompt: 'make it whimsical',
        content: PARAGRAPH,
        target: 'whimsical',
      });
      expect(out).toContain('whimsical');
    });
  });

  describe('translate', () => {
    it('refuses rather than faking a translation', () => {
      const out = synthesizeChat({
        action: 'translate',
        prompt: 'translate',
        content: PARAGRAPH,
        target: 'Spanish',
      });
      expect(out).toMatch(/isn't available in demo mode/i);
      expect(out).toContain('Spanish');
      // The original must not be echoed back as though it were translated.
      expect(out).not.toContain(PARAGRAPH);
      // Internal config must never leak into user-facing copy.
      expect(out).not.toMatch(/ANTHROPIC_API_KEY|LLM_PROVIDER/);
    });
  });

  describe('ideas', () => {
    it('returns five numbered angles', () => {
      const out = synthesizeChat({ action: 'ideas', prompt: 'ideas for AI tools', seed: 's' });
      expect(out).toMatch(/^1\. /m);
      expect(out).toMatch(/^5\. /m);
      expect(out).not.toMatch(/^6\. /m);
    });

    it('ties ideas to the first project when supplied', () => {
      const out = synthesizeChat({
        action: 'ideas',
        prompt: 'ideas for onboarding emails',
        projectNames: ['Launch', 'Rebrand'],
        seed: 's',
      });
      expect(out).toContain('Launch');
    });

    it('expands a platform alias and drops filler lead-ins', () => {
      const out = synthesizeChat({ action: 'ideas', prompt: 'i want to start content in insta', seed: 's' });
      expect(out).toContain('Instagram');
      // The raw filler phrase must not be parroted back.
      expect(out).not.toContain('i want to start content in insta');
    });

    it('gives platform-specific ideas when a platform is named', () => {
      const out = synthesizeChat({ action: 'ideas', prompt: 'youtube ideas', seed: 's' });
      expect(out).toMatch(/Content ideas for YouTube/);
    });
  });

  describe('subject normalization', () => {
    it.each([
      ['i want to start content in insta', 'Instagram'],
      ['how do i grow on youtube', 'YouTube'],
      ['help me with posting on linkedin', 'LinkedIn'],
      ['ideas for tiktok', 'TikTok'],
    ])('cleans %j into %j', (input, expected) => {
      expect(normalizeSubject(input)).toBe(expected);
    });

    it('falls back to the raw text when nothing strips', () => {
      expect(normalizeSubject('quantum widgets')).toBe('quantum widgets');
    });
  });

  describe('content-requiring actions', () => {
    it.each(['shorten', 'expand', 'rewrite', 'change_tone'] as const)(
      'asks for content when %s has none',
      (action) => {
        expect(synthesizeChat({ action, prompt: 'go' })).toMatch(/need some content/i);
      },
    );
  });

  describe('chat', () => {
    it('names the projects it can see for a non-content question', () => {
      const out = synthesizeChat({
        action: 'chat',
        prompt: 'what can you do?',
        projectNames: ['Alpha'],
      });
      expect(out).toContain('Alpha');
    });

    it('says so when there are no projects', () => {
      const out = synthesizeChat({ action: 'chat', prompt: 'hello', projectNames: [] });
      expect(out).toMatch(/no projects yet/i);
    });

    it('answers a content question with real ideas instead of deflecting', () => {
      const out = synthesizeChat({ action: 'chat', prompt: 'how do i start on instagram?', projectNames: [] });
      expect(out).toMatch(/Content ideas for Instagram/);
    });
  });

  it('labels transformed output as demo so it is never mistaken for a model', () => {
    const out = synthesizeChat({ action: 'shorten', prompt: 'shorten', content: PARAGRAPH });
    expect(out).toMatch(/demo mode/i);
  });

  it('never leaks internal config names into any user-facing reply', () => {
    const actions = ['chat', 'rewrite', 'expand', 'shorten', 'change_tone', 'translate', 'ideas'] as const;
    for (const action of actions) {
      const out = synthesizeChat({ action, prompt: 'go', content: PARAGRAPH, target: 'Spanish' });
      expect(out).not.toMatch(/ANTHROPIC_API_KEY|LLM_PROVIDER|anthropic/);
    }
  });
});
