import { mulberry32 } from './prng';
import { FRAME_W, WAVE_AMP, GAP, FRAME_H } from './layout';

/**
 * The unique wavy cut line of a card: a sum of sines whose frequencies,
 * phases and weights come from the card's seed. Returns deviation (mm) from
 * the nominal cut line as a function of x (frame mm), bounded by WAVE_AMP.
 */
export interface Wave {
  (x: number): number;
  seed: number;
}

export function makeWave(seed: number): Wave {
  const r = mulberry32(seed);
  const comps: { f: number; p: number; a: number }[] = [];
  const n = 4;
  for (let i = 0; i < n; i++) {
    comps.push({ f: 1.2 + r() * 6.5, p: r() * Math.PI * 2, a: 0.4 + r() * 0.6 });
  }
  // normalise so the max |w| over the printable width hits WAVE_AMP
  const raw = (x: number) => comps.reduce((s, c) => s + c.a * Math.sin((2 * Math.PI * c.f * x) / FRAME_W + c.p), 0);
  let peak = 1e-6;
  for (let x = -14; x <= FRAME_W + 14; x += 0.5) peak = Math.max(peak, Math.abs(raw(x)));
  const k = WAVE_AMP / peak;
  const w = ((x: number) => raw(x) * k) as Wave;
  w.seed = seed;
  return w;
}

/** Cut edge position in STOCK frame coordinates (y grows downward). */
export function stockEdgeY(w: Wave, x: number): number {
  return FRAME_H + GAP + w(x);
}

/** Cut edge position in FOIL frame coordinates. */
export function foilEdgeY(w: Wave, x: number): number {
  return w(x) - GAP;
}

/** Sample the wave as an SVG path in sheet coordinates. */
export function wavePath(w: Wave, offsetX: number, cutY: number, x0: number, x1: number, step = 1): string {
  let d = '';
  for (let x = x0; x <= x1 + 1e-9; x += step) {
    d += `${d ? 'L' : 'M'}${(x + offsetX).toFixed(2)},${(cutY + w(x)).toFixed(2)}`;
  }
  return d;
}
