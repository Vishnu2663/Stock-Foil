import { useMemo, useState } from 'react';
import { MAX_AMOUNT_MAJOR, MAX_CARRY_MAJOR, newCardSpec, type CardSpec } from '../../core/card';
import { MonthPicker } from '../components/MonthPicker';
import { AmountInput } from '../components/AmountInput';
import { randomId } from '../../core/prng';
import { newPairing, type Pairing } from '../../core/pairing';
import { LANGS } from '../../i18n';
import { sheetPdf } from '../../render/pdf';
import { sheetSvg } from '../../render/sheet';
import { deleteCard, saveCard } from '../../store';
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
  const [carry, setCarry] = useState(seed?.carryMinor !== undefined ? seed.carryMinor / 100 : 0);
  const [id, setId] = useState(initial?.id ?? randomId(8));
  const editing = draft?.revisedFrom; // set when this form edits an already-saved card
  const reprinting = !!initial;
  const [paired, setPaired] = useState(initial ? !!initial.pairing : true);
  const [pairing, setPairing] = useState<Pairing>(initial?.pairing ?? newPairing());

  const spec = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    return newCardSpec({ id, year: y || now.getFullYear(), month: m || 1, rateMinor: Math.round(rate * 100), advMinor: Math.round(adv * 100), currency, worker, employer, lang, carryMinor: Math.round(carry * 100), pairing: paired ? pairing : undefined, revisedFrom: editing });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ym, rate, adv, currency, worker, employer, lang, carry, paired, pairing, editing]);
  const svg = useMemo(() => sheetSvg(spec, lang), [spec, lang]);
  /** save the card; an edited card replaces the one it revises */
  const persist = () => {
    if (spec.revisedFrom) deleteCard(spec.revisedFrom);
    saveCard(spec);
  };

  return (
    <div>
      <h1 className="no-print" style={{ fontSize: '2rem' }}>{editing ? 'Edit card' : reprinting ? 'Reprint card' : 'New tally card'}</h1>
      {editing && (
        <div className="card flat sans no-print" style={{ marginBottom: 14, borderColor: 'var(--amber)' }}>
          <b>✎ Editing card <span className="mono">{editing}</span>.</b> The paper already printed cannot change, so saving makes a <b>new card</b> (new cut line and pairing code) that <b>replaces</b> the old one in your list. Print and cut both halves again and use the new card from now on. Days already punched on the old card stay on that old paper.
          <div className="small muted">Raise starting mid-month? Keep this card and apply the new wage at payday instead (Payday scan → “Wage changed this month?”).</div>
        </div>
      )}
      <div className="grid2">
        <div className="card no-print issue-form">
          <div className="fs-h"><span>1</span> Who is this card for?</div>
          <div className="field"><label>Worker name</label><input value={worker} maxLength={18} onChange={(e) => setWorker(e.target.value)} placeholder="e.g. Ramesh" /></div>
          <div className="field"><label>Employer / contractor</label><input value={employer} maxLength={18} onChange={(e) => setEmployer(e.target.value)} placeholder="e.g. Sharma Builders" /></div>
          <div className="fs-h"><span>2</span> Month &amp; pay</div>
          <div className="row fs-row">
            <MonthPicker label="Month" value={ym} onChange={setYm} />
            <div className="field" style={{ flex: 1 }}><label>Currency</label><select value={currency} onChange={(e) => setCurrency(e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="row fs-row">
            <AmountInput label="Daily wage" value={rate} onChange={setRate} max={MAX_AMOUNT_MAJOR} />
            <AmountInput label="One advance token is worth" value={adv} onChange={setAdv} max={MAX_AMOUNT_MAJOR} />
          </div>
          <div className="field"><label>Balance brought forward (optional)</label><input type="number" step="any" min={-MAX_CARRY_MAJOR} max={MAX_CARRY_MAJOR} value={carry} onChange={(e) => setCarry(Math.max(-MAX_CARRY_MAJOR, Math.min(MAX_CARRY_MAJOR, Number(e.target.value) || 0)))} />
            <div className="small muted sans">Negative = the worker still owes this from last month and it is deducted. Positive = the employer still owes it. It is printed on the card and locked into its code, so it cannot be changed later.</div></div>
          <div className="fs-h"><span>3</span> Options</div>
          <label className={`switch ${paired ? 'on' : ''} ${reprinting ? 'dis' : ''}`}>
            <input type="checkbox" checked={paired} disabled={reprinting} onChange={(e) => setPaired(e.target.checked)} />
            <i aria-hidden />
            <span><b>Pairing code</b> <em className="pill ok">recommended</em>
              <small>{reprinting ? 'A reprint keeps the card exactly as it was.' : 'The QR carries a secret that must match the other half, so a sloppy cut never fails a genuine pair and the other half cannot be faked.'}</small>
            </span>
          </label>
          <div className="field"><label>Language on the card and slip</label>
            <select value={lang} onChange={(e) => setLang(e.target.value)}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
          </div>
          <p className="note-line sans">💡 Advances: a worker takes cash early → punch one of the 10 token spots on both halves. Each is worth the token amount above.</p>
          <div className="actionbar">
            <button className="primary big" onClick={() => { persist(); printArea(); }}>🖨 Print &amp; save</button>
            <button onClick={() => { persist(); toast(editing ? 'Revised card saved (it replaces the old one)' : 'Card saved in this browser'); }}>💾 Save only</button>
            <button onClick={() => download(`tally-${spec.id}.svg`, svg, 'image/svg+xml')}>⬇ SVG</button>
            <button onClick={async () => { persist(); const b = await sheetPdf(svg); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `tally-${spec.id}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }}>⬇ PDF (A4)</button>
            <button className="ghost" onClick={() => { setId(randomId(8)); setPairing(newPairing()); }} title="Generate a new unique wavy cut">🔀 New wave</button>
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
