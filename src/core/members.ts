/**
 * Members: the people a card is created for. A card belongs to a member when its
 * worker name and employer match (case-insensitive), so no extra data has to be
 * printed on the card and the card code stays untouched.
 */
import { cleanName, newCardSpec, type CardSpec } from './card';
import { randomId } from './prng';

export interface Member {
  id: string;
  name: string;
  employer: string;
  rateMinor: number;
  advMinor: number;
  currency: string;
  lang: string;
  createdAt: string;
}

export function newMember(m: Partial<Omit<Member, 'id' | 'createdAt'>> & { name: string }): Member {
  return {
    id: randomId(6),
    name: cleanName(m.name),
    employer: cleanName(m.employer ?? ''),
    rateMinor: Math.max(0, Math.round(m.rateMinor ?? 50000)),
    advMinor: Math.max(0, Math.round(m.advMinor ?? 10000)),
    currency: (m.currency ?? 'INR').toUpperCase().slice(0, 3),
    lang: m.lang ?? 'en',
    createdAt: new Date().toISOString(),
  };
}

const norm = (s: string) => s.trim().toLowerCase();

export function ownsCard(m: Pick<Member, 'name' | 'employer'>, c: Pick<CardSpec, 'worker' | 'employer'>): boolean {
  return norm(m.name) === norm(c.worker) && norm(m.employer) === norm(c.employer);
}

export function cardsOf(m: Member, cards: CardSpec[]): CardSpec[] {
  return cards.filter((c) => ownsCard(m, c)).sort((a, b) => b.year * 12 + b.month - (a.year * 12 + a.month));
}

export function hasCardForMonth(m: Member, cards: CardSpec[], year: number, month: number): boolean {
  return cards.some((c) => ownsCard(m, c) && c.year === year && c.month === month);
}

export interface ReceiptLike {
  seq: number;
  cardId: string;
  month: string;
  verdict: string;
  netMinor: number;
}

/**
 * Balance to bring forward onto a member's card for (year, month): the previous
 * month's agreed net when it was negative (the worker owes it). Payment records
 * are ignored, and the latest scan of that month wins.
 */
export function carryFor(m: Member, cards: CardSpec[], receipts: ReceiptLike[], year: number, month: number): number {
  const py = month === 1 ? year - 1 : year;
  const pm = month === 1 ? 12 : month - 1;
  const key = `${py}-${String(pm).padStart(2, '0')}`;
  const ids = new Set(cards.filter((c) => ownsCard(m, c) && c.year === py && c.month === pm).map((c) => c.id));
  const last = receipts.filter((r) => ids.has(r.cardId) && r.month === key && r.verdict !== 'paid').sort((a, b) => b.seq - a.seq)[0];
  return last && last.netMinor < 0 ? last.netMinor : 0;
}

/** One new card per member who does not already have one for that month. */
export function bulkSpecs(members: Member[], cards: CardSpec[], year: number, month: number, carry: (m: Member) => number = () => 0): CardSpec[] {
  const seen = new Set<string>();
  const out: CardSpec[] = [];
  for (const m of members) {
    const key = `${norm(m.name)}|${norm(m.employer)}`;
    if (seen.has(key) || hasCardForMonth(m, cards, year, month)) continue;
    seen.add(key);
    out.push(newCardSpec({ year, month, worker: m.name, employer: m.employer, rateMinor: m.rateMinor, advMinor: m.advMinor, currency: m.currency, lang: m.lang, carryMinor: carry(m) }));
  }
  return out;
}

export function memberStats(members: Member[], cards: CardSpec[], year: number, month: number) {
  const owned = new Set<string>();
  let thisMonth = 0;
  for (const m of members) {
    for (const c of cardsOf(m, cards)) {
      owned.add(c.id);
      if (c.year === year && c.month === month) thisMonth++;
    }
  }
  return { members: members.length, cards: owned.size, thisMonth, missingThisMonth: members.filter((m) => !hasCardForMonth(m, cards, year, month)).length };
}
