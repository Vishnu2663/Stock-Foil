/**
 * Vision pipeline for one photo:
 *   1. find every Stock & Foil QR in the photo (jsQR, repeated with masking)
 *   2. QR corners -> first homography (frame mm -> image px)
 *   3. refine with the four corner fiducials (wide baseline, sub-pixel centroid)
 *   4. read every punch target (dark disc vs local paper)
 *   5. trace the cut edge profile (paper -> dark background transition)
 * Works on plain RGBA arrays so it runs identically in browsers and Node tests.
 */
import jsQR from 'jsqr';
import { decodePayload, type DecodedPayload } from '../core/card';
import type { PairToken } from '../core/pairing';
import { applyH, findAffine, findHomography, type H } from '../core/homography';
import {
  advCells,
  cellRefPoints,
  dayCells,
  fiducialCentres,
  qrCorners,
  FIDUCIAL,
  FRAME_H,
  FRAME_W,
  GAP,
  WAVE_AMP,
  SAMPLE_R,
  type Cell,
  type Pt,
} from '../core/layout';
import { blurRGBA, median, rgbaToGray, sample, unsharpRGBA, upscale2, type Gray, type RGBA } from './image';

export interface DetectOptions {
  /** ratio (centre / local paper) below which a cell counts as punched */
  punchRatio?: number;
  /** ratio band treated as uncertain */
  uncertainBand?: [number, number];
  maxQr?: number;
}

export const DEFAULTS: Required<DetectOptions> = {
  punchRatio: 0.62,
  uncertainBand: [0.48, 0.78],
  maxQr: 2,
};

export interface CellReading {
  kind: 'day' | 'adv';
  n: number;
  punched: boolean;
  /** centre luminance / local paper luminance */
  ratio: number;
  uncertain: boolean;
  /** set when a person corrected the reading by hand */
  manual?: boolean;
  /** hole centre relative to the printed target (frame mm); only for punched cells */
  dx?: number;
  dy?: number;
  /** equivalent radius of the dark hole (mm) */
  r?: number;
  /** the hole runs past the measuring window, so it is far from its target */
  clipped?: boolean;
}

export interface HalfScan {
  payload: DecodedPayload;
  /** the card is cryptographically paired */
  pairExpected: boolean;
  /** this half's pairing token (secret + tag), read from its QR */
  pair?: PairToken;
  /** frame mm -> image px */
  H: H;
  qrImgCorners: Pt[];
  fiducialsFound: number;
  /** mean reprojection error of fiducials (px) */
  fitError: number;
  pxPerMm: number;
  paperRef: number;
  bgRef: number;
  days: CellReading[];
  adv: CellReading[];
  /** x positions (frame mm) where the cut edge was sampled */
  edgeXs: number[];
  /** measured cut deviation from nominal (mm) at each x, NaN if not found */
  edge: number[];
  edgeCoverage: number;
  warnings: string[];
}

export interface PhotoScan {
  width: number;
  height: number;
  halves: HalfScan[];
  /** QR codes that were found but are not Stock & Foil cards */
  foreign: string[];
  gray: Gray;
}

interface QrHit {
  text: string;
  corners: Pt[]; // TL, TR, BR, BL
}

/**
 * Find up to `max` QR codes by masking each one after it is decoded. If the raw
 * photo yields nothing (sensor noise, slight blur), retry on progressively
 * denoised copies. Corner coordinates stay in the original image frame.
 */
