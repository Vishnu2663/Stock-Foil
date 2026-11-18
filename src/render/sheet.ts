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
  // retro time-card palette: sepia ink and rules; the corner squares and QR stay pure black for the scanner
  const black = '#111111';
  const ink = '#2e2014';
  const soft = '#77593b';
  const line = '#9a7c58';
  const rule = '#b49a74';
  const stampRed = '#a8322a';
  const fid = (cx: number, cy: number) => `<rect x="${cx - FIDUCIAL / 2}" y="${cy - FIDUCIAL / 2}" width="${FIDUCIAL}" height="${FIDUCIAL}" fill="${black}"/>`;
  const a = FID_INSET + FIDUCIAL / 2;
  const parts: string[] = [];
  // double-rule ledger frame (heavy outer rule + hairline inside), kept clear of the corner squares
  parts.push(`<rect x="0" y="0" width="${FRAME_W}" height="${FRAME_H}" fill="none" stroke="${rule}" stroke-width="0.5"/>`);
  parts.push(`<rect x="1.1" y="1.1" width="${FRAME_W - 2.2}" height="${FRAME_H - 2.2}" fill="none" stroke="${rule}" stroke-width="0.15"/>`);
  parts.push(fid(a, a), fid(FRAME_W - a, a), fid(a, FRAME_H - a), fid(FRAME_W - a, FRAME_H - a));
  parts.push(`<path d="${qrPath(encodePayload(spec, role))}" fill="${black}"/>`);

  // ---- header: role in spaced typewriter capitals + who keeps it, then a red date stamp
  const [roleWord, ...rest] = (stock ? t(lang, 'stockTitle') : t(lang, 'foilTitle')).split(' · ');
  const restTxt = rest.join(' · ');
  const roleSize = Number(fit(roleWord, 34, 6.4));
  const roleW = roleWord.length * roleSize * 0.6 + roleWord.length * 0.6;
  parts.push(`<text x="14" y="12" fill="${ink}"><tspan font-size="${roleSize}" font-weight="700" letter-spacing="0.6">${esc(roleWord.toUpperCase())}</tspan><tspan font-size="${fit(restTxt, Math.max(20, 88 - roleW), 3.6)}" font-style="italic" fill="${soft}" dx="2.4">${esc(restTxt)}</tspan></text>`);
  // rubber date stamp: month and year in a tilted double-bordered box, stopping well short of the QR quiet zone
  const stampTxt = `${monthName(lang, spec.month).toUpperCase()} ${spec.year}`;
  parts.push(`<g transform="rotate(-5 117 13)" opacity="0.85"><rect x="103" y="8.4" width="28" height="9" fill="none" stroke="${stampRed}" stroke-width="0.55"/><rect x="104" y="9.4" width="26" height="7" fill="none" stroke="${stampRed}" stroke-width="0.18"/><text x="117" y="14.1" font-size="${fit(stampTxt, 23 - stampTxt.length * 0.3, 3.3)}" font-weight="700" letter-spacing="0.3" text-anchor="middle" fill="${stampRed}">${esc(stampTxt)}</text></g>`);
  // one tidy line under the title: the names, or write-in blanks if they were left blank
  if (spec.worker || spec.employer) {
    parts.push(`<text x="14" y="18.6" font-size="3.2" font-weight="700" fill="${ink}">${esc(spec.worker || '________')}  <tspan fill="${rule}">/</tspan>  ${esc(spec.employer || '________')}</text>`);
  } else {
    // label widths follow the text (longer in some languages); lines shrink to stop short of the stamp at x=100
    const lw = (txt: string) => txt.length * 1.7 + 1.6;
    const wl = t(lang, 'writeWorker');
    const el = t(lang, 'writeEmployer');
    const wx = 14;
    const avail = 98 - wx - lw(wl) - lw(el) - 5;
    const l1 = Math.min(24, Math.max(8, avail * 0.48));
    const l2 = Math.min(24, Math.max(8, avail - l1));
    const ex = wx + lw(wl) + l1 + 5;
    parts.push(`<text x="${wx}" y="18.4" font-size="2.7" fill="${soft}">${esc(wl)}</text><line x1="${(wx + lw(wl)).toFixed(2)}" y1="18.9" x2="${(wx + lw(wl) + l1).toFixed(2)}" y2="18.9" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${ex.toFixed(2)}" y="18.4" font-size="2.7" fill="${soft}">${esc(el)}</text><line x1="${(ex + lw(el)).toFixed(2)}" y1="18.9" x2="${(ex + lw(el) + l2).toFixed(2)}" y2="18.9" stroke="${line}" stroke-width="0.25"/>`);
  }

  // ---- weekday headers (weekend labels muted red)
  for (let c = 0; c < GRID_COLS; c++) {
    parts.push(`<text x="${GRID_X + c * CELL_W + CELL_W / 2}" y="${GRID_Y - 2.2}" font-size="2.7" font-weight="700" letter-spacing="0.3" text-anchor="middle" fill="${c >= 5 ? stampRed : soft}">${esc(weekdayShort(lang, c).toUpperCase())}</text>`);
  }
  // ---- day cells (weekend columns lightly tinted)
  const halves = !!spec.halves;
  // one punch target: a dashed ring, and (printed-disc cards) a grey disc that punching removes
  const ring = (cx: number, cy: number) => (spec.discs ? `<circle cx="${cx}" cy="${cy}" r="${HOLE_R}" fill="#9d9d9d"/>` : '') + `<circle cx="${cx}" cy="${cy}" r="${HOLE_R}" fill="none" stroke="${rule}" stroke-width="0.15" stroke-dasharray="0.7 0.7"/>`;
  for (const c of dayCells(spec.year, spec.month, halves)) {
    const weekend = Math.round((c.x - GRID_X) / CELL_W) >= 5;
    parts.push(`<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${weekend ? '#f8f1e2' : 'none'}" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1.1}" y="${c.y + 2.9}" font-size="2.6" font-weight="700" fill="${ink}">${c.n}</text>`);
    parts.push(ring(c.cx, c.cy));
    // half-day cards: a faint divider between the first-half and second-half circles
    if (halves) parts.push(`<line x1="${c.x + c.w / 2}" y1="${c.y + 4.2}" x2="${c.x + c.w / 2}" y2="${c.y + c.h - 0.9}" stroke="${rule}" stroke-width="0.2" stroke-dasharray="0.6 0.8"/>`);
  }
  if (halves) {
    for (const c of pmCells(spec.year, spec.month)) {
      parts.push(ring(c.cx, c.cy));
    }
  }
  void daysInMonth;
  void GRID_ROWS;
  // ---- advance tokens
  parts.push(`<text x="${ADV_X}" y="${ADV_Y - 2}" font-size="2.9" font-weight="700" letter-spacing="0.2" fill="${soft}">${esc(t(lang, 'advanceRow', { v: formatMoney(spec.advMinor, spec.currency, lang) }).toUpperCase())}</text>`);
  // advance tokens drawn as ticket stubs: a half-moon notch in each side, at mid-height (clear of the paper reference points)
  const ticket = (x: number, y: number, w: number, h: number) => {
    const r = 1.2, m = y + h / 2;
    return `M${x},${y}H${x + w}V${m - r}A${r},${r} 0 0 0 ${x + w},${m + r}V${y + h}H${x}V${m + r}A${r},${r} 0 0 0 ${x},${m - r}Z`;
  };
  for (const c of advCells()) {
    parts.push(`<path d="${ticket(c.x + 0.25, c.y, c.w - 0.5, c.h)}" fill="#f7efdf" stroke="${line}" stroke-width="0.25"/>`);
    parts.push(`<text x="${c.x + 1}" y="${c.y + 2.8}" font-size="2.3" font-weight="700" fill="${ink}">${c.n}</text>`);
    parts.push(ring(c.cx, c.cy));
  }

  // ---- right-hand panel (the space under the main QR): pairing QR, rate, card code
  const px = 134, pw = 44;
  const box = (y: number, h: number) => `<rect x="${px}" y="${y}" width="${pw}" height="${h}" fill="#fbf6ea" stroke="${line}" stroke-width="0.3"/><rect x="${px + 0.8}" y="${y + 0.8}" width="${pw - 1.6}" height="${h - 1.6}" fill="none" stroke="${rule}" stroke-width="0.12"/>`;
  const cx = px + pw / 2;
  const rate = (y: number) => {
    const r = `${formatMoney(spec.rateMinor, spec.currency, lang)} / ${t(lang, 'perDay')}`;
    const tk = t(lang, 'tokenWorth', { v: formatMoney(spec.advMinor, spec.currency, lang) });
    return box(y, 14) + `<text x="${cx}" y="${y + 6.6}" font-size="${fit(r, pw - 4, 4.6)}" font-weight="800" text-anchor="middle" fill="${ink}">${esc(formatMoney(spec.rateMinor, spec.currency, lang))} <tspan font-size="3" font-weight="500" fill="${soft}">/ ${esc(t(lang, 'perDay'))}</tspan></text><text x="${cx}" y="${y + 11.2}" font-size="${fit(tk, pw - 4, 2.5)}" text-anchor="middle" fill="${soft}">${esc(tk)}</text>`;
  };
  const code = (y: number) => box(y, 14) + `<text x="${cx}" y="${y + 4.2}" font-size="2.3" font-weight="700" letter-spacing="0.4" text-anchor="middle" fill="${soft}">${esc(t(lang, 'cardCode').toUpperCase())}</text><text x="${cx}" y="${y + 10.6}" font-size="5.2" font-weight="800" text-anchor="middle" letter-spacing="0.4" fill="${ink}">№ ${cardCode(spec)}</text>`;
  parts.push(code(58), rate(75));
  if (spec.pairing) {
    parts.push(box(92, 10) + `<text x="${cx}" y="${92 + 6.4}" font-size="3.2" font-weight="800" text-anchor="middle" fill="#1f6b3c">✓ ${esc(t(lang, 'pairedBadge'))}</text>`);
  }

  if (spec.discs) {
    const dn = t(lang, 'discNote');
    parts.push(`<text x="${FRAME_W - 14}" y="${FRAME_H - 7.4}" font-size="${fit(dn, 62, 2.6)}" font-weight="600" text-anchor="end" fill="${soft}">${esc(dn)}</text>`);
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
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET_W} ${SHEET_H}" width="${SHEET_W}mm" height="${SHEET_H}mm" font-family="'Courier Prime', 'Courier New', Courier, 'Noto Sans Mono', monospace, 'Noto Sans', 'Noto Sans Devanagari', sans-serif">`,
    `<rect width="${SHEET_W}" height="${SHEET_H}" fill="#ffffff"/>`,
    `<g transform="translate(${STOCK_OFFSET.x} ${STOCK_OFFSET.y})">${half(spec, 'S', lang)}</g>`,
    `<g transform="translate(${FOIL_OFFSET.x} ${FOIL_OFFSET.y})">${half(spec, 'F', lang)}</g>`,
    // perforation: a row of round dots along the card's own wave
    `<path d="${cut}" fill="none" stroke="#2e2014" stroke-width="0.8" stroke-linecap="round" stroke-dasharray="0.01 1.7"/>`,
    `<text x="${SHEET_W / 2}" y="${CUT_Y - 7.5}" font-size="3" font-weight="700" letter-spacing="0.5" text-anchor="middle" fill="#5a4330">✂ ${esc(t(lang, 'cutHere').toUpperCase())} ✂</text>`,
    `<text x="${SHEET_W / 2}" y="${SHEET_H - 6}" font-size="2.6" text-anchor="middle" fill="#8a7358">Stock &amp; Foil · ${esc(t(lang, 'printNote'))}</text>`,
    `</svg>`,
  ];
  return s.join('');
}
