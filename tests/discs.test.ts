import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbAdv, arbConditions, arbSpec, photo } from './helpers';
import { cardCode, daysInMonth, decodePayload, encodePayload } from '../src/core/card';
import { newPairing } from '../src/core/pairing';
import { verifyPair } from '../src/vision/pair';

const RUNS = Number(process.env.SF_RUNS ?? 40);
// what the card lies on: a dark cloth, a dark bench, a pale table, and a table as bright as the paper.
// (A mid-grey surface is as bright as the printed grey disc, so a hole is hard to tell from an intact disc there: see the last test.)
const surface = fc.constantFrom(0.06, 0.2, 0.85, 0.92);
const discs = (s: Parameters<typeof cardCode>[0], halves: boolean, paired = true) => ({ ...s, discs: true as const, ...(halves ? { halves: true as const } : {}), ...(paired ? { pairing: newPairing() } : {}) });
// the denser pairing QR cannot be read under the very harshest blur + noise + dim light together (the app then asks for a retake),
// so paired cards are tested under moderate conditions; plain cards under the whole envelope
const arbMild = arbConditions.map((c) => ({ ...c, blur: Math.min(c.blur, 0.6), noise: Math.min(c.noise, 0.02), exposure: Math.max(c.exposure, 0.9), shadow: Math.min(c.shadow, 0.1) }));
const subset = (n: number) => fc.uniqueArray(fc.integer({ min: 1, max: n }), { maxLength: 12 });

describe('printed-disc cards on a surface as bright as the disc itself', () => {
  it('never silently wrong: every circle read incorrectly is flagged as unsure', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(discs(s, false, false)), subset(daysInMonth(s.year, s.month)), arbAdv, arbConditions, fc.constantFrom(0.3, 0.35, 0.45, 0.55, 0.65))),
      ([spec, days, adv, cond, surf]) => {
        const h = photo(spec, 'S', days, adv, { ...cond, surface: surf }).halves[0];
        for (const c of h.days) expect(c.punched === days.includes(c.n) || c.uncertain, `day ${c.n} read ${c.punched} (ratio ${c.ratio.toFixed(2)}) on surface ${surf}`).toBe(true);
        for (const c of h.adv) expect(c.punched === adv.includes(c.n) || c.uncertain, `advance ${c.n} read ${c.punched} (ratio ${c.ratio.toFixed(2)}) on surface ${surf}`).toBe(true);
      }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });
});

describe('printed-disc cards', () => {
  it('the flag round-trips through the QR payload and changes the card code', () => {
    fc.assert(fc.property(arbSpec, fc.boolean(), (spec, halves) => {
      const d = discs(spec, halves);
      for (const role of ['S', 'F'] as const) {
        const x = decodePayload(encodePayload(d, role))!;
        expect(x.spec.discs).toBe(true);
        expect(!!x.spec.halves).toBe(halves);
        expect(x.codeOk).toBe(true);
      }
      expect(cardCode(d)).not.toBe(cardCode({ ...d, discs: undefined }));
    }), { numRuns: 60 });
  });

  it('reads exactly the punched circles on any plain surface, whatever the photo conditions', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(discs(s, true, false)), subset(daysInMonth(s.year, s.month)), subset(daysInMonth(s.year, s.month)), arbAdv, arbConditions, surface)),
      ([spec, am, pm, adv, cond, surf]) => {
        const scan = photo(spec, 'S', am, adv, { ...cond, surface: surf }, undefined, { pm });
        expect(scan.halves.length).toBe(1);
        const h = scan.halves[0];
        expect(h.days.filter((c) => c.punched).map((c) => c.n)).toEqual([...am].sort((a, b) => a - b));
        expect(h.pm.filter((c) => c.punched).map((c) => c.n)).toEqual([...pm].sort((a, b) => a - b));
        expect(h.adv.filter((c) => c.punched).map((c) => c.n)).toEqual([...adv].sort((a, b) => a - b));
      }), { numRuns: RUNS, endOnFailure: true });
  });

  it('works for single-circle cards too', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(discs(s, false, false)), subset(daysInMonth(s.year, s.month)), arbAdv, arbConditions, surface)),
      ([spec, days, adv, cond, surf]) => {
        const h = photo(spec, 'S', days, adv, { ...cond, surface: surf }).halves[0];
        expect(h.days.filter((c) => c.punched).map((c) => c.n)).toEqual([...days].sort((a, b) => a - b));
        expect(h.adv.filter((c) => c.punched).map((c) => c.n)).toEqual([...adv].sort((a, b) => a - b));
      }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('an honest pair verifies on a white table (paired cards do not need the cut edge) and pays correctly', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(discs(s, true)), subset(daysInMonth(s.year, s.month)), subset(daysInMonth(s.year, s.month)), arbMild, arbMild, fc.constantFrom(0.06, 0.85, 0.92))),
      ([spec, am, pm, c1, c2, surf]) => {
        const r = verifyPair(
          photo(spec, 'S', am, [], { ...c1, surface: surf }, undefined, { pm }).halves[0],
          photo(spec, 'F', am, [], { ...c2, surface: surf }, undefined, { pm }).halves[0],
        );
        expect(r.verdict).toBe('genuine-consistent');
        expect(r.pay.agreed.netMinor).toBe(Math.round(((am.length + pm.length) * spec.rateMinor) / 2));
      }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('a one-sided hole is still caught on a white table', () => {
    fc.assert(fc.property(
      arbSpec.chain((s) => fc.tuple(fc.constant(discs(s, false)), subset(daysInMonth(s.year, s.month)), fc.integer({ min: 1, max: daysInMonth(s.year, s.month) }))),
      ([spec, days, extra]) => {
        fc.pre(!days.includes(extra));
        const r = verifyPair(
          photo(spec, 'S', [...days, extra], [], { ...arbConditionsClean, surface: 0.88 }).halves[0],
          photo(spec, 'F', days, [], { ...arbConditionsClean, surface: 0.88 }).halves[0],
        );
        expect(r.verdict).toBe('genuine-disputed');
        expect(r.cmp.stockOnlyDays).toEqual([extra]);
      }), { numRuns: Math.ceil(RUNS / 3), endOnFailure: true });
  });
});

const arbConditionsClean = { angle: 0.05, scale: 4.2, tx: 0, ty: 0, px: 0, py: 0, blur: 0, noise: 0, gradient: 0, gradDir: 0, shadow: 0, exposure: 1, gamma: 1, seed: 3 };