export function findQrs(img: RGBA, max = 2): QrHit[] {
  // cheapest first; later variants only run when earlier ones find nothing
  const variants: { make: () => RGBA; scale: number }[] = [
    { make: () => img, scale: 1 },
    { make: () => blurRGBA(img, 1), scale: 1 },
    { make: () => blurRGBA(img, 2), scale: 1 },
    { make: () => unsharpRGBA(blurRGBA(img, 1), 3, 1.5), scale: 1 },
    { make: () => upscale2(unsharpRGBA(blurRGBA(img, 1), 3, 1.5)), scale: 2 },
    // last resorts for heavy blur + noise together
    { make: () => unsharpRGBA(blurRGBA(img, 1), 3, 3), scale: 1 },
    { make: () => upscale2(unsharpRGBA(blurRGBA(img, 1), 3, 3)), scale: 2 },
  ];
  for (const { make, scale } of variants) {
    const src = make();
    const work = new Uint8ClampedArray(src.data);
    const hits: QrHit[] = [];
    for (let k = 0; k < max; k++) {
      const r = jsQR(work, src.width, src.height, { inversionAttempts: 'dontInvert' });
      if (!r || !r.data) break;
      const L = r.location;
      const own = [L.topLeftCorner, L.topRightCorner, L.bottomRightCorner, L.bottomLeftCorner].map((p) => ({ x: p.x, y: p.y }));
      hits.push({ text: r.data, corners: own.map((p) => ({ x: p.x / scale, y: p.y / scale })) });
      maskQuad(work, src.width, src.height, own, 1.25);
    }
    if (hits.length) return hits;
  }
  return [];
}

function maskQuad(data: Uint8ClampedArray, w: number, h: number, quad: Pt[], grow: number) {
  const cx = quad.reduce((s, p) => s + p.x, 0) / 4;
  const cy = quad.reduce((s, p) => s + p.y, 0) / 4;
  const q = quad.map((p) => ({ x: cx + (p.x - cx) * grow, y: cy + (p.y - cy) * grow }));
  const minX = Math.max(0, Math.floor(Math.min(...q.map((p) => p.x))));
  const maxX = Math.min(w - 1, Math.ceil(Math.max(...q.map((p) => p.x))));
  const minY = Math.max(0, Math.floor(Math.min(...q.map((p) => p.y))));
  const maxY = Math.min(h - 1, Math.ceil(Math.max(...q.map((p) => p.y))));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (insideQuad(q, x, y)) {
        const i = (y * w + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
      }
    }
  }
}

function insideQuad(q: Pt[], x: number, y: number): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    if (cr !== 0) {
      const s = Math.sign(cr);
      if (sign === 0) sign = s;
      else if (s !== sign) return false;
    }
  }
  return true;
}

/** Luminance at a frame-mm point. */
export function at(g: Gray, H: H, p: Pt): number {
  const q = applyH(H, p);
  return sample(g, q.x, q.y);
}

/** Mean luminance of a disc; NaN unless at least 85% of it lies inside the photo. */
function discMean(g: Gray, H: H, c: Pt, r: number, step: number): number {
  let s = 0;
  let n = 0;
  let total = 0;
  for (let dy = -r; dy <= r + 1e-9; dy += step) {
    for (let dx = -r; dx <= r + 1e-9; dx += step) {
      if (dx * dx + dy * dy > r * r) continue;
      total++;
      const v = at(g, H, { x: c.x + dx, y: c.y + dy });
      if (Number.isFinite(v)) {
        s += v;
        n++;
      }
    }
  }
  return n && n >= total * 0.85 ? s / n : NaN;
}

/**
 * Locate a corner square near its predicted position. Every dark blob in the
 * search window is evaluated; the one that is square-ish, about the right area
 * and not cut off by the window, and nearest the prediction, wins. Anything else
 * is rejected, so a wrong blob can never silently skew the pose. The window
 * widens when nothing is found (large perspective makes far squares drift).
 * Returns the image point.
 */
function refineFiducial(g: Gray, H: H, c: Pt): Pt | null {
  for (const half of [8, 15, 26]) {
    const r = refineFiducialIn(g, H, c, half);
    if (r) return r;
  }
  return null;
}

