/**
 * Payday verification of a stock + foil pair:
 *   - same card id, same card code, complementary roles
 *   - the two physical cut edges are the same curve (and match the card's design)
 *   - compare every punch target, then compute pay
 */
import { cardCode, waveSeed, type CardSpec } from '../core/card';
import { makeWave } from '../core/wave';
import { compareHalves, computePay, type Comparison, type PayResult, type Verdict } from '../core/wages';
import { advCells, dayCells } from '../core/layout';
import type { CellReading, HalfScan } from './detect';

export interface EdgeMatch {
  verdict: 'match' | 'mismatch' | 'inconclusive';
  /** stock vs foil edge: rms difference after removing offset (mm) */
  rms: number;
  /** stock vs foil edge: correlation of shapes */
  corr: number;
  /** each edge vs the designed wave */
  corrDesignStock: number;
  corrDesignFoil: number;
  coverage: number;
  /** 0..100 human score */
  score: number;
}

export interface PairResult {
  spec: CardSpec;
  code: string;
  checks: { label: string; ok: boolean | null; detail: string }[];
  edge: EdgeMatch;
  cmp: Comparison;
  pay: PayResult;
  verdict: Verdict;
  alignment: Alignment;
  uncertainCells: { kind: 'day' | 'adv'; n: number; half: 'S' | 'F' }[];
}

function corr(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 3) return NaN;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da > 1e-9 && db > 1e-9 ? num / Math.sqrt(da * db) : NaN;
}

export function matchEdges(xs: number[], stock: number[], foil: number[], seed: number): EdgeMatch {
  const w = makeWave(seed);
  const s: number[] = [], f: number[] = [], d: number[] = [];
  const sAll: number[] = [], dS: number[] = [], fAll: number[] = [], dF: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    const ok = Number.isFinite(stock[i]) && Number.isFinite(foil[i]);
    if (Number.isFinite(stock[i])) { sAll.push(stock[i]); dS.push(w(xs[i])); }
    if (Number.isFinite(foil[i])) { fAll.push(foil[i]); dF.push(w(xs[i])); }
    if (ok) { s.push(stock[i]); f.push(foil[i]); d.push(stock[i] - foil[i]); }
  }
  const coverage = s.length / xs.length;
  const md = d.length ? d.reduce((a, b) => a + b, 0) / d.length : 0;
  const rms = d.length ? Math.sqrt(d.reduce((a, v) => a + (v - md) ** 2, 0) / d.length) : NaN;
  const c = corr(s, f);
  const cs = corr(sAll, dS);
  const cf = corr(fAll, dF);
  let verdict: EdgeMatch['verdict'] = 'inconclusive';
  if (coverage >= 0.4 && Number.isFinite(c)) {
    if (rms <= 1.3 && c >= 0.8) verdict = 'match';
    else if (rms > 1.5 || c < 0.75) verdict = 'mismatch';
  }
  const score = Number.isFinite(rms) && Number.isFinite(c) ? Math.round(Math.max(0, Math.min(1, (c - 0.3) / 0.65)) * Math.max(0, Math.min(1, (2.5 - rms) / 2.0)) * 100) : 0;
  return { verdict, rms, corr: c, corrDesignStock: cs, corrDesignFoil: cf, coverage, score };
}

export interface Alignment {
  /** false when fewer than MIN_HOLES holes are shared, so no judgement is made */
  checked: boolean;
  shared: number;
  /** holes whose position disagrees with where the other half says they should be */
  flagged: { kind: 'day' | 'adv'; n: number; residualMm: number }[];
  maxResidualMm: number;
}

export const MIN_ALIGN_HOLES = 4;
/** Holes punched together agree to well under a millimetre; separately made ones rarely do. */
export const ALIGN_TOL_MM = 1.2;

interface Pair2 { a: { x: number; y: number }; b: { x: number; y: number }; kind: 'day' | 'adv'; n: number }

