import { useRef, useState } from 'react';
import type { HalfScan } from '../../vision/detect';
import { calibrate, DEFAULT_PUNCH_RATIO } from '../../vision/calibrate';
import { ALIGN_TOL_MM } from '../../vision/pair';
import { scanPhotoAsync } from '../scanAsync';
import { download, fileToRGBA } from '../imageIO';
import { useApp } from '../ctx';

interface Row { name: string; half: HalfScan }

export function Calibrate() {
  const { settings, setSettings, toast } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const add = async (files?: FileList | File[] | null) => {
    if (!files) return;
    setBusy(true);
    setMsg('');
    const out: Row[] = [];
    const missed: string[] = [];
    for (const f of Array.from(files)) {
      try {
        // measured with DEFAULT settings so numbers are comparable whatever is currently applied
        const scan = await scanPhotoAsync(await fileToRGBA(f));
        if (!scan.halves.length) missed.push(f.name);
        for (const h of scan.halves) out.push({ name: f.name, half: h });
      } catch {
        missed.push(f.name);
      }
    }
    setRows((r) => [...r, ...out]);
    if (missed.length) setMsg(`No card found in: ${missed.join(', ')}`);
    setBusy(false);
  };

  const rep = rows.length ? calibrate(rows.map((r) => r.half)) : null;
  const cur = settings.calibration;
  const applied = cur.punchRatio !== undefined || cur.alignTolMm !== undefined;

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
      style={drag ? { outline: '3px dashed var(--red)', outlineOffset: 6, borderRadius: 12 } : undefined}
    >
      <h1 style={{ fontSize: '2rem' }}>Calibrate</h1>
      <p className="muted">Tune the scanner to <b>your</b> paper, punch, light and phone. Upload photos of cards that were really punched (both halves, stacked and punched together). The app measures how clearly holes stand out, how big they are, and how well the two halves line up, then suggests settings. Nothing changes until you press Apply.</p>

      <div className="card">
        <div className="row">
          <button className="primary" onClick={() => input.current?.click()} disabled={busy}>🖼 Choose photos</button>
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <button className="ghost" onClick={() => { setRows([]); setMsg(''); }} disabled={!rows.length}>Clear</button>
          {busy && <span className="row sans"><span className="spin" /> Reading…</span>}
          <span className="small muted sans">or drag and drop. Best: 2 to 4 pairs, at least 6 punched holes in all.</span>
        </div>
        {msg && <p className="sans small" style={{ color: 'var(--amber)' }}>⚠ {msg}</p>}
        <p className="small muted sans" style={{ marginTop: 8 }}>Use only <b>honest</b> cards here (holes really punched through both halves together). Marker dots or separately made holes would teach the app the wrong tolerance.</p>
      </div>

      {rep && (
        <>
          <div className="grid2" style={{ marginTop: 16 }}>
            <div className="card">
              <h3>What was measured</h3>
              <table className="t">
                <tbody>
                  <tr><td>Photos / pairs</td><td>{rep.halves} / {rep.pairs}</td></tr>
                  <tr><td>Punched · blank targets</td><td>{rep.punched} · {rep.blank}</td></tr>
                  <tr><td>Brightest punched (ratio)</td><td>{rep.maxPunchedRatio?.toFixed(2) ?? '—'}</td></tr>
                  <tr><td>Darkest blank (ratio)</td><td>{rep.minBlankRatio?.toFixed(2) ?? '—'}</td></tr>
                  <tr><td>Separation</td><td><b style={{ color: rep.separation !== null && rep.separation > 0 ? 'var(--green)' : 'var(--bad)' }}>{rep.separation?.toFixed(2) ?? '—'}</b></td></tr>
                  <tr><td>Hole radius</td><td>{rep.holeRadiusMm ? `${rep.holeRadiusMm.mean.toFixed(2)} ± ${rep.holeRadiusMm.sd.toFixed(2)} mm (n=${rep.holeRadiusMm.n})` : '—'}</td></tr>
                  <tr><td>Worst alignment between halves</td><td>{rep.alignmentMaxMm !== null ? `${rep.alignmentMaxMm.toFixed(2)} mm` : '—'}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3>Suggested settings</h3>
              <table className="t">
                <thead><tr><th>Setting</th><th>Default</th><th>Suggested</th><th>Applied now</th></tr></thead>
                <tbody>
                  <tr><td>Hole threshold</td><td>{DEFAULT_PUNCH_RATIO}</td><td><b>{rep.recommended.punchRatio}</b></td><td>{cur.punchRatio ?? 'default'}</td></tr>
                  <tr><td>Punched-together tolerance (mm)</td><td>{ALIGN_TOL_MM}</td><td><b>{rep.recommended.alignTolMm}</b></td><td>{cur.alignTolMm ?? 'default'}</td></tr>
                </tbody>
              </table>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="primary" onClick={() => { setSettings({ ...settings, calibration: { punchRatio: rep.recommended.punchRatio, alignTolMm: rep.recommended.alignTolMm } }); toast('Calibration applied to this device'); }}>✓ Apply to this device</button>
                <button onClick={() => { setSettings({ ...settings, calibration: {} }); toast('Back to default settings'); }} disabled={!applied}>↺ Reset to defaults</button>
                <button onClick={() => download('calibration-report.json', JSON.stringify({ report: rep, photos: rows.map((r) => ({ file: r.name, role: r.half.payload.role, cornerSquares: r.half.fiducialsFound, pxPerMm: r.half.pxPerMm })) }, null, 2), 'application/json')}>⬇ Report</button>
              </div>
              {rep.notes.length > 0 && <ul className="small sans" style={{ paddingLeft: 18 }}>{rep.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3>Photos</h3>
            <table className="t">
              <thead><tr><th>File</th><th>Half</th><th>Card</th><th>Corners</th><th>px/mm</th><th>Punched</th><th>Unsure</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>{r.half.payload.role === 'S' ? 'worker' : 'employer'}</td>
                    <td className="mono">{r.half.payload.spec.id}</td>
                    <td>{r.half.fiducialsFound}/4</td>
                    <td>{r.half.pxPerMm.toFixed(1)}</td>
                    <td>{[...r.half.days, ...r.half.adv].filter((c) => c.punched).length}</td>
                    <td>{[...r.half.days, ...r.half.adv].filter((c) => c.uncertain).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
