import { useMemo, useState } from 'react';
import { newCardSpec, type CardSpec } from '../../core/card';
import { randomId } from '../../core/prng';
import { LANGS } from '../../i18n';
import { sheetPdf } from '../../render/pdf';
import { sheetSvg } from '../../render/sheet';
import { saveCard } from '../../store';
import { useApp } from '../ctx';
import { download, printArea } from '../imageIO';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'KES', 'NGN', 'BDT', 'PKR', 'NPR', 'PHP', 'IDR', 'MXN', 'BRL', 'ZAR'];

export function Issue({ initial, draft }: { initial?: CardSpec; draft?: Partial<CardSpec> }) {
  const { settings, toast } = useApp();
  const now = new Date();
  const seed = initial ?? draft;
  const [worker, setWorker] = useState(seed?.worker ?? '');
  const [employer, setEmployer] = useState(seed?.employer ?? '');
  const [ym, setYm] = useState(seed?.year && seed?.month ? `${seed.year}-${String(seed.month).padStart(2, '0')}` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [rate, setRate] = useState(seed?.rateMinor !== undefined ? seed.rateMinor / 100 : 500);
  const [adv, setAdv] = useState(seed?.advMinor !== undefined ? seed.advMinor / 100 : 100);
  const [currency, setCurrency] = useState(seed?.currency ?? 'INR');
  const [lang, setLang] = useState(seed?.lang ?? settings.lang);
  const [id, setId] = useState(initial?.id ?? randomId(8));

  const spec = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    return newCardSpec({ id, year: y || now.getFullYear(), month: m || 1, rateMinor: Math.round(rate * 100), advMinor: Math.round(adv * 100), currency, worker, employer, lang });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ym, rate, adv, currency, worker, employer, lang]);
  const svg = useMemo(() => sheetSvg(spec, lang), [spec, lang]);

  return (
    <div>
      <h1 className="no-print" style={{ fontSize: '2rem' }}>New tally card</h1>
      <div className="grid2">
        <div className="card no-print">
          <div className="field"><label>Worker name</label><input value={worker} maxLength={18} onChange={(e) => setWorker(e.target.value)} placeholder="e.g. Ramesh" /></div>
          <div className="field"><label>Employer / contractor</label><input value={employer} maxLength={18} onChange={(e) => setEmployer(e.target.value)} placeholder="e.g. Sharma Builders" /></div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Month</label><input type="month" value={ym} onChange={(e) => setYm(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>Currency</label><select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: 1 }}><label>Daily wage</label><input type="number" min={0} step="any" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></div>
            <div className="field" style={{ flex: 1 }}><label>One advance token is worth</label><input type="number" min={0} step="any" value={adv} onChange={(e) => setAdv(Number(e.target.value))} /></div>
          </div>
          <div className="field"><label>Language on the card and slip</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
          </div>
          <p className="small muted sans">Advances: a worker takes cash early → punch one of the 10 token spots on both halves. Each is worth the amount above.</p>
          <div className="row">
            <button className="primary" onClick={() => { saveCard(spec); printArea(); }}>🖨 Print &amp; save</button>
            <button onClick={() => { saveCard(spec); toast('Card saved in this browser'); }}>💾 Save only</button>
            <button onClick={() => download(`tally-${spec.id}.svg`, svg, 'image/svg+xml')}>⬇ SVG</button>
            <button onClick={async () => { saveCard(spec); const b = await sheetPdf(svg); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `tally-${spec.id}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }}>⬇ PDF (A4)</button>
            <button className="ghost" onClick={() => setId(randomId(8))} title="Generate a new unique wavy cut">🔀 New wave</button>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary>Printing &amp; punching tips</summary>
            <ol className="sans small">
              <li>Print on A4 at <b>100% / Actual size</b> (not “fit to page”), on thick paper if you can.</li>
              <li>Cut along the <b>wavy line</b>. Hand-cut is best: your cut is the unique signature.</li>
              <li>Give the top half (stock) to the worker, the bottom (foil) to the employer.</li>
              <li>Each day: lay one half exactly on the other, align edges, punch through the day’s circle with a standard 6 mm office punch.</li>
              <li>Keep the halves flat and dry. Never trim the edges.</li>
            </ol>
          </details>
        </div>
        <div>
          <div className="sheetprev print-area" dangerouslySetInnerHTML={{ __html: svg }} />
          <p className="small muted sans no-print" style={{ textAlign: 'center', marginTop: 6 }}>Card {spec.id} · its wavy cut is derived from this id, so no two cards fit together.</p>
        </div>
      </div>
    </div>
  );
}
