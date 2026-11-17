import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};

import { addReceipt, loadReceipts, type Receipt } from '../src/store';
import { buildCertificate, verifyCertificate } from '../src/store/certificate';
import { paymentStatus, payable } from '../src/core/settlement';

const base = { worker: 'Ramesh', employer: 'Sharma', stockOnlyDays: [] as number[], foilOnlyDays: [] as number[], disputedMinor: 0, currency: 'INR' };
const scan = (cardId: string, month: string, days: number, net: number, verdict = 'genuine-consistent') =>
  addReceipt({ ...base, cardId, month, verdict, agreedDays: Array.from({ length: days }, (_, i) => i + 1), agreedAdv: 1, netMinor: net });
const pay = (cardId: string, month: string, amount: number) => addReceipt({ ...base, cardId, month, verdict: 'paid', agreedDays: [], agreedAdv: 0, netMinor: amount });

describe('paid / settled status', () => {
  beforeEach(() => mem.clear());

  it('not paid until a paid receipt exists for exactly that card and month; others are unaffected', async () => {
    await scan('CARD0001', '2026-11', 5, 250000);
    let st = paymentStatus(loadReceipts(), 'CARD0001', '2026-11', 250000);
    expect(st.paid).toBe(false);
    await pay('CARD0001', '2026-11', 250000);
    st = paymentStatus(loadReceipts(), 'CARD0001', '2026-11', 250000);
    expect(st.paid).toBe(true);
    expect(st.amountMinor).toBe(250000);
    expect(st.changed).toBe(false);
    expect(paymentStatus(loadReceipts(), 'CARD0001', '2026-12', 250000).paid).toBe(false);
    expect(paymentStatus(loadReceipts(), 'OTHER001', '2026-11', 250000).paid).toBe(false);
  });

  it('a later scan showing a different amount than was paid is flagged as changed', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 5_000_000 }), fc.integer({ min: -2_000_000, max: 5_000_000 }), (paid, nowNet) => {
      const rs = [{ seq: 1, at: 't', cardId: 'C', month: '2026-11', verdict: 'paid', netMinor: paid }];
      const st = paymentStatus(rs, 'C', '2026-11', nowNet);
      expect(st.changed).toBe(paid !== payable(nowNet));
    }), { numRuns: 300 });
  });

  it('the latest payment record wins', () => {
    const rs = [
      { seq: 1, at: 'a', cardId: 'C', month: 'm', verdict: 'paid', netMinor: 100 },
      { seq: 2, at: 'b', cardId: 'C', month: 'm', verdict: 'paid', netMinor: 900 },
    ];
    expect(paymentStatus(rs, 'C', 'm', 900).amountMinor).toBe(900);
    expect(payable(-500)).toBe(0);
  });

  it('a payment record is part of the tamper-evident chain: editing it is detected', async () => {
    const { verifyChain } = await import('../src/store');
    await scan('CARD0001', '2026-11', 5, 250000);
    await pay('CARD0001', '2026-11', 250000);
    const rs = loadReceipts().map((r) => ({ ...r }));
    expect(await verifyChain(rs)).toBe(-1);
    rs[1].netMinor = 1; // pretend the worker was paid almost nothing
    expect(await verifyChain(rs)).toBe(1);
  });
});

describe('income certificate', () => {
  beforeEach(() => mem.clear());

  async function ledger(n: number) {
    for (let i = 1; i <= n; i++) {
      await scan('CARD' + String(i).padStart(4, '0'), `2026-${String(i).padStart(2, '0')}`, 10 + i, 100000 * i);
      if (i % 2 === 0) await pay('CARD' + String(i).padStart(4, '0'), `2026-${String(i).padStart(2, '0')}`, 100000 * i);
    }
    return loadReceipts();
  }

  it('a genuine certificate verifies against the ledger it came from', async () => {
    const l = await ledger(5);
    const cert = buildCertificate(l, 'Ramesh', 'Sharma', 6)!;
    expect(cert.months.length).toBe(5);
    expect(cert.totalDays).toBe(cert.months.reduce((s, m) => s + m.days, 0));
    expect(cert.months.filter((m) => m.paid !== undefined).length).toBe(2);
    const v = await verifyCertificate(cert, l);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('only the requested number of recent months is included, newest last', async () => {
    const l = await ledger(5);
    const cert = buildCertificate(l, 'Ramesh', 'Sharma', 3)!;
    expect(cert.months.map((m) => m.m)).toEqual(['2026-03', '2026-04', '2026-05']);
    expect(cert.from).toBe('2026-03');
    expect(cert.to).toBe('2026-05');
  });

  it('any inflated figure on the certificate fails verification', async () => {
    const l = await ledger(4);
    await fc.assert(fc.asyncProperty(fc.integer({ min: 0, max: 3 }), fc.constantFrom('days', 'adv', 'net'), fc.integer({ min: 1, max: 99999 }), async (i, field, d) => {
      const cert = JSON.parse(JSON.stringify(buildCertificate(l, 'Ramesh', 'Sharma', 6)!));
      cert.months[i][field] += d;
      expect((await verifyCertificate(cert, l)).ok).toBe(false);
    }), { numRuns: 30 });
  });

  it('a forged month (invented hash) and altered totals fail', async () => {
    const l = await ledger(3);
    const cert = JSON.parse(JSON.stringify(buildCertificate(l, 'Ramesh', 'Sharma', 6)!));
    const forged = JSON.parse(JSON.stringify(cert));
    forged.months.push({ m: '2026-09', days: 25, adv: 0, net: 999999, h: 'deadbeef' });
    expect((await verifyCertificate(forged, l)).ok).toBe(false);
    const totals = JSON.parse(JSON.stringify(cert));
    totals.totalNet += 1;
    expect((await verifyCertificate(totals, l)).ok).toBe(false);
  });

  it('editing or deleting receipts in the ledger invalidates an earlier certificate', async () => {
    const l = await ledger(4);
    const cert = buildCertificate(l, 'Ramesh', 'Sharma', 6)!;
    const edited: Receipt[] = l.map((r) => ({ ...r }));
    edited[0].netMinor += 100;
    expect((await verifyCertificate(cert, edited)).ok).toBe(false);
    expect((await verifyCertificate(cert, l.slice(1))).ok).toBe(false);
    expect((await verifyCertificate(cert, l.slice(0, -1))).ok).toBe(false);
  });

  it('returns nothing for a worker with no agreed scans, and never mixes in another worker', async () => {
    const l = await ledger(3);
    expect(buildCertificate(l, 'Nobody', 'Sharma', 6)).toBeNull();
    await addReceipt({ ...base, worker: 'Sita', cardId: 'SITA0001', month: '2026-03', verdict: 'genuine-consistent', agreedDays: [1, 2, 3], agreedAdv: 0, netMinor: 777 });
    const cert = buildCertificate(loadReceipts(), 'Ramesh', 'Sharma', 6)!;
    expect(cert.months.some((m) => m.net === 777)).toBe(false);
  });
});
