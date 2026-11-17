import { useEffect, useMemo, useRef, useState } from 'react';
import { explainPay } from '../../ai';
import { daysInMonth, firstWeekday, formatMoney } from '../../core/card';
import { weekdayShort, monthName, t } from '../../i18n';
import { addCrew, addReceipt, loadReceipts } from '../../store';
import { paymentStatus, payable } from '../../core/settlement';
import type { HalfScan, PhotoScan, CellReading } from '../../vision/detect';
import type { RGBA } from '../../vision/image';
import { verifyPair } from '../../vision/pair';
import { useApp } from '../ctx';
import { downloadPhoto, drawOverlay } from '../imageIO';
import { LangPicker, Slip } from './Slip';

export interface Captured {
  photo: RGBA;
  scan: PhotoScan;
  half: HalfScan;
}

type Edits = Record<string, boolean>;
const key = (role: string, kind: string, n: number) => `${role}:${kind}:${n}`;

function applyEdits(h: HalfScan, edits: Edits): HalfScan {
  const fix = (c: CellReading): CellReading => {
    const e = edits[key(h.payload.role, c.kind, c.n)];
    return e === undefined ? c : { ...c, punched: e, manual: true, uncertain: false };
  };
  return { ...h, days: h.days.map(fix), adv: h.adv.map(fix) };
}

