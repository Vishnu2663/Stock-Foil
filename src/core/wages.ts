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
  /** pm[d-1] = second-half circle of day d (cards with half-day circles only) */
  pm?: boolean[];
}

export interface Comparison {
  /** the card has half-day circles: each circle is worth half a day */
  halves: boolean;
  /** status of each second-half circle, by day */
  pmStatus: CellStatus[];
  agreedPm: number[];
  stockOnlyPm: number[];
  foilOnlyPm: number[];
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
  const halves = !!(stock.pm || foil.pm);
  const pmStatus: CellStatus[] = [];
  const res: Comparison = {
    halves,
    pmStatus,
    agreedPm: [],
    stockOnlyPm: [],
    foilOnlyPm: [],
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
  if (halves) {
    const np = Math.max(stock.pm?.length ?? 0, foil.pm?.length ?? 0);
    for (let i = 0; i < np; i++) {
      const st = statusOf(!!stock.pm?.[i], !!foil.pm?.[i]);
      pmStatus.push(st);
      if (st === 'both') res.agreedPm.push(i + 1);
      else if (st === 'stockOnly') res.stockOnlyPm.push(i + 1);
      else if (st === 'foilOnly') res.foilOnlyPm.push(i + 1);
    }
  }
  for (let i = 0; i < na; i++) {
    const st = statusOf(!!stock.adv[i], !!foil.adv[i]);
    advStatus.push(st);
    if (st === 'both') res.agreedAdv.push(i + 1);
    else if (st === 'stockOnly') res.stockOnlyAdv.push(i + 1);
    else if (st === 'foilOnly') res.foilOnlyAdv.push(i + 1);
  }
  res.consistent = res.stockOnlyDays.length + res.foilOnlyDays.length + res.stockOnlyPm.length + res.foilOnlyPm.length + res.stockOnlyAdv.length + res.foilOnlyAdv.length === 0;
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
  const grossMinor = Math.round(days * rateMinor); // days may be a half (x.5); money stays whole minor units
  const advancesMinor = advances * advMinor;
  return { days, rateMinor, grossMinor, advances, advMinor, advancesMinor, carryMinor, netMinor: grossMinor - advancesMinor + carryMinor };
}

/**
 * Like payLine, but from the actual day numbers so a mid-month wage change can apply from a
 * given day. With no change the result is identical to payLine (days x rate).
 */
export function payLineDays(dayNums: number[], rateMinor: number, advances: number, advMinor: number, carryMinor = 0, change?: RateChange, weight = 1): PayLine {
  if (!change) return payLine(dayNums.length * weight, rateMinor, advances, advMinor, carryMinor);
  // with half-day circles every entry in dayNums is one half-day (weight 0.5)
  const daysAfter = dayNums.filter((d) => d >= change.fromDay).length * weight;
  const daysBefore = dayNums.length * weight - daysAfter;
  const grossMinor = Math.round(daysBefore * rateMinor + daysAfter * change.rateMinor);
  const advancesMinor = advances * advMinor;
  return { days: dayNums.length * weight, rateMinor, grossMinor, advances, advMinor, advancesMinor, carryMinor, netMinor: grossMinor - advancesMinor + carryMinor, rateChange: { ...change, daysBefore, daysAfter } };
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
  // half-day cards: every circle (first or second half of a date) counts as half a day
  const w = cmp.halves ? 0.5 : 1;
  const sDays = [...cmp.agreedDays, ...cmp.stockOnlyDays, ...(cmp.halves ? [...cmp.agreedPm, ...cmp.stockOnlyPm] : [])];
  const fDays = [...cmp.agreedDays, ...cmp.foilOnlyDays, ...(cmp.halves ? [...cmp.agreedPm, ...cmp.foilOnlyPm] : [])];
  const aDays = [...cmp.agreedDays, ...(cmp.halves ? cmp.agreedPm : [])];
  const sAdv = cmp.agreedAdv.length + cmp.stockOnlyAdv.length;
  const fAdv = cmp.agreedAdv.length + cmp.foilOnlyAdv.length;
  const agreed = payLineDays(aDays, rateMinor, cmp.agreedAdv.length, advMinor, carryMinor, change, w);
  const workerView = payLineDays(sDays, rateMinor, sAdv, advMinor, carryMinor, change, w);
  const employerView = payLineDays(fDays, rateMinor, fAdv, advMinor, carryMinor, change, w);
  return { agreed, workerView, employerView, disputedMinor: Math.abs(workerView.netMinor - employerView.netMinor) };
}

/** Overall verdict for a payday check. */
export type Verdict = 'genuine-consistent' | 'genuine-disputed' | 'pair-mismatch' | 'inconclusive' | 'unreliable' | 'review';