function refineFiducialIn(g: Gray, H: H, c: Pt, half: number): Pt | null {
  const step = half > 20 ? 0.5 : half > 10 ? 0.4 : 0.3;
  const n = Math.floor((2 * half) / step) + 1;
  const val = new Float32Array(n * n);
  let mn = Infinity;
  let mx = -Infinity;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const v = at(g, H, { x: c.x - half + i * step, y: c.y - half + j * step });
      if (!Number.isFinite(v)) return null;
      val[j * n + i] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  if (mx - mn < 0.18) return null;
  const thr = (mn + mx) / 2;
  const mid = (n - 1) / 2;
  const seen = new Uint8Array(n * n);
  const want = FIDUCIAL * FIDUCIAL;
  let best: { d: number; x: number; y: number } | null = null;
  for (let start = 0; start < n * n; start++) {
    if (seen[start] || val[start] >= thr) continue;
    const stack = [start];
    seen[start] = 1;
    let sx = 0, sy = 0, sw = 0, cnt = 0;
    let i0 = n, i1 = -1, j0 = n, j1 = -1;
    while (stack.length) {
      const k = stack.pop()!;
      const i = k % n;
      const j = (k - i) / n;
      const wgt = thr - val[k];
      sx += i * wgt;
      sy += j * wgt;
      sw += wgt;
      cnt++;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
      if (i + 1 < n && !seen[k + 1] && val[k + 1] < thr) { seen[k + 1] = 1; stack.push(k + 1); }
      if (i > 0 && !seen[k - 1] && val[k - 1] < thr) { seen[k - 1] = 1; stack.push(k - 1); }
      if (j + 1 < n && !seen[k + n] && val[k + n] < thr) { seen[k + n] = 1; stack.push(k + n); }
      if (j > 0 && !seen[k - n] && val[k - n] < thr) { seen[k - n] = 1; stack.push(k - n); }
    }
    if (i0 === 0 || j0 === 0 || i1 === n - 1 || j1 === n - 1) continue; // cut off by the window
    const bw = (i1 - i0 + 1) * step;
    const bh = (j1 - j0 + 1) * step;
    const area = cnt * step * step;
    if (area < want * 0.6 || area > want * 1.5) continue;
    if (bw < FIDUCIAL * 0.65 || bw > FIDUCIAL * 1.5 || bh < FIDUCIAL * 0.65 || bh > FIDUCIAL * 1.5) continue;
    // fill ratio: a solid square fills its bounding box
    if (area / (bw * bh) < 0.8) continue;
    const ci = sx / sw;
    const cj = sy / sw;
    const d = Math.hypot(ci - mid, cj - mid);
    if (!best || d < best.d) best = { d, x: c.x - half + ci * step, y: c.y - half + cj * step };
  }
  return best ? applyH(H, { x: best.x, y: best.y }) : null;
}

interface Blob { x: number; y: number; area: number }

/**
 * Find every solid, square-ish dark blob in the whole photo (no prediction
 * needed). Uses a local-contrast threshold so it works on grey tables, then
 * moment tests: a filled rectangle has area == 12*sqrt(det(covariance)), and a
 * square has equal principal axes. Rings (QR finders) and text fail the test.
 */
export function detectSquares(g: Gray, maxKeep = 14): Blob[] {
  const { width: w, height: h, data } = g;
  const W1 = w + 1;
  const integ = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += data[y * w + x];
      integ[(y + 1) * W1 + x + 1] = integ[y * W1 + x + 1] + row;
    }
  }
  const R = Math.max(24, Math.round(0.05 * Math.max(w, h)));
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1);
      const sum = integ[y1 * W1 + x1] - integ[y0 * W1 + x1] - integ[y1 * W1 + x0] + integ[y0 * W1 + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = data[y * w + x];
      mask[y * w + x] = v < mean * 0.55 && v < 0.45 ? 1 : 0;
    }
  }
  const minA = Math.max(40, 0.00002 * w * h);
  const maxA = 0.012 * w * h;
  const stack = new Int32Array(w * h);
  const out: (Blob & { q: number })[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1) continue;
    let sp = 0;
    stack[sp++] = start;
    mask[start] = 2;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (sp) {
      const k = stack[--sp];
      const x = k % w;
      const y = (k - x) / w;
      n++;
      sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if (x + 1 < w && mask[k + 1] === 1) { mask[k + 1] = 2; stack[sp++] = k + 1; }
      if (x > 0 && mask[k - 1] === 1) { mask[k - 1] = 2; stack[sp++] = k - 1; }
      if (y + 1 < h && mask[k + w] === 1) { mask[k + w] = 2; stack[sp++] = k + w; }
      if (y > 0 && mask[k - w] === 1) { mask[k - w] = 2; stack[sp++] = k - w; }
    }
    if (n < minA || n > maxA) continue;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) continue;
    const mx = sx / n, my = sy / n;
    const cxx = sxx / n - mx * mx + 1 / 12, cyy = syy / n - my * my + 1 / 12, cxy = sxy / n - mx * my;
    const det = cxx * cyy - cxy * cxy;
    if (det <= 0) continue;
    const tr = cxx + cyy;
    const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    const l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    if (l2 <= 0 || l1 / l2 > 2.2) continue; // too elongated
    const rect = n / (12 * Math.sqrt(det)); // 1.0 for a filled rectangle, ~0.32 for a ring
    if (rect < 0.85 || rect > 1.2) continue;
    if (Math.max(bw, bh) > 3.2 * Math.min(bw, bh)) continue;
    out.push({ x: mx, y: my, area: n, q: Math.abs(rect - 1) + Math.abs(Math.log(l1 / l2)) * 0.3 });
  }
  out.sort((a, b) => a.q - b.q);
  return out.slice(0, maxKeep);
}

