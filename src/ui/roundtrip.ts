/**
 * Print round-trip self-test: rasterise the REAL printable SVG sheet in the
 * browser, cut it along its wavy line, punch holes through both halves, then
 * "photograph" each half (rotate, blur) and run the real scanner on the result.
 * This proves the printed layout and the scanner's layout agree.
 */
import type { CardSpec } from '../core/card';
import { dayCells, CUT_Y, FOIL_OFFSET, FRAME_W, HOLE_R, SHEET_H, SHEET_W, STOCK_OFFSET } from '../core/layout';
import { makeWave } from '../core/wave';
import { waveSeed } from '../core/card';
import { sheetSvg } from '../render/sheet';
import { scanPhoto } from '../vision/detect';
import type { Captured } from './components/Results';
import { canvasToRGBA } from './imageIO';

const K = 4.8; // sheet pixels per mm
const W = 1200;
const H = 1000;

async function rasteriseSheet(spec: CardSpec): Promise<HTMLCanvasElement> {
  const svg = sheetSvg(spec, spec.lang);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = Math.round(SHEET_W * K);
  c.height = Math.round(SHEET_H * K);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return c;
}

function photoOf(sheet: HTMLCanvasElement, spec: CardSpec, role: 'S' | 'F', days: number[], angleDeg: number, blurPx: number): Captured | null {
  const wave = makeWave(waveSeed(spec));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#101010';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
  const cy = role === 'S' ? (CUT_Y + 7) / 2 : (CUT_Y - 7 + SHEET_H) / 2;
  ctx.translate(W / 2, H / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.scale(K, K);
  ctx.translate(-SHEET_W / 2, -cy);
  // clip to this half's side of the wavy cut
  ctx.beginPath();
  const x0 = 0;
  const x1 = SHEET_W;
  const edge = (x: number) => CUT_Y + wave(x - STOCK_OFFSET.x);
  if (role === 'S') {
    ctx.moveTo(x0, 0);
    ctx.lineTo(x1, 0);
    for (let x = x1; x >= x0; x -= 0.5) ctx.lineTo(x, edge(x));
  } else {
    ctx.moveTo(x0, SHEET_H);
    ctx.lineTo(x1, SHEET_H);
    for (let x = x1; x >= x0; x -= 0.5) ctx.lineTo(x, edge(x));
  }
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(sheet, 0, 0, SHEET_W, SHEET_H);
  // punch
  const off = role === 'S' ? STOCK_OFFSET : FOIL_OFFSET;
  ctx.fillStyle = '#101010';
  for (const cell of dayCells(spec.year, spec.month)) {
    if (!days.includes(cell.n)) continue;
    ctx.beginPath();
    ctx.arc(cell.cx + off.x, cell.cy + off.y, HOLE_R, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  const photo = canvasToRGBA(c);
  const scan = scanPhoto(photo);
  const half = scan.halves[0];
  void FRAME_W;
  return half ? { photo, scan, half } : null;
}

export async function printRoundTrip(spec: CardSpec, stockDays: number[], foilDays: number[], angleDeg: number, blurPx: number): Promise<{ stock: Captured; foil: Captured } | { error: string }> {
  const sheet = await rasteriseSheet(spec);
  const stock = photoOf(sheet, spec, 'S', stockDays, angleDeg, blurPx);
  const foil = photoOf(sheet, spec, 'F', foilDays, -angleDeg * 0.6, blurPx);
  if (!stock || !foil) return { error: 'The scanner could not read the rasterised printable sheet. (QR/corner squares not found.)' };
  return { stock, foil };
}
