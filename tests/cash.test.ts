import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { breakdown, combine, DENOMS, notesTotalMinor } from '../src/core/cash';

const cur = fc.constantFrom(...Object.keys(DENOMS), 'XYZ');
const smallest = (c: string) => Math.min(...(DENOMS[c] ?? [1])) * 100;

describe('cash breakdown (property-based)', () => {
  it('notes + remainder always equal the amount exactly, and the remainder is below the smallest note', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 50_000_000 }), cur, (amt, c) => {
      const b = breakdown(amt, c);
      expect(notesTotalMinor(b) + b.remainderMinor).toBe(amt);
      expect(b.remainderMinor).toBeLessThan(smallest(c));
      expect(b.notes.every((n) => n.count > 0)).toBe(true);
    }), { numRuns: 1000 });
  });

  it('whole-rupee amounts in INR need no remainder', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5_000_000 }), (r) => {
      expect(breakdown(r * 100, 'INR').remainderMinor).toBe(0);
    }), { numRuns: 500 });
  });

  it('combining is exact: the total notes equal the sum of each worker\'s notes', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 0, max: 900_000 }), { maxLength: 30 }), (amts) => {
      const parts = amts.map((a) => breakdown(a, 'INR'));
      const all = combine(parts);
      expect(notesTotalMinor(all) + all.remainderMinor).toBe(amts.reduce((s, a) => s + a, 0));
    }), { numRuns: 300 });
  });

  it('never pays more than owed and uses largest notes first (greedy: no avoidable small notes)', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5_000_000 }), (r) => {
      const b = breakdown(r * 100, 'INR');
      expect(notesTotalMinor(b)).toBeLessThanOrEqual(r * 100);
      for (const n of b.notes) if (n.denom === 100) expect(n.count).toBeLessThan(5); // 5x100 would be a 500
    }), { numRuns: 300 });
  });
});