function polyArea(p: Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const q = p[(i + 1) % p.length];
    a += p[i].x * q.y - q.x * p[i].y;
  }
  return Math.abs(a) / 2;
}

/**
 * Choose the four blobs that are the card's corner squares: for every convex
 * 4-subset and rotation, fit a homography and require that it (a) predicts the
 * already-decoded QR corners and (b) predicts each blob's apparent area.
 */
function globalPose(g: Gray, qrImg: Pt[]): { H: H; found: { card: Pt; img: Pt }[] } | null {
  const cand = detectSquares(g);
  if (cand.length < 4) return null;
  const card = fiducialCentres(); // TL, TR, BL, BR
  const cw = [card[0], card[1], card[3], card[2]]; // clockwise: TL, TR, BR, BL
  const qc = qrCorners();
  const qrSide = Math.hypot(qrImg[1].x - qrImg[0].x, qrImg[1].y - qrImg[0].y);
  let best: { err: number; H: H; found: { card: Pt; img: Pt }[] } | null = null;
  const n = cand.length;
  const half = FIDUCIAL / 2;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const sub = [cand[a], cand[b], cand[c], cand[d]];
    const cx = sub.reduce((s, p) => s + p.x, 0) / 4;
    const cy = sub.reduce((s, p) => s + p.y, 0) / 4;
    const q = [...sub].sort((p1, p2) => Math.atan2(p1.y - cy, p1.x - cx) - Math.atan2(p2.y - cy, p2.x - cx));
    if (polyArea(q) < 0.04 * qrSide * qrSide) continue;
    // convex?
    let convex = true;
    for (let i = 0; i < 4 && convex; i++) {
      const p0 = q[i], p1 = q[(i + 1) % 4], p2 = q[(i + 2) % 4];
      if ((p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x) <= 0) convex = false;
    }
    if (!convex) continue;
    for (let r = 0; r < 4; r++) {
      const img = [0, 1, 2, 3].map((i) => q[(i + r) % 4]);
      const H = findHomography(cw, img.map((p) => ({ x: p.x, y: p.y })));
      if (!H) continue;
      let err = 0;
      for (let i = 0; i < 4; i++) {
        const p = applyH(H, qc[i]);
        err += Math.hypot(p.x - qrImg[i].x, p.y - qrImg[i].y);
      }
      err /= 4 * qrSide;
      if (best && err >= best.err) continue;
      if (err > 0.08) continue;
      // apparent area of each square must match the measured blob
      let areaOk = true;
      for (let i = 0; i < 4; i++) {
        const c0 = cw[i];
        const poly = [{ x: c0.x - half, y: c0.y - half }, { x: c0.x + half, y: c0.y - half }, { x: c0.x + half, y: c0.y + half }, { x: c0.x - half, y: c0.y + half }].map((p) => applyH(H, p));
        const pa = polyArea(poly);
        const ratio = img[i].area / pa;
        if (ratio < 0.5 || ratio > 1.6) areaOk = false;
      }
      if (!areaOk) continue;
      best = { err, H, found: cw.map((cp, i) => ({ card: cp, img: { x: img[i].x, y: img[i].y } })) };
    }
  }
  return best ? { H: best.H, found: best.found } : null;
}

/**
 * Pose from the QR, grown outward one corner square at a time. Predictions use
 * an affine model until >= 3 spread-out squares are known (a homography fitted
 * to points clustered on one side extrapolates wildly), then a full homography.
 */
