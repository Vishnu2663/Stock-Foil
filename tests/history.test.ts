import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildHistory, historyTotals, type HistoryReceipt } from '../src/core/history';
import { payState, paymentStatus } from '../src/core/settlement';
import { carryFor, newMember } from '../src/core/members';
import { newCardSpec } from '../src/core/card';

const VERDICTS = ['genuine-consistent', 'genuine-disputed', 'review', 'paid', 'unpaid'] as const;
const arbReceipts = fc.array(
  fc.record({
    card: fc.constantFrom('C1', 'C2', 'C3'),
    month: fc.constantFrom('2026-09', '2026-10'),
    verdict: fc.constantFrom(...VERDICTS),
    net: fc.integer({ min: -500000, max: 900000 }),
    cur: fc.constantFrom('INR', 'USD'),
  }),
  { maxLength: 40 },
).map((l) => l.map((r, i): HistoryReceipt => ({ seq: i + 1, at: `2026-11-${String((i % 28) + 1).padStart(2, '0')}T10:00:00Z`, cardId: r.card, month: r.month, worker: 'W' + r.card, employer: 'E', verdict: r.verdict, agreedDays: [1, 2, 3], netMinor: r.net, disputedMinor: 0, currency: r.cur })));

describe('pay status: Paid / Yet to pay', () => {
  it('paid is final: a later "yet to pay" can never turn a paid card back into an owed one', () => {
    fc.assert(fc.property(arbReceipts, (rs) => {
      for (const card of ['C1', 'C2', 'C3']) for (const month of ['2026-09', '2026-10']) {
        const rel = rs.filter((r) => r.cardId === card && r.month === month);
        const st = payState(rs, card, month).state;
        if (rel.some((r) => r.verdict === 'paid')) expect(st).toBe('paid');
        else if (rel.some((r) => r.verdict === 'unpaid')) expect(st).toBe('unpaid');
        else expect(st).toBe('none');
      }
    }), { numRuns: 300 });
  });

  it('"yet to pay" then "paid" ends as paid; the status of one card never leaks into another', () => {
    const rs: HistoryReceipt[] = [
      { seq: 1, at: 'a', cardId: 'C1', month: 'm', worker: 'W', employer: 'E', verdict: 'genuine-consistent', agreedDays: [1], netMinor: 500, disputedMinor: 0, currency: 'INR' },
      { seq: 2, at: 'b', cardId: 'C1', month: 'm', worker: 'W', employer: 'E', verdict: 'unpaid', agreedDays: [], netMinor: 500, disputedMinor: 0, currency: 'INR' },
    ];
    expect(payState(rs, 'C1', 'm').state).toBe('unpaid');
    expect(paymentStatus(rs, 'C1', 'm', 500).pending).toBe(true);
    expect(payState(rs, 'C2', 'm').state).toBe('none');
    const later = [...rs, { ...rs[1], seq: 3, verdict: 'paid', at: 'c' }];
    expect(payState(later, 'C1', 'm').state).toBe('paid');
    expect(paymentStatus(later, 'C1', 'm', 500)).toMatchObject({ paid: true, pending: false });
  });
});

describe('history rows and totals (property-based)', () => {
  it('exactly one row per card and month; status counts always add up to the rows', () => {
    fc.assert(fc.property(arbReceipts, (rs) => {
      const rows = buildHistory(rs);
      expect(rows.length).toBe(new Set(rs.map((r) => `${r.cardId}|${r.month}`)).size);
      expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
      const tot = historyTotals(rows);
      let sum = 0;
      for (const t of Object.values(tot)) sum += t.paid.count + t.unpaid.count + t.none.count;
      expect(sum).toBe(rows.length);
      for (const t of Object.values(tot)) expect(t.paid.count + t.unpaid.count + t.none.count).toBe(t.rows);
    }), { numRuns: 300 });
  });

  it('the latest scan wins, scans are counted, and the amount owed is never negative', () => {
    fc.assert(fc.property(arbReceipts, (rs) => {
      for (const row of buildHistory(rs)) {
        const scans = rs.filter((r) => r.cardId === row.cardId && r.month === row.month && r.verdict !== 'paid' && r.verdict !== 'unpaid');
        expect(row.scans).toBe(scans.length);
        if (scans.length) expect(row.netMinor).toBe([...scans].sort((a, b) => b.seq - a.seq)[0].netMinor);
        expect(row.amountMinor).toBeGreaterThanOrEqual(0);
        if (row.status !== 'paid') expect(row.amountMinor).toBe(Math.max(0, row.netMinor));
      }
    }), { numRuns: 300 });
  });

  it('totals are kept per currency and never mix currencies', () => {
    fc.assert(fc.property(arbReceipts, (rs) => {
      const rows = buildHistory(rs);
      const tot = historyTotals(rows);
      for (const cur of Object.keys(tot)) {
        const mine = rows.filter((r) => r.currency === cur);
        expect(tot[cur].paid.minor).toBe(mine.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amountMinor, 0));
        expect(tot[cur].unpaid.minor).toBe(mine.filter((r) => r.status === 'unpaid').reduce((s, r) => s + r.amountMinor, 0));
      }
    }), { numRuns: 200 });
  });

  it('a payment record with no saved scan (older data) still shows up as a row', () => {
    const rows = buildHistory([{ seq: 1, at: 't', cardId: 'OLD', month: '2026-05', worker: 'W', employer: 'E', verdict: 'paid', agreedDays: [], netMinor: 123400, disputedMinor: 0, currency: 'INR' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'paid', days: null, amountMinor: 123400, scans: 0 });
  });
});

describe('a "yet to pay" marker never masks a balance to carry forward', () => {
  it('carryFor reads the scan, not the paid / unpaid records saved after it', () => {
    const m = newMember({ name: 'Ramesh', employer: 'Sharma' });
    const cards = [newCardSpec({ id: 'PREV0001', year: 2026, month: 10, worker: 'Ramesh', employer: 'Sharma' })];
    const scan = { seq: 1, cardId: 'PREV0001', month: '2026-10', verdict: 'genuine-consistent', netMinor: -70000 };
    const after = [scan, { seq: 2, cardId: 'PREV0001', month: '2026-10', verdict: 'unpaid', netMinor: 0 }];
    expect(carryFor(m, cards, after, 2026, 11)).toBe(-70000);
    expect(carryFor(m, cards, [...after, { seq: 3, cardId: 'PREV0001', month: '2026-10', verdict: 'paid', netMinor: 0 }], 2026, 11)).toBe(-70000);
  });
});
