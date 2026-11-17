import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAdv, arbConditions, arbSpec, photo, range } from './helpers';
import { cardCode, decodePayload, daysInMonth, encodePayload, newCardSpec } from '../src/core/card';
import { compareHalves, computePay } from '../src/core/wages';
import { verifyPair } from '../src/vision/pair';

const RUNS = Number(process.env.SF_RUNS ?? 40);
const half = (s: ReturnType<typeof newCardSpec>) => ({ ...s, halves: true as const });
const subset = (n: number) => fc.uniqueArray(fc.integer({ min: 1, max: n }), { maxLength: 12 });

describe('half-day card format', () => {
  it('round-trips through the QR payload, and changes the card code', () => {
    fc.assert(fc.property(arbSpec, (spec) => {
      const h = half(spec);
      for (const role of ['S', 'F'] as const) {
        const d = decodePayload(encodePayload(h, role))!;
        expect(d.spec.halves).toBe(true);
        expect(d.codeOk).toBe(true);
      }
      expect(cardCode(h)).not.toBe(cardCode(spec));
      // cards printed before half-day circles existed decode exactly as they did
      expect(decodePayload(encodePayload(spec, 'S'))!.spec.halves).toBeUndefined();
    }), { numRuns: 60 });
  });
});

describe('half-day pay arithmetic', () => {
  it('every circle is worth half a day: pay = (agreed circles / 2) x rate - advances', () => {
    fc.assert(fc.property(subset(30), subset(30), fc.integer({ min: 1, max: 200000 }), fc.integer({ min: 0, max: 5 }), (am, pm, rate, advN) => {
      const marks = (list: number[]) => range(30).map((d) => list.includes(d));
      const stock = { days: marks(am), pm: marks(pm), adv: range(10).map((i) => i <= advN) };
      const cmp = compareHalves(stock, stock);
      const pay = computePay(cmp, rate, 10000);
      expect(cmp.halves).toBe(true);
      expect(pay.agreed.days).toBe((am.length + pm.length) / 2);
      expect(pay.agreed.grossMinor).toBe(Math.round(((am.length + pm.length) * rate) / 2));
      expect(pay.agreed.netMinor).toBe(pay.agreed.grossMinor - advN * 10000);
      expect(pay.disputedMinor).toBe(0);
    }));
  });
  it('a half day punched on one half only is disputed for exactly half a wage', () => {
    const base = { days: [true, false, false], pm: [false, false, false], adv: [] as boolean[] };
    const cmp = compareHalves({ ...base, pm: [true, false, false] }, base);
    expect(cmp.stockOnlyPm).toEqual([1]);
    expect(cmp.consistent).toBe(false);
    const pay = computePay(cmp, 50000, 10000);
    expect(pay.agreed.days).toBe(0.5);
    expect(pay.disputedMinor).toBe(25000);
  });
  it('cards without half-day circles are unaffected', () => {
    const cmp = compareHalves({ days: [true, true], adv: [] }, { days: [true, true], adv: [] });
    expect(cmp.halves).toBe(false);
    expect(computePay(cmp, 50000, 10000).agreed.days).toBe(2);
  });
});

describe('scanner reads both circles of every date', () => {
  it('first-half and second-half punches are read separately, whatever the photo conditions', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(half(s)), subset(daysInMonth(s.year, s.month)), subset(daysInMonth(s.year, s.month)), arbAdv, arbConditions)), ([spec, am, pm, adv, cond]) => {
      const scan = photo(spec, 'S', am, adv, cond, undefined, { pm });
      expect(scan.halves.length).toBe(1);
      const h = scan.halves[0];
      expect(h.days.filter((c) => c.punched).map((c) => c.n)).toEqual([...am].sort((a, b) => a - b));
      expect(h.pm.filter((c) => c.punched).map((c) => c.n)).toEqual([...pm].sort((a, b) => a - b));
    }), { numRuns: RUNS, endOnFailure: true });
  });

  it('an honest half-day pair verifies, and pays half a wage per circle', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(half(s)), subset(daysInMonth(s.year, s.month)), subset(daysInMonth(s.year, s.month)), arbConditions, arbConditions)), ([spec, am, pm, c1, c2]) => {
      const r = verifyPair(photo(spec, 'S', am, [], c1, undefined, { pm }).halves[0], photo(spec, 'F', am, [], c2, undefined, { pm }).halves[0]);
      expect(r.verdict).toBe('genuine-consistent');
      expect(r.pay.agreed.days).toBe((am.length + pm.length) / 2);
      expect(r.pay.agreed.netMinor).toBe(Math.round(((am.length + pm.length) * spec.rateMinor) / 2));
    }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('a second-half hole on ONE half only is caught and not paid as agreed', () => {
    fc.assert(fc.property(arbSpec.chain((s) => fc.tuple(fc.constant(half(s)), subset(daysInMonth(s.year, s.month)), fc.integer({ min: 1, max: daysInMonth(s.year, s.month) }), fc.boolean())), ([spec, am, extra, onStock]) => {
      const r = verifyPair(
        photo(spec, 'S', am, [], undefined, undefined, { pm: onStock ? [extra] : [] }).halves[0],
        photo(spec, 'F', am, [], undefined, undefined, { pm: onStock ? [] : [extra] }).halves[0],
      );
      expect(r.verdict).toBe('genuine-disputed');
      expect(onStock ? r.cmp.stockOnlyPm : r.cmp.foilOnlyPm).toEqual([extra]);
      expect(r.cmp.agreedPm).not.toContain(extra);
    }), { numRuns: Math.ceil(RUNS / 3), endOnFailure: true });
  });
});
