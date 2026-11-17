import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { formatMoney } from '../../core/card';
import { loadReceipts, type Receipt } from '../../store';
import { buildCertificate, verifyCertificate, type CertCheck, type Certificate } from '../../store/certificate';
import { useApp } from '../ctx';
import { download, printArea } from '../imageIO';

const COUNTED = new Set(['genuine-consistent', 'genuine-disputed', 'review', 'inconclusive']);

export function Income() {
  const { lang } = useApp();
  const ledger = useMemo(() => loadReceipts(), []);
  const people = useMemo(() => {
    const m = new Map<string, { worker: string; employer: string }>();
    for (const r of ledger) if (COUNTED.has(r.verdict)) m.set(`${r.worker.toLowerCase()}|${r.employer.toLowerCase()}`, { worker: r.worker, employer: r.employer });
    return [...m.entries()].map(([k, v]) => ({ k, ...v }));
  }, [ledger]);
  const [sel, setSel] = useState(people[0]?.k ?? '');
  const [months, setMonths] = useState(6);
  const person = people.find((p) => p.k === sel);
  const cert = useMemo(() => (person ? buildCertificate(ledger, person.worker, person.employer, months) : null), [ledger, person, months]);
  const code = cert ? JSON.stringify(cert) : '';
  const [qr, setQr] = useState('');
  useEffect(() => {
    if (!code) { setQr(''); return; }
    QRCode.toDataURL(code, { errorCorrectionLevel: 'L', margin: 1, width: 320 }).then(setQr).catch(() => setQr(''));
  }, [code]);

  // verification
  const [pasted, setPasted] = useState('');
  const [other, setOther] = useState<Receipt[] | null>(null);
  const [result, setResult] = useState<CertCheck | null>(null);
  const [vErr, setVErr] = useState('');
  const verify = async () => {
    setVErr('');
    setResult(null);
    try {
      const c = JSON.parse(pasted) as Certificate;
      if (!c || c.v !== 1 || !Array.isArray(c.months)) throw new Error('That is not a certificate code.');
      setResult(await verifyCertificate(c, other ?? ledger));
    } catch (e) {
      setVErr(e instanceof Error ? e.message : 'Could not read that code.');
    }
  };

  const money = (v: number) => formatMoney(v, cert?.currency ?? 'INR', lang);
  return (
    <div>
      <h1 className="no-print" style={{ fontSize: '2rem' }}>Income proof</h1>
      <p className="muted no-print">Workers paid in cash rarely have payslips. This turns the agreed, tamper-evident payday records into a one-page certificate that can be shown for a loan, a rental or a school fee, and checked by anyone who has the ledger.</p>

      {people.length === 0 ? (
        <div className="card no-print"><p className="sans">No agreed payday records yet. Scan a pair on <a href="#/scan">Payday scan</a> and press <b>Save to ledger</b>; then come back here.</p></div>
      ) : (
        <div className="grid2">
          <div className="card no-print">
            <div className="field"><label>Worker</label>
              <select value={sel} onChange={(e) => setSel(e.target.value)}>{people.map((p) => <option key={p.k} value={p.k}>{p.worker} · {p.employer || '—'}</option>)}</select>
            </div>
            <div className="field"><label>Months to include (most recent)</label>
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>{[3, 6, 12].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            </div>
            <div className="row">
              <button className="primary" onClick={() => printArea()} disabled={!cert}>🖨 Print certificate</button>
              <button onClick={() => navigator.clipboard?.writeText(code)} disabled={!cert}>📋 Copy code</button>
              <button onClick={() => download('income-certificate.json', code, 'application/json')} disabled={!cert}>⬇ JSON</button>
            </div>
            <p className="small muted sans" style={{ marginTop: 10 }}>Only scans saved to the ledger count, and only the agreed amounts (never the disputed ones). To let someone else verify, give them the certificate and an export of the ledger from the Ledger page.</p>
          </div>

          <div>
            {cert ? (
              <div className="slip print-area" style={{ maxWidth: 560 }}>
                <h3>Record of agreed work and pay</h3>
                <div className="line"><span className="l">Worker</span><b>{cert.worker}</b></div>
                <div className="line"><span className="l">Employer</span><b>{cert.employer || '—'}</b></div>
                <div className="line"><span className="l">Period</span><b>{cert.from} to {cert.to}</b></div>
                <table className="t" style={{ marginTop: 8 }}>
                  <thead><tr><th>Month</th><th>Days</th><th>Advances</th><th>Agreed pay</th><th>Paid</th></tr></thead>
                  <tbody>{cert.months.map((x) => <tr key={x.m}><td>{x.m}</td><td>{x.days}</td><td>{x.adv}</td><td>{money(Math.max(0, x.net))}</td><td>{x.paid !== undefined ? money(x.paid) : '—'}</td></tr>)}</tbody>
                </table>
                <div className="total"><span>{cert.totalDays} days</span><span>{money(cert.totalNet)}</span></div>
                <p className="small" style={{ marginTop: 8 }}>About {money(Math.round(cert.totalNet / cert.months.length))} a month over {cert.months.length} month{cert.months.length === 1 ? '' : 's'}.</p>
                <div className="row" style={{ alignItems: 'center', marginTop: 8 }}>
                  {qr && <img src={qr} width={130} height={130} alt="Certificate QR code" style={{ background: '#fff' }} />}
                  <p className="small" style={{ flex: 1, minWidth: 180, margin: 0 }}>Each month comes from a payday scan where <b>both</b> the worker’s and the employer’s halves of a paper tally agreed. The QR holds these figures and the ledger fingerprint <span className="mono">{cert.head}</span>. Issued {new Date(cert.at).toLocaleDateString(lang)}.</p>
                </div>
                <p className="small" style={{ color: '#7a1f1f', marginTop: 8 }}>This is a record both sides agreed on. It is not an employer-signed payslip or a legal document.</p>
              </div>
            ) : <div className="card"><p className="sans">No agreed months for this worker.</p></div>}
          </div>
        </div>
      )}

      <div className="card no-print" style={{ marginTop: 16 }}>
        <h3>Verify a certificate</h3>
        <p className="small muted sans">Paste the certificate code. It is checked against this device’s ledger, or against a ledger file you choose (the JSON export from the Ledger page).</p>
        <div className="field"><textarea rows={4} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder='{"v":1,"worker":…}' className="mono" /></div>
        <div className="row">
          <input type="file" accept="application/json,.json" style={{ width: 'auto' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return setOther(null); try { setOther(JSON.parse(await f.text())); } catch { setVErr('Could not read that ledger file.'); } }} />
          <button className="primary" onClick={verify} disabled={!pasted.trim()}>Verify</button>
        </div>
        {vErr && <p style={{ color: 'var(--bad)' }}>{vErr}</p>}
        {result && (
          <div className="verdict" style={{ marginTop: 12 }} data-ok={result.ok}>
            <span className="big">{result.ok ? '✅' : '⛔'}</span>
            <div>
              <h2>{result.ok ? 'Genuine: every figure matches an untampered ledger.' : 'Does NOT verify.'}</h2>
              {result.problems.map((p) => <div key={p} className="small sans">• {p}</div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
