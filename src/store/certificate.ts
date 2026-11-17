/**
 * Proof-of-income certificate. Informal workers rarely have payslips; this turns
 * the agreed, hash-chained payday receipts into a printable summary whose QR
 * carries the figures plus the ledger head. Anyone holding the exported ledger
 * can verify it: the chain must be intact and every figure must match a receipt.
 *
 * It is a record both sides agreed on, NOT an employer-signed payslip.
 */
import { receiptDays, verifyChain, type Receipt } from './index';

export interface CertMonth {
  /** yyyy-mm */
  m: string;
  days: number;
  adv: number;
  /** agreed net for the month, minor units */
  net: number;
  /** first 8 hex of the receipt hash */
  h: string;
  /** amount recorded as paid, if the card was marked paid */
  paid?: number;
}

export interface Certificate {
  v: 1;
  worker: string;
  employer: string;
  currency: string;
  from: string;
  to: string;
  months: CertMonth[];
  totalDays: number;
  totalNet: number;
  /** first 16 hex of the newest receipt hash in the ledger when issued */
  head: string;
  at: string;
}

const norm = (s: string) => s.trim().toLowerCase();
const COUNTED = new Set(['genuine-consistent', 'genuine-disputed', 'review', 'inconclusive']);

export function buildCertificate(ledger: Receipt[], worker: string, employer: string, maxMonths = 6, now = new Date()): Certificate | null {
  const mine = ledger.filter((r) => norm(r.worker) === norm(worker) && norm(r.employer) === norm(employer));
  // latest counted scan per card+month
  const latest = new Map<string, Receipt>();
  for (const r of mine) if (COUNTED.has(r.verdict)) {
    const k = `${r.cardId}|${r.month}`;
    if (!latest.has(k) || latest.get(k)!.seq < r.seq) latest.set(k, r);
  }
  if (!latest.size) return null;
  // one entry per month: if several cards exist for a month, the newest scan wins
  const byMonth = new Map<string, Receipt>();
  for (const r of latest.values()) if (!byMonth.has(r.month) || byMonth.get(r.month)!.seq < r.seq) byMonth.set(r.month, r);
  const months: CertMonth[] = [...byMonth.values()]
    .sort((a, b) => (a.month < b.month ? 1 : -1))
    .slice(0, maxMonths)
    .reverse()
    .map((r) => {
      const paidRec = mine.filter((p) => p.verdict === 'paid' && p.cardId === r.cardId && p.month === r.month).sort((a, b) => b.seq - a.seq)[0];
      return { m: r.month, days: receiptDays(r), adv: r.agreedAdv, net: r.netMinor, h: r.hash.slice(0, 8), ...(paidRec ? { paid: paidRec.netMinor } : {}) };
    });
  const first = [...byMonth.values()][0];
  return {
    v: 1,
    worker: first.worker,
    employer: first.employer,
    currency: first.currency,
    from: months[0].m,
    to: months[months.length - 1].m,
    months,
    totalDays: months.reduce((s, x) => s + x.days, 0),
    totalNet: months.reduce((s, x) => s + Math.max(0, x.net), 0),
    head: ledger.length ? ledger[ledger.length - 1].hash.slice(0, 16) : '',
    at: now.toISOString(),
  };
}

export interface CertCheck {
  ok: boolean;
  problems: string[];
}

export async function verifyCertificate(cert: Certificate, ledger: Receipt[]): Promise<CertCheck> {
  const problems: string[] = [];
  const bad = await verifyChain(ledger);
  if (bad >= 0) problems.push(`The ledger has been altered: its chain breaks at receipt #${bad + 1}.`);
  if (!ledger.some((r) => r.hash.startsWith(cert.head))) problems.push('The ledger head named on the certificate is not in this ledger.');
  for (const m of cert.months) {
    const r = ledger.find((x) => x.hash.startsWith(m.h) && x.month === m.m && norm(x.worker) === norm(cert.worker) && norm(x.employer) === norm(cert.employer) && COUNTED.has(x.verdict));
    if (!r) problems.push(`${m.m}: no matching receipt.`);
    else if (receiptDays(r) !== m.days || r.agreedAdv !== m.adv || r.netMinor !== m.net) problems.push(`${m.m}: the figures do not match the ledger.`);
    else if (m.paid !== undefined && !ledger.some((p) => p.verdict === 'paid' && p.cardId === r.cardId && p.month === m.m && p.netMinor === m.paid)) problems.push(`${m.m}: the recorded payment is not in the ledger.`);
  }
  if (cert.totalDays !== cert.months.reduce((s, x) => s + x.days, 0)) problems.push('Total days do not add up.');
  if (cert.totalNet !== cert.months.reduce((s, x) => s + Math.max(0, x.net), 0)) problems.push('Total earnings do not add up.');
  return { ok: problems.length === 0, problems };
}
