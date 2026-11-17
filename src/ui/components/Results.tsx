import { useEffect, useMemo, useRef, useState } from 'react';
import { explainPay } from '../../ai';
import { daysInMonth, firstWeekday, formatMoney, MAX_AMOUNT_MAJOR } from '../../core/card';
import { AmountInput } from './AmountInput';
import { PaydayCard } from './PaydayCard';
import { PayBreakdown } from './PayBreakdown';
import { useCountUp } from '../fx';
import { weekdayShort, monthName, t } from '../../i18n';
import { addCrew, addReceipt, loadReceipts } from '../../store';
import { paymentStatus, payable } from '../../core/settlement';
import { splitDays } from '../../core/wages';
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
  return { ...h, days: h.days.map(fix), pm: h.pm.map(fix), adv: h.adv.map(fix) };
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
  // a wage change both sides agree at payday (the printed rate cannot change on paper)
  const [wc, setWc] = useState({ on: false, rate: stock.half.payload.spec.rateMinor / 100, from: 15 });
  const cs = useRef<HTMLCanvasElement>(null);
  const cf = useRef<HTMLCanvasElement>(null);

  const sH = useMemo(() => applyEdits(stock.half, edits), [stock, edits]);
  const fH = useMemo(() => applyEdits(foil.half, edits), [foil, edits]);
  const rateChange = wc.on ? { fromDay: Math.max(1, Math.round(wc.from) || 1), rateMinor: Math.min(MAX_AMOUNT_MAJOR, Math.max(0, wc.rate)) * 100 } : undefined;
  const rcKey = rateChange ? `${rateChange.fromDay}:${rateChange.rateMinor}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const r = useMemo(() => verifyPair(sH, fH, { alignTolMm: settings.calibration.alignTolMm, rateChange }), [sH, fH, settings.calibration.alignTolMm, rcKey]);
  const { spec } = r;

  useEffect(() => {
    if (cs.current) drawOverlay(cs.current, stock.photo, stock.scan, sH, r.cmp.dayStatus, r.cmp.advStatus, r.cmp.pmStatus);
    if (cf.current) drawOverlay(cf.current, foil.photo, foil.scan, fH, r.cmp.dayStatus, r.cmp.advStatus, r.cmp.pmStatus);
  }, [stock, foil, sH, fH, r]);

  const unreliable = r.verdict === 'unreliable';
  const celebrated = useRef('');
  useEffect(() => {
    // celebrate a clean, genuine result once per card (never on a dispute, a mismatch or an unreliable scan)
    if (r.verdict === 'genuine-consistent' && celebrated.current !== spec.id) {
      celebrated.current = spec.id;
    }
  }, [r.verdict, spec.id]);
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
  const blocked = r.verdict === 'pair-mismatch' || unreliable;
  /** "Paid" or "Yet to pay": saves this scan to History (if not already) and then records the status */
  const record = async (kind: 'paid' | 'unpaid') => {
    if (!saved) await save(true);
    await addReceipt({ cardId: spec.id, month: monthKey, worker: spec.worker, employer: spec.employer, verdict: kind, agreedDays: [], stockOnlyDays: [], foilOnlyDays: [], agreedAdv: 0, netMinor: payable(net), disputedMinor: r.pay.disputedMinor, currency: spec.currency, ...(rateChange ? { rateChange } : {}) });
    setPaidTick((n) => n + 1);
    toast(kind === 'paid' ? `💰 Paid ${formatMoney(payable(net), spec.currency, lang)}. Saved to History.` : `⏳ Yet to pay ${formatMoney(payable(net), spec.currency, lang)}. Saved to History.`);
  };
  const totalShown = useCountUp(r.pay.agreed.netMinor);
  const nDays = daysInMonth(spec.year, spec.month);
  const off = firstWeekday(spec.year, spec.month);
  const halves = !!spec.halves;
  const flagSet = (k: 'day' | 'pm') => new Set(r.alignment.flagged.filter((f) => f.kind === k).map((f) => f.n));
  const susAm = flagSet('day'), susPm = flagSet('pm');
  const sus = new Set([...susAm, ...susPm]);
  const uncSet = (k: 'day' | 'pm') => new Set(r.uncertainCells.filter((u) => u.kind === k).map((u) => u.n));
  const uncAm = uncSet('day'), uncPm = uncSet('pm');
  const uncertain = new Set([...uncAm, ...uncPm]);
  const dayTypes = splitDays(r.cmp);
  const fullSet = new Set(dayTypes.full), halfSet = new Set(dayTypes.half);
  const warnings = [...stock.half.warnings.map((w) => `Stock: ${w}`), ...foil.half.warnings.map((w) => `Foil: ${w}`)];

  const cellVal = (h: HalfScan, kind: 'day' | 'pm' | 'adv', n: number) => (kind === 'day' ? h.days : kind === 'pm' ? h.pm : h.adv).find((c) => c.n === n)?.punched ?? false;
  const toggle = (role: 'S' | 'F', kind: 'day' | 'pm' | 'adv', n: number) => {
    const cur = cellVal(role === 'S' ? sH : fH, kind, n);
    setEdits((e) => ({ ...e, [key(role, kind, n)]: !cur }));
    setSaved(false);
  };

  const doExplain = async () => {
    setBusy(true);
    setExplain(await explainPay(settings, r, lang));
    setBusy(false);
  };
  const save = async (quiet = false) => {
    await addReceipt({
      cardId: spec.id,
      month: `${spec.year}-${String(spec.month).padStart(2, '0')}`,
      worker: spec.worker,
      employer: spec.employer,
      verdict: r.verdict,
      agreedDays: r.cmp.agreedDays,
      ...(r.cmp.halves ? { halfUnits: r.cmp.agreedDays.length + r.cmp.agreedPm.length } : {}),
      stockOnlyDays: r.cmp.stockOnlyDays,
      foilOnlyDays: r.cmp.foilOnlyDays,
      agreedAdv: r.cmp.agreedAdv.length,
      netMinor: r.pay.agreed.netMinor,
      disputedMinor: r.pay.disputedMinor,
      currency: spec.currency,
      ...(rateChange ? { rateChange } : {}),
    });
    setSaved(true);
    if (!quiet) toast('Saved to History (tamper-evident ledger)');
  };

  const selStatus = sel ? r.cmp.dayStatus[sel - 1] : null;

  return (
    <div>
      <div className="scan-again no-print">
        <span className="small sans">Done with this card?</span>
        <button className="primary" onClick={onReset}>📷 Scan another card</button>
      </div>
      <PaydayCard
        spec={spec}
        lang={lang}
        tone={cls === 'ok' ? 'ok' : cls === 'bad' ? 'bad' : 'warn'}
        stamp={r.verdict === 'genuine-consistent' ? 'VERIFIED' : r.verdict === 'genuine-disputed' ? 'IN DISPUTE' : r.verdict === 'pair-mismatch' ? 'REJECTED' : unreliable ? 'RETAKE' : 'CHECK'}
        title={title}
        dayStatus={r.cmp.dayStatus}
        pmStatus={halves ? r.cmp.pmStatus : undefined}
        split={halves ? { full: dayTypes.full.length, half: dayTypes.half.length } : undefined}
        advStatus={r.cmp.advStatus}
        agreedDays={r.pay.agreed.days}
        agreedAdv={r.pay.agreed.advances}
        netMinor={r.pay.agreed.netMinor}
        disputedMinor={r.pay.disputedMinor}
        money={m}
        payState={status.paid ? 'paid' : status.pending ? 'unpaid' : 'none'}
        formula={`${r.pay.agreed.rateChange ? `${r.pay.agreed.rateChange.daysBefore} × ${m(spec.rateMinor)} + ${r.pay.agreed.rateChange.daysAfter} × ${m(r.pay.agreed.rateChange.rateMinor)} (raise from day ${r.pay.agreed.rateChange.fromDay})` : `${r.pay.agreed.days} days × ${m(spec.rateMinor)}`} − ${r.pay.agreed.advances} × ${m(spec.advMinor)}${carry !== 0 ? ` ${carry < 0 ? '−' : '+'} ${m(Math.abs(carry))} b/f` : ''}`}
      />
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
          {halves && (
            <div className="daysum" role="status">
              <div><b>{dayTypes.full.length}</b><span>full {dayTypes.full.length === 1 ? 'day' : 'days'}<small>both circles</small></span></div>
              <i aria-hidden>+</i>
              <div><b>{dayTypes.half.length}</b><span>half {dayTypes.half.length === 1 ? 'day' : 'days'}<small>one circle</small></span></div>
              <i aria-hidden>=</i>
              <div className="tot"><b>{Number.isInteger(r.pay.agreed.days) ? r.pay.agreed.days : r.pay.agreed.days.toFixed(1)}</b><span>days paid<small>agreed on both pieces</small></span></div>
            </div>
          )}
          <div className={`cal ${halves ? 'halves' : ''}`}>
            {Array.from({ length: 7 }, (_, i) => (
              <div className="h" key={i}>{weekdayShort(lang, i)}</div>
            ))}
            {Array.from({ length: off }, (_, i) => (
              <button key={'b' + i} className="blank" disabled />
            ))}
            {Array.from({ length: nDays }, (_, i) => {
              const d = i + 1;
              const am = r.cmp.dayStatus[i] ?? 'none';
              const pm = halves ? r.cmp.pmStatus[i] ?? 'none' : 'none';
              const all = halves ? [am, pm] : [am];
              // the tile takes the colour of its worst circle: one-sided beats agreed beats empty
              const st = all.includes('stockOnly') ? 'stockOnly' : all.includes('foilOnly') ? 'foilOnly' : all.includes('both') ? 'both' : 'none';
              const slot = (status: string, unsure: boolean, flagged: boolean, label: string) => (
                <span className={`slot ${status} ${unsure ? 'unsure' : ''} ${flagged ? 'sus' : ''}`} title={label}>
                  {status === 'stockOnly' ? 'W' : status === 'foilOnly' ? 'E' : ''}
                </span>
              );
              return (
                <button key={d} style={{ ['--i' as string]: d }} className={`${st} ${uncertain.has(d) ? 'unsure' : ''} ${sus.has(d) ? 'sus' : ''} ${sel === d ? 'sel' : ''}`} onClick={() => setSel(sel === d ? null : d)} aria-label={`Day ${d}`}>
                  <span className="dnum">{d}{halves && fullSet.has(d) && <em className="dt full">FULL</em>}{halves && halfSet.has(d) && <em className="dt half">½</em>}</span>
                  <span className="slots">
                    {slot(am, uncAm.has(d), susAm.has(d), halves ? 'First half of the day' : 'The day')}
                    {halves && slot(pm, uncPm.has(d), susPm.has(d), 'Second half of the day')}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="legend sans" aria-label="How to read the calendar">
            <div className="legend-item"><span className="slot both" /><span><b>Both halves</b>Punched on the worker's AND the employer's piece. Counted.</span></div>
            <div className="legend-item"><span className="slot stockOnly">W</span><span><b>Worker's piece only</b>Not on the employer's piece. Disputed, not paid.</span></div>
            <div className="legend-item"><span className="slot foilOnly">E</span><span><b>Employer's piece only</b>Not on the worker's piece. Disputed, not paid.</span></div>
            <div className="legend-item"><span className="slot none unsure" /><span><b>Unsure</b>Hard to read. Tap the day and check by eye.</span></div>
            <div className="legend-item"><span className="slot both sus" /><span><b>Looks separately made</b>The holes did not line up when stacked.</span></div>
            {halves && <div className="legend-item wide"><span className="slot-pair"><span className="slot none" /><span className="slot none" /></span><span><b>Two circles a day</b>Left = first half of the day, right = second half. One circle is half a day's wage.</span></div>}
          </div>
          {sel && (
            <div className="card flat sans" style={{ marginTop: 10 }}>
              <b>Day {sel}</b> <span className="pill">{selStatus}</span>
              {(halves ? (['day', 'pm'] as const) : (['day'] as const)).map((k) => (
                <div key={k} style={{ marginTop: 8 }}>
                  {halves && <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>{k === 'day' ? 'First half of the day' : 'Second half of the day'}</div>}
                  <div className="row">
                    <button className="sm" onClick={() => toggle('S', k, sel)}>Worker piece: {cellVal(sH, k, sel) ? 'punched' : 'not punched'} ⇄</button>
                    <button className="sm" onClick={() => toggle('F', k, sel)}>Employer piece: {cellVal(fH, k, sel) ? 'punched' : 'not punched'} ⇄</button>
                  </div>
                </div>
              ))}
              <div className="small muted" style={{ marginTop: 6 }}>Correct only what the camera got wrong. Fixes are marked as manual.</div>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3>Pay</h3>
        {unreliable && <p className="small sans" style={{ color: 'var(--bad)' }}>⛔ Do not pay from this scan. The photos were not read reliably, so the numbers below may be wrong. Retake both photos with the whole half in view.</p>}
        <div className={`wagebox no-print ${wc.on ? 'on' : ''}`}>
          <label className="wagebox-head">
            <input type="checkbox" checked={wc.on} onChange={(e) => setWc({ ...wc, on: e.target.checked })} />
            <i aria-hidden />
            <span className="wagebox-txt">
              <b>Did the wage change this month?</b>
              <small>{wc.on ? `Paying ${m(Math.round(wc.rate * 100))} a day from day ${wc.from}; earlier days stay at the printed ${m(spec.rateMinor)}.` : 'Switch on to pay a different daily wage from a chosen day (a raise, say).'}</small>
            </span>
            <em className="wagebox-state">{wc.on ? 'ON' : 'OFF'}</em>
          </label>
          {wc.on && (
            <div className="wagebox-body sans">
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <AmountInput label="New daily wage" value={wc.rate} onChange={(v) => setWc({ ...wc, rate: v })} max={MAX_AMOUNT_MAJOR} />
                <div className="field" style={{ flex: 1 }}>
                  <label>Applies from day</label>
                  <input type="number" min={1} max={nDays} value={wc.from} onChange={(e) => setWc({ ...wc, from: Math.min(nDays, Math.max(1, Number(e.target.value) || 1)) })} />
                  <div className="small sans" style={{ color: 'var(--ink-2)', minHeight: '1.2em' }}>Days before it are paid at {m(spec.rateMinor)}.</div>
                </div>
              </div>
              <div className="small" style={{ color: 'var(--amber)' }}>⚠ Both sides must agree. It is shown on the slip and recorded in the ledger.</div>
            </div>
          )}
        </div>
        {r.pay.agreed.rateChange && (
          <div className="wage-badge" role="status">
            <b>Wage changed</b> · {r.pay.agreed.rateChange.daysBefore} days at {m(spec.rateMinor)} <i aria-hidden>→</i> {r.pay.agreed.rateChange.daysAfter} days at {m(r.pay.agreed.rateChange.rateMinor)} <span>from day {r.pay.agreed.rateChange.fromDay}</span>
          </div>
        )}
        <PayBreakdown pay={r.pay} rateMinor={spec.rateMinor} advMinor={spec.advMinor} money={m} netShown={totalShown} split={halves ? { full: dayTypes.full.length, half: dayTypes.half.length } : undefined} />
        {status.paid && (
          <div className="card flat sans" style={{ marginTop: 10, borderColor: status.changed ? 'var(--bad)' : 'var(--green)' }}>
            <b>💰 Already paid</b> on {new Date(status.at!).toLocaleDateString(lang)}: {m(status.amountMinor!)}.
            {status.changed && <div style={{ color: 'var(--bad)' }}>⚠ These records now show {m(payable(net))}, which differs from the {m(status.amountMinor!)} paid. Check before paying anything more.</div>}
          </div>
        )}
        {status.pending && (
          <div className="card flat sans no-print" style={{ marginTop: 10, borderColor: 'var(--amber)' }}>
            <b>⏳ Yet to pay</b>: {m(status.pendingAmountMinor ?? payable(net))} is still owed for this month. It is saved in <a href="#/history">History</a>.
            <div className="row" style={{ marginTop: 8 }}>
              <button className="sm primary" onClick={() => record('paid')} disabled={blocked}>💰 Mark paid now</button>
            </div>
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
        <div className="settle no-print">
          <div className="settle-head">
            <div>
              <b>Settle this month</b>
              <span className="small sans">{status.paid ? 'Already paid. This card is closed.' : status.pending ? 'Marked yet to pay. It is waiting in History.' : saved ? 'Saved in History, payment not recorded yet.' : 'Nothing recorded yet.'}</span>
            </div>
            <div className="settle-amt"><small>Agreed amount</small>{formatMoney(payable(net), spec.currency, lang)}</div>
          </div>
          {blocked && <p className="settle-block sans">⛔ {unreliable ? 'Payment cannot be recorded: the photos were not read reliably. Retake both photos.' : 'Payment cannot be recorded: the two halves do not belong to the same card.'}</p>}
          <div className="settle-btns">
            <button className="primary" onClick={() => record('paid')} disabled={status.paid || blocked} title="The money was handed over. Saves this scan to History as Paid. Paid is final: this card can never be paid twice.">
              <span>{status.paid ? '💰 Paid ✓' : '💰 Paid'}</span><small>{status.paid ? 'recorded' : `handed over ${formatMoney(payable(net), spec.currency, lang)}`}</small>
            </button>
            <button onClick={() => record('unpaid')} disabled={status.paid || status.pending || blocked} title="Not paid yet. Saves this scan to History as Yet to pay, so it is not forgotten; you can mark it paid later.">
              <span>{status.pending ? '⏳ Yet to pay ✓' : '⏳ Yet to pay'}</span><small>{status.pending ? 'recorded' : 'still owed, saved to History'}</small>
            </button>
            <button className="ghost" onClick={() => save()} disabled={saved || blocked} title="Save the scan to History without a payment status">
              <span>{saved ? '✓ In History' : '📒 Save only'}</span><small>{saved ? 'saved' : 'no payment status'}</small>
            </button>
          </div>
        </div>
        <div className="row no-print" style={{ marginTop: 10 }}>
          <button className="primary" disabled={unreliable} onClick={() => setShowSlip((s) => !s)}>🧾 {showSlip ? 'Hide' : 'Show'} pay slip</button>
          <button onClick={doExplain} disabled={busy || settings.aiProvider === 'off'}>{busy ? <span className="spin" /> : '🤖'} Explain simply</button>
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
      {(() => {
        const cnt = (st: string) => r.cmp.dayStatus.filter((x) => x === st).length + r.cmp.advStatus.filter((x) => x === st).length;
        const unsure = [sH, fH].reduce((n, h) => n + h.days.filter((d) => d.uncertain && !d.manual).length + h.adv.filter((d) => d.uncertain && !d.manual).length, 0);
        const items: { cls: string; label: string; what: string; n: number }[] = [
          { cls: 'both', label: 'Green ring', what: 'punched on both halves, counted', n: cnt('both') },
          { cls: 'one', label: 'Red ring', what: 'punched on one half only, not counted', n: cnt('stockOnly') + cnt('foilOnly') },
          { cls: 'unsure', label: 'Amber ring', what: 'could not be read, check it by eye', n: unsure },
          { cls: 'edge', label: 'Purple dots', what: 'the cut edge the app measured', n: 0 },
        ];
        return (
          <div className="ovl-legend no-print" role="list" aria-label="How to read the marked photos">
            {items.map((it) => (
              <div key={it.cls} className={`ovl-item ${it.cls}`} role="listitem">
                <i aria-hidden />
                <span><b>{it.label}</b> {it.what}{it.cls !== 'edge' && <em className="ovl-n">{it.n}</em>}</span>
              </div>
            ))}
            <p className="small sans">{tt('slipAgreedNote')}</p>
          </div>
        );
      })()}
    </div>
  );
}
