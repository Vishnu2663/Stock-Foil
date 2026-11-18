import { hash53, toBase32, randomId } from './prng';
import { isPairChars, pairTag, type Pairing, type PairToken } from './pairing';

/** Which half of the tally: the worker keeps the STOCK, the employer keeps the FOIL. */
export type Role = 'S' | 'F';

export interface CardSpec {
  /** Payload version. */
  v: 1;
  /** Unique card id (base32). Seeds the wavy cut line. */
  id: string;
  year: number;
  /** 1-12 */
  month: number;
  /** Day rate in minor units (paise / cents) to keep money math exact. */
  rateMinor: number;
  /** Value of one punched advance token, in minor units. */
  advMinor: number;
  /** ISO 4217 currency code. */
  currency: string;
  worker: string;
  employer: string;
  /** Preferred language of the worker (BCP-47), used for the slip and voice. */
  lang: string;
  /**
   * Balance brought forward from the previous month, minor units. Negative = the
   * worker still owes this (it is deducted); positive = the employer still owes it.
   * Zero for ordinary cards, which keep the original SF1 format byte-for-byte.
   */
  carryMinor: number;
  /**
   * Secrets that cryptographically pair the two halves (see pairing.ts). Kept only by
   * the issuer's app and never part of the card code; absent on cards printed before
   * pairing codes existed.
   */
  pairing?: Pairing;
  /**
   * Half-day mode: every date has TWO punch circles (first half, second half), each worth half a
   * day's wage, so a half day can be recorded and read without ambiguity. Absent on cards printed
   * before it existed, which keep their single circle per date and their original card code.
   */
  halves?: boolean;
  /**
   * Printed targets: every punch circle has a grey disc printed in it. Punching removes the disc, so a hole
   * is read as "the grey is gone" whatever is behind it (a dark cloth, a white table, a wooden bench), and the
   * card can be photographed on any plain surface. Absent on cards printed before this existed.
   */
  discs?: boolean;
  /** id of the card this one replaced when it was edited (local record only) */
  revisedFrom?: string;
}

export const MAX_NAME = 18;

/** Highest daily wage or advance-token value (in major units, e.g. rupees) a new card may carry. */
export const MAX_AMOUNT_MAJOR = 2000;
export const MAX_AMOUNT_MINOR = MAX_AMOUNT_MAJOR * 100;
/** Sanity bound on a hand-typed balance brought forward. Balances computed from the ledger are never truncated. */
export const MAX_CARRY_MAJOR = 100000;

export const clampAmount = (n: number) => Math.min(MAX_AMOUNT_MINOR, Math.max(0, Number.isFinite(n) ? Math.round(n) : 0));

export function cleanName(s: string): string {
  return s.replace(/[|\n\r]/g, ' ').trim().slice(0, MAX_NAME);
}

export function newCardSpec(input: Partial<Omit<CardSpec, 'v' | 'id'>> & { id?: string }): CardSpec {
  const now = new Date();
  return {
    v: 1,
    id: input.id ?? randomId(8),
    year: input.year ?? now.getFullYear(),
    month: input.month ?? now.getMonth() + 1,
    rateMinor: clampAmount(input.rateMinor ?? 50000),
    advMinor: clampAmount(input.advMinor ?? 10000),
    currency: (input.currency ?? 'INR').toUpperCase().slice(0, 3),
    worker: cleanName(input.worker ?? ''),
    employer: cleanName(input.employer ?? ''),
    lang: input.lang ?? 'en',
    carryMinor: Math.round(input.carryMinor ?? 0),
    ...(input.pairing ? { pairing: input.pairing } : {}),
    ...(input.halves ? { halves: true } : {}),
    ...(input.discs ? { discs: true } : {}),
    ...(input.revisedFrom ? { revisedFrom: input.revisedFrom } : {}),
  };
}

/**
 * Short human-readable "card code" binding every shared field. Printed on both
 * halves and embedded in the QR, so a half re-printed with a different rate,
 * month or name cannot pose as the partner of the original half.
 */
