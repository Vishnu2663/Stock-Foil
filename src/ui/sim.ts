import type { CardSpec } from '../core/card';
import { CLEAN, placeHalf, renderScene, type PhotoConditions } from '../render/scene';
import { makeWave, type Wave } from '../core/wave';
import { scanPhoto } from '../vision/detect';
import type { Captured } from './components/Results';

export interface SimInput {
  spec: CardSpec;
  stockDays: number[];
  foilDays: number[];
  stockAdv?: number[];
  foilAdv?: number[];
  /** second-half circles punched (cards with half-day circles) */
  stockPm?: number[];
  foilPm?: number[];
  /** spec used to print the foil (to simulate a foreign or altered half) */
  foilSpec?: CardSpec;
  foilWave?: Wave;
  condS?: Partial<PhotoConditions>;
  condF?: Partial<PhotoConditions>;
}

export function simulate(i: SimInput): { stock: Captured; foil: Captured } | { error: string } {
  const cs = { ...CLEAN, scale: 4.2, ...i.condS };
  const cf = { ...CLEAN, scale: 4.2, seed: 5, ...i.condF };
  const photoS = renderScene([{ spec: i.spec, role: 'S', days: i.stockDays, pm: i.stockPm, adv: i.stockAdv ?? [], H: placeHalf(cs, 'S') }], cs);
  const photoF = renderScene([{ spec: i.foilSpec ?? i.spec, role: 'F', days: i.foilDays, pm: i.foilPm, adv: i.foilAdv ?? [], H: placeHalf(cf, 'F'), wave: i.foilWave }], cf);
  const ss = scanPhoto(photoS);
  const sf = scanPhoto(photoF);
  if (!ss.halves[0] || !sf.halves[0]) return { error: 'Could not read one of the simulated photos. Try less blur or rotation.' };
  return { stock: { photo: photoS, scan: ss, half: ss.halves[0] }, foil: { photo: photoF, scan: sf, half: sf.halves[0] } };
}

export const forgedWave = (seed: number) => makeWave(seed * 31 + 7);

/** Run `fn` after letting the browser paint a spinner. */
export const defer = <T,>(fn: () => T): Promise<T> => new Promise((res) => setTimeout(() => res(fn()), 30));