function refinePose(g: Gray, qrImg: Pt[]): { H: H | null; found: { card: Pt; img: Pt }[] } {
  const qc = qrCorners();
  let H = findHomography(qc, qrImg);
  if (!H) return { H: null, found: [] };
  const all = fiducialCentres(); // TL, TR, BL, BR
  // Preferred: find the corner squares anywhere in the photo and fit them as a set.
  const gp = globalPose(g, qrImg);
  if (gp) {
    let Hg = gp.H;
    let fg = gp.found;
    for (let iter = 0; iter < 2; iter++) {
      const again: { card: Pt; img: Pt }[] = [];
      for (const f of all) {
        const ip = refineFiducial(g, Hg, f);
        if (ip) again.push({ card: f, img: ip });
      }
      if (again.length < 4) break;
      fg = again;
      const nxt = findHomography(fg.map((f) => f.card), fg.map((f) => f.img));
      if (nxt) Hg = nxt;
    }
    return { H: Hg, found: fg };
  }
  const qcx = qc.reduce((s, p) => s + p.x, 0) / 4;
  const qcy = qc.reduce((s, p) => s + p.y, 0) / 4;
  const first = [...all].sort((a, b) => Math.hypot(a.x - qcx, a.y - qcy) - Math.hypot(b.x - qcx, b.y - qcy))[0];
  const horizontal = all.find((f) => f.y === first.y && f.x !== first.x)!;
  const vertical = all.find((f) => f.x === first.x && f.y !== first.y)!;
  const diagonal = all.find((f) => f !== first && f !== horizontal && f !== vertical)!;
  const order = [first, horizontal, vertical, diagonal];
  let found: { card: Pt; img: Pt }[] = [];
  const refit = () => {
    const card = [...found.map((f) => f.card), ...qc];
    const img = [...found.map((f) => f.img), ...qrImg];
    const next = found.length >= 3 ? findHomography(card, img) : findAffine(card, img);
    if (next) H = next;
  };
  for (const f of order) {
    const ip = refineFiducial(g, H, f);
    if (ip) {
      found.push({ card: f, img: ip });
      refit();
    }
  }
  // polish: re-detect every square with the full pose and fit on the squares alone
  for (let iter = 0; iter < 2 && found.length >= 3; iter++) {
    const again: { card: Pt; img: Pt }[] = [];
    for (const f of order) {
      const ip = refineFiducial(g, H, f);
      if (ip) again.push({ card: f, img: ip });
    }
    if (again.length < found.length) break;
    found = again;
    const next = found.length === 4 ? findHomography(found.map((f) => f.card), found.map((f) => f.img)) : findHomography([...found.map((f) => f.card), ...qc], [...found.map((f) => f.img), ...qrImg]);
    if (next) H = next;
  }
  return { H, found };
}

/**
 * Centre of the dark hole near a punch target, in frame mm relative to the
 * target. Flood-fills the dark region connected to the middle of a 4.2 mm disc,
 * so grid lines are never included; the printed-digit box is masked out so a
 * hole next to a number cannot merge with it.
 */
function holeCentre(g: Gray, H: H, c: Pt, ref: number, skip: { x0: number; y0: number; x1: number; y1: number }): { dx: number; dy: number; r: number; clipped: boolean } | null {
  const R = 6;
  const step = 0.25;
  const n = Math.round((2 * R) / step) + 1;
  const dark = new Uint8Array(n * n);
  const thr = ref * 0.4;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -R + i * step, y = -R + j * step;
      if (x * x + y * y > R * R) continue;
      const px = c.x + x, py = c.y + y;
      if (px >= skip.x0 && px <= skip.x1 && py >= skip.y0 && py <= skip.y1) continue;
      const v = at(g, H, { x: px, y: py });
      if (Number.isFinite(v) && v < thr) dark[j * n + i] = 1;
    }
  }
  // seed: dark sample nearest the middle
  let seed = -1, best = Infinity;
  const mid = (n - 1) / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (dark[j * n + i]) { const d = (i - mid) ** 2 + (j - mid) ** 2; if (d < best) { best = d; seed = j * n + i; } }
  if (seed < 0 || best > (2.2 / step) ** 2) return null;
  const stack = [seed];
  dark[seed] = 2;
  let cnt = 0, sx = 0, sy = 0, clipped = false;
  while (stack.length) {
    const k = stack.pop()!;
    const i = k % n, j = (k - i) / n;
    cnt++; sx += i; sy += j;
    if (Math.hypot(-R + i * step, -R + j * step) > R - 1.5 * step) clipped = true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
      const nk = nj * n + ni;
      if (dark[nk] === 1) { dark[nk] = 2; stack.push(nk); }
    }
  }
  const area = cnt * step * step;
  if (area < 4) return null;
  return { dx: -R + (sx / cnt) * step, dy: -R + (sy / cnt) * step, r: Math.sqrt(area / Math.PI), clipped };
}

