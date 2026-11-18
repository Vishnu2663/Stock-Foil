/**
 * Pixel-level photo simulator. Renders one or more card halves lying on a dark
 * surface exactly as a phone camera would see them: arbitrary rotation, scale,
 * perspective tilt, blur, sensor noise, uneven lighting and shadows.
 *
 * It is used by (a) the property-based tests, which run the real scanner on
 * thousands of generated photos, and (b) the in-app Simulator and Demo pages.
 */
import QRCode from 'qrcode';
import { encodePayload, type CardSpec, type Role } from '../core/card';
import { applyH, invertH, poseH, type H } from '../core/homography';
import {
  FRAME_H,
  FRAME_W,
  FIDUCIAL,
  FID_INSET,
  GAP,
  HOLE_R,
  PAPER_LEFT,
  PAPER_RIGHT,
  QR_SIZE,
  QR_X,
  QR_Y,
  CELL_W,
  CELL_H,
  GRID_X,
  GRID_Y,
  ADV_X,
  ADV_Y,
  ADV_W,
  ADV_H,
  GRID_ROWS,
  STOCK_PAPER_TOP,
  FOIL_PAPER_BOTTOM,
  dayCells,
  advCells,
  pmCells,
  type Cell,
} from '../core/layout';
import { makeWave, type Wave } from '../core/wave';
import { gaussian, mulberry32 } from '../core/prng';
import { waveSeed, daysInMonth } from '../core/card';
import type { RGBA } from '../vision/image';

export interface HalfInstance {
  spec: CardSpec;
  role: Role;
  /** punched day numbers (1-based) */
  days: number[];
  /** punched second-half circles (day numbers), for cards with half-day circles */
  pm?: number[];
  /** punched advance token numbers (1-10) */
  adv: number[];
  /** frame mm -> image px */
  H: H;
  /** override the wave (used to simulate a forged/foreign cut line) */
  wave?: Wave;
  /** per-hole position error in mm, keyed 'd12' (day) or 'a3' (advance): a hole made separately */
  holeOffset?: Record<string, { dx: number; dy: number }>;
  /** whole-half stacking error: every hole shifted by (dx,dy) mm and rotated by rotDeg about the frame centre */
  stack?: { dx: number; dy: number; rotDeg: number };
}

export interface PhotoConditions {
  angle: number; // radians
  scale: number; // px per mm
  tx: number;
  ty: number;
  /** perspective tilt terms (1/mm) */
  px: number;
  py: number;
  blur: number; // gaussian-ish radius in px (0 = none)
  noise: number; // sigma, 0..1 luminance
  /** lighting gradient strength 0..0.6 and direction (rad) */
  gradient: number;
  gradDir: number;
  /** 0..0.5 darkness of a soft shadow band */
  shadow: number;
  /** global brightness multiplier */
  exposure: number;
  /** gamma */
  gamma: number;
  seed: number;
  /** brightness of whatever the card lies on (default: a dark cloth); holes show it */
  surface?: number;
}

export const CLEAN: PhotoConditions = {
  angle: 0,
  scale: 4.2,
  tx: 0,
  ty: 0,
  px: 0,
  py: 0,
  blur: 0,
  noise: 0,
  gradient: 0,
  gradDir: 0,
  shadow: 0,
  exposure: 1,
  gamma: 1,
  seed: 1,
};

export const IMG_W = 1100;
export const IMG_H = 880;

const qrCache = new Map<string, { n: number; get: (r: number, c: number) => boolean }>();
function qrFor(text: string) {
  let q = qrCache.get(text);
  if (!q) {
    const code = QRCode.create(text, { errorCorrectionLevel: 'M' });
    const n = code.modules.size;
    const data = code.modules.data;
    q = { n, get: (r, c) => !!data[r * n + c] };
    qrCache.set(text, q);
  }
  return q;
}

/** Homography placing a half in the middle of the image with the given conditions. */
export function placeHalf(c: PhotoConditions, role: Role, centre = { x: IMG_W / 2, y: IMG_H / 2 }, width = IMG_W, height = IMG_H): H {
  void width;
  void height;
  const cy = role === 'S' ? 62 : 62;
  return poseH({ scale: c.scale, angle: c.angle, tx: centre.x + c.tx, ty: centre.y + c.ty, px: c.px, py: c.py, cx: FRAME_W / 2, cy });
}

interface Prepared {
  inst: HalfInstance;
  inv: H;
  wave: Wave;
  qr: ReturnType<typeof qrFor>;
  dayPunched: Set<number>;
  pmPunched: Set<number>;
  advPunched: Set<number>;
  holeAt: Map<string, { x: number; y: number }>;
  dcells: Cell[];
  pcells: Cell[];
  acells: Cell[];
}

