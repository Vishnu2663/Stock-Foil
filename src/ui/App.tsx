import { useCallback, useEffect, useMemo, useState } from 'react';
import { t as tr } from '../i18n';
import type { CardSpec } from '../core/card';
import { loadCards, loadSettings, saveSettings, type Settings as SettingsT } from '../store';
import { AppCtx } from './ctx';
import { About } from './pages/About';
import { Crew } from './pages/Crew';
import { Demo } from './pages/Demo';
import { Haunt } from './pages/Haunt';
import { Home } from './pages/Home';
import { Issue } from './pages/Issue';
import { Lab } from './pages/Lab';
import { Members } from './pages/Members';
import { Ledger } from './pages/Ledger';
import { Punch } from './pages/Punch';
import { Scan } from './pages/Scan';
import { Settings } from './pages/Settings';

const ROUTES = ['home', 'issue', 'punch', 'scan', 'members', 'crew', 'demo', 'haunt', 'lab', 'ledger', 'about', 'settings'] as const;
type Route = (typeof ROUTES)[number];

const readRoute = (): Route => {
  const h = location.hash.replace(/^#\/?/, '').split('?')[0] as Route;
  return (ROUTES as readonly string[]).includes(h) ? h : 'home';
};

export function App() {
  const [route, setRoute] = useState<Route>(readRoute);
  const [settings, setSettingsState] = useState<SettingsT>(loadSettings);
  const [toastMsg, setToastMsg] = useState('');
  const [reprintId, setReprintId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<CardSpec> | null>(null);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (route !== 'issue') { setReprintId(null); setDraft(null); }
  }, [route]);
  useEffect(() => {
    document.documentElement.lang = settings.lang;
  }, [settings.lang]);

  const go = useCallback((r: string) => {
    location.hash = `#/${r}`;
    window.scrollTo(0, 0);
  }, []);
  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg(''), 2600);
  }, []);
  const setSettings = useCallback((s: SettingsT) => {
    setSettingsState(s);
    saveSettings(s);
  }, []);

  const ctx = useMemo(
    () => ({ settings, setSettings, lang: settings.lang, t: (k: string, v?: Record<string, string | number>) => tr(settings.lang, k, v), toast }),
    [settings, setSettings, toast],
  );
  const t = ctx.t;
  const nav: [Route, string][] = [
    ['home', t('navHome')],
    ['issue', t('navIssue')],
    ['punch', t('navPunch')],
    ['scan', t('navScan')],
    ['members', 'Members'],
    ['crew', 'Crew'],
    ['demo', '▶ Demo'],
    ['haunt', '🎃 Story mode'],
    ['lab', t('navLab')],
    ['ledger', t('navLedger')],
    ['about', t('navAbout')],
    ['settings', '⚙'],
  ];
  const reprint = reprintId ? loadCards().find((c) => c.id === reprintId) : undefined;

  return (
    <AppCtx.Provider value={ctx}>
      <header className="top">
        <div className="in">
          <a className="brand" href="#/home" aria-label="Stock & Foil home">
            <svg viewBox="0 0 96 96" aria-hidden><rect width="96" height="96" rx="20" fill="#7a1f1f" /><path d="M14 40 Q30 28 48 40 T82 40 V20 H14Z" fill="#f4ead2" /><path d="M14 40 Q30 28 48 40 T82 40 V76 H14Z" fill="#e6d6ad" /><circle cx="30" cy="22" r="5" fill="#7a1f1f" /><circle cx="48" cy="22" r="5" fill="#7a1f1f" /><circle cx="66" cy="22" r="5" fill="#7a1f1f" /><circle cx="30" cy="58" r="5" fill="#7a1f1f" /><circle cx="48" cy="58" r="5" fill="#7a1f1f" /><circle cx="66" cy="58" r="5" fill="#7a1f1f" /></svg>
            Stock &amp; Foil
          </a>
          <nav aria-label="Main">
            {nav.map(([r, label]) => (
              <a key={r} href={`#/${r}`} className={route === r ? 'on' : ''}>{label}</a>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">
        {route === 'home' && <Home go={go} />}
        {route === 'issue' && <Issue key={reprintId ?? (draft ? JSON.stringify(draft) : 'new')} initial={reprint} draft={draft ?? undefined} />}
        {route === 'members' && <Members go={go} newCardFor={(d) => { setDraft(d); go('issue'); }} />}
        {route === 'punch' && <Punch />}
        {route === 'scan' && <Scan />}
        {route === 'crew' && <Crew go={go} />}
        {route === 'demo' && <Demo />}
        {route === 'haunt' && <Haunt />}
        {route === 'lab' && <Lab />}
        {route === 'ledger' && <Ledger go={(r) => { setReprintId(null); go(r); }} reprint={(id) => { setReprintId(id); go('issue'); }} />}
        {route === 'about' && <About />}
        {route === 'settings' && <Settings />}
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
