import { useEffect, useState } from 'react';
import { formatMoney, type CardSpec } from '../../core/card';
import { clearAll, deleteCard, loadCards, loadReceipts, verifyChain, type Receipt } from '../../store';
import { useApp } from '../ctx';
import { download } from '../imageIO';
import { sheetPdf } from '../../render/pdf';
import { sheetSvg } from '../../render/sheet';

export function Ledger({ go, reprint, edit }: { go: (r: string) => void; reprint: (id: string) => void; edit: (c: CardSpec) => void }) {
  const { toast } = useApp();
  const [cards, setCards] = useState(loadCards());
  const [receipts, setReceipts] = useState<Receipt[]>(loadReceipts());
  const [chain, setChain] = useState<{ ok: boolean; at: number; label: string } | null>(null);

  const check = async (rs: Receipt[], label: string) => {
    const bad = await verifyChain(rs);
    setChain({ ok: bad < 0, at: bad, label });
  };
  useEffect(() => {
    check(receipts, 'Ledger');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tamperTest = async () => {
    if (!receipts.length) return toast('Save a payday receipt first');
    const copy = receipts.map((r) => ({ ...r }));
    copy[0].netMinor += 100;
    await check(copy, 'Tamper test (edited copy: +1.00 on receipt #1)');
  };

  const csv = () => {
    const head = 'seq,time,card,month,worker,employer,verdict,agreed_days,stock_only,foil_only,agreed_advances,net_minor,disputed_minor,currency,hash';
    const rows = receipts.map((r) => [r.seq, r.at, r.cardId, r.month, r.worker, r.employer, r.verdict, r.agreedDays.join(' '), r.stockOnlyDays.join(' '), r.foilOnlyDays.join(' '), r.agreedAdv, r.netMinor, r.disputedMinor, r.currency, r.hash].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    download('stock-foil-ledger.csv', [head, ...rows].join('\n'), 'text/csv');
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>Ledger</h1>
      <p className="muted">Stored only on this device. Receipts are chained by SHA-256: change or delete any past receipt and every later link breaks.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>Payday receipts</h3>
          {chain && <span className={`pill ${chain.ok ? 'ok' : 'bad'}`}>{chain.ok ? `✓ ${chain.label}: chain intact` : `✗ ${chain.label}: broken at #${chain.at + 1}`}</span>}
          <span style={{ flex: 1 }} />
          <button className="sm" onClick={tamperTest}>🧪 Tamper test</button>
          <button className="sm" onClick={csv} disabled={!receipts.length}>⬇ CSV</button>
          <button className="sm" onClick={() => download('stock-foil-ledger.json', JSON.stringify(receipts, null, 2), 'application/json')} disabled={!receipts.length}>⬇ JSON</button>
        </div>
        {receipts.length === 0 ? (
          <p className="muted sans">No receipts yet. Verify a pair on <a href="#/scan">Payday scan</a> and press “Save to ledger”.</p>
        ) : (
          <table className="t" style={{ marginTop: 10 }}>
            <thead><tr><th>#</th><th>Month</th><th>Worker</th><th>Days</th><th>Verdict</th><th>Net</th><th>Disputed</th></tr></thead>
            <tbody>
              {[...receipts].reverse().map((r) => (
                <tr key={r.seq}>
                  <td>{r.seq}</td>
                  <td>{r.month}</td>
                  <td>{r.worker || '—'}</td>
                  <td>{r.agreedDays.length}{r.stockOnlyDays.length + r.foilOnlyDays.length ? ` (+${r.stockOnlyDays.length + r.foilOnlyDays.length}?)` : ''}</td>
                  <td>{r.verdict === 'paid' ? '💰 paid' : r.verdict.replace('genuine-', '')}</td>
                  <td>{formatMoney(r.netMinor, r.currency)}</td>
                  <td>{r.disputedMinor ? formatMoney(r.disputedMinor, r.currency) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <div className="row"><h3 style={{ margin: 0 }}>Cards issued</h3><span style={{ flex: 1 }} /><button className="sm" onClick={() => go('issue')}>＋ New</button></div>
        {cards.length === 0 ? (
          <p className="muted sans">No cards saved yet.</p>
        ) : (
          <table className="t" style={{ marginTop: 10 }}>
            <thead><tr><th>Card</th><th>Month</th><th>Worker / Employer</th><th>Rate</th><th /></tr></thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id}>
                  <td className="mono">{c.id}</td>
                  <td>{c.year}-{String(c.month).padStart(2, '0')}</td>
                  <td>{c.worker || '—'} / {c.employer || '—'}</td>
                  <td>{formatMoney(c.rateMinor, c.currency)}</td>
                  <td>
                    <button className="sm" onClick={async () => { const b = await sheetPdf(sheetSvg(c, c.lang)); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `tally-${c.id}.pdf`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000); }}>⬇ PDF</button>{' '}
                    <button className="sm" onClick={() => edit(c)} title="Change the wage, names or month. Makes a revised card that replaces this one.">✎ Edit</button>{' '}
                    <button className="sm" onClick={() => reprint(c.id)}>Reprint</button>{' '}
                    <button className="sm ghost" onClick={() => { deleteCard(c.id); setCards(loadCards()); }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ marginTop: 16 }}>
        <button className="ghost sm" onClick={() => { if (confirm('Delete all cards and receipts stored in this browser? This cannot be undone.')) { clearAll(); setCards([]); setReceipts([]); setChain(null); } }}>Delete all local data</button>
      </p>
    </div>
  );
}