export function cardCode(spec: CardSpec): string {
  const parts: (string | number)[] = [spec.v, spec.id, spec.year, spec.month, spec.rateMinor, spec.advMinor, spec.currency, spec.worker, spec.employer, spec.lang];
  // only mixed in when non-zero, so every card printed before carry-forward existed keeps its code
  if (spec.carryMinor) parts.push('c' + spec.carryMinor);
  if (spec.halves) parts.push('h2'); // half-day circles change the card layout, so they are part of the code
  if (spec.discs) parts.push('d3'); // printed discs change how holes are read, so they are part of the code
  const s = parts.join('|');
  const c = toBase32(hash53(s, 0x5f0), 6);
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

/** Seed for the unique cut line of this card. */
export function waveSeed(spec: Pick<CardSpec, 'id'>): number {
  return hash53('wave:' + spec.id) >>> 0;
}

/**
 * QR payload. Ordinary cards use the original SF1 layout:
 *   SF1|role|id|yyyymm|rate|adv|cur|lang|code|worker|employer
 * A balance brought forward uses SF2 (adds carry before code):
 *   SF2|role|id|yyyymm|rate|adv|cur|lang|carry|code|worker|employer
 * A trailing 'h' (SF1h, SF1ph, SF2h…) means the card has two half-day circles per date; a further 'd' (SF1phd…)
 * means a grey disc is printed in every circle.
 * A trailing 'p' on the version (SF1p, SF2p) means the card is cryptographically paired:
 * this half's own secret and the pair tag follow the code, before the names:
 *   SF1p|role|id|yyyymm|rate|adv|cur|lang|code|secret|tag|worker|employer
 * Every older form still decodes, so cards that are already printed keep working.
 */
export function encodePayload(spec: CardSpec, role: Role): string {
  const ym = `${spec.year}${String(spec.month).padStart(2, '0')}`;
  const code = cardCode(spec).replace('-', '');
  const pair = spec.pairing ? [role === 'S' ? spec.pairing.sa : spec.pairing.sf, pairTag(spec.id, spec.pairing.sa, spec.pairing.sf)] : [];
  const flag = (spec.pairing ? 'p' : '') + (spec.halves ? 'h' : '') + (spec.discs ? 'd' : '');
  const head = ['SF' + (spec.carryMinor ? '2' : '1') + flag, role, spec.id, ym, spec.rateMinor, spec.advMinor, spec.currency, spec.lang];
  return [...head, ...(spec.carryMinor ? [spec.carryMinor] : []), code, ...pair, spec.worker, spec.employer].join('|');
}

export interface DecodedPayload {
  spec: CardSpec;
  role: Role;
  /** the card is cryptographically paired (its QR carries this half's secret and the tag) */
  pairing: boolean;
  /** this half's pairing token, when the card is paired */
  pair?: PairToken;
  /** True if the embedded code matches the recomputed one (fields not altered). */
  codeOk: boolean;
}

export function decodePayload(text: string): DecodedPayload | null {
  const p = text.split('|');
  const m = /^SF([12])(p?)(h?)(d?)$/.exec(p[0]);
  if (!m) return null;
  const hasCarry = m[1] === '2';
  const paired = m[2] === 'p';
  const halves = m[3] === 'h';
  const discs = m[4] === 'd';
  const carryAt = hasCarry ? 8 : -1;
  const codeAt = hasCarry ? 9 : 8;
  const secretAt = paired ? codeAt + 1 : -1;
  const nameAt = codeAt + 1 + (paired ? 2 : 0);
  if (p.length < nameAt + 2) return null;
  const role = p[1];
  if (role !== 'S' && role !== 'F') return null;
  const ym = p[3];
  if (!/^\d{6}$/.test(ym)) return null;
  const month = Number(ym.slice(4));
  if (month < 1 || month > 12) return null;
  const rateMinor = Number(p[4]);
  const advMinor = Number(p[5]);
  const carryMinor = carryAt >= 0 ? Number(p[carryAt]) : 0;
  if (!Number.isFinite(rateMinor) || !Number.isFinite(advMinor) || !Number.isFinite(carryMinor)) return null;
  let pair: PairToken | undefined;
  if (paired) {
    if (!isPairChars(p[secretAt]) || !isPairChars(p[secretAt + 1])) return null;
    pair = { role, id: p[2], secret: p[secretAt], tag: p[secretAt + 1] };
  }
  const spec: CardSpec = {
    v: 1,
    id: p[2],
    year: Number(ym.slice(0, 4)),
    month,
    rateMinor,
    advMinor,
    currency: p[6],
    lang: p[7],
    carryMinor,
    worker: p[nameAt],
    employer: p.slice(nameAt + 1).join('|'),
    ...(halves ? { halves: true } : {}),
    ...(discs ? { discs: true } : {}),
  };
  const codeOk = cardCode(spec).replace('-', '') === p[codeAt];
  return { spec, role, codeOk, pairing: paired, ...(pair ? { pair } : {}) };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Weekday of the 1st, with Monday = 0 … Sunday = 6. */
export function firstWeekday(year: number, month: number): number {
  return (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
}

export function formatMoney(minor: number, currency: string, locale = 'en'): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
  } catch {
    return `${currency} ${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`;
  }
}
