/**
 * History: every payday scan that was saved, with where the money stands. Built purely from
 * the hash-chained ledger, so it is as tamper-evident as the ledger itself.
 *
 * One row per card + month (the latest scan wins; `scans` counts how many there were). The
 * status comes from the "Paid" / "Yet to pay" receipts, and paid is final.
 */
import { payable, payState, type PayState } from './settlement';

export interface HistoryReceipt {
  seq: number;
  at: string;
  cardId: string;
  month: string;
  worker: string;
  employer: string;
  verdict: string;
  agreedDays: number[];
  netMinor: number;
  disputedMinor: number;
  currency: string;
}

export interface HistoryRow {
  key: string;
  cardId: string;
  month: string;
  worker: string;
  employer: string;
  /** when the latest scan was saved */
  scanAt: string;
  verdict: string;
  /** agreed days; null when only a payment record exists (older data) */
  days: number | null;
  /** agreed net from the scan, minor units (can be negative: a balance carried forward) */
  netMinor: number;
  disputedMinor: number;
  currency: string;
  scans: number;
  status: PayState;
  statusAt?: string;
  /** what to pay (or what was paid): never negative */
  amountMinor: number;
}

const isStatus = (v: string) => v === 'paid' || v === 'unpaid';

export function buildHistory(receipts: HistoryReceipt[]): HistoryRow[] {
  const groups = new Map<string, HistoryReceipt[]>();
  for (const r of receipts) {
    const k = `${r.cardId}|${r.month}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const rows: HistoryRow[] = [];
  for (const [key, rs] of groups) {
    const scans = rs.filter((r) => !isStatus(r.verdict)).sort((a, b) => b.seq - a.seq);
    const latestAny = [...rs].sort((a, b) => b.seq - a.seq)[0];
    const base = scans[0] ?? latestAny; // a payment record with no scan (older data) still gets a row
    const st = payState(receipts, base.cardId, base.month);
    rows.push({
      key,
      cardId: base.cardId,
      month: base.month,
      worker: base.worker,
      employer: base.employer,
      scanAt: base.at,
      verdict: scans[0] ? scans[0].verdict : st.state,
      days: scans[0] ? scans[0].agreedDays.length : null,
      netMinor: scans[0] ? scans[0].netMinor : st.amountMinor ?? 0,
      disputedMinor: scans[0] ? scans[0].disputedMinor : 0,
      currency: base.currency,
      scans: scans.length,
      status: st.state,
      statusAt: st.at,
      amountMinor: st.state === 'paid' ? payable(st.amountMinor ?? 0) : payable(scans[0]?.netMinor ?? st.amountMinor ?? 0),
    });
  }
  // newest activity first
  const last = (r: HistoryRow) => (r.statusAt && r.statusAt > r.scanAt ? r.statusAt : r.scanAt);
  return rows.sort((a, b) => (last(b) > last(a) ? 1 : last(b) < last(a) ? -1 : 0));
}

export interface HistoryTotals {
  rows: number;
  paid: { count: number; minor: number };
  unpaid: { count: number; minor: number };
  none: { count: number; minor: number };
  disputedMinor: number;
}

/** Totals per currency, so different currencies are never added together. */
export function historyTotals(rows: HistoryRow[]): Record<string, HistoryTotals> {
  const out: Record<string, HistoryTotals> = {};
  for (const r of rows) {
    const t = (out[r.currency] ??= { rows: 0, paid: { count: 0, minor: 0 }, unpaid: { count: 0, minor: 0 }, none: { count: 0, minor: 0 }, disputedMinor: 0 });
    t.rows++;
    t[r.status].count++;
    t[r.status].minor += r.amountMinor;
    t.disputedMinor += r.disputedMinor;
  }
  return out;
}
