import { useCallback, useEffect, useMemo, useState } from 'react';
import { t as tr } from '../i18n';
import type { CardSpec } from '../core/card';
import { loadCards, loadSettings, saveSettings, type Settings as SettingsT } from '../store';
import { AppCtx } from './ctx';
import { About } from './pages/About';
import { Calibrate } from './pages/Calibrate';
import { Crew } from './pages/Crew';
import { Demo } from './pages/Demo';
import { Story } from './pages/Story';
import { Home } from './pages/Home';
import { Income } from './pages/Income';
import { Issue } from './pages/Issue';
import { Lab } from './pages/Lab';
import { Members } from './pages/Members';
import { Ledger } from './pages/Ledger';
import { History } from './pages/History';
import { Punch } from './pages/Punch';
import { Scan } from './pages/Scan';
import { Settings } from './pages/Settings';
import { TopNav } from './components/TopNav';
import { initReveal, initRipple, initTilt } from './fx';
import { HolesField } from './components/HolesField';

const ROUTES = ['home', 'issue', 'punch', 'scan', 'members', 'crew', 'income', 'calibrate', 'demo', 'story', 'lab', 'history', 'ledger', 'about', 'settings'] as const;
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
    initTilt();
    initRipple();
    return initReveal();
  }, []);
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
    () => ({ settings, setSettings, lang: settings.lang, t: (k: string, v?: Record<string, string | number>) => tr(settings.lang, k, v), toast, startCard: (d: Partial<CardSpec>) => { setDraft(d); go('issue'); } }),
    [settings, setSettings, toast, go],
  );
  const t = ctx.t;
  const primary = [
    { route: 'home', icon: '🏠', label: t('navHome') },
    { route: 'issue', icon: '🪪', label: t('navIssue') },
    { route: 'scan', icon: '📷', label: t('navScan') },
    { route: 'members', icon: '👥', label: 'Members' },
    { route: 'crew', icon: '🧰', label: 'Crew' },
    { route: 'story', icon: '🎃', label: 'Story', accent: true },
  ];
  const groups = [
    { id: 'records', label: 'Records', items: [
      { route: 'history', icon: '🕘', label: 'History', hint: 'Every payday scan, paid or yet to pay' },
      { route: 'ledger', icon: '📒', label: t('navLedger'), hint: 'Receipts, paid status, cards' },
      { route: 'income', icon: '🧾', label: 'Income proof', hint: 'Certificate for a loan or rent' },
    ] },
    { id: 'more', label: 'More', items: [
      { route: 'punch', icon: '⭕', label: t('navPunch'), hint: 'How to punch each day' },
      { route: 'demo', icon: '▶️', label: 'Demo', hint: 'The 4 vs 5 days story' },
      { route: 'lab', icon: '🧪', label: t('navLab'), hint: 'Simulate, forge, stress-test' },
      { route: 'calibrate', icon: '🎯', label: 'Calibrate', hint: 'Tune to your paper and punch' },
      { route: 'about', icon: '📜', label: 'About & security', hint: 'How it is protected, and its limits' },
    ] },
  ];
  /** edit a saved card: the printed halves cannot change, so it becomes a revised card that replaces it */
  const editCard = (c: CardSpec) => {
    setDraft({ worker: c.worker, employer: c.employer, year: c.year, month: c.month, rateMinor: c.rateMinor, advMinor: c.advMinor, currency: c.currency, lang: c.lang, carryMinor: c.carryMinor, revisedFrom: c.id });
    go('issue');
  };
  const reprint = reprintId ? loadCards().find((c) => c.id === reprintId) : undefined;

  return (
    <AppCtx.Provider value={ctx}>
      <div className="ambient" aria-hidden><i /><i /><i /></div>
      <HolesField />
      <TopNav route={route} primary={primary} groups={groups} settings={{ route: 'settings', label: 'Settings' }} />
      <main className="wrap" key={route}>
        {route === 'home' && <Home go={go} />}
        {route === 'issue' && <Issue key={reprintId ?? (draft ? JSON.stringify(draft) : 'new')} initial={reprint} draft={draft ?? undefined} />}
        {route === 'members' && <Members go={go} newCardFor={(d) => { setDraft(d); go('issue'); }} />}
        {route === 'punch' && <Punch />}
        {route === 'scan' && <Scan />}
        {route === 'crew' && <Crew go={go} />}
        {route === 'income' && <Income />}
        {route === 'calibrate' && <Calibrate />}
        {route === 'demo' && <Demo />}
        {route === 'story' && <Story go={go} />}
        {route === 'lab' && <Lab />}
        {route === 'history' && <History go={go} />}
        {route === 'ledger' && <Ledger go={(r) => { setReprintId(null); go(r); }} reprint={(id) => { setReprintId(id); go('issue'); }} edit={editCard} />}
        {route === 'about' && <About />}
        {route === 'settings' && <Settings />}
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
