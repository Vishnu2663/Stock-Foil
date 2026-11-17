/** Minimal image types that work in the browser and in Node tests alike. */

export interface Gray {
  width: number;
  height: number;
  /** luminance 0..1, row-major */
  data: Float32Array;
}

export interface RGBA {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function rgbaToGray(img: RGBA): Gray {
  const { width, height, data } = img;
  const out = new Float32Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    out[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  }
  return { width, height, data: out };
}

export function grayToRgba(g: Gray): RGBA {
  const out = new Uint8ClampedArray(g.width * g.height * 4);
  for (let j = 0, i = 0; j < g.data.length; j++, i += 4) {
    const v = Math.round(g.data[j] * 255);
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return { width: g.width, height: g.height, data: out };
}

/** Bilinear sample; returns NaN outside the image. */
export function sample(g: Gray, x: number, y: number): number {
  if (!(x >= 0 && y >= 0 && x <= g.width - 1 && y <= g.height - 1)) return NaN;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, g.width - 1);
  const y1 = Math.min(y0 + 1, g.height - 1);
  const fx = x - x0;
  const fy = y - y0;
  const w = g.width;
  const d = g.data;
  const a = d[y0 * w + x0];
  const b = d[y0 * w + x1];
  const c = d[y1 * w + x0];
  const e = d[y1 * w + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + e * fx * fy;
}

/** Area-average downscale so the longest side is <= maxSide. */
export function downscaleRGBA(img: RGBA, maxSide: number): RGBA {
  const s = Math.max(img.width, img.height) / maxSide;
  if (s <= 1) return img;
  const w = Math.round(img.width / s);
  const h = Math.round(img.height / s);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const sy0 = Math.floor(y * s);
    const sy1 = Math.min(img.height, Math.floor((y + 1) * s));
    for (let x = 0; x < w; x++) {
      const sx0 = Math.floor(x * s);
      const sx1 = Math.min(img.width, Math.floor((x + 1) * s));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = sy0; yy < sy1; yy++) {
        for (let xx = sx0; xx < sx1; xx++) {
          const i = (yy * img.width + xx) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          n++;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}

export function median(vals: number[]): number {
  const v = vals.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return NaN;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Separable box blur (radius r) returning a grayscale RGBA copy. Used to denoise before QR detection. */
export function blurRGBA(img: RGBA, r: number): RGBA {
  const { width: w, height: h } = img;
  const g = rgbaToGray(img).data;
  const tmp = new Float32Array(w * h);
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += g[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / n;
      s += g[y * w + Math.min(w - 1, x + r + 1)] - g[y * w + Math.max(0, x - r)];
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      const v = Math.round((s / n) * 255);
      const o = (y * w + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return { width: w, height: h, data: out };
}

/** Unsharp mask on luminance: img + amount * (img - blur(img)). Restores edges after denoising. */
export function unsharpRGBA(img: RGBA, r: number, amount: number): RGBA {
  const b = blurRGBA(img, r);
  const g = rgbaToGray(img).data;
  const out = new Uint8ClampedArray(img.data.length);
  for (let k = 0, i = 0; k < g.length; k++, i += 4) {
    const v = g[k] * 255 + amount * (g[k] * 255 - b.data[i]);
    out[i] = out[i + 1] = out[i + 2] = v;
    out[i + 3] = 255;
  }
  return { width: img.width, height: img.height, data: out };
}

/** 2x bilinear upscale of luminance (helps decode QR codes whose modules are < 4 px). */
export function upscale2(img: RGBA): RGBA {
  const w = img.width * 2;
  const h = img.height * 2;
  const out = new Uint8ClampedArray(w * h * 4);
  const g = (xx: number, yy: number) => img.data[(yy * img.width + xx) * 4];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.width - 1.001, Math.max(0, x / 2 - 0.25));
      const sy = Math.min(img.height - 1.001, Math.max(0, y / 2 - 0.25));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const v = g(x0, y0) * (1 - fx) * (1 - fy) + g(x0 + 1, y0) * fx * (1 - fy) + g(x0, y0 + 1) * (1 - fx) * fy + g(x0 + 1, y0 + 1) * fx * fy;
      const o = (y * w + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return { width: w, height: h, data: out };
}
