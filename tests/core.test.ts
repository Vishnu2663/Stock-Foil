import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbSpec } from './helpers';
import { cardCode, decodePayload, encodePayload, waveSeed, daysInMonth, newCardSpec, MAX_AMOUNT_MAJOR, MAX_AMOUNT_MINOR } from '../src/core/card';
import { newMember } from '../src/core/members';
import { makeWave } from '../src/core/wave';
import { applyH, findHomography, invertH, poseH } from '../src/core/homography';
import { WAVE_AMP } from '../src/core/layout';

describe('card payload', () => {
  it('round-trips and its code binds the fields', () => {
    fc.assert(fc.property(arbSpec, fc.constantFrom('S' as const, 'F' as const), (spec, role) => {
      const d = decodePayload(encodePayload(spec, role))!;
      expect(d.role).toBe(role);
      expect(d.codeOk).toBe(true);
      expect(d.spec).toEqual(spec);
    }), { numRuns: 300 });
  });
  it('any edit to rate or month breaks the code', () => {
    fc.assert(fc.property(arbSpec, fc.integer({ min: 1, max: 1000 }), (spec, delta) => {
      expect(cardCode({ ...spec, rateMinor: spec.rateMinor + delta })).not.toBe(cardCode(spec));
      expect(cardCode({ ...spec, month: (spec.month % 12) + 1 })).not.toBe(cardCode(spec));
    }), { numRuns: 300 });
  });
  it('rejects garbage', () => {
    fc.assert(fc.property(fc.string(), (s) => { expect(decodePayload(s)).toBeNull(); }), { numRuns: 200 });
  });
  it('calendar lengths are right', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2026, 11)).toBe(30);
  });
});

describe('wavy cut line', () => {
  it('is deterministic per id, bounded, and different between ids', () => {
    fc.assert(fc.property(arbSpec, arbSpec, fc.double({ min: -10, max: 200, noNaN: true }), (a, b, x) => {
      const wa = makeWave(waveSeed(a));
      expect(wa(x)).toBe(makeWave(waveSeed(a))(x));
      expect(Math.abs(wa(x))).toBeLessThanOrEqual(WAVE_AMP + 1e-6 + 0.5);
      if (a.id !== b.id) {
        const wb = makeWave(waveSeed(b));
        let diff = 0;
        for (let t = 0; t <= 186; t += 3) diff += Math.abs(wa(t) - wb(t));
        expect(diff).toBeGreaterThan(5);
      }
    }), { numRuns: 200 });
  });
});

describe('homography', () => {
  it('recovers a known pose from 4 points and inverts exactly', () => {
    fc.assert(fc.property(
      fc.record({ scale: fc.double({ min: 2, max: 8, noNaN: true }), angle: fc.double({ min: -3, max: 3, noNaN: true }), tx: fc.double({ min: 100, max: 900, noNaN: true }), ty: fc.double({ min: 100, max: 700, noNaN: true }), px: fc.double({ min: -0.0006, max: 0.0006, noNaN: true }), py: fc.double({ min: -0.0006, max: 0.0006, noNaN: true }) }),
      (p) => {
        const H = poseH({ ...p, cx: 93, cy: 60 });
        const src = [{ x: 0, y: 0 }, { x: 186, y: 0 }, { x: 186, y: 120 }, { x: 0, y: 120 }];
        const est = findHomography(src, src.map((q) => applyH(H, q)))!;
        for (const q of [{ x: 20, y: 30 }, { x: 150, y: 90 }]) {
          const a = applyH(H, q), b = applyH(est, q);
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-4);
          const back = applyH(invertH(H)!, a);
          expect(Math.hypot(back.x - q.x, back.y - q.y)).toBeLessThan(1e-5);
        }
      }), { numRuns: 200 });
  });
});

describe('amount ceiling (daily wage and advance token: max 2000)', () => {
  it('a new card or member can never carry more than the ceiling, however absurd the input', () => {
    expect(MAX_AMOUNT_MAJOR).toBe(2000);
    fc.assert(fc.property(fc.oneof(fc.integer({ min: -1e9, max: 1e12 }), fc.double({ noNaN: false }), fc.constant(Infinity)), fc.oneof(fc.integer({ min: -1e9, max: 1e12 }), fc.constant(NaN)), (rate, adv) => {
      const c = newCardSpec({ rateMinor: rate as number, advMinor: adv as number });
      expect(c.rateMinor).toBeGreaterThanOrEqual(0);
      expect(c.rateMinor).toBeLessThanOrEqual(MAX_AMOUNT_MINOR);
      expect(c.advMinor).toBeGreaterThanOrEqual(0);
      expect(c.advMinor).toBeLessThanOrEqual(MAX_AMOUNT_MINOR);
      const m = newMember({ name: 'X', rateMinor: rate as number, advMinor: adv as number });
      expect(m.rateMinor).toBeLessThanOrEqual(MAX_AMOUNT_MINOR);
      expect(m.advMinor).toBeLessThanOrEqual(MAX_AMOUNT_MINOR);
    }), { numRuns: 300 });
  });
  it('amounts at or under the ceiling are kept exactly', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: MAX_AMOUNT_MINOR }), (n) => {
      expect(newCardSpec({ rateMinor: n }).rateMinor).toBe(n);
    }), { numRuns: 200 });
  });
  it('cards printed earlier with a bigger wage still decode and verify (the ceiling only applies to new cards)', () => {
    const old = { ...newCardSpec({ id: 'OLDCARD1', year: 2026, month: 11 }), rateMinor: 9_000_000 };
    const d = decodePayload(encodePayload(old, 'S'))!;
    expect(d.codeOk).toBe(true);
    expect(d.spec.rateMinor).toBe(9_000_000);
  });
});
