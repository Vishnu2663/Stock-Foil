import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { arbConditions, arbSpec, photo } from './helpers';
import { verifyPair } from '../src/vision/pair';
import { newPairing } from '../src/core/pairing';
import { makeWave } from '../src/core/wave';
import { newCardSpec } from '../src/core/card';

const RUNS = Number(process.env.SF_RUNS ?? 40);
const paired = (base: ReturnType<typeof newCardSpec>) => ({ ...base, pairing: newPairing() });

describe('QR pairing on simulated photos', () => {
  it('an honest paired card is verified and genuine under random photo conditions', () => {
    fc.assert(fc.property(arbSpec, arbConditions, arbConditions, (base, c1, c2) => {
      const spec = paired(base);
      const S = photo(spec, 'S', [3, 4], [], c1).halves[0];
      const F = photo(spec, 'F', [3, 4], [], c2).halves[0];
      expect(S.pairExpected && !!S.pair).toBe(true);
      expect(F.pairExpected && !!F.pair).toBe(true);
      const r = verifyPair(S, F);
      expect(r.pairing).toBe('verified');
      expect(r.verdict).toBe('genuine-consistent');
    }), { numRuns: Math.ceil(RUNS / 2), endOnFailure: true });
  });

  it('a sloppy or different cut can NOT make a genuine paired card fail', () => {
    fc.assert(fc.property(arbSpec, fc.integer({ min: 1, max: 50000 }), (base, seed) => {
      const spec = paired(base);
      const S = photo(spec, 'S', [1, 2], []).halves[0];
      // the foil was cut along a completely different line
      const F = photo(spec, 'F', [1, 2], [], undefined, makeWave(seed * 31 + 7)).halves[0];
      const r = verifyPair(S, F);
      expect(r.pairing).toBe('verified');
      expect(r.edge.verdict).not.toBe('match'); // the cut really is different...
      expect(r.verdict).toBe('genuine-consistent'); // ...and it does not matter
    }), { numRuns: 12, endOnFailure: true });
  });

  it('a half fabricated from the other (same id, code and QR data, wrong secret) is rejected even with a perfect cut', () => {
    fc.assert(fc.property(arbSpec, (base) => {
      const real = paired(base);
      const fake = { ...real, pairing: newPairing() }; // forger knows id/rate/names from the stock, but not its secret
      const S = photo(real, 'S', [1, 2, 3], []).halves[0];
      const F = photo(fake, 'F', [1, 2, 3, 4, 5], []).halves[0]; // identical wave (same id), more days claimed
      const r = verifyPair(S, F);
      expect(r.pairing).toBe('failed');
      expect(r.verdict).toBe('pair-mismatch');
    }), { numRuns: 10, endOnFailure: true });
  });

  it('a paired half cannot be matched with an older card that has no pairing code', () => {
    const base = newCardSpec({ id: 'LEGACY01', year: 2026, month: 11 });
    const S = photo(paired(base), 'S', [1], []).halves[0];
    const F = photo(base, 'F', [1], []).halves[0];
    expect(verifyPair(S, F).verdict).toBe('pair-mismatch');
  });

  it('older cards behave exactly as before: the cut still decides', () => {
    const base = newCardSpec({ id: 'LEGACY02', year: 2026, month: 11 });
    const S = photo(base, 'S', [1], []).halves[0];
    const good = verifyPair(S, photo(base, 'F', [1], []).halves[0]);
    expect(good.pairing).toBe('legacy');
    expect(good.verdict).toBe('genuine-consistent');
    const forged = verifyPair(S, photo(base, 'F', [1], [], undefined, makeWave(777)).halves[0]);
    expect(forged.verdict).toBe('pair-mismatch');
  });
});
