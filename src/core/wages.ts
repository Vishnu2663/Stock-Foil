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

export interface PayLine {
  days: number;
  rateMinor: number;
  grossMinor: number;
  advances: number;
  advMinor: number;
  advancesMinor: number;
  /** May be negative: then the worker owes a balance carried forward. */
  netMinor: number;
}

export function payLine(days: number, rateMinor: number, advances: number, advMinor: number): PayLine {
  const grossMinor = days * rateMinor;
  const advancesMinor = advances * advMinor;
  return { days, rateMinor, grossMinor, advances, advMinor, advancesMinor, netMinor: grossMinor - advancesMinor };
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

export function computePay(cmp: Comparison, rateMinor: number, advMinor: number): PayResult {
  const sDays = cmp.agreedDays.length + cmp.stockOnlyDays.length;
  const fDays = cmp.agreedDays.length + cmp.foilOnlyDays.length;
  const sAdv = cmp.agreedAdv.length + cmp.stockOnlyAdv.length;
  const fAdv = cmp.agreedAdv.length + cmp.foilOnlyAdv.length;
  const agreed = payLine(cmp.agreedDays.length, rateMinor, cmp.agreedAdv.length, advMinor);
  const workerView = payLine(sDays, rateMinor, sAdv, advMinor);
  const employerView = payLine(fDays, rateMinor, fAdv, advMinor);
  return { agreed, workerView, employerView, disputedMinor: Math.abs(workerView.netMinor - employerView.netMinor) };
}

/** Overall verdict for a payday check. */
export type Verdict = 'genuine-consistent' | 'genuine-disputed' | 'pair-mismatch' | 'inconclusive' | 'unreliable' | 'review';
