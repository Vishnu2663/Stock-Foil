import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { compareHalves, computePay } from '../src/core/wages';

const marks = (n: number) => fc.array(fc.boolean(), { minLength: n, maxLength: n });

describe('wage arithmetic (property-based)', () => {
  const arb = fc.record({
    sd: marks(31), fd: marks(31), sa: marks(10), fa: marks(10),
    rate: fc.integer({ min: 0, max: 10_000_000 }), adv: fc.integer({ min: 0, max: 1_000_000 }),
  });

  it('agreed days = intersection; one-sided = symmetric difference', () => {
    fc.assert(fc.property(arb, (a) => {
      const c = compareHalves({ days: a.sd, adv: a.sa }, { days: a.fd, adv: a.fa });
      const both = a.sd.filter((v, i) => v && a.fd[i]).length;
      const one = a.sd.filter((v, i) => v !== a.fd[i]).length;
      expect(c.agreedDays.length).toBe(both);
      expect(c.stockOnlyDays.length + c.foilOnlyDays.length).toBe(one);
      expect(c.consistent).toBe(one === 0 && a.sa.every((v, i) => v === a.fa[i]));
    }), { numRuns: 500 });
  });

  it('net = days x rate - advances x token, exactly', () => {
    fc.assert(fc.property(arb, (a) => {
      const c = compareHalves({ days: a.sd, adv: a.sa }, { days: a.fd, adv: a.fa });
      const p = computePay(c, a.rate, a.adv);
      expect(p.agreed.netMinor).toBe(c.agreedDays.length * a.rate - c.agreedAdv.length * a.adv);
      expect(Number.isInteger(p.agreed.netMinor)).toBe(true);
    }), { numRuns: 500 });
  });

  it('a hole added to only one half is always flagged and never counted as agreed', () => {
    fc.assert(fc.property(marks(31), fc.integer({ min: 0, max: 30 }), (m, k) => {
      const base = m.map(() => false);
      const stock = [...m]; const foil = [...m];
      stock[k] = true; foil[k] = false;
      const c = compareHalves({ days: stock, adv: [] }, { days: foil, adv: [] });
      expect(c.stockOnlyDays).toContain(k + 1);
      expect(c.agreedDays).not.toContain(k + 1);
      expect(c.consistent).toBe(false);
      void base;
    }), { numRuns: 300 });
  });

  it('disputed amount equals the one-sided days x rate net of advances', () => {
    fc.assert(fc.property(arb, (a) => {
      const c = compareHalves({ days: a.sd, adv: a.sa }, { days: a.fd, adv: a.fa });
      const p = computePay(c, a.rate, a.adv);
      expect(p.disputedMinor).toBe(Math.abs(p.workerView.netMinor - p.employerView.netMinor));
      if (c.consistent) expect(p.disputedMinor).toBe(0);
    }), { numRuns: 300 });
  });
});
