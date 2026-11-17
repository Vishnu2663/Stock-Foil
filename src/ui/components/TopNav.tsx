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
export function TopNav({ route, primary, groups, settings }: { route: string; primary: NavItem[]; groups: Group[]; settings: NavItem }) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    setOpenMenu(null);
    setPanel(false);
  }, [route]);

  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) {
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
    const scroll = () => setScrolled(window.scrollY > 4);
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

  return (
    <header className={`top ${scrolled ? 'scrolled' : ''}`} ref={root}>
      <div className="in">
        <a className="brand" href="#/home" aria-label="Stock & Foil home">
          <svg viewBox="0 0 96 96" aria-hidden><rect width="96" height="96" rx="20" fill="#7a1f1f" /><path d="M14 40 Q30 28 48 40 T82 40 V20 H14Z" fill="#f4ead2" /><path d="M14 40 Q30 28 48 40 T82 40 V76 H14Z" fill="#e6d6ad" /><circle cx="30" cy="22" r="5" fill="#7a1f1f" /><circle cx="48" cy="22" r="5" fill="#7a1f1f" /><circle cx="66" cy="22" r="5" fill="#7a1f1f" /><circle cx="30" cy="58" r="5" fill="#7a1f1f" /><circle cx="48" cy="58" r="5" fill="#7a1f1f" /><circle cx="66" cy="58" r="5" fill="#7a1f1f" /></svg>
          <span>Stock &amp; Foil</span>
        </a>
        <button className="burger" aria-expanded={panel} aria-controls="mainnav" aria-label="Menu" onClick={() => setPanel((p) => !p)}>
          <span aria-hidden>{panel ? '✕' : '☰'}</span> <span className="burger-label">Menu</span>
        </button>
        <nav id="mainnav" aria-label="Main" className={panel ? 'open' : ''}>
          {primary.map((i) => (
            <a key={i.route} href={`#/${i.route}`} className={`${route === i.route ? 'on' : ''} ${i.accent ? 'accent' : ''}`} aria-current={route === i.route ? 'page' : undefined}>{i.label}</a>
          ))}
          {groups.map((g) => {
            const active = g.items.some((i) => i.route === route);
            const open = openMenu === g.id;
            return (
              <div key={g.id} data-group={g.id} className={`dd ${open ? 'open' : ''} ${g.items.length > 4 ? 'wide' : ''}`} onKeyDown={menuKeys}>
                <button className={`dd-btn ${active ? 'on' : ''}`} aria-haspopup="true" aria-expanded={open} onClick={() => setOpenMenu(open ? null : g.id)}>
                  {g.label} <span aria-hidden className="caret">▾</span>
                </button>
                <div className="dd-menu" role="menu" aria-label={g.label}>
                  <div className="dd-title">{g.label}</div>
                  {g.items.map((i, n) => (
                    <a key={i.route} role="menuitem" style={{ ['--n' as string]: n }} href={`#/${i.route}`} className={`dd-item ${route === i.route ? 'on' : ''}`} aria-current={route === i.route ? 'page' : undefined}>
                      <span className="dd-ico" aria-hidden>{i.icon}</span>
                      <span className="dd-txt"><b>{i.label}</b>{i.hint && <small>{i.hint}</small>}</span>
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
  );
}
