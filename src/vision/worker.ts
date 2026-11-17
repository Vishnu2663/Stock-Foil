/// <reference lib="webworker" />
import { scanPhoto } from './detect';
import type { RGBA } from './image';

self.onmessage = (e: MessageEvent<{ id: number; photo: RGBA }>) => {
  try {
    (self as unknown as Worker).postMessage({ id: e.data.id, scan: scanPhoto(e.data.photo) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id: e.data.id, error: String(err) });
  }
};
