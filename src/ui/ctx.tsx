import { createContext, useContext } from 'react';
import type { Settings } from '../store';
import { t as tr } from '../i18n';

export interface Ctx {
  settings: Settings;
  setSettings: (s: Settings) => void;
  lang: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toast: (msg: string) => void;
}

export const AppCtx = createContext<Ctx>({
  settings: { lang: 'en', aiProvider: 'off', aiNote: true, customUrl: '', customModel: '', customKey: '', speakRate: 0.9 },
  setSettings: () => undefined,
  lang: 'en',
  t: (k) => tr('en', k),
  toast: () => undefined,
});

export const useApp = () => useContext(AppCtx);
