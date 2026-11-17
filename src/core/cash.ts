/**
 * Cash breakdown for payday: which notes to hand each worker, and in total.
 * Works in integer minor units so the arithmetic is exact. Denominations are
 * common circulating notes/coins per currency (major units); unknown currencies
 * fall back to a generic set.
 */
export const DENOMS: Record<string, number[]> = {
  INR: [500, 200, 100, 50, 20, 10, 5, 2, 1],
  USD: [100, 50, 20, 10, 5, 1],
  EUR: [200, 100, 50, 20, 10, 5, 2, 1],
  GBP: [50, 20, 10, 5, 2, 1],
  KES: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  NGN: [1000, 500, 200, 100, 50, 20, 10, 5],
  BDT: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
  PKR: [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1],
  NPR: [1000, 500, 100, 50, 20, 10, 5, 2, 1],
  PHP: [1000, 500, 200, 100, 50, 20, 10, 5, 1],
  IDR: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100],
  MXN: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1],
  BRL: [200, 100, 50, 20, 10, 5, 2, 1],
  ZAR: [200, 100, 50, 20, 10, 5, 2, 1],
};
const FALLBACK = [100, 50, 20, 10, 5, 1];

export interface Breakdown {
  /** denomination (major units) -> count, largest first, zero counts omitted */
  notes: { denom: number; count: number }[];
  /** what cannot be paid with the smallest denomination, in minor units */
  remainderMinor: number;
}

export function breakdown(amountMinor: number, currency: string): Breakdown {
  const ds = [...(DENOMS[currency] ?? FALLBACK)].sort((a, b) => b - a);
  let left = Math.max(0, Math.floor(amountMinor));
  const notes: Breakdown['notes'] = [];
  for (const d of ds) {
    const c = Math.floor(left / (d * 100));
    if (c > 0) {
      notes.push({ denom: d, count: c });
      left -= c * d * 100;
    }
  }
  return { notes, remainderMinor: left };
}

/** Sum several breakdowns into the notes the contractor needs to bring. */
export function combine(parts: Breakdown[]): Breakdown {
  const m = new Map<number, number>();
  let rem = 0;
  for (const p of parts) {
    rem += p.remainderMinor;
    for (const n of p.notes) m.set(n.denom, (m.get(n.denom) ?? 0) + n.count);
  }
  return { notes: [...m.entries()].map(([denom, count]) => ({ denom, count })).sort((a, b) => b.denom - a.denom), remainderMinor: rem };
}

export function notesTotalMinor(b: Breakdown): number {
  return b.notes.reduce((s, n) => s + n.denom * 100 * n.count, 0);
}
