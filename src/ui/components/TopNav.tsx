import { useEffect, useRef, useState } from 'react';

export interface NavItem { route: string; label: string; hint?: string; icon?: string; accent?: boolean }
interface Group { id: string; label: string; items: NavItem[] }

/** Feather "settings" icon (MIT), drawn at a size that is easy to hit. */
function Gear() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="gear">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/**
 * Compact header: everyday pages stay visible; the rest live in two dropdown panels
 * (icon tile, title and hint per item; two columns for the long one). On phones it
 * collapses to a menu button with the same items as a list. Keyboard: Escape closes,
 * ArrowDown/Up/Home/End move through a menu, and menus are ordinary links.
 */
/** Section tiles: one line-icon language and a colour per section. */
const NAV_HUE: Record<string, string> = { home: '#f0a24b', issue: '#6aa9ff', scan: '#ff6a55', members: '#9be37a', crew: '#e0925f', story: '#ff8a3d', records: '#6fd39a', more: '#b99cff' };
function NavIcon({ id, fallback }: { id: string; fallback?: string }) {
  const g: Record<string, JSX.Element> = {
    home: <><path d="M4 11l8-6.5 8 6.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
    issue: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10.5h18M7 15h4" /></>,
    scan: <><path d="M4 8V6.5A2.5 2.5 0 0 1 6.5 4H8M16 4h1.5A2.5 2.5 0 0 1 20 6.5V8M20 16v1.5a2.5 2.5 0 0 1-2.5 2.5H16M8 20H6.5A2.5 2.5 0 0 1 4 17.5V16" /><circle cx="12" cy="12" r="3" /></>,
    members: <><circle cx="9" cy="9" r="3" /><path d="M3.5 19c.5-3 2.7-4.5 5.5-4.5s5 1.5 5.5 4.5" /><circle cx="17" cy="9.5" r="2.4" /><path d="M15.5 14.6c2.6-.3 4.5.9 5 3.9" /></>,
    crew: <><rect x="3.5" y="8" width="17" height="11" rx="2.5" /><path d="M9 8V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5V8M3.5 13h17M11 13v2h2v-2" /></>,
    story: <path d="M12 3c1 3.2 4.5 5 4.5 9.2A4.5 4.5 0 0 1 12 17c-2.5 0-4.5-1.9-4.5-4.4 0-1.7.9-2.8 1.8-3.8.2 1.2.8 2 1.6 2.4C10.5 8 11 5.5 12 3zM8 19.5c1 .9 2.4 1.5 4 1.5s3-.6 4-1.5" />,
    records: <><path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" /><path d="M9 9h6M9 12.5h6" /></>,
    more: <><circle cx="7" cy="7" r="1.7" /><circle cx="17" cy="7" r="1.7" /><circle cx="7" cy="17" r="1.7" /><circle cx="17" cy="17" r="1.7" /></>,
  };
  const icon = g[id];
  return <span className="nav-ic" aria-hidden>{icon ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">{icon}</svg> : fallback}</span>;
}

/** Line icons for the dropdown tiles: one visual language instead of mixed emoji. */
const DD_HUE: Record<string, string> = { history: '#f0a24b', ledger: '#e0925f', income: '#6fd39a', punch: '#ff6a55', demo: '#6aa9ff', lab: '#9be37a', calibrate: '#ff8a3d', about: '#b99cff' };
function DdIcon({ route, fallback }: { route: string; fallback: string }) {
  const p: Record<string, JSX.Element> = {
    history: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
    ledger: <><path d="M5 4.5h11a2 2 0 0 1 2 2V20H7a2 2 0 0 1-2-2z" /><path d="M9 9h6M9 12.5h6" /></>,
    income: <><rect x="4" y="5" width="16" height="12" rx="2" /><circle cx="12" cy="11" r="2.4" /><path d="M9 20l3-2.5 3 2.5" /></>,
    punch: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2.4" /></>,
    demo: <><rect x="3.5" y="5" width="17" height="14" rx="3" /><path d="M10.5 9.5l4.5 2.5-4.5 2.5z" /></>,
    lab: <><path d="M9.5 4h5M10.5 4v5.5L5.8 18a1.8 1.8 0 0 0 1.6 2.7h9.2a1.8 1.8 0 0 0 1.6-2.7L13.5 9.5V4" /><path d="M8 15h8" /></>,
    calibrate: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" /></>,
    about: <><path d="M12 3.5l7 2.8v5.4c0 4.3-2.9 7.3-7 8.8-4.1-1.5-7-4.5-7-8.8V6.3z" /><path d="M9 12l2.2 2.2L15.2 10" /></>,
  };
  const g = p[route];
  if (!g) return <>{fallback}</>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="21" height="21">{g}</svg>;
}

export function TopNav({ route, primary, groups, settings }: { route: string; primary: NavItem[]; groups: Group[]; settings: NavItem }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const root = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [prog, setProg] = useState(0);
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number; tone: 'red' | 'accent'; away: boolean } | null>(null);

  useEffect(() => {
    setOpenMenu(null);
    setPanel(false);
  }, [route]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node) && !(e.target as Element).closest?.('.mtabs')) {
        setOpenMenu(null);
        setPanel(false);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setPanel(false);
      }
    };
    const scroll = () => setScrolled((was) => (window.scrollY > 70 ? true : window.scrollY < 24 ? false : was));
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', scroll, { passive: true });
    scroll();
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', scroll);
    };
  }, []);

  /** the nav items the gliding pill can sit under (not Settings, which has its own look) */
  const pillItems = () => Array.from(navRef.current?.querySelectorAll<HTMLElement>(':scope > a:not(.settings-btn), :scope .dd-btn') ?? []);
  const activeItem = () => pillItems().find((e) => e.classList.contains('on')) ?? null;
  const placePill = (el: HTMLElement | null, away: boolean) => {
    const nav = navRef.current;
    if (!el || !nav || !window.matchMedia('(min-width: 1001px)').matches) { setPill(null); return; }
    const n = nav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ x: r.left - n.left, y: r.top - n.top, w: r.width, h: r.height, tone: el.classList.contains('accent') ? 'accent' : 'red', away });
  };
  // settle under the current page, and re-measure on resize / once fonts have loaded
  useEffect(() => {
    const settle = () => placePill(activeItem(), false);
    const id = requestAnimationFrame(settle);
    window.addEventListener('resize', settle);
    document.fonts?.ready.then(settle).catch(() => undefined);
    return () => { cancelAnimationFrame(id); window.removeEventListener('resize', settle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
  useEffect(() => {
    // the tiles shrink when the page scrolls: measure again once that has settled
    const t = setTimeout(() => placePill(activeItem(), false), 340);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolled]);
  useEffect(() => {
    const on = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProg(h > 0 ? Math.min(1, window.scrollY / h) : 0);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [route]);

  /** Arrow-key navigation inside one dropdown. */
  const menuKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const box = e.currentTarget; // React clears currentTarget after the handler returns, so keep it
    const items = () => Array.from(box.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    const btn = box.querySelector<HTMLElement>('.dd-btn');
    const list = items();
    const at = list.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % list.length;
    else if (e.key === 'ArrowUp') next = at <= 0 ? list.length - 1 : at - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    else if (e.key === 'Escape') {
      setOpenMenu(null);
      btn?.focus();
      return;
    }
    if (next >= 0) {
      e.preventDefault();
      setOpenMenu(box.dataset.group ?? null);
      // the menu may have just opened: focus once it has rendered
      setTimeout(() => items()[next]?.focus(), 30);
    }
  };

  const tabs = ['home', 'issue', 'scan', 'members'].map((r) => primary.find((i) => i.route === r)).filter((i): i is NavItem => !!i);
  return (
    <>
    <header className={`top ${scrolled ? 'scrolled' : ''}`} ref={root}>
      <i className="scroll-progress" style={{ transform: `scaleX(${prog})` }} aria-hidden />
      <div className="in">
        <a className="brand" href="#/home" aria-label="Stock & Foil home">
          <svg viewBox="0 0 96 96" aria-hidden><rect width="96" height="96" rx="20" fill="#7a1f1f" /><path d="M14 40 Q30 28 48 40 T82 40 V20 H14Z" fill="#f4ead2" /><path d="M14 40 Q30 28 48 40 T82 40 V76 H14Z" fill="#e6d6ad" /><circle cx="30" cy="22" r="5" fill="#7a1f1f" /><circle cx="48" cy="22" r="5" fill="#7a1f1f" /><circle cx="66" cy="22" r="5" fill="#7a1f1f" /><circle cx="30" cy="58" r="5" fill="#7a1f1f" /><circle cx="48" cy="58" r="5" fill="#7a1f1f" /><circle cx="66" cy="58" r="5" fill="#7a1f1f" /></svg>
          <span className="wm" aria-hidden>
            <b>Stock</b>
            <svg className="wm-cut" viewBox="0 0 120 8" preserveAspectRatio="none"><path d="M0 4 Q10 0 20 4 T40 4 T60 4 T80 4 T100 4 T120 4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="4 3" strokeLinecap="round" /></svg>
            <b>&amp; Foil</b>
          </span>
        </a>
        <button className="burger" aria-expanded={panel} aria-controls="mainnav" aria-label="Menu" onClick={() => setPanel((p) => !p)}>
          <span className="bars" aria-hidden><i /><i /><i /></span> <span className="burger-label">Menu</span>
        </button>
        <a href={`#/${settings.route}`} className={`settings-top ${route === settings.route ? 'on' : ''}`} aria-label={settings.label} aria-current={route === settings.route ? 'page' : undefined}>
          <Gear />
          <span className="settings-label">{settings.label}</span>
        </a>
        <nav
          id="mainnav"
          ref={navRef}
          aria-label="Main"
          className={`${panel ? 'open' : ''} ${pill ? 'has-pill' : ''} ${pill?.away ? 'away' : ''}`}
          onPointerOver={(e) => {
            const it = (e.target as HTMLElement).closest<HTMLElement>('#mainnav > a:not(.settings-btn), #mainnav .dd-btn');
            if (it && navRef.current?.contains(it)) placePill(it, it !== activeItem());
          }}
          onPointerLeave={() => placePill(activeItem(), false)}
        >
          {pill && <span className="nav-pill" data-tone={pill.tone} style={{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: pill.w, height: pill.h }} aria-hidden />}
          {primary.map((i) => (
            <a key={i.route} href={`#/${i.route}`} style={{ ['--hue' as string]: NAV_HUE[i.route] ?? '#ff8a3d' }} className={`${route === i.route ? 'on' : ''} ${i.accent ? 'accent' : ''}`} aria-current={route === i.route ? 'page' : undefined}><NavIcon id={i.route} fallback={i.icon} /><span className="nav-lbl">{i.label}</span></a>
          ))}
          {groups.map((g) => {
            const active = g.items.some((i) => i.route === route);
            const open = openMenu === g.id;
            return (
              <div key={g.id} data-group={g.id} className={`dd ${open ? 'open' : ''} ${g.items.length > 4 ? 'wide' : ''}`} onKeyDown={menuKeys}>
                <button className={`dd-btn ${active ? 'on' : ''}`} style={{ ['--hue' as string]: NAV_HUE[g.id] ?? '#ff8a3d' }} aria-haspopup="true" aria-expanded={open} onClick={() => setOpenMenu(open ? null : g.id)}>
                  <NavIcon id={g.id} /><span className="nav-lbl">{g.label} <span aria-hidden className="caret">▾</span></span>
                </button>
                <div className="dd-menu" role="menu" aria-label={g.label}>
                  <div className="dd-title">{g.label}</div>
                  {g.items.map((i, n) => (
                    <a key={i.route} role="menuitem" style={{ ['--n' as string]: n, ['--hue' as string]: DD_HUE[i.route] ?? '#ff8a3d' }} href={`#/${i.route}`} className={`dd-item ${route === i.route ? 'on' : ''}`} aria-current={route === i.route ? 'page' : undefined}>
                      <span className="dd-ico" aria-hidden><DdIcon route={i.route} fallback={i.icon ?? ''} /></span>
                      <span className="dd-txt"><b>{i.label}</b>{i.hint && <small>{i.hint}</small>}</span>
                      <span className="dd-go" aria-hidden>›</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
          <a href={`#/${settings.route}`} className={`settings-btn ${route === settings.route ? 'on' : ''}`} aria-label={settings.label} title={settings.label} aria-current={route === settings.route ? 'page' : undefined}>
            <Gear />
            <span className="settings-label">{settings.label}</span>
          </a>
        </nav>
      </div>
    </header>
    {/* phones: the sections you use every day sit under the thumb; everything else is in the More sheet */}
    <nav className="mtabs" aria-label="Main">
      {tabs.map((i) => (
        <a key={i.route} href={`#/${i.route}`} className={`mtab ${route === i.route ? 'on' : ''} ${i.route === 'scan' ? 'main' : ''}`} style={{ ['--hue' as string]: NAV_HUE[i.route] ?? '#ff8a3d' }} aria-current={route === i.route ? 'page' : undefined}>
          <NavIcon id={i.route} fallback={i.icon} /><span>{i.label}</span>
        </a>
      ))}
      <button className={`mtab more ${panel ? 'on' : ''}`} style={{ ['--hue' as string]: NAV_HUE.more }} aria-expanded={panel} aria-controls="mainnav" onClick={() => setPanel((p) => !p)}>
        <NavIcon id="more" /><span>More</span>
      </button>
    </nav>
    {panel && <div className="sheet-dim" onClick={() => setPanel(false)} aria-hidden />}
    </>
  );
}
