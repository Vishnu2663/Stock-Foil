/**
 * Physical layout of one half, in millimetres, relative to the half's FRAME
 * (the printed rectangle). Both halves share the exact same frame layout, so
 * when the foil is laid on top of the stock with frames aligned, every punch
 * target coincides and one punch goes through both.
 *
 * Sheet (A4 portrait, 210 x 297):
 *   stock frame at (12, 12) size 186 x 120
 *   cut band: nominal cut line at sheet y = 12 + 120 + GAP
 *   foil frame at (12, 12 + 120 + 2*GAP)
 */
import { daysInMonth, firstWeekday } from './card';

export const SHEET_W = 210;
export const SHEET_H = 297;
export const MARGIN = 12;
export const FRAME_W = 186;
export const FRAME_H = 120;
/** Distance from frame edge to the nominal (zero) cut line. */
export const GAP = 12;
/** Max deviation of the wavy cut from nominal. */
export const WAVE_AMP = 5;

export const FIDUCIAL = 7;
export const FID_INSET = 3;

export const QR_X = 140;
export const QR_Y = 14;
export const QR_SIZE = 38;

export const GRID_X = 14;
export const GRID_Y = 27;
export const CELL_W = 16;
export const CELL_H = 11;
export const GRID_COLS = 7;
export const GRID_ROWS = 6;

export const ADV_COUNT = 10;
export const ADV_X = 14;
export const ADV_Y = 99;
export const ADV_W = 11.2;
export const ADV_H = 11;

/** Diameter of a standard office hole punch is ~6 mm. */
export const HOLE_R = 3;
/** Radius of the disc sampled to decide whether a cell is punched. */
export const SAMPLE_R = 1.6;

export interface Pt { x: number; y: number }

/** Fiducial square centres (frame coordinates): TL, TR, BL, BR. */
export function fiducialCentres(): Pt[] {
  const a = FID_INSET + FIDUCIAL / 2;
  const bx = FRAME_W - FID_INSET - FIDUCIAL / 2;
  const by = FRAME_H - FID_INSET - FIDUCIAL / 2;
  return [
    { x: a, y: a },
    { x: bx, y: a },
    { x: a, y: by },
    { x: bx, y: by },
  ];
}

/** QR symbol corners (frame coordinates): TL, TR, BR, BL. */
export function qrCorners(): Pt[] {
  return [
    { x: QR_X, y: QR_Y },
    { x: QR_X + QR_SIZE, y: QR_Y },
    { x: QR_X + QR_SIZE, y: QR_Y + QR_SIZE },
    { x: QR_X, y: QR_Y + QR_SIZE },
  ];
}

export interface Cell {
  /** 'day' cells carry the day of month (1-31) (the first half when the card has half-day circles); 'pm' cells are the second-half circle of that same date; 'adv' cells carry index 1-10. */
  kind: 'day' | 'pm' | 'adv';
  n: number;
  /** Top-left of the cell box. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Punch target centre. */
  cx: number;
  cy: number;
}

/** Distance of each half-day circle from the middle of its date box (mm). Holes are 6 mm, boxes 16 mm wide. */
export const HALF_DX = 4.1;

export function dayCells(year: number, month: number, halves = false): Cell[] {
  const first = firstWeekday(year, month);
  const n = daysInMonth(year, month);
  const out: Cell[] = [];
  for (let d = 1; d <= n; d++) {
    const idx = first + d - 1;
    const col = idx % 7;
    const row = Math.floor(idx / 7);
    const x = GRID_X + col * CELL_W;
    const y = GRID_Y + row * CELL_H;
    out.push({ kind: 'day', n: d, x, y, w: CELL_W, h: CELL_H, cx: x + CELL_W / 2 - (halves ? HALF_DX : 0), cy: y + CELL_H / 2 + 0.6 });
  }
  return out;
}

/** The second-half circle of every date (only on cards with half-day circles). */
export function pmCells(year: number, month: number): Cell[] {
  return dayCells(year, month, true).map((c) => ({ ...c, kind: 'pm' as const, cx: c.cx + 2 * HALF_DX }));
}

/** Every punch target of a card, in reading order. */
export function punchCells(spec: { year: number; month: number; halves?: boolean }): Cell[] {
  return [...dayCells(spec.year, spec.month, !!spec.halves), ...(spec.halves ? pmCells(spec.year, spec.month) : []), ...advCells()];
}

export function advCells(): Cell[] {
  const out: Cell[] = [];
  for (let i = 1; i <= ADV_COUNT; i++) {
    const x = ADV_X + (i - 1) * ADV_W;
    out.push({ kind: 'adv', n: i, x, y: ADV_Y, w: ADV_W, h: ADV_H, cx: x + ADV_W / 2, cy: ADV_Y + ADV_H / 2 + 0.6 });
  }
  return out;
}

/** Points inside a cell, away from the punch, number and border: local paper reference. */
export function cellRefPoints(c: Cell): Pt[] {
  const dx = c.w / 2 - 1.6;
  const mx = c.x + c.w / 2; // box centre, so both half-day circles share the same paper references
  return [
    { x: mx - dx, y: c.y + c.h - 1.6 },
    { x: mx + dx, y: c.y + c.h - 1.6 },
    { x: mx + dx, y: c.y + 2.2 },
  ];
}

/** Where the two halves sit on the printed sheet (sheet mm = frame mm + offset). */
export const STOCK_OFFSET: Pt = { x: MARGIN, y: MARGIN };
export const FOIL_OFFSET: Pt = { x: MARGIN, y: MARGIN + FRAME_H + 2 * GAP };
/** Nominal cut line y in sheet mm. */
export const CUT_Y = MARGIN + FRAME_H + GAP;

/** Paper extent of each half in its own frame coordinates (before the cut). */
export const PAPER_LEFT = -MARGIN;
export const PAPER_RIGHT = FRAME_W + MARGIN;
export const STOCK_PAPER_TOP = -MARGIN;
export const FOIL_PAPER_BOTTOM = SHEET_H - FOIL_OFFSET.y;
