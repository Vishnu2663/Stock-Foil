import { describe, it, expect } from 'vitest';
import { formatVerdict, STORY_LANGS, storyPack, type VerdictKind } from '../src/i18n/story';

const en = storyPack('en');
const KINDS: VerdictKind[] = ['mismatchPairing', 'mismatch', 'disputed', 'sloppy', 'ok'];
/** a character range that proves the text is really written in that script */
const SCRIPT: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/, mr: /[ऀ-ॿ]/, bn: /[ঀ-৿]/, ta: /[஀-௿]/, te: /[ఀ-౿]/, ar: /[؀-ۿ]/,
};

describe('story language packs', () => {
  it('there are eleven languages with unique codes and well-formed voice tags', () => {
    expect(STORY_LANGS).toHaveLength(11);
    expect(new Set(STORY_LANGS.map((p) => p.code)).size).toBe(11);
    for (const p of STORY_LANGS) {
      expect(p.speech).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
      expect(p.name.trim().length).toBeGreaterThan(1);
      expect(!!p.rtl).toBe(p.code === 'ar'); // only Arabic is right-to-left
    }
  });

  it('every language has all nine chapters, each with a title, a short label and real text', () => {
    for (const p of STORY_LANGS) {
      for (const k of ['title', 'short', 'text'] as const) {
        expect(p[k], `${p.code}.${k}`).toHaveLength(9);
        for (const s of p[k]) expect(s.trim().length, `${p.code}.${k}`).toBeGreaterThanOrEqual(k === 'short' ? 2 : 3);
      }
      for (const s of p.short) expect(s.length, `${p.code} label "${s}"`).toBeLessThanOrEqual(22); // fits the chapter dots
    }
  });

  it('no translation is a leftover copy of the English, and non-Latin languages are written in their own script', () => {
    for (const p of STORY_LANGS.filter((x) => x.code !== 'en')) {
      for (let i = 0; i < 9; i++) {
        expect(p.title[i], `${p.code} title ${i}`).not.toBe(en.title[i]);
        expect(p.text[i], `${p.code} text ${i}`).not.toBe(en.text[i]);
      }
      const script = SCRIPT[p.code];
      if (script) {
        for (const s of [...p.title, ...p.short, ...p.text, ...KINDS.map((k) => p.v[k])]) expect(script.test(s), `${p.code}: "${s.slice(0, 30)}"`).toBe(true);
      }
    }
  });

  it('verdict sentences keep their placeholders and never leave one unfilled', () => {
    for (const p of STORY_LANGS) {
      expect(p.v.disputed).toContain('{days}');
      expect(p.v.disputed).toContain('{n}');
      expect(p.v.sloppy).toContain('{n}');
      expect(p.v.ok).toContain('{n}');
      for (const k of KINDS) {
        const out = formatVerdict(p, k, { n: 5, days: '12' });
        expect(out, `${p.code}.${k}`).not.toMatch(/[{}]/);
      }
      expect(formatVerdict(p, 'ok', { n: 5 })).toContain('5');
      expect(formatVerdict(p, 'disputed', { n: 5, days: '12' })).toContain('12');
    }
  });

  it('an unknown language code falls back to English', () => {
    expect(storyPack('xx').code).toBe('en');
    expect(storyPack('').code).toBe('en');
  });
});
