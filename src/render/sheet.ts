/**
 * Printable A4 sheet as SVG (mm units). Stock on top, foil below, separated by
 * the card's unique wavy cut line. The user prints it, cuts along the wave with
 * scissors, and gives one half to each side.
 */
import QRCode from 'qrcode';
import { cardCode, daysInMonth, encodePayload, formatMoney, waveSeed, type CardSpec, type Role } from '../core/card';
import {
  ADV_X, ADV_Y, CELL_W, CUT_Y, FIDUCIAL, FID_INSET, FOIL_OFFSET, FRAME_H, FRAME_W, GRID_COLS, GRID_X, GRID_Y,
  HOLE_R, QR_SIZE, QR_X, QR_Y, SHEET_H, SHEET_W, STOCK_OFFSET, advCells, dayCells, pmCells, GRID_ROWS,
} from '../core/layout';
import { makeWave, wavePath } from '../core/wave';
import { t, weekdayShort, monthName } from '../i18n';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

function qrPath(text: string, ox = QR_X, oy = QR_Y, size = QR_SIZE, ecc: 'L' | 'M' = 'M'): string {
  const q = QRCode.create(text, { errorCorrectionLevel: ecc });
  const n = q.modules.size;
  const m = size / n;
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (q.modules.data[r * n + c]) {
        let e = c;
        while (e < n && q.modules.data[r * n + e]) e++;
        d += `M${(ox + c * m).toFixed(3)},${(oy + r * m).toFixed(3)}h${((e - c) * m).toFixed(3)}v${m.toFixed(3)}h${(-(e - c) * m).toFixed(3)}z`;
        c = e;
      } else c++;
    }
  }
  return d;
}

/** Font size that keeps `txt` inside `maxW` mm (average glyph ~0.6 em), never above `base`. */
const fit = (txt: string, maxW: number, base: number) => Math.min(base, maxW / (Math.max(1, txt.length) * 0.6)).toFixed(2);

