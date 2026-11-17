import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAdv, arbConditions, arbDays, arbSpec, photo } from './helpers';
import { verifyPair } from '../src/vision/pair';
import { newCardSpec } from '../src/core/card';
import { makeWave } from '../src/core/wave';
import { daysInMonth } from '../src/core/card';

const RUNS = Number(process.env.SF_RUNS ?? 40);

describe('scanner on simulated photos (rotation, tilt, blur, noise, lighting)', () => {
  it('reads exactly the punched days and advances, whatever the photo conditions', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(s), arbDays(s), arbAdv, arbConditions)), ([spec, days, adv, cond]) => {
      const scan = photo(spec, 'S', days, adv, cond);
      expect(scan.halves.length).toBe(1);
      const h = scan.halves[0];
      const gotDays = h.days.filter((c) => c.punched).map((c) => c.n);
      expect(gotDays).toEqual([...days].sort((a, b) => a - b));
      expect(h.adv.filter((c) => c.punched).map((c) => c.n)).toEqual([...adv].sort((a, b) => a - b));
    }), { numRuns: RUNS, endOnFailure: true });
  });

  it('an honest pair verifies as genuine and consistent, under independent photo conditions', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(s), arbDays(s), arbAdv, arbConditions, arbConditions)), ([spec, days, adv, c1, c2]) => {
      const r = verifyPair(photo(spec, 'S', days, adv, c1).halves[0], photo(spec, 'F', days, adv, c2).halves[0]);
      expect(r.verdict).toBe('genuine-consistent');
      expect(r.cmp.agreedDays.length).toBe(days.length);
      expect(r.pay.agreed.netMinor).toBe(days.length * spec.rateMinor - adv.length * spec.advMinor);
    }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('an extra hole on ONE half is always caught and never paid as agreed', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(s), arbDays(s), arbConditions, arbConditions, fc.integer({ min: 1, max: daysInMonth(s.year, s.month) }), fc.boolean())),
      ([spec, days, c1, c2, extra, onStock]) => {
        fc.pre(!days.includes(extra));
        const sd = onStock ? [...days, extra] : days;
        const fd = onStock ? days : [...days, extra];
        const r = verifyPair(photo(spec, 'S', sd, [], c1).halves[0], photo(spec, 'F', fd, [], c2).halves[0]);
        expect(r.verdict).toBe('genuine-disputed');
        expect(onStock ? r.cmp.stockOnlyDays : r.cmp.foilOnlyDays).toEqual([extra]);
        expect(r.cmp.agreedDays).not.toContain(extra);
        expect(r.pay.agreed.days).toBe(days.length);
      }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('a missing hole (filled-in / re-printed) on one half is caught too', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(s), fc.uniqueArray(fc.integer({ min: 1, max: daysInMonth(s.year, s.month) }), { minLength: 1, maxLength: 20 }), arbConditions)),
      ([spec, days, c]) => {
        const r = verifyPair(photo(spec, 'S', days, [], c).halves[0], photo(spec, 'F', days.slice(1), [], c).halves[0]);
        expect(r.verdict).toBe('genuine-disputed');
        expect(r.cmp.stockOnlyDays).toEqual([days[0]]);
      }), { numRuns: Math.ceil(RUNS / 3), endOnFailure: true });
  });
});

describe('pair authenticity', () => {
  it('halves from two different cards are rejected', () => {
    fc.assert(fc.property(arbSpec, arbSpec, fc.uniqueArray(fc.integer({ min: 1, max: 28 }), { maxLength: 10 }), (a, b, days) => {
      fc.pre(a.id !== b.id);
      const r = verifyPair(photo(a, 'S', days, []).halves[0], photo(b, 'F', days, []).halves[0]);
      expect(r.verdict).toBe('pair-mismatch');
    }), { numRuns: 15, endOnFailure: true });
  });

  it('a forged foil with the SAME id but a different wavy cut is rejected by the edge check', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 50000 }), (s) => {
      const spec = newCardSpec({ id: 'FORGE' + String(s % 1000).padStart(3, '0'), year: 2026, month: 11 });
      const forged = makeWave(s * 31 + 7);
      const r = verifyPair(photo(spec, 'S', [1, 2], []).halves[0], photo(spec, 'F', [1, 2], [], undefined, forged).halves[0]);
      expect(r.edge.verdict).toBe('mismatch');
      expect(r.verdict).toBe('pair-mismatch');
    }), { numRuns: 12, endOnFailure: true });
  });

  it('a half reprinted with a changed rate no longer pairs (card code)', () => {
    const real = newCardSpec({ id: 'RATE0001', year: 2026, month: 11, rateMinor: 50000 });
    const fake = { ...real, rateMinor: 90000 };
    const r = verifyPair(photo(real, 'S', [1], []).halves[0], photo(fake, 'F', [1], []).halves[0]);
    expect(r.verdict).toBe('pair-mismatch');
  });
});

describe('never silently wrong (outside the supported envelope)', () => {
  // Rougher than the envelope: big rotation, off-centre, card partly out of frame, heavy blur.
  const arbHarsh = fc.record({
    angle: fc.double({ min: -1.4, max: 1.4, noNaN: true }),
    scale: fc.double({ min: 2.4, max: 5.2, noNaN: true }),
    tx: fc.double({ min: -220, max: 220, noNaN: true }),
    ty: fc.double({ min: -200, max: 200, noNaN: true }),
    px: fc.double({ min: -0.0012, max: 0.0012, noNaN: true }),
    py: fc.double({ min: -0.0012, max: 0.0012, noNaN: true }),
    blur: fc.double({ min: 0, max: 2.5, noNaN: true }),
    noise: fc.double({ min: 0, max: 0.08, noNaN: true }),
    gradient: fc.double({ min: 0, max: 0.6, noNaN: true }),
    gradDir: fc.double({ min: 0, max: 6.28, noNaN: true }),
    shadow: fc.double({ min: 0, max: 0.4, noNaN: true }),
    exposure: fc.double({ min: 0.5, max: 1.2, noNaN: true }),
    gamma: fc.double({ min: 0.7, max: 1.5, noNaN: true }),
    seed: fc.integer({ min: 1, max: 1_000_000 }),
  });

  it('a wrong punch reading always comes with a warning or an "unsure" flag', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(s), arbDays(s), arbHarshC())), ([spec, days, cond]) => {
      const scan = photo(spec, 'S', days, [], cond);
      if (scan.halves.length === 0) return; // honestly "nothing found" is fine
      const h = scan.halves[0];
      const got = h.days.filter((c) => c.punched).map((c) => c.n);
      const exact = JSON.stringify(got) === JSON.stringify([...days].sort((a, b) => a - b));
      const flagged = h.warnings.length > 0 || h.days.some((c) => c.uncertain);
      expect(exact || flagged).toBe(true);
    }), { numRuns: Math.ceil(RUNS * 1.5), endOnFailure: true });
  });

  function arbHarshC() { return arbHarsh; }
});
