import { describe, expect, it } from 'vitest';
import { sentences } from '../src/ai/speech';
import { STORY_LANGS, storyPack } from '../src/i18n/story';

describe('narration chunking', () => {
  it('splits into sentences with a longer pause at the end of a paragraph', () => {
    const s = sentences('Title.\nOne. Two! Three?');
    expect(s.map((x) => x.t)).toEqual(['Title.', 'One.', 'Two!', 'Three?']);
    expect(s[0].pause).toBeGreaterThan(s[1].pause); // paragraph break is a longer breath
    expect(s[3].pause).toBeGreaterThan(s[1].pause);
  });
  it('handles the Devanagari danda and Arabic question mark', () => {
    expect(sentences('पहला वाक्य। दूसरा वाक्य।').length).toBe(2);
    expect(sentences('هل هذا صحيح؟ نعم.').length).toBe(2);
  });
  it('keeps every utterance short in every Story language (no stalls on long text)', () => {
    for (const l of STORY_LANGS) {
      const pack = storyPack(l.code);
      for (const txt of pack.text) {
        for (const c of sentences(txt)) expect(c.t.length, `${l.code}: ${c.t.slice(0, 40)}`).toBeLessThanOrEqual(260);
      }
    }
  });
  it('never loses words', () => {
    const t = 'A long sentence, with several clauses, that keeps going on and on and on; and then it really does continue for a good while longer than a single breath should ever allow, so it must be cut.';
    expect(sentences(t).map((x) => x.t).join(' ').replace(/\s+/g, ' ')).toBe(t);
  });
});
