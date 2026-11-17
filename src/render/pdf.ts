/**
 * Dependency-free A4 PDF export of printable sheets: each SVG is rasterised at
 * 300 dpi, JPEG-encoded, and placed on its own page sized exactly 210 x 297 mm,
 * so printing at 100% gives the exact card geometry the scanner expects.
 */
import { SHEET_H, SHEET_W } from '../core/layout';

const DPI = 300;
const PT = 72 / 25.4; // points per mm

async function svgToJpeg(svg: string): Promise<{ jpg: Uint8Array; w: number; h: number }> {
  const w = Math.round((SHEET_W / 25.4) * DPI);
  const h = Math.round((SHEET_H / 25.4) * DPI);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(url);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.95));
  return { jpg: new Uint8Array(await blob.arrayBuffer()), w, h };
}

/** One page per SVG. */
export async function sheetsPdf(svgs: string[]): Promise<Blob> {
  const pages = [];
  for (const s of svgs) pages.push(await svgToJpeg(s));
  const pw = (SHEET_W * PT).toFixed(2);
  const ph = (SHEET_H * PT).toFixed(2);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (b: Uint8Array) => {
    parts.push(b);
    len += b.length;
  };
  const text = (s: string) => push(enc.encode(s));
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = len;
    text(`${n} 0 obj\n`);
    if (typeof body === 'string') text(body);
    else body();
    text('\nendobj\n');
  };
  const n = pages.length;
  text('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ')}] /Count ${n} >>`);
  pages.forEach((p, i) => {
    const page = 3 + 3 * i;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${page + 1} 0 R >> >> /Contents ${page + 2} 0 R >>`);
    obj(page + 1, () => {
      text(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`);
      push(p.jpg);
      text('\nendstream');
    });
    const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
    obj(page + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  const total = 3 + 3 * n;
  const xref = len;
  text(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let k = 1; k < total; k++) text(`${String(offsets[k]).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

/** Single-page convenience wrapper. */
export const sheetPdf = (svg: string) => sheetsPdf([svg]);
