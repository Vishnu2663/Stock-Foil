import { applyH } from '../core/homography';
import { advCells, dayCells, pmCells, SAMPLE_R } from '../core/layout';
import type { CellStatus } from '../core/wages';
import type { HalfScan, PhotoScan } from '../vision/detect';
import { downscaleRGBA, type RGBA } from '../vision/image';

export const MAX_SIDE = 1600;

export function canvasToRGBA(c: HTMLCanvasElement | OffscreenCanvas): RGBA {
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, c.width, c.height);
  return { width: d.width, height: d.height, data: d.data };
}

export async function fileToRGBA(file: Blob, maxSide = MAX_SIDE): Promise<RGBA> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return canvasToRGBA(c);
}

export function videoFrameToRGBA(v: HTMLVideoElement, maxSide = MAX_SIDE): RGBA {
  const s = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(v.videoWidth * s);
  c.height = Math.round(v.videoHeight * s);
  c.getContext('2d', { willReadFrequently: true })!.drawImage(v, 0, 0, c.width, c.height);
  return canvasToRGBA(c);
}

export function rgbaToCanvas(img: RGBA, canvas: HTMLCanvasElement, maxW = 900) {
  const small = Math.max(img.width, img.height) > maxW * 1.6 ? downscaleRGBA(img, maxW * 1.6) : img;
  canvas.width = small.width;
  canvas.height = small.height;
  canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(small.data), small.width, small.height), 0, 0);
  return small.width / img.width;
}

export const STATUS_COLOR: Record<CellStatus | 'unsure', string> = {
  both: '#1f9d55',
  none: 'rgba(150,150,150,0.0)',
  stockOnly: '#e3342f',
  foilOnly: '#e3342f',
  unsure: '#f6a609',
};

/** Draw the photo and colour-code every punch target; also trace the measured cut edge. */
export function drawOverlay(canvas: HTMLCanvasElement, photo: RGBA, scan: PhotoScan, half: HalfScan, dayStatus: CellStatus[], advStatus: CellStatus[], pmStatus: CellStatus[] = []) {
  const k = rgbaToCanvas(photo, canvas);
  const ctx = canvas.getContext('2d')!;
  const sp = half.pxPerMm * k;
  const { spec } = half.payload;
  const draw = (cx: number, cy: number, st: CellStatus, unsure: boolean, label: string) => {
    const p = applyH(half.H, { x: cx, y: cy });
    const x = p.x * k;
    const y = p.y * k;
    const col = unsure ? STATUS_COLOR.unsure : STATUS_COLOR[st];
    if (st === 'none' && !unsure) return;
    ctx.lineWidth = Math.max(2, sp * 0.45);
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, sp * 3.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.font = `bold ${Math.max(10, sp * 2.6)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y - sp * 4.3);
  };
  const dc = dayCells(spec.year, spec.month, !!spec.halves);
  dc.forEach((c, i) => {
    const r = half.days[i];
    draw(c.cx, c.cy, dayStatus[i] ?? 'none', !!r?.uncertain && !r.manual, String(c.n));
  });
  if (spec.halves) {
    pmCells(spec.year, spec.month).forEach((c, i) => {
      const r = half.pm[i];
      draw(c.cx, c.cy, pmStatus[i] ?? 'none', !!r?.uncertain && !r.manual, '');
    });
  }
  advCells().forEach((c, i) => {
    const r = half.adv[i];
    draw(c.cx, c.cy, advStatus[i] ?? 'none', !!r?.uncertain && !r.manual, `A${c.n}`);
  });
  // measured cut edge
  ctx.fillStyle = '#7c3aed';
  half.edgeXs.forEach((x, i) => {
    const e = half.edge[i];
    if (!Number.isFinite(e)) return;
    const baseY = half.payload.role === 'S' ? 132 : -12;
    const p = applyH(half.H, { x, y: baseY + e });
    ctx.beginPath();
    ctx.arc(p.x * k, p.y * k, Math.max(2, sp * 0.5), 0, Math.PI * 2);
    ctx.fill();
  });
  void SAMPLE_R;
  void scan;
}

export function download(name: string, text: string, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Print only elements marked .print-area (the slip or the card sheet), not the whole page. */
export function printArea() {
  document.body.classList.add('printing-area');
  const done = () => {
    document.body.classList.remove('printing-area');
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  window.print();
}

/** Save an RGBA photo as a full-resolution PNG file. */
export function downloadPhoto(img: RGBA, name: string) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  c.toBlob((b) => {
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