const PAPER = 0.9;
const INK = 0.14;
const SURFACE = 0.06;
/** printed grey disc, about 60% of the paper's brightness */
const DISC = 0.54;

function cellAt(prep: Prepared, x: number, y: number): { cell: Cell; punched: boolean } | null {
  if (x >= GRID_X && x < GRID_X + 7 * CELL_W && y >= GRID_Y && y < GRID_Y + GRID_ROWS * CELL_H) {
    const col = Math.floor((x - GRID_X) / CELL_W);
    const row = Math.floor((y - GRID_Y) / CELL_H);
    for (const c of prep.dcells) {
      const cc = Math.floor((c.x - GRID_X) / CELL_W);
      const rr = Math.floor((c.y - GRID_Y) / CELL_H);
      if (cc === col && rr === row) return { cell: c, punched: prep.dayPunched.has(c.n) };
    }
    return null;
  }
  if (y >= ADV_Y && y < ADV_Y + ADV_H && x >= ADV_X && x < ADV_X + 10 * ADV_W) {
    const i = Math.floor((x - ADV_X) / ADV_W);
    const c = prep.acells[i];
    if (c) return { cell: c, punched: prep.advPunched.has(c.n) };
  }
  return null;
}

/** Colour of the half at a frame-mm point, or null when there is no paper there. */
function shade(prep: Prepared, x: number, y: number): number | null {
  const role = prep.inst.role;
  if (x < PAPER_LEFT || x > PAPER_RIGHT) return null;
  const w = prep.wave(x);
  if (role === 'S') {
    if (y < STOCK_PAPER_TOP || y > FRAME_H + GAP + w) return null;
  } else {
    if (y > FOIL_PAPER_BOTTOM || y < w - GAP) return null;
  }
  // fiducials
  const fx = (cx: number, cy: number) => Math.abs(x - cx) <= FIDUCIAL / 2 && Math.abs(y - cy) <= FIDUCIAL / 2;
  const a = FID_INSET + FIDUCIAL / 2;
  const bx = FRAME_W - a;
  const by = FRAME_H - a;
  if (fx(a, a) || fx(bx, a) || fx(a, by) || fx(bx, by)) return INK;
  // QR
  if (x >= QR_X && x < QR_X + QR_SIZE && y >= QR_Y && y < QR_Y + QR_SIZE) {
    const q = prep.qr;
    const m = QR_SIZE / q.n;
    const c = Math.floor((x - QR_X) / m);
    const r = Math.floor((y - QR_Y) / m);
    return q.get(r, c) ? INK : PAPER;
  }
  const hit = cellAt(prep, x, y);
  if (hit) {
    const { cell, punched } = hit;
    if (punched) {
      const hp = prep.holeAt.get(`${cell.kind === 'day' ? 'd' : 'a'}${cell.n}`)!;
      if (Math.hypot(x - hp.x, y - hp.y) <= HOLE_R) return null;
    }
    if (cell.kind === 'day' && prep.pmPunched.has(cell.n)) {
      const hp = prep.holeAt.get(`p${cell.n}`);
      if (hp && Math.hypot(x - hp.x, y - hp.y) <= HOLE_R) return null;
    }
    // printed grey discs in every target that has not been punched out
    if (prep.inst.spec.discs) {
      const targets: [string, boolean][] = cell.kind === 'adv'
        ? [[`a${cell.n}`, prep.advPunched.has(cell.n)]]
        : [[`d${cell.n}`, prep.dayPunched.has(cell.n)], ...(prep.pcells.length ? [[`p${cell.n}`, prep.pmPunched.has(cell.n)] as [string, boolean]] : [])];
      for (const [key, punched] of targets) {
        const hp = prep.holeAt.get(key);
        if (!punched && hp && Math.hypot(x - hp.x, y - hp.y) <= HOLE_R) return DISC;
      }
    }
    // grid lines
    const lx = Math.min(x - cell.x, cell.x + cell.w - x);
    const ly = Math.min(y - cell.y, cell.y + cell.h - y);
    if (lx < 0.15 || ly < 0.15) return 0.3;
    // printed day number (blob stands in for glyphs, top-left of the cell)
    if (cell.kind === 'day' && x - cell.x < 3.6 && x - cell.x > 0.9 && y - cell.y < 3.2 && y - cell.y > 1.0) return 0.35;
    if (cell.kind === 'adv' && x - cell.x < 3.2 && x - cell.x > 0.9 && y - cell.y < 3.0 && y - cell.y > 1.0) return 0.35;
  }
  // section rule lines
  if (Math.abs(y - (GRID_Y - 1.5)) < 0.15 && x > GRID_X && x < GRID_X + 7 * CELL_W) return 0.3;
  return PAPER;
}