function half(spec: CardSpec, role: Role, lang: string): string {
  const stock = role === 'S';
  const ink = '#1c1a17';
  const soft = '#6b645a';
  const line = '#8d867a';
  const fid = (cx: number, cy: number) => `<rect x="${cx - FIDUCIAL / 2}" y="${cy - FIDUCIAL / 2}" width="${FIDUCIAL}" height="${FIDUCIAL}" fill="${ink}"/>`;
  const a = FID_INSET + FIDUCIAL / 2;
  const parts: string[] = [];
  parts.push(`<rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="none" stroke="#c9c3b6" stroke-width="0.2" stroke-dasharray="1 1"/>`);
  parts.push(fid(a, a), fid(FRAME_W - a, a), fid(a, FRAME_H - a), fid(FRAME_W - a, FRAME_H - a));
  parts.push(`<path d="${qrPath(encodePayload(spec, role))}" fill="${ink}"/>`);

  // ---- header: role (bold) + who keeps it (light), month, names or write-in lines, card code
  const [roleWord, ...rest] = (stock ? t(lang, 'stockTitle') : t(lang, 'foilTitle')).split(' · ');
  parts.push(`<text x="14" y="12" fill="${ink}"><tspan font-size="6.4" font-weight="800" letter-spacing="0.2">${esc(roleWord)}</tspan><tspan font-size="3.8" font-weight="500" fill="${soft}" dx="2.2">${esc(rest.join(' · '))}</tspan></text>`);
  // one tidy line: month, then the names, or write-in lines if they were left blank
  const month = `${esc(monthName(lang, spec.month))} ${spec.year}`;
  if (spec.worker || spec.employer) {
    parts.push(`<text x="14" y="18.6" font-size="3.6" font-weight="700" fill="${ink}">${month}<tspan font-size="3.1" font-weight="500" fill="${soft}" dx="2.4">·  ${esc(spec.worker || '________')}  <tspan fill="#b3ada1">/</tspan>  ${esc(spec.employer || '________')}</tspan></text>`);
  } else {
    parts.push(`<text x="14" y="18.6" font-size="3.6" font-weight="700" fill="${ink}">${month}</text>`);
    // label widths follow the text (longer in some languages); lines shrink to stop well short of the QR at x=140
    const lw = (txt: string) => txt.length * 1.55 + 1.6;
    const wl = t(lang, 'writeWorker');
    const el = t(lang, 'writeEmployer');
    const wx = Math.max(56, 14 + (month.length * 2.05) + 8);
    const avail = 133 - wx - lw(wl) - lw(el) - 5;
    const l1 = Math.min(17, Math.max(8, avail * 0.45));
    const l2 = Math.min(19, Math.max(8, avail - l1));
    const ex = wx + lw(wl) + l1 + 5;
    parts.push(`<text x="${wx}" y="18.4" font-size="2.7" fill="${soft}">${esc(wl)}</text><line x1="${(wx + lw(wl)).toFixed(2)}" y1="18.9" x2="${(wx + lw(wl) + l1).toFixed(2)}" y2="18.9" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${ex.toFixed(2)}" y="18.4" font-size="2.7" fill="${soft}">${esc(el)}</text><line x1="${(ex + lw(el)).toFixed(2)}" y1="18.9" x2="${(ex + lw(el) + l2).toFixed(2)}" y2="18.9" stroke="${line}" stroke-width="0.25"/>`);
  }

  // ---- weekday headers (weekend labels muted red)
  for (let c = 0; c < GRID_COLS; c++) {
    parts.push(`<text x="${GRID_X + c * CELL_W + CELL_W / 2}" y="${GRID_Y - 2.2}" font-size="2.7" font-weight="600" text-anchor="middle" fill="${c >= 5 ? '#9a4a3a' : soft}">${esc(weekdayShort(lang, c))}</text>`);
  }
  // ---- day cells (weekend columns lightly tinted)
  const halves = !!spec.halves;
  for (const c of dayCells(spec.year, spec.month, halves)) {
    const weekend = Math.round((c.x - GRID_X) / CELL_W) >= 5;
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${weekend ? '#f6f2e8' : 'none'}" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1.1}" y="${c.y + 3.3}" font-size="3" font-weight="700" fill="${ink}">${c.n}</text>`);
    parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${HOLE_R}" fill="none" stroke="#a39d90" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`);
    // half-day cards: a faint divider between the first-half and second-half circles
    if (halves) parts.push(`<line x1="${c.x + c.w / 2}" y1="${c.y + 4.2}" x2="${c.x + c.w / 2}" y2="${c.y + c.h - 0.9}" stroke="#c9c3b6" stroke-width="0.2" stroke-dasharray="0.6 0.8"/>`);
  }
  if (halves) {
    for (const c of pmCells(spec.year, spec.month)) {
      parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${HOLE_R}" fill="none" stroke="#a39d90" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`);
    }
  }
  void daysInMonth;
  void GRID_ROWS;
  // ---- advance tokens
  parts.push(`<text x="${ADV_X}" y="${ADV_Y - 2}" font-size="2.9" font-weight="600" fill="${soft}">${esc(t(lang, 'advanceRow', { v: formatMoney(spec.advMinor, spec.currency, lang) }))}</text>`);
  for (const c of advCells()) {
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="#f4f0e6" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1}" y="${c.y + 3.1}" font-size="2.6" font-weight="600" fill="${ink}">${c.n}</text>`);
    parts.push(`<circle cx="${c.cx}" cy="${c.cy}" r="${HOLE_R}" fill="none" stroke="#a39d90" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`);
  }

  // ---- right-hand panel (the space under the main QR): pairing QR, rate, card code
  const px = 134, pw = 44;
  const box = (y: number, h: number) => `<rect x="${px}" y="${y}" width="${pw}" height="${h}" rx="2" fill="#faf8f2" stroke="#c9c3b6" stroke-width="0.25"/>`;
  const cx = px + pw / 2;
  const rate = (y: number) => {
    const r = `${formatMoney(spec.rateMinor, spec.currency, lang)} / ${t(lang, 'perDay')}`;
    const tk = t(lang, 'tokenWorth', { v: formatMoney(spec.advMinor, spec.currency, lang) });
    return box(y, 14) + `<text x="${cx}" y="${y + 6.6}" font-size="${fit(r, pw - 4, 4.6)}" font-weight="800" text-anchor="middle" fill="${ink}">${esc(formatMoney(spec.rateMinor, spec.currency, lang))} <tspan font-size="3" font-weight="500" fill="${soft}">/ ${esc(t(lang, 'perDay'))}</tspan></text><text x="${cx}" y="${y + 11.2}" font-size="${fit(tk, pw - 4, 2.5)}" text-anchor="middle" fill="${soft}">${esc(tk)}</text>`;
  };
  const code = (y: number) => box(y, 14) + `<text x="${cx}" y="${y + 4.2}" font-size="2.3" font-weight="700" letter-spacing="0.4" text-anchor="middle" fill="${soft}">${esc(t(lang, 'cardCode').toUpperCase())}</text><text x="${cx}" y="${y + 10.6}" font-size="5.2" font-weight="800" text-anchor="middle" font-family="ui-monospace, Menlo, monospace" letter-spacing="0.6" fill="${ink}">${cardCode(spec)}</text>`;
  parts.push(code(58), rate(75));
  if (spec.pairing) {
    parts.push(box(92, 10) + `<text x="${cx}" y="${92 + 6.4}" font-size="3.2" font-weight="800" text-anchor="middle" fill="#1f6b3c">✓ ${esc(t(lang, 'pairedBadge'))}</text>`);
  }

  // ---- footer
  parts.push(`<text x="14" y="${FRAME_H - 3.5}" font-size="2.6" fill="${soft}">${esc(stock ? t(lang, 'keepStock') : t(lang, 'keepFoil'))}</text>`);
  if (spec.halves) {
    const ht = t(lang, 'halfLegend');
    parts.push(`<text x="${spec.carryMinor ? 78 : FRAME_W - 14}" y="${FRAME_H - 3.5}" font-size="${fit(ht, 62, 2.6)}" font-weight="600" text-anchor="${spec.carryMinor ? 'middle' : 'end'}" fill="${soft}">${esc(ht)}</text>`);
  }
  if (spec.carryMinor) {
    const ct = t(lang, 'carryRow', { v: formatMoney(spec.carryMinor, spec.currency, lang) });
    parts.push(`<text x="${FRAME_W - 14}" y="${FRAME_H - 3.5}" font-size="${fit(ct, 70, 3)}" font-weight="700" text-anchor="end" fill="${ink}">${esc(ct)}</text>`);
  }
  return parts.join('');
}

