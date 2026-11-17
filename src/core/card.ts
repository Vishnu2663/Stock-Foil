import { hash53, toBase32, randomId } from './prng';

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
}

export const MAX_NAME = 18;

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
    rateMinor: Math.max(0, Math.round(input.rateMinor ?? 50000)),
    advMinor: Math.max(0, Math.round(input.advMinor ?? 10000)),
    currency: (input.currency ?? 'INR').toUpperCase().slice(0, 3),
    worker: cleanName(input.worker ?? ''),
    employer: cleanName(input.employer ?? ''),
    lang: input.lang ?? 'en',
  };
}

/**
 * Short human-readable "card code" binding every shared field. Printed on both
 * halves and embedded in the QR, so a half re-printed with a different rate,
 * month or name cannot pose as the partner of the original half.
 */
export function cardCode(spec: CardSpec): string {
  const s = [spec.v, spec.id, spec.year, spec.month, spec.rateMinor, spec.advMinor, spec.currency, spec.worker, spec.employer, spec.lang].join('|');
  const c = toBase32(hash53(s, 0x5f0), 6);
  return `${c.slice(0, 3)}-${c.slice(3)}`;
}

/** Seed for the unique cut line of this card. */
export function waveSeed(spec: Pick<CardSpec, 'id'>): number {
  return hash53('wave:' + spec.id) >>> 0;
}

/** QR payload: SF1|role|id|yyyymm|rate|adv|cur|lang|code|worker|employer */
export function encodePayload(spec: CardSpec, role: Role): string {
  const ym = `${spec.year}${String(spec.month).padStart(2, '0')}`;
  return ['SF1', role, spec.id, ym, spec.rateMinor, spec.advMinor, spec.currency, spec.lang, cardCode(spec).replace('-', ''), spec.worker, spec.employer].join('|');
}

export interface DecodedPayload {
  spec: CardSpec;
  role: Role;
  /** True if the embedded code matches the recomputed one (fields not altered). */
  codeOk: boolean;
}

export function decodePayload(text: string): DecodedPayload | null {
  const p = text.split('|');
  if (p.length < 11 || p[0] !== 'SF1') return null;
  const role = p[1];
  if (role !== 'S' && role !== 'F') return null;
  const ym = p[3];
  if (!/^\d{6}$/.test(ym)) return null;
  const month = Number(ym.slice(4));
  if (month < 1 || month > 12) return null;
  const rateMinor = Number(p[4]);
  const advMinor = Number(p[5]);
  if (!Number.isFinite(rateMinor) || !Number.isFinite(advMinor)) return null;
  const spec: CardSpec = {
    v: 1,
    id: p[2],
    year: Number(ym.slice(0, 4)),
    month,
    rateMinor,
    advMinor,
    currency: p[6],
    lang: p[7],
    worker: p[9],
    employer: p.slice(10).join('|'),
  };
  const codeOk = cardCode(spec).replace('-', '') === p[8];
  return { spec, role, codeOk };
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