export function Results({ stock, foil, onReset }: { stock: Captured; foil: Captured; onReset: () => void }) {
  const { settings, t: tt, toast, startCard } = useApp();
  const [lang, setLang] = useState(stock.half.payload.spec.lang || settings.lang);
  const [edits, setEdits] = useState<Edits>({});
  const [sel, setSel] = useState<number | null>(null);
  const [showSlip, setShowSlip] = useState(false);
  const [explain, setExplain] = useState<{ text: string; source: 'ai' | 'offline' } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [paidTick, setPaidTick] = useState(0);
  const cs = useRef<HTMLCanvasElement>(null);
  const cf = useRef<HTMLCanvasElement>(null);

  const sH = useMemo(() => applyEdits(stock.half, edits), [stock, edits]);
  const fH = useMemo(() => applyEdits(foil.half, edits), [foil, edits]);
  const r = useMemo(() => verifyPair(sH, fH, { alignTolMm: settings.calibration.alignTolMm }), [sH, fH, settings.calibration.alignTolMm]);
  const { spec } = r;

  useEffect(() => {
    if (cs.current) drawOverlay(cs.current, stock.photo, stock.scan, sH, r.cmp.dayStatus, r.cmp.advStatus);
    if (cf.current) drawOverlay(cf.current, foil.photo, foil.scan, fH, r.cmp.dayStatus, r.cmp.advStatus);
  }, [stock, foil, sH, fH, r]);

  const unreliable = r.verdict === 'unreliable';
  const cls = r.verdict === 'genuine-consistent' ? 'ok' : r.verdict === 'pair-mismatch' || unreliable ? 'bad' : 'warn';
  const icon = cls === 'ok' ? '✅' : cls === 'bad' ? '⛔' : '⚠️';
  const title = r.verdict === 'genuine-consistent' ? t(lang, 'vGenuine') : r.verdict === 'genuine-disputed' ? t(lang, 'vDisputed') : r.verdict === 'inconclusive' ? t(lang, 'vInconclusive') : r.verdict === 'review' ? t(lang, 'vReview') : unreliable ? t(lang, 'vUnreliable') : t(lang, 'vMismatch');
  const m = (v: number) => formatMoney(v, spec.currency, lang);
  const monthKey = `${spec.year}-${String(spec.month).padStart(2, '0')}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const status = useMemo(() => paymentStatus(loadReceipts(), spec.id, monthKey, r.pay.agreed.netMinor), [spec.id, monthKey, r.pay.agreed.netMinor, paidTick, saved]);
  const net = r.pay.agreed.netMinor;
  const carry = r.pay.agreed.carryMinor;
  const nextMonth = spec.month === 12 ? { year: spec.year + 1, month: 1 } : { year: spec.year, month: spec.month + 1 };
  const markPaid = async () => {
    await addReceipt({ cardId: spec.id, month: monthKey, worker: spec.worker, employer: spec.employer, verdict: 'paid', agreedDays: [], stockOnlyDays: [], foilOnlyDays: [], agreedAdv: 0, netMinor: payable(net), disputedMinor: r.pay.disputedMinor, currency: spec.currency });
    setPaidTick((n) => n + 1);
    toast(`Recorded: ${formatMoney(payable(net), spec.currency, lang)} paid`);
  };
  const nDays = daysInMonth(spec.year, spec.month);
  const off = firstWeekday(spec.year, spec.month);
  const sus = new Set(r.alignment.flagged.filter((f) => f.kind === 'day').map((f) => f.n));
  const uncertain = new Set(r.uncertainCells.filter((u) => u.kind === 'day').map((u) => u.n));
  const warnings = [...stock.half.warnings.map((w) => `Stock: ${w}`), ...foil.half.warnings.map((w) => `Foil: ${w}`)];

  const cellVal = (h: HalfScan, kind: 'day' | 'adv', n: number) => (kind === 'day' ? h.days : h.adv).find((c) => c.n === n)?.punched ?? false;
  const toggle = (role: 'S' | 'F', kind: 'day' | 'adv', n: number) => {
    const cur = cellVal(role === 'S' ? sH : fH, kind, n);
    setEdits((e) => ({ ...e, [key(role, kind, n)]: !cur }));
    setSaved(false);
  };

  const doExplain = async () => {
    setBusy(true);
    setExplain(await explainPay(settings, r, lang));
    setBusy(false);
  };
  const save = async () => {
    await addReceipt({
      cardId: spec.id,
      month: `${spec.year}-${String(spec.month).padStart(2, '0')}`,
      worker: spec.worker,
      employer: spec.employer,
      verdict: r.verdict,
      agreedDays: r.cmp.agreedDays,
      stockOnlyDays: r.cmp.stockOnlyDays,
      foilOnlyDays: r.cmp.foilOnlyDays,
      agreedAdv: r.cmp.agreedAdv.length,
      netMinor: r.pay.agreed.netMinor,
      disputedMinor: r.pay.disputedMinor,
      currency: spec.currency,
    });
    setSaved(true);
    toast('Saved to the tamper-evident ledger');
  };

  const selStatus = sel ? r.cmp.dayStatus[sel - 1] : null;

  return (
    <div>
      <div className={`verdict ${cls}`} role="status">
        <span className="big">{icon}</span>
        <div>
          <h2>{title}</h2>
          <div className="small muted sans">
            {monthName(lang, spec.month)} {spec.year} · {spec.worker || '—'} / {spec.employer || '—'} · {t(lang, 'cardCode')} {r.code}
          </div>
        </div>
        <div style={{ marginLeft: 'auto' }} className="no-print">
          <LangPicker value={lang} onChange={(l) => { setLang(l); setExplain(null); }} />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card flat sans small" style={{ marginBottom: 14, borderColor: 'var(--amber)' }}>
          {warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}

      <div className="grid2">
        <div className="card">
          <h3>Checks</h3>
          <ul className="checks">
            {r.checks.map((c) => (
              <li key={c.label}>
                <span className={`ic ${c.ok === true ? 't' : c.ok === false ? 'f' : 'n'}`}>{c.ok === true ? '✓' : c.ok === false ? '✗' : '?'}</span>
                <span>
                  <b>{c.label}</b>
                  <br />
                  <span className="muted">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Days · tap a day to review or correct</h3>
          <div className="cal">
            {Array.from({ length: 7 }, (_, i) => (
              <div className="h" key={i}>{weekdayShort(lang, i)}</div>
            ))}
            {Array.from({ length: off }, (_, i) => (
              <button key={'b' + i} className="blank" disabled />
            ))}
            {Array.from({ length: nDays }, (_, i) => {
              const d = i + 1;
              const st = r.cmp.dayStatus[i] ?? 'none';
              return (
                <button key={d} className={`${st} ${uncertain.has(d) ? 'unsure' : ''} ${sus.has(d) ? 'sus' : ''} ${sel === d ? 'sel' : ''}`} onClick={() => setSel(sel === d ? null : d)} title={st}>
                  {d}
                  <small>{sus.has(d) ? '⚠' : st === 'both' ? '●●' : st === 'stockOnly' ? '●○' : st === 'foilOnly' ? '○●' : ''}</small>
                </button>
              );
            })}
          </div>
          <div className="small muted sans" style={{ marginTop: 8 }}>
            ●● both halves · ●○ worker only · ○● employer only · dashed = unsure · ⚠ hole looks separately made
          </div>
          {sel && (
            <div className="card flat sans" style={{ marginTop: 10 }}>
              <b>Day {sel}</b> <span className="pill">{selStatus}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <button className="sm" onClick={() => toggle('S', 'day', sel)}>Worker half: {cellVal(sH, 'day', sel) ? 'punched' : 'not punched'} ⇄</button>
                <button className="sm" onClick={() => toggle('F', 'day', sel)}>Employer half: {cellVal(fH, 'day', sel) ? 'punched' : 'not punched'} ⇄</button>
              </div>
              <div className="small muted" style={{ marginTop: 6 }}>Correct only what the camera got wrong. Fixes are marked as manual.</div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pay</h3>
        {unreliable && <p className="small sans" style={{ color: 'var(--bad)' }}>⛔ Do not pay from this scan. The photos were not read reliably, so the numbers below may be wrong. Retake both photos with the whole half in view.</p>}
        <div className="formula">
          <span>{r.pay.agreed.days}</span>
          <span className="op">days ×</span>
          <span>{m(spec.rateMinor)}</span>
          <span className="op">−</span>
          <span>{r.pay.agreed.advances} × {m(spec.advMinor)}</span>
          {carry !== 0 && <><span className="op">{carry < 0 ? '−' : '+'}</span><span title="balance brought forward from last month">{m(Math.abs(carry))} b/f</span></>}
          <span className="op">=</span>
          <span className="total">{m(r.pay.agreed.netMinor)}</span>
        </div>
        <table className="t" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>View</th><th>Days</th><th>Advances</th><th>Net</th></tr>
          </thead>
          <tbody>
            <tr><td>✅ Agreed (both halves)</td><td>{r.pay.agreed.days}</td><td>{r.pay.agreed.advances}</td><td><b>{m(r.pay.agreed.netMinor)}</b></td></tr>
            <tr><td>Worker half alone</td><td>{r.pay.workerView.days}</td><td>{r.pay.workerView.advances}</td><td>{m(r.pay.workerView.netMinor)}</td></tr>
            <tr><td>Employer half alone</td><td>{r.pay.employerView.days}</td><td>{r.pay.employerView.advances}</td><td>{m(r.pay.employerView.netMinor)}</td></tr>
          </tbody>
        </table>
        {r.pay.disputedMinor > 0 && <p className="small sans" style={{ color: 'var(--amber)', marginTop: 8 }}>In dispute: {m(r.pay.disputedMinor)}. Pay the agreed amount now; settle the rest together.</p>}
        {status.paid && (
          <div className="card flat sans" style={{ marginTop: 10, borderColor: status.changed ? 'var(--bad)' : 'var(--green)' }}>
            <b>💰 Already paid</b> on {new Date(status.at!).toLocaleDateString(lang)}: {m(status.amountMinor!)}.
            {status.changed && <div style={{ color: 'var(--bad)' }}>⚠ These records now show {m(payable(net))}, which differs from the {m(status.amountMinor!)} paid. Check before paying anything more.</div>}
          </div>
        )}
        {net < 0 && !unreliable && (
          <div className="card flat sans no-print" style={{ marginTop: 10 }}>
            <b>Balance to carry forward: −{m(-net)}</b> (the worker has taken more than earned). Pay nothing now; carry it onto next month’s card so it is not forgotten or changed.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="sm" onClick={() => startCard({ worker: spec.worker, employer: spec.employer, rateMinor: spec.rateMinor, advMinor: spec.advMinor, currency: spec.currency, lang: spec.lang, year: nextMonth.year, month: nextMonth.month, carryMinor: net })}>＋ Make next month’s card with this balance</button>
            </div>
          </div>
        )}
        <div className="row no-print" style={{ marginTop: 10 }}>
          <button className="primary" disabled={unreliable} onClick={() => setShowSlip((s) => !s)}>🧾 {showSlip ? 'Hide' : 'Show'} pay slip</button>
          <button onClick={doExplain} disabled={busy || settings.aiProvider === 'off'}>{busy ? <span className="spin" /> : '🤖'} Explain simply</button>
          <button onClick={markPaid} disabled={status.paid || r.verdict === 'pair-mismatch' || unreliable} title="Record that the agreed amount was handed over. Rescanning this card later will warn that it is already paid.">{status.paid ? '💰 Paid' : '💰 Mark as paid'}</button>
          <button onClick={save} disabled={saved || r.verdict === 'pair-mismatch' || unreliable}>{saved ? '✓ Saved' : '📒 Save to ledger'}</button>
          <button onClick={() => { addCrew({ cardId: spec.id, month: `${spec.year}-${String(spec.month).padStart(2, '0')}`, worker: spec.worker, employer: spec.employer, verdict: r.verdict, agreedDays: r.pay.agreed.days, advances: r.pay.agreed.advances, netMinor: r.pay.agreed.netMinor, disputedMinor: r.pay.disputedMinor, currency: spec.currency }); toast('Added to crew payroll'); }} disabled={r.verdict === 'pair-mismatch' || unreliable}>➕ Add to crew payroll</button>
          <button onClick={() => { downloadPhoto(stock.photo, `stock-${spec.id}.png`); setTimeout(() => downloadPhoto(foil.photo, `foil-${spec.id}.png`), 400); }} title="Save both photos as PNG so you can upload them on the Payday scan page, or on another device">⬇ Save photos</button>
          <button className="ghost" onClick={onReset}>Scan another</button>
        </div>
        {settings.aiProvider === 'off' && <div className="small muted sans">AI is off (Settings). The slip still explains the sum in plain words.</div>}
        {explain && (
          <p className="card flat" style={{ marginTop: 10 }} lang={lang}>
            {explain.text} <span className="pill">{explain.source === 'ai' ? 'AI' : 'offline'}</span>
          </p>
        )}
      </div>

      {showSlip && (
        <div style={{ marginTop: 16 }}>
          <Slip r={r} lang={lang} explain={explain?.text} />
        </div>
      )}

      <div className="grid2 no-print" style={{ marginTop: 16 }}>
        <div className="card">
          <h3>What the app saw · worker half</h3>
          <canvas ref={cs} className="photo" />
        </div>
        <div className="card">
          <h3>What the app saw · employer half</h3>
          <canvas ref={cf} className="photo" />
        </div>
      </div>
      <p className="small muted sans no-print">Green ring = punched on both · red = one half only · amber = unsure · purple dots = measured cut edge. {tt('slipAgreedNote')}</p>
    </div>
  );
}
