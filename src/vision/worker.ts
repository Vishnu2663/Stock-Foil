/// <reference lib="webworker" />
import { scanPhoto, type DetectOptions } from './detect';
import type { RGBA } from './image';

self.onmessage = (e: MessageEvent<{ id: number; photo: RGBA; opts?: DetectOptions }>) => {
  try {
    (self as unknown as Worker).postMessage({ id: e.data.id, scan: scanPhoto(e.data.photo, e.data.opts) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, error: String(err) });
  }
};
