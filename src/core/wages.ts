/**
 * Pure tally comparison and pay arithmetic. All money is integer minor units,
 * so results are exact and property tests can check them precisely.
 */

export type CellStatus = 'both' | 'none' | 'stockOnly' | 'foilOnly';

export interface HalfMarks {
  /** days[d-1] = punched on day d */
  days: boolean[];
  /** adv[i-1] = advance token i punched */
  adv: boolean[];
}

export interface Comparison {
  dayStatus: CellStatus[];
  advStatus: CellStatus[];
  agreedDays: number[];
  stockOnlyDays: number[];
  foilOnlyDays: number[];
  agreedAdv: number[];
  stockOnlyAdv: number[];
  foilOnlyAdv: number[];
  /** True when every punch appears on both halves. */
  consistent: boolean;
}

export function statusOf(s: boolean, f: boolean): CellStatus {
  return s && f ? 'both' : s ? 'stockOnly' : f ? 'foilOnly' : 'none';
}

export function compareHalves(stock: HalfMarks, foil: HalfMarks): Comparison {
  const nd = Math.max(stock.days.length, foil.days.length);
  const na = Math.max(stock.adv.length, foil.adv.length);
  const dayStatus: CellStatus[] = [];
  const advStatus: CellStatus[] = [];
  const res: Comparison = {
    dayStatus,
    advStatus,
    agreedDays: [],
    stockOnlyDays: [],
    foilOnlyDays: [],
    agreedAdv: [],
    stockOnlyAdv: [],
    foilOnlyAdv: [],
    consistent: true,
  };
  for (let i = 0; i < nd; i++) {
    const st = statusOf(!!stock.days[i], !!foil.days[i]);
    dayStatus.push(st);
    if (st === 'both') res.agreedDays.push(i + 1);
    else if (st === 'stockOnly') res.stockOnlyDays.push(i + 1);
    else if (st === 'foilOnly') res.foilOnlyDays.push(i + 1);
  }
  for (let i = 0; i < na; i++) {
    const st = statusOf(!!stock.adv[i], !!foil.adv[i]);
    advStatus.push(st);
    if (st === 'both') res.agreedAdv.push(i + 1);
    else if (st === 'stockOnly') res.stockOnlyAdv.push(i + 1);
    else if (st === 'foilOnly') res.foilOnlyAdv.push(i + 1);
  }
  res.consistent = res.stockOnlyDays.length + res.foilOnlyDays.length + res.stockOnlyAdv.length + res.foilOnlyAdv.length === 0;
  return res;
}

/** A wage change agreed at payday: days numbered fromDay or later are paid at rateMinor. */
export interface RateChange {
  fromDay: number;
  rateMinor: number;
}

export interface PayLine {
  days: number;
  rateMinor: number;
  grossMinor: number;
  advances: number;
  advMinor: number;
  advancesMinor: number;
  /** balance brought forward (negative = worker owes), included in net */
  carryMinor: number;
  /** set when a mid-month wage change was applied; days split at rateChange.fromDay */
  rateChange?: RateChange & { daysBefore: number; daysAfter: number };
  /** May be negative: then the worker owes a balance carried forward. */
  netMinor: number;
}

export function payLine(days: number, rateMinor: number, advances: number, advMinor: number, carryMinor = 0): PayLine {
  const grossMinor = days * rateMinor;
  const advancesMinor = advances * advMinor;
  return { days, rateMinor, grossMinor, advances, advMinor, advancesMinor, carryMinor, netMinor: grossMinor - advancesMinor + carryMinor };
}

/**
 * Like payLine, but from the actual day numbers so a mid-month wage change can apply from a
 * given day. With no change the result is identical to payLine (days x rate).
 */
export function payLineDays(dayNums: number[], rateMinor: number, advances: number, advMinor: number, carryMinor = 0, change?: RateChange): PayLine {
  if (!change) return payLine(dayNums.length, rateMinor, advances, advMinor, carryMinor);
  const daysAfter = dayNums.filter((d) => d >= change.fromDay).length;
  const daysBefore = dayNums.length - daysAfter;
  const grossMinor = daysBefore * rateMinor + daysAfter * change.rateMinor;
  const advancesMinor = advances * advMinor;
  return { days: dayNums.length, rateMinor, grossMinor, advances, advMinor, advancesMinor, carryMinor, netMinor: grossMinor - advancesMinor + carryMinor, rateChange: { ...change, daysBefore, daysAfter } };
}

export interface PayResult {
  /** Only what both halves agree on: this is the undisputed amount. */
  agreed: PayLine;
  /** What the worker's half (stock) alone shows. */
  workerView: PayLine;
  /** What the employer's half (foil) alone shows. */
  employerView: PayLine;
  /** Amount in dispute between the two views. */
  disputedMinor: number;
}

export function computePay(cmp: Comparison, rateMinor: number, advMinor: number, carryMinor = 0, change?: RateChange): PayResult {
  const sDays = [...cmp.agreedDays, ...cmp.stockOnlyDays];
  const fDays = [...cmp.agreedDays, ...cmp.foilOnlyDays];
  const sAdv = cmp.agreedAdv.length + cmp.stockOnlyAdv.length;
  const fAdv = cmp.agreedAdv.length + cmp.foilOnlyAdv.length;
  const agreed = payLineDays(cmp.agreedDays, rateMinor, cmp.agreedAdv.length, advMinor, carryMinor, change);
  const workerView = payLineDays(sDays, rateMinor, sAdv, advMinor, carryMinor, change);
  const employerView = payLineDays(fDays, rateMinor, fAdv, advMinor, carryMinor, change);
  return { agreed, workerView, employerView, disputedMinor: Math.abs(workerView.netMinor - employerView.netMinor) };
}

/** Overall verdict for a payday check. */
export type Verdict = 'genuine-consistent' | 'genuine-disputed' | 'pair-mismatch' | 'inconclusive' | 'unreliable' | 'review';
