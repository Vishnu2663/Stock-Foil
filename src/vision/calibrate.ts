/**
 * Calibration from REAL photos. Measures how clearly punched holes differ from
 * blank targets, how big the holes are, and how well the two halves' holes line
 * up, then suggests thresholds. It never changes anything by itself.
 */
import { ALIGN_TOL_MM, checkAlignment } from './pair';
import type { HalfScan } from './detect';

export interface CalibrationReport {
  halves: number;
  pairs: number;
  punched: number;
  blank: number;
  /** highest punched ratio and lowest blank ratio seen (centre / local paper) */
  maxPunchedRatio: number | null;
  minBlankRatio: number | null;
  /** > 0 means punched and blank cells are cleanly separable */
  separation: number | null;
  holeRadiusMm: { mean: number; sd: number; n: number } | null;
  /** worst honest alignment residual across the pairs, mm */
  alignmentMaxMm: number | null;
  recommended: { punchRatio: number; alignTolMm: number };
  notes: string[];
}

export const DEFAULT_PUNCH_RATIO = 0.62;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function calibrate(halves: HalfScan[]): CalibrationReport {
  const notes: string[] = [];
  const punched: number[] = [];
  const blank: number[] = [];
  const radii: number[] = [];
  for (const h of halves) {
    for (const c of [...h.days, ...h.adv]) {
      if (!Number.isFinite(c.ratio)) continue;
      if (c.punched) {
        punched.push(c.ratio);
        if (c.r !== undefined) radii.push(c.r);
      } else blank.push(c.ratio);
    }
    if (h.fiducialsFound < 4) notes.push(`A ${h.payload.role === 'S' ? 'worker' : 'employer'} photo found only ${h.fiducialsFound}/4 corner squares; retake it.`);
  }
  // pair up halves of the same card
  const byId = new Map<string, { S?: HalfScan; F?: HalfScan }>();
  for (const h of halves) {
    const e = byId.get(h.payload.spec.id) ?? {};
    e[h.payload.role] = h;
    byId.set(h.payload.spec.id, e);
  }
  let pairs = 0;
  let alignMax: number | null = null;
  for (const e of byId.values()) {
    if (!e.S || !e.F) continue;
    pairs++;
    const a = checkAlignment(e.S, e.F, 1e9);
    if (a.checked) alignMax = Math.max(alignMax ?? 0, a.maxResidualMm);
  }
  const maxP = punched.length ? Math.max(...punched) : null;
  const minB = blank.length ? Math.min(...blank) : null;
  const sep = maxP !== null && minB !== null ? minB - maxP : null;
  let punchRatio = DEFAULT_PUNCH_RATIO;
  if (sep === null) notes.push('Need photos with both punched and blank targets to tune the hole threshold.');
  else if (sep > 0) punchRatio = clamp(+((maxP! + minB!) / 2).toFixed(2), 0.4, 0.75);
  else notes.push('Punched and blank targets overlap in brightness. Keep the default threshold and retake with better light or a darker surface.');
  if (punched.length < 6) notes.push(`Only ${punched.length} punched holes measured; use at least 6 for a dependable estimate.`);
  let alignTol = ALIGN_TOL_MM;
  if (alignMax === null) notes.push(`Need a pair with at least 4 matching holes (punched together) to tune the alignment tolerance.`);
  else {
    alignTol = +clamp(Math.max(1.0, alignMax * 1.6), 1.0, 2.5).toFixed(2);
    if (alignMax > 1.5) notes.push(`Honest holes were up to ${alignMax.toFixed(2)} mm apart; the cards may have been stacked loosely or punched one at a time.`);
  }
  const mean = radii.length ? radii.reduce((s, v) => s + v, 0) / radii.length : 0;
  const sd = radii.length ? Math.sqrt(radii.reduce((s, v) => s + (v - mean) ** 2, 0) / radii.length) : 0;
  return {
    halves: halves.length,
    pairs,
    punched: punched.length,
    blank: blank.length,
    maxPunchedRatio: maxP,
    minBlankRatio: minB,
    separation: sep,
    holeRadiusMm: radii.length ? { mean, sd, n: radii.length } : null,
    alignmentMaxMm: alignMax,
    recommended: { punchRatio, alignTolMm: alignTol },
    notes,
  };
}
