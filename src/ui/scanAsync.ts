import { scanPhoto, type PhotoScan } from '../vision/detect';
import type { RGBA } from '../vision/image';

/** Runs the scanner in a Web Worker so the UI never freezes; falls back to the main thread. */
let worker: Worker | null = null;
let broken = false;
let nextId = 1;
const pending = new Map<number, { ok: (s: PhotoScan) => void; fail: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (broken || typeof Worker === 'undefined') return null;
  if (!worker) {
    try {
      worker = new Worker(new URL('../vision/worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ id: number; scan?: PhotoScan; error?: string }>) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        if (e.data.scan) p.ok(e.data.scan);
        else p.fail(new Error(e.data.error ?? 'scan failed'));
      };
      worker.onerror = () => {
        broken = true;
        worker = null;
        for (const [, p] of pending) p.fail(new Error('worker crashed'));
        pending.clear();
      };
    } catch {
      broken = true;
      return null;
    }
  }
  return worker;
}

export function scanPhotoAsync(photo: RGBA): Promise<PhotoScan> {
  const w = getWorker();
  if (!w) return new Promise((res) => setTimeout(() => res(scanPhoto(photo)), 30));
  return new Promise<PhotoScan>((ok, fail) => {
    const id = nextId++;
    pending.set(id, { ok, fail });
    w.postMessage({ id, photo });
  }).catch(() => new Promise<PhotoScan>((res) => setTimeout(() => res(scanPhoto(photo)), 30)));
}
