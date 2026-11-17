import { useState } from 'react';
import { breakdown, combine, notesTotalMinor } from '../../core/cash';
import { formatMoney } from '../../core/card';
import { clearCrew, loadCrew, removeCrew } from '../../store';
import { useApp } from '../ctx';
import { download, printArea } from '../imageIO';

const label = (v: string) => ({ 'genuine-consistent': '✅ agreed', 'genuine-disputed': '⚠ disputed', review: '⚠ review', inconclusive: '? edge unclear' }[v] ?? v);

export function Crew({ go }: { go: (r: string) => void }) {
  const { lang } = useApp();
  const [rows, setRows] = useState(loadCrew());
  const currencies = [...new Set(rows.map((r) => r.currency))];
  const money = (v: number, c: string) => formatMoney(v, c, lang);

  const csv = () => {
    const head = 'worker,employer,month,card,verdict,days,advances,pay_minor,disputed_minor,currency,notes';
    const lines = rows.map((r) => {
      const pay = Math.max(0, r.netMinor);
      const b = breakdown(pay, r.currency);
      const notes = b.notes.map((n) => `${n.count}x${n.denom}`).join(' ');
      return [r.worker, r.employer, r.month, r.cardId, r.verdict, r.agreedDays, r.advances, pay, r.disputedMinor, r.currency, notes].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });
    download('stock-foil-crew-payroll.csv', [head, ...lines].join('\n'), 'text/csv');
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem' }} className="no-print">Crew payroll</h1>
      <p className="muted no-print">Scan each worker’s pair on Payday scan, press “Add to crew payroll”, and get one sheet: who to pay, how much, and exactly which notes to bring.</p>
      <div className="row no-print" style={{ marginBottom: 12 }}>
        <button className="primary" onClick={() => go('scan')}>📷 Scan next worker</button>
        <button onClick={csv} disabled={!rows.length}>⬇ CSV</button>
        <button onClick={() => printArea()} disabled={!rows.length}>🖨 Print sheet</button>
        <button className="ghost" disabled={!rows.length} onClick={() => { if (confirm('Clear the whole crew sheet?')) { clearCrew(); setRows([]); } }}>Clear</button>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="sans">No workers yet. Scan a pair, then press <b>➕ Add to crew payroll</b> on the result.</p></div>
      ) : (
        <div className="print-area">
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Pay list</h3>
            <table className="t">
              <thead><tr><th>Worker</th><th>Days</th><th>Adv.</th><th>Status</th><th>Pay now</th><th>Notes to hand over</th><th className="no-print" /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const pay = Math.max(0, r.netMinor);
                  const b = breakdown(pay, r.currency);
                  return (
                    <tr key={r.id}>
                      <td>{r.worker || '—'}<div className="small muted">{r.month}</div></td>
                      <td>{r.agreedDays}</td>
                      <td>{r.advances}</td>
                      <td>{label(r.verdict)}{r.disputedMinor ? <div className="small" style={{ color: 'var(--amber)' }}>{money(r.disputedMinor, r.currency)} in dispute</div> : null}</td>
                      <td><b>{money(pay, r.currency)}</b>{r.netMinor < 0 ? <div className="small" style={{ color: 'var(--bad)' }}>owes {money(-r.netMinor, r.currency)}</div> : null}</td>
                      <td className="small" style={{ textAlign: 'left' }}>{b.notes.map((n) => `${n.count}×${n.denom}`).join('  ') || '—'}{b.remainderMinor ? ` (+${money(b.remainderMinor, r.currency)} coins)` : ''}</td>
                      <td className="no-print"><button className="sm ghost" onClick={() => { removeCrew(r.id); setRows(loadCrew()); }}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {currencies.map((c) => {
            const mine = rows.filter((r) => r.currency === c);
            const total = mine.reduce((s, r) => s + Math.max(0, r.netMinor), 0);
            const all = combine(mine.map((r) => breakdown(Math.max(0, r.netMinor), c)));
            return (
              <div className="card" key={c} style={{ marginBottom: 16 }}>
                <h3>Cash to bring · {c}</h3>
                <div className="formula"><span>{mine.length} workers</span><span className="op">→</span><span className="total">{money(total, c)}</span></div>
                <p className="sans" style={{ marginTop: 10 }}>
                  {all.notes.map((n) => <span key={n.denom} className="pill" style={{ marginRight: 6, fontSize: '0.9rem' }}>{n.count} × {n.denom}</span>)}
                </p>
                <p className="small muted sans">Notes total {money(notesTotalMinor(all), c)}{all.remainderMinor ? ` · plus ${money(all.remainderMinor, c)} in coins/change` : ''}. Disputed amounts are <b>not</b> included; settle them separately.</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