export function renderScene(halves: HalfInstance[], cond: PhotoConditions, w = IMG_W, h = IMG_H, ss = 1): RGBA {
  const preps: Prepared[] = halves.map((inst) => ({
    inst,
    inv: invertH(inst.H)!,
    wave: inst.wave ?? makeWave(waveSeed(inst.spec)),
    qr: qrFor(encodePayload(inst.spec, inst.role)),
    dayPunched: new Set(inst.days.filter((d) => d >= 1 && d <= daysInMonth(inst.spec.year, inst.spec.month))),
    pmPunched: new Set((inst.pm ?? []).filter((d) => d >= 1 && d <= daysInMonth(inst.spec.year, inst.spec.month))),
    advPunched: new Set(inst.adv),
    holeAt: new Map(),
    dcells: dayCells(inst.spec.year, inst.spec.month, !!inst.spec.halves),
    pcells: inst.spec.halves ? pmCells(inst.spec.year, inst.spec.month) : [],
    acells: advCells(),
  }));
  for (const p of preps) {
    const st = p.inst.stack ?? { dx: 0, dy: 0, rotDeg: 0 };
    const th = (st.rotDeg * Math.PI) / 180;
    const cs = Math.cos(th), sn = Math.sin(th);
    for (const c of [...p.dcells, ...p.pcells, ...p.acells]) {
      const key = `${c.kind === 'day' ? 'd' : c.kind === 'pm' ? 'p' : 'a'}${c.n}`;
      const o = p.inst.holeOffset?.[key] ?? { dx: 0, dy: 0 };
      const rx = c.cx - FRAME_W / 2, ry = c.cy - 60;
      p.holeAt.set(key, { x: FRAME_W / 2 + cs * rx - sn * ry + st.dx + o.dx, y: 60 + sn * rx + cs * ry + st.dy + o.dy });
    }
  }
  let lum = new Float32Array(w * h);
  const gx = Math.cos(cond.gradDir);
  const gy = Math.sin(cond.gradDir);
  const sub = ss > 1 ? ss : 1;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let acc = 0;
      for (let sj = 0; sj < sub; sj++) {
        for (let si = 0; si < sub; si++) {
          const px = i + (si + 0.5) / sub - 0.5;
          const py = j + (sj + 0.5) / sub - 0.5;
          let v = cond.surface ?? SURFACE;
          let onPaper = false;
          for (const p of preps) {
            const f = applyH(p.inv, { x: px, y: py });
            const s = shade(p, f.x, f.y);
            if (s !== null) {
              v = s;
              onPaper = true;
              break;
            }
          }
          if (onPaper) {
            const u = ((px - w / 2) * gx + (py - h / 2) * gy) / (Math.hypot(w, h) / 2);
            let light = 1 - cond.gradient * 0.5 * (u + 1) * 0.9 + cond.gradient * 0.45;
            if (cond.shadow > 0) {
              const band = Math.exp(-(((px - w * 0.62 + py * 0.15) / (w * 0.12)) ** 2));
              light *= 1 - cond.shadow * band;
            }
            v *= light;
          }
          acc += v;
        }
      }
      lum[j * w + i] = acc / (sub * sub);
    }
  }
  if (cond.blur > 0.3) lum = boxBlur(lum, w, h, cond.blur);
  const rand = mulberry32(cond.seed * 7919 + 13);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let k = 0, o = 0; k < lum.length; k++, o += 4) {
    let v = lum[k] * cond.exposure;
    if (cond.noise > 0) v += gaussian(rand) * cond.noise;
    v = Math.pow(Math.max(0, Math.min(1, v)), cond.gamma);
    const b = Math.round(v * 255);
    out[o] = b;
    out[o + 1] = b;
    out[o + 2] = b;
    out[o + 3] = 255;
  }
  return { width: w, height: h, data: out };
}

/** Separable box blur applied 2x ~ gaussian of the given radius. */
function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const r = Math.max(1, Math.round(radius));
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let sum = 0;
      for (let x = -r; x <= r; x++) sum += a[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = sum / (2 * r + 1);
        sum += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)];
      }
    }
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = sum / (2 * r + 1);
        sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
    a = out;
  }
  return a;
}