export function scanPhoto(img: RGBA, opts: DetectOptions = {}): PhotoScan {
  const o = { ...DEFAULTS, ...opts };
  if (opts.punchRatio && !opts.uncertainBand) o.uncertainBand = [opts.punchRatio * 0.774, opts.punchRatio * 1.258];
  const gray = rgbaToGray(img);
  const hits = findQrs(img, o.maxQr);
  const halves: HalfScan[] = [];
  const foreign: string[] = [];
  for (const hit of hits) {
    const payload = decodePayload(hit.text);
    if (!payload) {
      foreign.push(hit.text);
      continue;
    }
    const h = readHalf(gray, hit.corners, payload, o);
    if (h) halves.push(h);
  }
  return { width: img.width, height: img.height, halves, foreign, gray };
}

export function readHalf(g: Gray, qrImg: Pt[], payload: DecodedPayload, o: Required<DetectOptions> = DEFAULTS): HalfScan | null {
  const warnings: string[] = [];
  const pose = refinePose(g, qrImg);
  if (!pose.H) return null;
  const H = pose.H;
  const found = pose.found;
  if (found.length < 4) warnings.push(`Only ${found.length}/4 corner squares seen — keep the whole half in the photo.`);
  const fitError = found.length ? found.reduce((s, f) => s + Math.hypot(applyH(H, f.card).x - f.img.x, applyH(H, f.card).y - f.img.y), 0) / found.length : NaN;

  const a = applyH(H, { x: 0, y: 0 });
  const b = applyH(H, { x: FRAME_W, y: 0 });
  const pxPerMm = Math.hypot(b.x - a.x, b.y - a.y) / FRAME_W;
  if (pxPerMm < 2) warnings.push('Card is small in the photo — move the camera closer.');

  const { spec } = payload;
  const cells = [...dayCells(spec.year, spec.month), ...advCells()];
  const refs: number[] = [];
  const cellRef = new Map<Cell, number>();
  for (const c of cells) {
    const vals = cellRefPoints(c).map((p) => discMean(g, H, p, 0.6, 0.3));
    const m = median(vals);
    cellRef.set(c, m);
    refs.push(...vals);
  }
  const paperRef = median(refs);
  const step = Math.max(0.25, Math.min(0.5, 1 / pxPerMm));
  const readings: CellReading[] = cells.map((c) => {
    const centre = discMean(g, H, { x: c.cx, y: c.cy }, SAMPLE_R, step);
    let ref = cellRef.get(c)!;
    if (!Number.isFinite(ref) || ref < paperRef * 0.7) ref = paperRef;
    const ratio = centre / ref;
    // A target we could not see is never read as "no hole": it is flagged unsure.
    const unseen = !Number.isFinite(ratio);
    const punched = !unseen && ratio < o.punchRatio;
    const hc = punched ? holeCentre(g, H, { x: c.cx, y: c.cy }, ref, { x0: c.x, y0: c.y, x1: c.x + (c.kind === 'day' ? 4.6 : 3.8), y1: c.y + (c.kind === 'day' ? 4.2 : 3.6) }) : null;
    return {
      kind: c.kind,
      n: c.n,
      punched,
      ratio,
      uncertain: unseen || (ratio > o.uncertainBand[0] && ratio < o.uncertainBand[1]),
      ...(hc ?? {}),
    };
  });

  const unseen = readings.filter((r) => !Number.isFinite(r.ratio)).length;
  if (unseen) warnings.push(`${unseen} punch spot(s) are outside the photo or cut off — retake with the whole half in view.`);

  // background reference just beyond where the cut can be
  const isStock = payload.role === 'S';
  const beyond = isStock ? FRAME_H + GAP + WAVE_AMP + 5 : -(GAP + WAVE_AMP + 5);
  const bgVals: number[] = [];
  for (let x = 10; x <= FRAME_W - 10; x += 6) bgVals.push(discMean(g, H, { x, y: beyond }, 0.8, 0.4));
  const bgRef = median(bgVals);
  if (!(paperRef > 0.15)) warnings.push('Photo is too dark — add light.');
  const contrastOk = Number.isFinite(bgRef) && bgRef < paperRef * 0.72;
  if (!contrastOk) warnings.push('Place the halves apart on a dark surface so holes and the cut edge show.');

  // trace the cut edge
  const edgeXs: number[] = [];
  const edge: number[] = [];
  const t0 = isStock ? FRAME_H + GAP - WAVE_AMP - 3 : -(GAP - WAVE_AMP - 3);
  const t1 = isStock ? FRAME_H + GAP + WAVE_AMP + 4 : -(GAP + WAVE_AMP + 4);
  const dir = isStock ? 1 : -1;
  const tStep = Math.max(0.15, Math.min(0.35, 0.5 / pxPerMm));
  for (let x = 4; x <= FRAME_W - 4 + 1e-9; x += 2) {
    edgeXs.push(x);
    if (!contrastOk) {
      edge.push(NaN);
      continue;
    }
    const localPaper = discMean(g, H, { x, y: t0 }, 0.8, 0.4);
    const pRef = Number.isFinite(localPaper) && localPaper > bgRef ? localPaper : paperRef;
    const thr = bgRef + 0.5 * (pRef - bgRef);
    let prev = at(g, H, { x, y: t0 });
    let found = NaN;
    for (let t = t0 + dir * tStep; dir * (t1 - t) >= 0; t += dir * tStep) {
      const v = at(g, H, { x, y: t });
      if (!Number.isFinite(v)) break;
      if (v < thr && prev >= thr) {
        // confirm it stays dark a little further (not a printed line)
        const v2 = at(g, H, { x, y: t + dir * 1.2 });
        if (v2 < thr) {
          const frac = (prev - thr) / Math.max(1e-6, prev - v);
          found = t - dir * tStep * (1 - frac);
          break;
        }
      }
      prev = v;
    }
    edge.push(Number.isFinite(found) ? (isStock ? found - FRAME_H - GAP : found + GAP) : NaN);
  }
  const edgeCoverage = edge.filter(Number.isFinite).length / edge.length;
  if (contrastOk && edgeCoverage < 0.5) warnings.push('Cut edge only partly visible — keep the wavy edge inside the photo.');

  return {
    payload,
    pairExpected: payload.pairing,
    pair: payload.pair,
    H,
    qrImgCorners: qrImg,
    fiducialsFound: found.length,
    fitError,
    pxPerMm,
    paperRef,
    bgRef,
    days: readings.filter((r) => r.kind === 'day'),
    adv: readings.filter((r) => r.kind === 'adv'),
    edgeXs,
    edge,
    edgeCoverage,
    warnings,
  };
}

/**
 * Warp a half into a flat, upright view (for the "what the app saw" panel).
 * Covers the frame plus the cut band.
 */
export function rectify(g: Gray, H: H, role: 'S' | 'F', pxPerMm = 4): { img: Gray; y0: number } {
  const y0 = role === 'S' ? -4 : -(GAP + WAVE_AMP + 6);
  const y1 = role === 'S' ? FRAME_H + GAP + WAVE_AMP + 6 : FRAME_H + 4;
  const x0 = -4;
  const x1 = FRAME_W + 4;
  const w = Math.round((x1 - x0) * pxPerMm);
  const h = Math.round((y1 - y0) * pxPerMm);
  const data = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const v = at(g, H, { x: x0 + i / pxPerMm, y: y0 + j / pxPerMm });
      data[j * w + i] = Number.isFinite(v) ? v : 0;
    }
  }
  return { img: { width: w, height: h, data }, y0 };
}
