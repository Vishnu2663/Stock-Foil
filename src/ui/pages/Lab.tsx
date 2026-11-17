import { useState } from 'react';
import fc from 'fast-check';
import { daysInMonth, newCardSpec } from '../../core/card';
import { randomId } from '../../core/prng';
import { CLEAN, placeHalf, renderScene, type PhotoConditions } from '../../render/scene';
import { scanPhoto } from '../../vision/detect';
import { Results, type Captured } from '../components/Results';
import { defer, forgedWave, simulate } from '../sim';
import { rgbaToCanvas } from '../imageIO';
import { printRoundTrip } from '../roundtrip';

type Tamper = 'none' | 'extraStock' | 'extraFoil' | 'missingFoil' | 'forgedCut' | 'otherCard' | 'newRate';

const TAMPERS: { id: Tamper; label: string; help: string }[] = [
  { id: 'none', label: 'Honest pair', help: 'Both halves identical.' },
  { id: 'extraStock', label: 'Extra hole on worker half', help: 'Worker (or someone) adds a day to the stock only.' },
  { id: 'extraFoil', label: 'Extra hole on employer half', help: 'Employer adds a day to the foil only.' },
  { id: 'missingFoil', label: 'Hole patched on employer half', help: 'A day is filled in on the foil.' },
  { id: 'forgedCut', label: 'Forged foil (wrong cut)', help: 'Same card id but a different wavy edge.' },
  { id: 'otherCard', label: 'Halves from different cards', help: 'Foil belongs to another card.' },
  { id: 'newRate', label: 'Foil reprinted with higher rate', help: 'Card code no longer matches.' },
];

const parseDays = (s: string, max: number) => [...new Set(s.split(/[ ,]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))];

const arbCond = fc.record({
  angle: fc.double({ min: -0.4, max: 0.4, noNaN: true }),
  scale: fc.double({ min: 3.6, max: 4.6, noNaN: true }),
  tx: fc.double({ min: -20, max: 20, noNaN: true }),
  ty: fc.double({ min: -20, max: 20, noNaN: true }),
  px: fc.double({ min: -0.0005, max: 0.0005, noNaN: true }),
  py: fc.double({ min: -0.0005, max: 0.0005, noNaN: true }),
  blur: fc.double({ min: 0, max: 1.2, noNaN: true }),
  noise: fc.double({ min: 0, max: 0.05, noNaN: true }),
  gradient: fc.double({ min: 0, max: 0.35, noNaN: true }),
  gradDir: fc.double({ min: 0, max: 6.28, noNaN: true }),
  shadow: fc.double({ min: 0, max: 0.2, noNaN: true }),
  exposure: fc.double({ min: 0.75, max: 1.1, noNaN: true }),
  gamma: fc.double({ min: 0.8, max: 1.3, noNaN: true }),
  seed: fc.integer({ min: 1, max: 1_000_000 }),
});

