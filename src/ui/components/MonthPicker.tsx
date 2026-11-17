import { useEffect, useRef, useState } from 'react';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Themed month chooser (replaces the browser's grey native picker). value is "YYYY-MM". */
export function MonthPicker({ value, onChange, label }: { value: string; onChange: (ym: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  const [y0, m0] = value.split('-').map(Number);
  const [year, setYear] = useState(y0);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => setYear(y0), [y0]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  const pick = (m: number) => { onChange(`${year}-${String(m).padStart(2, '0')}`); setOpen(false); };
  const now = new Date();
  return (
    <div className="field mp" ref={box}>
      {label && <label>{label}</label>}
      <button type="button" className="mp-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>{MON[m0 - 1]} {y0}</span><span aria-hidden>📅</span>
      </button>
      {open && (
        <div className="mp-pop" role="dialog" aria-label="Choose month">
          <div className="mp-year">
            <button type="button" className="sm ghost" aria-label="Previous year" onClick={() => setYear(year - 1)}>‹</button>
            <b>{year}</b>
            <button type="button" className="sm ghost" aria-label="Next year" onClick={() => setYear(year + 1)}>›</button>
          </div>
          <div className="mp-grid">
            {MON.map((n, i) => (
              <button type="button" key={n} className={`mp-m ${year === y0 && i + 1 === m0 ? 'on' : ''}`} onClick={() => pick(i + 1)}>{n}</button>
            ))}
          </div>
          <button type="button" className="sm ghost mp-today" onClick={() => { setYear(now.getFullYear()); onChange(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`); setOpen(false); }}>This month</button>
        </div>
      )}
    </div>
  );
}
