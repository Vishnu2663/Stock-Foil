import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

// Minimal localStorage shim for Node
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

import { addReceipt, loadReceipts, verifyChain } from '../src/store';
import { offlineExplain, anonymisedFacts, explainPay } from '../src/ai';
import { DEFAULT_SETTINGS } from '../src/store';
import { newCardSpec } from '../src/core/card';
import { compareHalves, computePay } from '../src/core/wages';
import type { PairResult } from '../src/vision/pair';

const base = { cardId: 'X', month: '2026-11', worker: 'W', employer: 'E', verdict: 'genuine-consistent', agreedDays: [1, 2], stockOnlyDays: [], foilOnlyDays: [], agreedAdv: 0, disputedMinor: 0, currency: 'INR' };

describe('hash-chained ledger', () => {
  beforeEach(() => mem.clear());

  it('an untouched chain verifies', async () => {
    for (let i = 0; i < 5; i++) await addReceipt({ ...base, netMinor: i * 100 });
    expect(await verifyChain(loadReceipts())).toBe(-1);
  });

  it('editing ANY receipt, removing one, or reordering breaks the chain at the right place', async () => {
    for (let i = 0; i < 6; i++) await addReceipt({ ...base, netMinor: i * 100 });
    const rs = loadReceipts();
    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 1, max: 9999 }), async (k, d) => {
      const edited = rs.map((r) => ({ ...r }));
      edited[k].netMinor += d;
      expect(await verifyChain(edited)).toBe(k);
    }), { numRuns: 40 });
    const removed = rs.filter((_, i) => i !== 2);
    expect(await verifyChain(removed)).toBe(2);
    expect(await verifyChain([rs[1], rs[0], ...rs.slice(2)])).toBe(0);
  });
});

function fakeResult(sd: number[], fd: number[]): PairResult {
  const spec = newCardSpec({ id: 'AI000001', year: 2026, month: 11, rateMinor: 50000, advMinor: 10000, worker: 'Secret Name', employer: 'Hidden Corp' });
  const mk = (d: number[]) => Array.from({ length: 30 }, (_, i) => d.includes(i + 1));
  const cmp = compareHalves({ days: mk(sd), adv: [] }, { days: mk(fd), adv: [] });
  return { spec, code: 'AAA-BBB', checks: [], edge: {} as never, cmp, pay: computePay(cmp, spec.rateMinor, spec.advMinor), verdict: cmp.consistent ? 'genuine-consistent' : 'genuine-disputed', pairing: 'legacy', alignment: { checked: false, shared: 0, flagged: [], maxResidualMm: 0 }, uncertainCells: [] };
}

describe('AI layer', () => {
  it('cloud prompt facts never contain names or card ids', () => {
    const facts = anonymisedFacts(fakeResult([1, 2, 3], [1, 2]));
    for (const secret of ['Secret Name', 'Hidden Corp', 'AI000001']) expect(facts).not.toContain(secret);
    expect(facts).toContain('only on worker half: 3');
  });

  it('offline explanation always states the agreed sum and any disputed days', () => {
    fc.assert(fc.property(fc.uniqueArray(fc.integer({ min: 1, max: 30 })), fc.uniqueArray(fc.integer({ min: 1, max: 30 })), (a, b) => {
      const r = fakeResult(a, b);
      const t = offlineExplain(r, 'en');
      expect(t).toContain(String(r.pay.agreed.days));
      for (const d of [...r.cmp.stockOnlyDays, ...r.cmp.foilOnlyDays]) expect(t).toContain(String(d));
    }), { numRuns: 100 });
  });

  it('a carried balance is stated in the offline explanation (so the spoken sum adds up) and in the AI facts', () => {
    fc.assert(fc.property(fc.integer({ min: -900_000, max: 900_000 }).filter((n) => n !== 0), fc.uniqueArray(fc.integer({ min: 1, max: 30 }), { minLength: 1 }), (carry, d) => {
      const r = fakeResult(d, d);
      const withCarry = { ...r, pay: computePay(r.cmp, r.spec.rateMinor, r.spec.advMinor, carry) } as PairResult;
      const t = offlineExplain(withCarry, 'en');
      expect(t).toContain('balance brought forward');
      expect(anonymisedFacts(withCarry)).toContain('Balance brought forward');
      expect(offlineExplain(r, 'en')).not.toContain('balance brought forward');
    }), { numRuns: 100 });
  });

  it('with AI off, explainPay returns the offline text; a failing provider falls back too', async () => {
    const r = fakeResult([1, 2], [1, 2]);
    const off = await explainPay({ ...DEFAULT_SETTINGS, aiProvider: 'off' }, r, 'en');
    expect(off.source).toBe('offline');
    // builtin provider is unavailable in Node, so it must degrade gracefully
    const builtin = await explainPay({ ...DEFAULT_SETTINGS, aiProvider: 'builtin' }, r, 'en');
    expect(builtin.source).toBe('offline');
    expect(builtin.text.length).toBeGreaterThan(5);
  });
});