export function Lab() {
  const [days, setDays] = useState('2, 3, 4, 5, 9, 10');
  const [carry, setCarry] = useState(0);
  const [tamper, setTamper] = useState<Tamper>('none');
  const [c, setC] = useState({ angle: 8, blur: 0.5, noise: 0.015, gradient: 0.2, tilt: 0.0003, exposure: 0.95 });
  const [pair, setPair] = useState<{ stock: Captured; foil: Captured } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stress, setStress] = useState<{ n: number; done: number; exact: number; flagged: number; wrong: number; ms: number } | null>(null);
  const [stopFlag, setStopFlag] = useState({ stop: false });

  const spec = newCardSpec({ id: 'LAB' + randomId(5), year: 2026, month: 11, rateMinor: 50000, advMinor: 10000, worker: 'Lab Worker', employer: 'Lab Employer', carryMinor: Math.round(carry * 100) });

  const go = async () => {
    setBusy(true);
    setErr('');
    setPair(null);
    const max = daysInMonth(spec.year, spec.month);
    const base = parseDays(days, max);
    const extra = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((d) => !base.includes(d)) ?? 15;
    const cond = (flip: number): Partial<PhotoConditions> => ({
      angle: (c.angle * Math.PI) / 180 * flip,
      blur: c.blur,
      noise: c.noise,
      gradient: c.gradient,
      gradDir: flip > 0 ? 0.8 : 3.8,
      px: c.tilt * flip,
      py: -c.tilt,
      exposure: c.exposure,
      seed: flip > 0 ? 3 : 4,
    });
    const r = await defer(() =>
      simulate({
        spec,
        stockDays: tamper === 'extraStock' ? [...base, extra] : base,
        foilDays: tamper === 'extraFoil' ? [...base, extra] : tamper === 'missingFoil' ? base.slice(1) : base,
        stockAdv: [1, 2],
        foilAdv: [1, 2],
        foilSpec: tamper === 'otherCard' ? { ...spec, id: 'OTHER' + randomId(3) } : tamper === 'newRate' ? { ...spec, rateMinor: spec.rateMinor * 2 } : undefined,
        foilWave: tamper === 'forgedCut' ? forgedWave(7) : undefined,
        condS: cond(1),
        condF: cond(-1),
      }),
    );
    setBusy(false);
    if ('error' in r) setErr(r.error);
    else setPair(r);
  };

  const runPrint = async () => {
    setBusy(true);
    setErr('');
    setPair(null);
    const base = parseDays(days, daysInMonth(spec.year, spec.month));
    const r = await printRoundTrip(spec, tamper === 'extraStock' ? [...base, 20] : base, tamper === 'extraFoil' ? [...base, 20] : base, c.angle, c.blur);
    setBusy(false);
    if ('error' in r) setErr(r.error);
    else setPair(r);
  };

  const runStress = async (n: number) => {
    const flag = { stop: false };
    setStopFlag(flag);
    const t0 = performance.now();
    const st = { n, done: 0, exact: 0, flagged: 0, wrong: 0, ms: 0 };
    setStress({ ...st });
    const samples = fc.sample(arbCond, { numRuns: n, seed: Date.now() % 100000 });
    for (const cond of samples) {
      if (flag.stop) break;
      await defer(() => {
        const sp = newCardSpec({ id: randomId(8), year: 2026, month: 1 + Math.floor(Math.random() * 12), worker: 'Stress', employer: 'Test' });
        const maxD = daysInMonth(sp.year, sp.month);
        const want = [...new Set(Array.from({ length: 4 + Math.floor(Math.random() * 12) }, () => 1 + Math.floor(Math.random() * maxD)))].sort((a, b) => a - b);
        const cd = { ...CLEAN, ...cond } as PhotoConditions;
        const scan = scanPhoto(renderScene([{ spec: sp, role: 'S', days: want, adv: [], H: placeHalf(cd, 'S') }], cd));
        const h = scan.halves[0];
        st.done++;
        if (!h) st.flagged++;
        else {
          const got = h.days.filter((x) => x.punched).map((x) => x.n);
          const ok = JSON.stringify(got) === JSON.stringify(want);
          if (ok) st.exact++;
          else if (h.warnings.length || h.days.some((x) => x.uncertain)) st.flagged++;
          else st.wrong++;
        }
        st.ms = performance.now() - t0;
      });
      setStress({ ...st });
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>Test lab</h1>
      <p className="muted">A photo simulator renders both halves as a phone would see them, then the <i>real</i> scanner reads them. Same engine the property-based tests (Kiro / fast-check) hammer thousands of times.</p>
      <div className="grid2">
        <div className="card">
          <h3>Scenario</h3>
          <div className="field"><label>Days punched (1–30)</label><input value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <div className="field"><label>Balance brought forward (negative = worker owes)</label><input type="number" step="any" value={carry} onChange={(e) => setCarry(Number(e.target.value))} /></div>
          <div className="field">
            <label>Tampering</label>
            <select value={tamper} onChange={(e) => setTamper(e.target.value as Tamper)}>{TAMPERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
            <div className="small muted sans">{TAMPERS.find((t) => t.id === tamper)!.help}</div>
          </div>
          <h3 style={{ marginTop: 14 }}>Camera conditions</h3>
          {([
            ['angle', 'Rotation (±°)', 0, 25, 1],
            ['blur', 'Blur (px)', 0, 1.3, 0.1],
            ['noise', 'Sensor noise', 0, 0.08, 0.005],
            ['gradient', 'Uneven light', 0, 0.6, 0.05],
            ['tilt', 'Perspective tilt', 0, 0.001, 0.0001],
            ['exposure', 'Exposure', 0.5, 1.1, 0.05],
          ] as const).map(([k, label, min, max, step]) => (
            <div className="field" key={k}>
              <label>{label}: {c[k]}</label>
              <input type="range" min={min} max={max} step={step} value={c[k]} onChange={(e) => setC({ ...c, [k]: Number(e.target.value) })} />
            </div>
          ))}
          <div className="row">
            <button className="primary" onClick={go} disabled={busy}>{busy ? <span className="spin" /> : '▶'} Render &amp; scan</button>
            <button onClick={runPrint} disabled={busy} title="Rasterise the real printable sheet, cut it on its wave, punch it, photograph it, and scan it">🖨 Print round-trip</button>
          </div>
          {err && <p style={{ color: 'var(--bad)' }}>{err}</p>}
        </div>

        <div className="card">
          <h3>Stress test</h3>
          <p className="small muted sans">Random in-envelope photos (rotation, tilt, blur, noise, shadows, exposure). Counts exact reads, flagged-for-review, and silently wrong reads (should be 0).</p>
          <div className="row">
            {[10, 30, 100].map((n) => <button key={n} onClick={() => runStress(n)}>Run {n}</button>)}
            <button className="ghost" onClick={() => { stopFlag.stop = true; }}>Stop</button>
          </div>
          {stress && (
            <div style={{ marginTop: 12 }} className="sans">
              <div className="bar"><i style={{ width: `${(stress.done / stress.n) * 100}%` }} /></div>
              <table className="t" style={{ marginTop: 8 }}>
                <tbody>
                  <tr><td>Photos scanned</td><td>{stress.done} / {stress.n}</td></tr>
                  <tr><td>Exactly right</td><td><b style={{ color: 'var(--green)' }}>{stress.exact}</b></td></tr>
                  <tr><td>Flagged for human review</td><td>{stress.flagged}</td></tr>
                  <tr><td>Silently wrong</td><td><b style={{ color: stress.wrong ? 'var(--bad)' : 'inherit' }}>{stress.wrong}</b></td></tr>
                  <tr><td>Avg time / photo</td><td>{stress.done ? Math.round(stress.ms / stress.done) : 0} ms</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {pair && (
            <div style={{ marginTop: 12 }}>
              <h3>Simulated photos</h3>
              <div className="row">
                <canvas className="photo" style={{ width: '48%' }} ref={(el) => { if (el) rgbaToCanvas(pair.stock.photo, el, 400); }} />
                <canvas className="photo" style={{ width: '48%' }} ref={(el) => { if (el) rgbaToCanvas(pair.foil.photo, el, 400); }} />
              </div>
            </div>
          )}
        </div>
      </div>
      {pair && (
        <div style={{ marginTop: 16 }}>
          <Results stock={pair.stock} foil={pair.foil} onReset={() => setPair(null)} />
        </div>
      )}
    </div>
  );
}