export function sheetSvg(spec: CardSpec, lang = spec.lang): string {
  const wave = makeWave(waveSeed(spec));
  const cut = wavePath(wave, STOCK_OFFSET.x, CUT_Y, -12, FRAME_W + 12, 1);
  const s = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}mm" height="${SHEET_H}mm" font-family="system-ui, 'Noto Sans', 'Noto Sans Devanagari', sans-serif">`,
    `<rect width="${SHEET_W}" height="${SHEET_H}" fill="#ffffff"/>`,
    `<g transform="translate(${STOCK_OFFSET.x} ${STOCK_OFFSET.y})">${half(spec, 'S', lang)}</g>`,
    `<g transform="translate(${FOIL_OFFSET.x} ${FOIL_OFFSET.y})">${half(spec, 'F', lang)}</g>`,
    `<path d="${cut}" fill="none" stroke="#000" stroke-width="0.7" stroke-dasharray="3 1.6"/>`,
    `<text x="${SHEET_W / 2}" y="${CUT_Y - 7.5}" font-size="3" text-anchor="middle" fill="#444">✂ ${esc(t(lang, 'cutHere'))} ✂</text>`,
    `<text x="${SHEET_W / 2}" y="${SHEET_H - 6}" font-size="2.6" text-anchor="middle" fill="#888">Stock &amp; Foil · ${esc(t(lang, 'printNote'))}</text>`,
    `</svg>`,
  ];
  return s.join('');
}
