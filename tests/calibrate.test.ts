import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { newCardSpec } from '../src/core/card';
import { calibrate, DEFAULT_PUNCH_RATIO } from '../src/vision/calibrate';
import { ALIGN_TOL_MM } from '../src/vision/pair';
import { photo } from './helpers';

const days = [3, 4, 5, 9, 10, 11, 17];

describe('calibration from real photos (simulated here)', () => {
  it('suggests a threshold between punched and blank brightness, and a tolerance that covers observed honest stacking', () => {
    fc.assert(fc.property(
      fc.record({ dx: fc.double({ min: -1, max: 1, noNaN: true }), dy: fc.double({ min: -1, max: 1, noNaN: true }), rot: fc.double({ min: -0.4, max: 0.4, noNaN: true }) }),
      fc.integer({ min: 1, max: 9999 }),
      (stack, n) => {
        const spec = newCardSpec({ id: 'CAL' + String(n).padStart(5, '0'), year: 2026, month: 11 });
        const S = photo(spec, 'S', days, [1]).halves[0];
        const F = photo(spec, 'F', days, [1], undefined, undefined, { stack: { dx: stack.dx, dy: stack.dy, rotDeg: stack.rot } }).halves[0];
        const r = calibrate([S, F]);
        expect(r.pairs).toBe(1);
        expect(r.punched).toBeGreaterThan(10);
        expect(r.separation!).toBeGreaterThan(0);
        expect(r.recommended.punchRatio).toBeGreaterThan(r.maxPunchedRatio!);
        expect(r.recommended.punchRatio).toBeLessThan(r.minBlankRatio!);
        expect(r.recommended.alignTolMm).toBeGreaterThanOrEqual(1.0);
        expect(r.recommended.alignTolMm).toBeLessThanOrEqual(2.5);
        expect(r.recommended.alignTolMm).toBeGreaterThanOrEqual(Math.min(2.5, r.alignmentMaxMm! * 1.6) - 0.01);
        expect(r.holeRadiusMm!.mean).toBeGreaterThan(2.5);
        expect(r.holeRadiusMm!.mean).toBeLessThan(3.5);
      }), { numRuns: 6, endOnFailure: true });
  });

  it('with a single half it keeps default alignment tolerance and says what is missing', () => {
    const spec = newCardSpec({ id: 'CAL00001', year: 2026, month: 11 });
    const r = calibrate([photo(spec, 'S', days, []).halves[0]]);
    expect(r.pairs).toBe(0);
    expect(r.alignmentMaxMm).toBeNull();
    expect(r.recommended.alignTolMm).toBe(ALIGN_TOL_MM);
    expect(r.notes.join(' ')).toMatch(/pair/i);
  });

  it('with no usable holes it keeps the default threshold and does not invent numbers', () => {
    const r = calibrate([]);
    expect(r.recommended.punchRatio).toBe(DEFAULT_PUNCH_RATIO);
    expect(r.separation).toBeNull();
    expect(r.holeRadiusMm).toBeNull();
  });

  it('a tolerance suggested from honest data never flags that same honest pair', async () => {
    const { verifyPair } = await import('../src/vision/pair');
    const spec = newCardSpec({ id: 'CAL00007', year: 2026, month: 11 });
    const S = photo(spec, 'S', days, []).halves[0];
    const F = photo(spec, 'F', days, [], undefined, undefined, { stack: { dx: 1.0, dy: -0.8, rotDeg: 0.4 } }).halves[0];
    const rep = calibrate([S, F]);
    const v = verifyPair(S, F, { alignTolMm: rep.recommended.alignTolMm });
    expect(v.alignment.flagged).toEqual([]);
  });
});
