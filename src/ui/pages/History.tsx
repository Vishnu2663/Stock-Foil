import { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../../core/card';
import { buildHistory, historyTotals, type HistoryRow } from '../../core/history';
import { addReceipt, loadReceipts, verifyChain, type Receipt } from '../../store';
import { useApp } from '../ctx';
import { download } from '../imageIO';

type Filter = 'all' | 'unpaid' | 'paid' | 'none';
const FILTERS: [Filter, string][] = [['all', 'All'], ['unpaid', '⏳ Yet to pay'], ['paid', '💰 Paid'], ['none', 'Not marked']];
const LABEL = { paid: '💰 Paid', unpaid: '⏳ Yet to pay', none: 'Not marked' } as const;

export function History({ go }: { go: (r: string) => void }) {
  const { toast, lang } = useApp();
  const [receipts, setReceipts] = useState<Receipt[]>(loadReceipts());
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState<boolean | null>(null);

  useEffect(() => { verifyChain(receipts).then((b) => setChainOk(b < 0)); }, [receipts]);

  const rows = useMemo(() => buildHistory(receipts), [receipts]);
  const totals = useMemo(() => historyTotals(rows), [rows]);
  const shown = rows.filter((r) => (filter === 'all' || r.status === filter) && (!q.trim() || `${r.worker} ${r.employer} ${r.month} ${r.cardId}`.toLowerCase().includes(q.trim().toLowerCase())));
  const m = (v: number, c: string) => formatMoney(v, c, lang);

  const markPaid = async (r: HistoryRow) => {
    setConfirming(null);
    await addReceipt({ cardId: r.cardId, month: r.month, worker: r.worker, employer: r.employer, verdict: 'paid', agreedDays: [], stockOnlyDays: [], foilOnlyDays: [], agreedAdv: 0, netMinor: r.amountMinor, disputedMinor: r.disputedMinor, currency: r.currency });
    setReceipts(loadReceipts());
    toast('💰 Marked as paid');
  };

  const csv = () => {
    const head = 'month,worker,employer,card,days,amount,currency,status,scan_time,status_time,scans';
    const body = shown.map((r) => [r.month, r.worker, r.employer, r.cardId, r.days ?? '', (r.amountMinor / 100).toFixed(2), r.currency, r.status, r.scanAt, r.statusAt ?? '', r.scans].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    download('stock-foil-history.csv', [head, ...body].join('\n'), 'text/csv');
  };

  return (
    <div>
      <div className="hist-head">
        <div>
          <h1>🕘 History</h1>
          <p>Every payday scan you saved, and whether it was paid or is still yet to pay.</p>
        </div>
        {chainOk !== null && <span className={`chain-pill ${chainOk ? 'ok' : 'bad'}`}>{chainOk ? '🔗 Chain intact' : '⚠ Chain broken'}</span>}
      </div>

      {Object.entries(totals).map(([cur, t]) => (
        <div className="hist-tiles" key={cur}>
          <div className="htile paid"><span>💰 Paid · {t.paid.count}</span><b>{m(t.paid.minor, cur)}</b></div>
          <div className={`htile unpaid ${t.unpaid.count ? 'hot' : ''}`}><span>⏳ Yet to pay · {t.unpaid.count}</span><b>{m(t.unpaid.minor, cur)}</b></div>
          <div className="htile none"><span>Not marked · {t.none.count}</span><b>{m(t.none.minor, cur)}</b></div>
        </div>
      ))}

      <div className="row" style={{ marginBottom: 10 }}>
        {FILTERS.map(([k, l]) => <button key={k} className={`sm ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}
        <input placeholder="Search name, month or card" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        <button className="sm" onClick={csv} disabled={!shown.length}>⬇ CSV</button>
      </div>

      {!rows.length ? (
        <div className="card">
          <h2>Nothing here yet</h2>
          <p className="sans">After a payday scan, press <b>💰 Paid</b> or <b>⏳ Yet to pay</b>. The scan lands here.</p>
          <button className="primary" onClick={() => go('scan')}>📷 Payday scan</button>
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="t hist">
            <thead><tr><th>Month</th><th>Worker</th><th>Employer</th><th className="num">Days</th><th className="num">Amount</th><th>Status</th><th>Date</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key}>
                  <td>{r.month}</td>
                  <td>{r.worker || '—'}</td>
                  <td>{r.employer || '—'}</td>
                  <td className="num">{r.days ?? '—'}</td>
                  <td className="num">{m(r.amountMinor, r.currency)}{r.disputedMinor > 0 && <div className="small">⚠ {m(r.disputedMinor, r.currency)} disputed</div>}</td>
                  <td><span className="pill">{LABEL[r.status]}</span></td>
                  <td className="nowrap">{new Date(r.statusAt ?? r.scanAt).toLocaleDateString()}{r.scans > 1 && <div className="small">{r.scans} scans</div>}</td>
                  <td>{r.status !== 'paid' && r.amountMinor > 0 && (confirming === r.key ? (
                    <div className="confirm-inline">
                      <span className="small">Paid {m(r.amountMinor, r.currency)}? Final.</span>
                      <button className="sm primary" onClick={() => markPaid(r)}>Yes, paid</button>
                      <button className="sm ghost" onClick={() => setConfirming(null)}>Cancel</button>
                    </div>
                  ) : <button className="sm" onClick={() => setConfirming(r.key)}>💰 Mark paid</button>)}</td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={8} className="empty">No payday scans match this filter.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
