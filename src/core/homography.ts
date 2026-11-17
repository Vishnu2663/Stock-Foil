import type { Pt } from './layout';

/** 3x3 homography, row-major, h[8] normalised to 1. */
export type H = number[];

/** Solve A x = b in place with partial pivoting. Returns null if singular. */
export function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-12) return null;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      if (f === 0) continue;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/**
 * Homography mapping src -> dst from >= 4 correspondences (least squares via
 * normal equations, with Hartley normalisation for numerical stability).
 */
export function findHomography(src: Pt[], dst: Pt[]): H | null {
  if (src.length < 4 || src.length !== dst.length) return null;
  const ns = normaliser(src);
  const nd = normaliser(dst);
  const s = src.map((p) => applyH(ns, p));
  const d = dst.map((p) => applyH(nd, p));
  const AtA = Array.from({ length: 8 }, () => new Array(8).fill(0));
  const Atb = new Array(8).fill(0);
  const add = (row: number[], rhs: number) => {
    for (let i = 0; i < 8; i++) {
      Atb[i] += row[i] * rhs;
      for (let j = 0; j < 8; j++) AtA[i][j] += row[i] * row[j];
    }
  };
  for (let i = 0; i < s.length; i++) {
    const { x, y } = s[i];
    const { x: u, y: v } = d[i];
    add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  const sol = solve(AtA, Atb);
  if (!sol) return null;
  const Hn = [...sol, 1];
  const ndInv = invertH(nd);
  if (!ndInv) return null;
  return normalise(mul(mul(ndInv, Hn), ns));
}

function normaliser(pts: Pt[]): H {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const md = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length || 1;
  const k = Math.SQRT2 / md;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

export function mul(a: H, b: H): H {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

export function normalise(h: H): H {
  const s = h[8];
  return Math.abs(s) < 1e-15 ? h : h.map((v) => v / s);
}

export function applyH(h: H, p: Pt): Pt {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

export function invertH(h: H): H | null {
  const [a, b, c, d, e, f, g, hh, i] = h;
  const A = e * i - f * hh;
  const B = -(d * i - f * g);
  const C = d * hh - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) return null;
  const inv = [A, -(b * i - c * hh), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * hh - b * g), a * e - b * d];
  return normalise(inv.map((v) => v / det));
}

/** Build a similarity+perspective homography: scale, rotate (rad), translate, plus small tilt. */
export function poseH(opts: { scale: number; angle: number; tx: number; ty: number; px?: number; py?: number; cx?: number; cy?: number }): H {
  const { scale, angle, tx, ty, px = 0, py = 0, cx = 0, cy = 0 } = opts;
  const c = Math.cos(angle) * scale;
  const s = Math.sin(angle) * scale;
  // translate to centre, perspective, rotate/scale, translate out
  const T1: H = [1, 0, -cx, 0, 1, -cy, 0, 0, 1];
  const P: H = [1, 0, 0, 0, 1, 0, px, py, 1];
  const R: H = [c, -s, tx, s, c, ty, 0, 0, 1];
  return normalise(mul(R, mul(P, T1)));
}

/**
 * Least-squares affine fit (6 DOF), returned as a homography with no perspective.
 * Far better conditioned than a full homography when the points are clustered
 * on one side, so it is used to predict where distant markers should be.
 */
export function findAffine(src: Pt[], dst: Pt[]): H | null {
  if (src.length < 3 || src.length !== dst.length) return null;
  const n = src.length;
  const cx = src.reduce((s, p) => s + p.x, 0) / n;
  const cy = src.reduce((s, p) => s + p.y, 0) / n;
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const bx = [0, 0, 0];
  const by = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    const r = [src[i].x - cx, src[i].y - cy, 1];
    for (let a = 0; a < 3; a++) {
      bx[a] += r[a] * dst[i].x;
      by[a] += r[a] * dst[i].y;
      for (let b = 0; b < 3; b++) AtA[a][b] += r[a] * r[b];
    }
  }
  const px = solve(AtA.map((r) => [...r]), bx);
  const py = solve(AtA.map((r) => [...r]), by);
  if (!px || !py) return null;
  // undo the centring: x' = a(x-cx) + b(y-cy) + c
  return [px[0], px[1], px[2] - px[0] * cx - px[1] * cy, py[0], py[1], py[2] - py[0] * cx - py[1] * cy, 0, 0, 1];
}