/** Rigid fit (rotation + shift) mapping a-points onto b-points. */
function rigidFit(ps: Pair2[]) {
  const n = ps.length;
  const ac = { x: ps.reduce((s, p) => s + p.a.x, 0) / n, y: ps.reduce((s, p) => s + p.a.y, 0) / n };
  const bc = { x: ps.reduce((s, p) => s + p.b.x, 0) / n, y: ps.reduce((s, p) => s + p.b.y, 0) / n };
  let dot = 0, cross = 0;
  for (const p of ps) {
    const ax = p.a.x - ac.x, ay = p.a.y - ac.y, bx = p.b.x - bc.x, by = p.b.y - bc.y;
    dot += ax * bx + ay * by;
    cross += ax * by - ay * bx;
  }
  const th = Math.atan2(cross, dot);
  const c = Math.cos(th), s = Math.sin(th);
  return (q: { x: number; y: number }) => ({ x: c * (q.x - ac.x) - s * (q.y - ac.y) + bc.x, y: s * (q.x - ac.x) + c * (q.y - ac.y) + bc.y });
}

/**
 * "Punched together" check. A hole made through both halves at once lands at the
 * same place on each; one added or made separately is off by more than normal
 * stacking error. Each hole is judged against a rigid fit made WITHOUT it.
 */
export function checkAlignment(stock: HalfScan, foil: HalfScan): Alignment {
  const spec = stock.payload.spec;
  const cells = [...dayCells(spec.year, spec.month), ...advCells()];
  const ps: Pair2[] = [];
  for (const c of cells) {
    const list = (h: HalfScan) => (c.kind === 'day' ? h.days : h.adv).find((r) => r.n === c.n);
    const s = list(stock), f = list(foil);
    if (!s?.punched || !f?.punched || s.dx === undefined || f.dx === undefined || s.dy === undefined || f.dy === undefined) continue;
    ps.push({ a: { x: c.cx + s.dx, y: c.cy + s.dy }, b: { x: c.cx + f.dx, y: c.cy + f.dy }, kind: c.kind, n: c.n });
  }
  if (ps.length < MIN_ALIGN_HOLES) return { checked: false, shared: ps.length, flagged: [], maxResidualMm: 0 };
  const flagged: Alignment['flagged'] = [];
  let maxR = 0;
  // A hole so far from its target that it overflows the measuring window is suspicious by itself.
  const clippedKey = new Set<string>();
  for (const c of cells) {
    for (const h of [stock, foil]) {
      const r = (c.kind === 'day' ? h.days : h.adv).find((x) => x.n === c.n);
      if (r?.punched && r.clipped) clippedKey.add(`${c.kind}${c.n}`);
    }
  }
  ps.forEach((p, i) => {
    const fit = rigidFit(ps.filter((_, j) => j !== i));
    const q = fit(p.a);
    const r = Math.hypot(q.x - p.b.x, q.y - p.b.y);
    maxR = Math.max(maxR, r);
    const clip = clippedKey.has(`${p.kind}${p.n}`);
    if (r > ALIGN_TOL_MM || clip) flagged.push({ kind: p.kind, n: p.n, residualMm: Math.max(r, clip ? 3 : 0) });
  });
  return { checked: true, shared: ps.length, flagged, maxResidualMm: maxR };
}

function marks(r: CellReading[], n: number): boolean[] {
  const out = new Array(n).fill(false);
  for (const c of r) if (c.n >= 1 && c.n <= n) out[c.n - 1] = c.punched;
  return out;
}

