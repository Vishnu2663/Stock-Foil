import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { compilePack, lookup, translateText } from '../src/i18n/uiPack';

const c = compilePack({
  'Save only': 'सिर्फ़ सेव करें',
  'Day {0}': 'दिन {0}',
  '{0} days × {1}': '{0} दिन × {1}',
  'Paying {0} a day from day {1}': 'दिन {1} से रोज़ {0}',
  'Paying {0} a day from day {1}; earlier days stay at the printed {2}.': 'दिन {1} से रोज़ {0}; पहले के दिन छपे हुए {2} पर।',
});

describe('whole-app translation matching', () => {
  it('translates exact strings and keeps surrounding whitespace', () => {
    expect(translateText(c, '  Save only ')).toBe('  सिर्फ़ सेव करें ');
    expect(translateText(c, 'Save   only')).toBe('सिर्फ़ सेव करें');
  });
  it('carries numbers, names and amounts through templates, even when the translation reorders them', () => {
    expect(lookup(c, 'Day 12')).toBe('दिन 12');
    expect(lookup(c, '5 days × ₹600')).toBe('5 दिन × ₹600');
    expect(lookup(c, 'Paying ₹700 a day from day 15')).toBe('दिन 15 से रोज़ ₹700');
  });
  it('prefers the most specific template', () => {
    expect(lookup(c, 'Paying ₹700 a day from day 15; earlier days stay at the printed ₹600.')).toBe('दिन 15 से रोज़ ₹700; पहले के दिन छपे हुए ₹600 पर।');
  });
  it('leaves anything it has no translation for, and all numbers, untouched', () => {
    expect(translateText(c, 'Something new')).toBe('Something new');
    expect(translateText(c, '₹3,400')).toBe('₹3,400');
    expect(translateText(null, 'Save only')).toBe('Save only');
  });
});

describe('language packs', () => {
  const src: string[] = JSON.parse(fs.readFileSync('src/i18n/ui/source.json', 'utf8'));
  const ph = (s: string) => (s.match(/\{\d+\}/g) ?? []).sort().join(',');
  for (const lang of ['hi', 'bn', 'ta', 'es', 'sw']) {
    const file = `src/i18n/ui/${lang}.json`;
    it.skipIf(!fs.existsSync(file))(`${lang}: covers every UI string and keeps every placeholder`, () => {
      const pack: Record<string, string> = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(src.filter((k) => !pack[k]?.trim())).toEqual([]);
      expect(src.filter((k) => ph(k) !== ph(pack[k] ?? ''))).toEqual([]);
    });
  }
});
