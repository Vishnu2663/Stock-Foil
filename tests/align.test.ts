import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConditions, arbSpec, photo } from './helpers';
import { checkAlignment, verifyPair } from '../src/vision/pair';
import { daysInMonth } from '../src/core/card';

const RUNS = Number(process.env.SF_RUNS ?? 40);
const arbHoles = (max: number) => fc.uniqueArray(fc.integer({ min: 1, max }), { minLength: 5, maxLength: 12 });

// Honest stacking error: whole foil shifted up to 1.2 mm and rotated up to 0.5 deg relative to the stock.
const arbStack = fc.record({ dx: fc.double({ min: -1.2, max: 1.2, noNaN: true }), dy: fc.double({ min: -1.2, max: 1.2, noNaN: true }), rotDeg: fc.double({ min: -0.5, max: 0.5, noNaN: true }) });

describe('punched-together check (property-based)', () => {
  it('holes punched together are NOT flagged, even with sloppy stacking (shift + slight rotation)', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(s), arbHoles(daysInMonth(s.year, s.month)), arbConditions, arbConditions, arbStack)), ([spec, days, c1, c2, stack]) => {
      const S = photo(spec, 'S', days, []).halves[0];
      const F = photo(spec, 'F', days, [], c2, undefined, { stack }).halves[0];
      void c1;
      const a = checkAlignment(S, F);
      expect(a.checked).toBe(true);
      expect(a.flagged).toEqual([]);
    }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('a hole made separately (1.8 to 3.4 mm off) never passes as clean: flagged by alignment OR one-sided', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(s), arbHoles(daysInMonth(s.year, s.month)), arbConditions, arbStack, fc.double({ min: 1.8, max: 3.4, noNaN: true }), fc.double({ min: 0, max: 6.28, noNaN: true }), fc.nat())),
      ([spec, days, c2, stack, mag, ang, pick]) => {
        const bad = days[pick % days.length];
        const holeOffset = { [`d${bad}`]: { dx: mag * Math.cos(ang), dy: mag * Math.sin(ang) } };
        const S = photo(spec, 'S', days, []).halves[0];
        const F = photo(spec, 'F', days, [], c2, undefined, { stack, holeOffset }).halves[0];
        const r = verifyPair(S, F);
        expect(r.verdict).not.toBe('genuine-consistent');
        const caught = r.alignment.flagged.some((f) => f.n === bad) || r.cmp.stockOnlyDays.includes(bad) || r.cmp.foilOnlyDays.includes(bad);
        expect(caught).toBe(true);
        // never flag an innocent hole
        for (const f of r.alignment.flagged) expect(f.n).toBe(bad);
      }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('with fewer than 4 shared holes it declines to judge instead of guessing', () => {
    fc.assert(fc.property(arbSpec, fc.uniqueArray(fc.integer({ min: 1, max: 28 }), { minLength: 1, maxLength: 3 }), (spec, days) => {
      const a = checkAlignment(photo(spec, 'S', days, []).halves[0], photo(spec, 'F', days, []).halves[0]);
      expect(a.checked).toBe(false);
      expect(a.flagged).toEqual([]);
    }), { numRuns: 8, endOnFailure: true });
  });
});
