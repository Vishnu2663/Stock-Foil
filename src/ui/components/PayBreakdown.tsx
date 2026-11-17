import type { PayResult } from '../../core/wages';

interface Props {
  pay: PayResult;
  rateMinor: number;
  advMinor: number;
  money: (minor: number) => string;
  /** the net amount, counting up */
  netShown: number;
}

const fmtDays = (d: number) => (Number.isInteger(d) ? String(d) : d.toFixed(1));

/**
 * The calculation as a chain of tiles (days × wage = earned − advances ± balance = pay), then
 * who says what: the agreed figures against each half read alone, with a bar for each and a gap
 * meter for whatever is in dispute.
 */
export function PayBreakdown({ pay, rateMinor, advMinor, money, netShown }: Props) {
  const a = pay.agreed;
  const rc = a.rateChange;
  const nets = [a.netMinor, pay.workerView.netMinor, pay.employerView.netMinor].map((n) => Math.max(0, n));
  const top = Math.max(1, ...nets);
  const views = [
    { key: 'agreed', label: 'Agreed', sub: 'both halves', line: a, tone: 'ok' },
    { key: 'worker', label: 'Worker half', sub: 'alone', line: pay.workerView, tone: 'plain' },
    { key: 'employer', label: 'Employer half', sub: 'alone', line: pay.employerView, tone: 'plain' },
  ] as const;
  let n = 0;
  const step = () => ({ ['--i' as string]: n++ });

  return (
    <div className="pb">
      <div className="pb-flow" role="group" aria-label="How the amount is worked out">
        {rc ? (
          <>
            <div className="pb-step" style={step()}><small>Before day {rc.fromDay}</small><b>{fmtDays(rc.daysBefore)} × {money(rateMinor)}</b></div>
            <i className="pb-op" style={step()}>+</i>
            <div className="pb-step" style={step()}><small>From day {rc.fromDay}</small><b>{fmtDays(rc.daysAfter)} × {money(rc.rateMinor)}</b></div>
          </>
        ) : (
          <>
            <div className="pb-step" style={step()}><small>Days counted</small><b>{fmtDays(a.days)}</b></div>
            <i className="pb-op" style={step()}>×</i>
            <div className="pb-step" style={step()}><small>Daily wage</small><b>{money(rateMinor)}</b></div>
          </>
        )}
        <i className="pb-op" style={step()}>=</i>
        <div className="pb-step earn" style={step()}><small>Earned</small><b>{money(a.grossMinor)}</b></div>
        <i className="pb-op" style={step()}>−</i>
        <div className="pb-step minus" style={step()}><small>Advances</small><b>{money(a.advancesMinor)}</b><em>{a.advances} × {money(advMinor)}</em></div>
        {a.carryMinor !== 0 && (
          <>
            <i className="pb-op" style={step()}>{a.carryMinor < 0 ? '−' : '+'}</i>
            <div className={`pb-step ${a.carryMinor < 0 ? 'minus' : 'earn'}`} style={step()}><small>Balance b/f</small><b>{money(Math.abs(a.carryMinor))}</b><em>from last month</em></div>
          </>
        )}
        <i className="pb-op" style={step()}>=</i>
        <div className={`pb-step total ${a.netMinor < 0 ? 'neg' : ''}`} style={step()}><small>{a.netMinor < 0 ? 'Carry forward' : 'Pay now'}</small><b>{money(Math.round(netShown))}</b></div>
      </div>

      <div className="pb-views" role="table" aria-label="Agreed figures against each half alone">
        <div className="pb-vh" role="row"><span /><span>Days</span><span>Advances</span><span>Net</span></div>
        {views.map((v, i) => (
          <div key={v.key} className={`pb-v ${v.tone}`} role="row" style={{ ['--i' as string]: i }}>
            <div className="pb-vname" role="cell"><b>{v.label}</b><small>{v.sub}</small></div>
            <span className="pb-chip" role="cell">{fmtDays(v.line.days)}</span>
            <span className="pb-chip" role="cell">{v.line.advances}</span>
            <div className="pb-vnet" role="cell">
              <span>{money(v.line.netMinor)}</span>
              <i className="pb-bar" style={{ ['--w' as string]: `${(Math.max(0, v.line.netMinor) / top) * 100}%` }} aria-hidden />
            </div>
          </div>
        ))}
      </div>

      {pay.disputedMinor > 0 && (
        <div className="pb-gap" role="note">
          <div className="pb-gap-bar" aria-hidden>
            <i className="ok" style={{ flexGrow: Math.max(1, a.netMinor) }} />
            <i className="dis" style={{ flexGrow: pay.disputedMinor }} />
          </div>
          <p><b>{money(pay.disputedMinor)} in dispute.</b> Pay the agreed <b>{money(Math.max(0, a.netMinor))}</b> now and settle the rest together.</p>
        </div>
      )}
    </div>
  );
}
