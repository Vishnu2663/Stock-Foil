import fc from 'fast-check';
import { newCardSpec, daysInMonth, type CardSpec, type Role } from '../src/core/card';
import { CLEAN, IMG_H, IMG_W, placeHalf, renderScene, type PhotoConditions, type HalfInstance } from '../src/render/scene';
import { applyH } from '../src/core/homography';
import { scanPhoto } from '../src/vision/detect';
import type { Wave } from '../src/core/wave';

export const arbSpec = fc
  .record({
    id: fc.stringOf(fc.constantFrom(...'0123456789ABCDEFGHJKMNPQRSTVWXYZ'.split('')), { minLength: 8, maxLength: 8 }),
    year: fc.integer({ min: 2024, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    rateMinor: fc.integer({ min: 100, max: 5_000_000 }),
    advMinor: fc.integer({ min: 0, max: 500_000 }),
    worker: fc.constantFrom('Ramesh', 'Sita Devi', 'Joao', 'Amina', 'Kofi'),
    employer: fc.constantFrom('Sharma Builders', 'Patel Farm', 'Mrs Rao'),
  })
  .map((r) => newCardSpec(r));

export const arbDays = (spec: CardSpec) =>
  fc.uniqueArray(fc.integer({ min: 1, max: daysInMonth(spec.year, spec.month) }), { maxLength: 31 });

export const arbAdv = fc.uniqueArray(fc.integer({ min: 1, max: 10 }), { maxLength: 10 });

/** True when the whole half (paper incl. margin and cut band) is inside the photo: the documented capture requirement. */
export function fitsInFrame(c: PhotoConditions, role: Role): boolean {
  const H = placeHalf(c, role);
  return [[-12, -17], [198, -17], [-12, 141], [198, 141]].every(([x, y]) => {
    const p = applyH(H, { x, y });
    return p.x >= 2 && p.y >= 2 && p.x <= IMG_W - 2 && p.y <= IMG_H - 2;
  });
}

/** Photo conditions inside the documented capture envelope (whole half in frame). */
export const arbConditions: fc.Arbitrary<PhotoConditions> = fc.record({
  angle: fc.double({ min: -0.45, max: 0.45, noNaN: true }),
  scale: fc.double({ min: 3.6, max: 4.8, noNaN: true }),
  tx: fc.double({ min: -30, max: 30, noNaN: true }),
  ty: fc.double({ min: -30, max: 30, noNaN: true }),
  px: fc.double({ min: -0.0005, max: 0.0005, noNaN: true }),
  py: fc.double({ min: -0.0005, max: 0.0005, noNaN: true }),
  blur: fc.double({ min: 0, max: 1.3, noNaN: true }),
  noise: fc.double({ min: 0, max: 0.04, noNaN: true }),
  gradient: fc.double({ min: 0, max: 0.35, noNaN: true }),
  gradDir: fc.double({ min: 0, max: 6.28, noNaN: true }),
  shadow: fc.double({ min: 0, max: 0.2, noNaN: true }),
  exposure: fc.double({ min: 0.75, max: 1.1, noNaN: true }),
  gamma: fc.double({ min: 0.8, max: 1.3, noNaN: true }),
  seed: fc.integer({ min: 1, max: 1_000_000 }),
}).filter((c) => fitsInFrame(c, 'S') && fitsInFrame(c, 'F'));

export function photo(spec: CardSpec, role: Role, days: number[], adv: number[], cond: PhotoConditions = CLEAN, wave?: Wave, extra: Partial<HalfInstance> = {}) {
  const inst: HalfInstance = { spec, role, days, adv, H: placeHalf(cond, role), wave, ...extra };
  return scanPhoto(renderScene([inst], cond));
}

export const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);
