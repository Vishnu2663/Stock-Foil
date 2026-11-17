import { useState } from 'react';
import { newCardSpec } from '../../core/card';
import { Results, type Captured } from '../components/Results';
import { defer, simulate } from '../sim';

const spec = newCardSpec({ id: 'DEMO2026', year: 2026, month: 11, rateMinor: 60000, advMinor: 20000, worker: 'Ramesh', employer: 'Sharma Builders', lang: 'en' });
const FIVE = [3, 4, 5, 6, 9];
const camS = { angle: 0.12, noise: 0.01, gradient: 0.25, gradDir: 1.1, tx: -10 };
const camF = { angle: -0.2, noise: 0.015, gradient: 0.2, gradDir: 3.5, shadow: 0.1, blur: 0.6, px: 0.0003 };

type Step = 0 | 1 | 2;
export function Demo() {
  const [step, setStep] = useState<Step>(0);
  const [pair, setPair] = useState<{ stock: Captured; foil: Captured } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const run = async (s: Step) => {
    setBusy(true);
    setErr('');
    const r = await defer(() =>
      s === 1
        ? simulate({ spec, stockDays: FIVE, foilDays: FIVE, stockAdv: [1], foilAdv: [1], condS: camS, condF: camF })
        : simulate({ spec, stockDays: [...FIVE, 11], foilDays: FIVE, stockAdv: [1], foilAdv: [1], condS: camS, condF: camF }),
    );
    setBusy(false);
    if ('error' in r) setErr(r.error);
    else {
      setPair(r);
      setStep(s);
    }
  };

  return (
    <div>
      <div className="kicker">The 90-second story</div>
      <h1 style={{ fontSize: '2.2rem' }}>“You only worked 4 days.”</h1>
      <p className="muted">Everything below is a real run of the scanner on simulated phone photos (rotated, tilted, noisy, unevenly lit), not a mock-up.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row">
          <button className={step === 0 ? 'primary' : ''} onClick={() => { setStep(0); setPair(null); }}>1 · The claim</button>
          <button className={step === 1 ? 'primary' : ''} disabled={busy} onClick={() => run(1)}>2 · Worker brings his half</button>
          <button className={step === 2 ? 'primary' : ''} disabled={busy} onClick={() => run(2)}>3 · A sneaky extra hole</button>
          {busy && <span className="spin" />}
        </div>
        {step === 0 && (
          <div style={{ marginTop: 12 }}>
            <p><b>Contractor:</b> “You only worked 4 days this month. Here’s ₹2,400.”</p>
            <p><b>Ramesh:</b> “No. I worked five.” He has no phone, no payslip, no witness. But he kept his half of the card.</p>
            <p className="muted small sans">Step 2 scans both halves. Step 3 shows what happens when someone adds one hole to a single half.</p>
          </div>
        )}
        {step === 1 && <p style={{ marginTop: 12 }}>Both halves are lined up by the cut: <b>5 holes match on both</b>. Pay = 5 × ₹600 − 1 advance (₹200) = ₹2,800. The contractor’s 4 days can’t stand.</p>}
        {step === 2 && <p style={{ marginTop: 12 }}>Someone punches day 11 into the worker’s half to claim a 6th day. The other half never got that hole, so the scan <b>catches it instantly</b> and pays only what both halves agree on.</p>}
        {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
      </div>

      {pair && <Results key={step} stock={pair.stock} foil={pair.foil} onReset={() => { setStep(0); setPair(null); }} />}
    </div>
  );
}