export function verifyPair(stock: HalfScan, foil: HalfScan): PairResult {
  const ss = stock.payload.spec;
  const fs = foil.payload.spec;
  const checks: PairResult['checks'] = [];
  checks.push({ label: 'Worker half (stock) found', ok: stock.payload.role === 'S', detail: stock.payload.role === 'S' ? 'Stock half read' : 'This is not a stock half' });
  checks.push({ label: 'Employer half (foil) found', ok: foil.payload.role === 'F', detail: foil.payload.role === 'F' ? 'Foil half read' : 'This is not a foil half' });
  const sameId = ss.id === fs.id;
  checks.push({ label: 'Same card id', ok: sameId, detail: sameId ? ss.id : `${ss.id} ≠ ${fs.id}` });
  const codesOk = stock.payload.codeOk && foil.payload.codeOk && cardCode(ss) === cardCode(fs);
  checks.push({ label: 'Card code matches (rate, month, names unchanged)', ok: codesOk, detail: `${cardCode(ss)} / ${cardCode(fs)}` });
  const edge = matchEdges(stock.edgeXs, stock.edge, foil.edge, waveSeed(ss));
  checks.push({
    label: 'Wavy cut lines fit together',
    ok: edge.verdict === 'match' ? true : edge.verdict === 'mismatch' ? false : null,
    detail: edge.verdict === 'inconclusive' ? 'Could not see enough of the cut edges' : `fit ${edge.score}/100 · shape r=${edge.corr.toFixed(2)} · gap spread ${edge.rms.toFixed(2)} mm`,
  });

  const nDays = Math.max(ss.year ? stock.days.length : 0, foil.days.length);
  const cmp = compareHalves(
    { days: marks(stock.days, nDays), adv: marks(stock.adv, 10) },
    { days: marks(foil.days, nDays), adv: marks(foil.adv, 10) },
  );
  checks.push({ label: 'Every punch is on both halves', ok: cmp.consistent, detail: cmp.consistent ? 'No one-sided holes' : `${cmp.stockOnlyDays.length + cmp.foilOnlyDays.length} day(s), ${cmp.stockOnlyAdv.length + cmp.foilOnlyAdv.length} advance(s) on one half only` });

  const alignment = checkAlignment(stock, foil);
  checks.push({
    label: 'Holes were punched through both halves together',
    ok: alignment.checked ? alignment.flagged.length === 0 : null,
    detail: !alignment.checked
      ? `Need ${MIN_ALIGN_HOLES}+ matching holes to check (have ${alignment.shared})`
      : alignment.flagged.length === 0
        ? `${alignment.shared} holes line up (worst ${alignment.maxResidualMm.toFixed(2)} mm)`
        : `Look separately made: ${alignment.flagged.map((f) => (f.kind === 'day' ? `day ${f.n}` : `advance ${f.n}`) + ` (${f.residualMm.toFixed(1)} mm off)`).join(', ')}`,
  });

  const pay = computePay(cmp, ss.rateMinor, ss.advMinor);
  const pairOk = stock.payload.role === 'S' && foil.payload.role === 'F' && sameId && codesOk && edge.verdict !== 'mismatch';
  // A pose built from fewer than 3 corner squares cannot be trusted to place the punch targets.
  const poseOk = Math.min(stock.fiducialsFound, foil.fiducialsFound) >= 3;
  checks.push({ label: 'Photos are sharp and complete enough to read', ok: poseOk, detail: poseOk ? `Corner squares: worker ${stock.fiducialsFound}/4, employer ${foil.fiducialsFound}/4` : `Only ${stock.fiducialsFound}/4 and ${foil.fiducialsFound}/4 corner squares found. Retake with the whole half in view.` });
  const verdict: Verdict = !poseOk && pairOk ? 'unreliable' : !pairOk ? 'pair-mismatch' : !cmp.consistent ? 'genuine-disputed' : alignment.flagged.length ? 'review' : edge.verdict === 'inconclusive' ? 'inconclusive' : 'genuine-consistent';
  const uncertainCells = [
    ...[...stock.days, ...stock.adv].filter((c) => c.uncertain && !c.manual).map((c) => ({ kind: c.kind, n: c.n, half: 'S' as const })),
    ...[...foil.days, ...foil.adv].filter((c) => c.uncertain && !c.manual).map((c) => ({ kind: c.kind, n: c.n, half: 'F' as const })),
  ];
  return { spec: ss, code: cardCode(ss), checks, edge, cmp, pay, verdict, alignment, uncertainCells };
}
