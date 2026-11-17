/**
 * Printable A4 sheet as SVG (mm units). Stock on top, foil below, separated by
 * the card's unique wavy cut line. The user prints it, cuts along the wave with
 * scissors, and gives one half to each side.
 */
import QRCode from 'qrcode';
import { cardCode, daysInMonth, encodePayload, formatMoney, waveSeed, type CardSpec, type Role } from '../core/card';
import {
  ADV_X, ADV_Y, CELL_W, CUT_Y, FIDUCIAL, FID_INSET, FOIL_OFFSET, FRAME_H, FRAME_W, GRID_COLS, GRID_X, GRID_Y,
  HOLE_R, QR_SIZE, QR_X, QR_Y, SHEET_H, SHEET_W, STOCK_OFFSET, advCells, dayCells, GRID_ROWS,
} from '../core/layout';
import { makeWave, wavePath } from '../core/wave';
import { t, weekdayShort, monthName } from '../i18n';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function qrPath(text: string): string {
  const q = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = q.modules.size;
  const m = QR_SIZE / n;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (q.modules.data[r * n + c]) {
        let e = c;
        while (e < n && q.modules.data[r * n + e]) e++;
        d += `M${(QR_X + c * m).toFixed(3)},${(QR_Y + r * m).toFixed(3)}h${((e - c) * m).toFixed(3)}v${m.toFixed(3)}h${(-(e - c) * m).toFixed(3)}z`;
        c = e;
      } else c++;
    }
  }
  return d;
}

function half(spec: CardSpec, role: Role, lang: string): string {
  const stock = role === 'S';
  const ink = '#1c1a17';
  const fid = (cx: number, cy: number) => `<rect x="${cx - FIDUCIAL / 2}" y="${cy - FIDUCIAL / 2}" width="${FIDUCIAL}" height="${FIDUCIAL}" fill="${ink}"/>`;
  const a = FID_INSET + FIDUCIAL / 2;
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="none" stroke="#bbb" stroke-width="0.2" stroke-dasharray="1 1"/>`);
  parts.push(fid(a, a), fid(FRAME_W - a, a), fid(a, FRAME_H - a), fid(FRAME_W - a, FRAME_H - a));
  parts.push(`<path d="${qrPath(encodePayload(spec, role))}" fill="${ink}"/>`);
  // title block
  const title = stock ? t(lang, 'stockTitle') : t(lang, 'foilTitle');
  parts.push(`<text x="14" y="13" font-size="6" font-weight="700" fill="${ink}">${esc(title)}</text>`);
  parts.push(`<text x="14" y="18.5" font-size="3.6" fill="${ink}">${esc(monthName(lang, spec.month))} ${spec.year} · ${esc(spec.worker || '—')} / ${esc(spec.employer || '—')}</text>`);
  parts.push(`<text x="14" y="22.5" font-size="3" fill="#555">${esc(formatMoney(spec.rateMinor, spec.currency, lang))} / ${esc(t(lang, 'perDay'))} · ${t(lang, 'cardCode')} ${cardCode(spec)}</text>`);
  // weekday headers
  for (let c = 0; c < GRID_COLS; c++) {
    parts.push(`<text x="${GRID_X + c * CELL_W + CELL_W / 2}" y="${GRID_Y - 2.2}" font-size="2.8" text-anchor="middle" fill="#555">${esc(weekdayShort(lang, c))}</text>`);
  }
  // day cells
  for (const c of dayCells(spec.year, spec.month)) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="none" stroke="#777" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1.1}" y="${c.y + 3.3}" font-size="3" font-weight="600" fill="${ink}">${c.n}</text>`);
    parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${HOLE_R}" fill="none" stroke="#999" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`);
  }
  void daysInMonth;
  void GRID_ROWS;
  // advance tokens
  parts.push(`<text x="${ADV_X}" y="${ADV_Y - 2}" font-size="3" fill="#555">${esc(t(lang, 'advanceRow', { v: formatMoney(spec.advMinor, spec.currency, lang) }))}</text>`);
  for (const c of advCells()) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="#f1ece0" stroke="#777" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1}" y="${c.y + 3.1}" font-size="2.6" fill="${ink}">${c.n}</text>`);
    parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${HOLE_R}" fill="none" stroke="#999" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`);
  }
  parts.push(`<text x="14" y="${FRAME_H - 3.5}" font-size="2.6" fill="#777">${esc(stock ? t(lang, 'keepStock') : t(lang, 'keepFoil'))}</text>`);
  return parts.join('');
}

export function sheetSvg(spec: CardSpec, lang = spec.lang): string {
  const wave = makeWave(waveSeed(spec));
  const cut = wavePath(wave, STOCK_OFFSET.x, CUT_Y, -12, FRAME_W + 12, 1);
  const s = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}mm" height="${SHEET_H}mm" font-family="system-ui, 'Noto Sans', 'Noto Sans Devanagari', sans-serif">`,
    `<rect width="${SHEET_W}" height="${SHEET_H}" fill="#fffdf6"/>`,
    `<g transform="translate(${STOCK_OFFSET.x} ${STOCK_OFFSET.y})">${half(spec, 'S', lang)}</g>`,
    `<g transform="translate(${FOIL_OFFSET.x} ${FOIL_OFFSET.y})">${half(spec, 'F', lang)}</g>`,
    `<path d="${cut}" fill="none" stroke="#000" stroke-width="0.7" stroke-dasharray="3 1.6"/>`,
    `<text x="${SHEET_W / 2}" y="${CUT_Y - 7.5}" font-size="3" text-anchor="middle" fill="#444">✂ ${esc(t(lang, 'cutHere'))} ✂</text>`,
    `<text x="${SHEET_W / 2}" y="${SHEET_H - 6}" font-size="2.6" text-anchor="middle" fill="#888">Stock &amp; Foil · ${esc(t(lang, 'printNote'))}</text>`,
    `</svg>`,
  ];
  return s.join('');
}
