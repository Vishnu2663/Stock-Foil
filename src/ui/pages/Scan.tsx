import { useRef, useState } from 'react';
import type { RGBA } from '../../vision/image';
import { Camera } from '../components/Camera';
import { Results, type Captured } from '../components/Results';
import { useApp } from '../ctx';
import { scanPhotoAsync } from '../scanAsync';
import { drawOverlay, fileToRGBA } from '../imageIO';
import type { CellStatus } from '../../core/wages';

type Slots = { S?: Captured; F?: Captured };

/** Immediate per-photo feedback: the photo with every detected hole ringed, plus a plain summary. */
function HalfPreview({ c }: { c: Captured }) {
  const h = c.half;
  const st = (r: { punched: boolean }): CellStatus => (r.punched ? 'both' : 'none');
  const days = h.days.filter((d) => d.punched).map((d) => d.n);
  const advs = h.adv.filter((d) => d.punched).map((d) => d.n);
  const unsure = [...h.days, ...h.adv].filter((d) => d.uncertain).map((d) => (d.kind === 'day' ? `day ${d.n}` : `advance ${d.n}`));
  const role = h.payload.role === 'S' ? 'Worker half' : 'Employer half';
  return (
    <div>
      <canvas className="photo" ref={(el) => { if (el) drawOverlay(el, c.photo, c.scan, h, h.days.map(st), h.adv.map(st)); }} />
      <p className="sans" style={{ margin: '8px 0 2px' }}>
        <b>✓ {role} detected</b> · card {h.payload.spec.id}
      </p>
      <p className="sans small" style={{ margin: 0 }}>
        Days punched: <b>{days.length ? days.join(', ') : 'none'}</b> · Advances: <b>{advs.length ? advs.join(', ') : 'none'}</b>
      </p>
      <p className="sans small muted" style={{ margin: '2px 0 0' }}>Corner squares {h.fiducialsFound}/4 · cut edge {Math.round(h.edgeCoverage * 100)}% visible</p>
      {unsure.length > 0 && <p className="sans small" style={{ color: 'var(--amber)', margin: '2px 0 0' }}>Unsure: {unsure.join(', ')}</p>}
      {h.fiducialsFound < 3 && <p className="sans small" style={{ color: 'var(--bad)', margin: '2px 0 0' }}>⛔ Not reliable: retake with the whole half in view.</p>}
    </div>
  );
}

export function Scan({ preset }: { preset?: Slots }) {
  const { t, toast, settings } = useApp();
  const [slots, setSlots] = useState<Slots>(preset ?? {});
  const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const [drag, setDrag] = useState(false);
  const [msg, setMsg] = useState('');
  const fileS = useRef<HTMLInputElement>(null);
  const fileF = useRef<HTMLInputElement>(null);
  const fileBoth = useRef<HTMLInputElement>(null);

  const ingest = async (photo: RGBA) => {
    setBusy(true);
    setMsg('');
    const scan = await scanPhotoAsync(photo, settings.calibration.punchRatio ? { punchRatio: settings.calibration.punchRatio } : undefined);
    setBusy(false);
    if (scan.halves.length === 0) {
      setMsg(scan.foreign.length ? 'That QR code is not a Stock & Foil card.' : 'No Stock & Foil card found. Place the half flat on a dark table, fill the frame, and add light.');
      return;
    }
    setSlots((s) => {
      const next = { ...s };
      for (const half of scan.halves) next[half.payload.role] = { photo, scan, half };
      return next;
    });
    if (scan.halves.length === 1) toast(`${scan.halves[0].payload.role === 'S' ? 'Worker' : 'Employer'} half read`);
  };

  const onFile = async (f?: File | null) => {
    if (!f) return;
    try {
      await ingest(await fileToRGBA(f));
    } catch {
      setMsg('Could not open that image.');
    }
  };

  const onFiles = async (files?: FileList | File[] | null) => {
    if (!files) return;
    for (const f of Array.from(files)) await onFile(f);
  };

  const both = slots.S && slots.F;
  if (both) return <Results stock={slots.S!} foil={slots.F!} onReset={() => setSlots({})} />;

  const slot = (role: 'S' | 'F', ref: React.RefObject<HTMLInputElement>, label: string) => (
    <div className={`drop ${slots[role] ? 'has' : ''} ${drag ? 'hot' : ''}`}>
      <h3>{label}</h3>
      {slots[role] ? (
        <>
          <HalfPreview c={slots[role]!} />
          {!slots[role === 'S' ? 'F' : 'S'] && <p className="small sans" style={{ color: 'var(--green)' }}>Now add the {role === 'S' ? 'employer' : 'worker'} half to compare.</p>}
          {slots[role]!.half.warnings.map((w) => <p key={w} className="small sans" style={{ color: 'var(--amber)' }}>⚠ {w}</p>)}
        </>
      ) : (
        <p className="muted small sans">No photo yet</p>
      )}
      <div className="row" style={{ justifyContent: 'center' }}>
        <button onClick={() => ref.current?.click()} disabled={busy}>🖼 {t('scanUpload')}</button>
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
      </div>
    </div>
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
      style={drag ? { outline: '3px dashed var(--red)', outlineOffset: 6, borderRadius: 12 } : undefined}
    >
      <h1 style={{ fontSize: '2rem' }}>{t('scanTitle')}</h1>
      <p className="muted">{t('scanHelp')} You can also drag and drop photos here; they are read automatically.</p>
      {cam ? (
        <div className="card">
          <Camera have={{ S: !!slots.S, F: !!slots.F }} onClose={() => setCam(false)} onCapture={(img) => { ingest(img); }} />
          {busy && <p className="small sans"><span className="spin" /> Reading…</p>}
        </div>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 12 }}>
            <button className="primary" onClick={() => setCam(true)} disabled={busy}>📷 Scan with camera (automatic)</button>
            <span className="small muted sans">Just show each half. It captures by itself.</span>
          </div>
          <div className="grid2">
            {slot('S', fileS, t('scanStock'))}
            {slot('F', fileF, t('scanFoil'))}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button onClick={() => fileBoth.current?.click()} disabled={busy}>🗂 Choose photos (one or both at once)</button>
            <input ref={fileBoth} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
            {busy && <span className="row sans"><span className="spin" /> {t('scanning')}</span>}
          </div>
          {msg && <p className="card flat sans" style={{ marginTop: 12, borderColor: 'var(--bad)' }}>⚠ {msg}</p>}
          <details style={{ marginTop: 16 }}>
            <summary>Photo tips</summary>
            <ul className="sans small">
              <li>Dark, plain surface (a dark cloth works). The cut edge and holes show up against it.</li>
              <li>Whole half in view: the four black corner squares, the QR, and the wavy edge.</li>
              <li>Hold the phone above, roughly parallel to the table. Tilt and rotation are fine.</li>
              <li>Avoid strong glare and shadows across the holes. Add light if the app says it is too dark.</li>
            </ul>
          </details>
        </>
      )}
    </div>
  );
}
