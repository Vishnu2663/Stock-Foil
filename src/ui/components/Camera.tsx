import { useEffect, useRef, useState } from 'react';
import type { RGBA } from '../../vision/image';
import { scanPhotoAsync } from '../scanAsync';
import { videoFrameToRGBA } from '../imageIO';
import { useApp } from '../ctx';
import { BtnIcon } from './BtnIcon';

/**
 * Live camera that captures by itself. About twice a second a frame goes through
 * the same scanner used on payday. When a half that is still needed is read
 * cleanly (QR + all four corner squares, no warnings) on two frames in a row, a
 * full-resolution frame is captured automatically. The camera stays open until
 * the parent has both halves, so the user just shows one half, then the other.
 */
export function Camera({ have, onCapture, onClose }: { have: { S: boolean; F: boolean }; onCapture: (img: RGBA, role: 'S' | 'F') => void; onClose: () => void }) {
  const { settings } = useApp();
  const calib = useRef(settings.calibration);
  const vref = useRef<HTMLVideoElement>(null);
  const [hint, setHint] = useState('Starting camera…');
  const [tone, setTone] = useState<'idle' | 'warn' | 'ok'>('idle');
  const [auto, setAuto] = useState(true);
  const [err, setErr] = useState('');
  const [flash, setFlash] = useState('');
  const [torchOk, setTorchOk] = useState(false);
  const [torch, setTorch] = useState(false);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const paused = useRef(false);
  const autoRef = useRef(true);
  const haveRef = useRef(have);
  const propHave = useRef(have);
  const busy = useRef(false);
  const streak = useRef<{ role: string; n: number }>({ role: '', n: 0 });
  const lastCapture = useRef(0);

  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { haveRef.current = have; propHave.current = have; }, [have]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let alive = true;
    (async () => {
      try {
        // ask for the rear camera at a sensible size, and fall back step by step: some phones refuse the size or the facing mode
        const tries: MediaStreamConstraints[] = [
          { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false },
          { video: { facingMode: 'environment' }, audio: false },
          { video: true, audio: false },
        ];
        let lastErr: unknown;
        for (const c of tries) {
          try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (e) { lastErr = e; if ((e as DOMException)?.name === 'NotAllowedError') throw e; }
        }
        if (!stream) throw lastErr;
        if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
        const v = vref.current!;
        v.srcObject = stream;
        await v.play();
        // phone extras, used only where the camera offers them: continuous focus and the torch
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
        setTorchOk(!!caps.torch);
        if (caps.focusMode?.includes('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined);
        timer = window.setInterval(() => {
          if (busy.current || paused.current || !v.videoWidth || Date.now() - lastCapture.current < 1800) return;
          busy.current = true;
          // Scan at full capture resolution (small/skewed QR codes need the pixels) and
          // capture this very frame if it is good, so what is checked is what is saved.
          const frame = videoFrameToRGBA(v, 1600);
          scanPhotoAsync(frame, calib.current.punchRatio ? { punchRatio: calib.current.punchRatio } : undefined)
            .then((s) => {
              const need = (r: 'S' | 'F') => !haveRef.current[r];
              const h = s.halves.find((x) => need(x.payload.role)) ?? s.halves[0];
              if (!h) {
                streak.current = { role: '', n: 0 };
                setTone('idle');
                setHint(haveRef.current.S ? 'Show the EMPLOYER half (foil) to the camera…' : haveRef.current.F ? 'Show the WORKER half (stock) to the camera…' : 'Show a half to the camera. Hold it flat in good light, whole half in view.');
                return;
              }
              const role = h.payload.role;
              const label = role === 'S' ? 'worker' : 'employer';
              if (!need(role)) {
                setTone('warn');
                setHint(`The ${label} half is already captured. Show the ${role === 'S' ? 'EMPLOYER' : 'WORKER'} half.`);
                return;
              }
              // Block only on things that make the PUNCH reading unreliable. Cut-edge or
              // background warnings (fingers over the edge, bright room) do not block capture.
              const unseen = [...h.days, ...h.pm, ...h.adv].some((c) => !Number.isFinite(c.ratio));
              const reason = h.fiducialsFound < 4 ? `Only ${h.fiducialsFound}/4 corner squares seen: show the whole half, flat to the camera.`
                : unseen ? 'Some punch spots are cut off: show the whole half.'
                : h.pxPerMm < 2.5 ? 'Move the half closer to the camera.'
                : !(h.paperRef > 0.15) ? 'Too dark: add light.'
                : '';
              if (reason) {
                streak.current = { role: '', n: 0 };
                setTone('warn');
                setHint(reason);
                return;
              }
              streak.current = { role, n: streak.current.role === role ? streak.current.n + 1 : 1 };
              setTone('ok');
              if (autoRef.current && streak.current.n >= 2) {
                streak.current = { role: '', n: 0 };
                lastCapture.current = Date.now();
                haveRef.current = { ...haveRef.current, [role]: true };
                setFlash(`✓ ${label} half captured`);
                setTimeout(() => setFlash(''), 1600);
                onCapture(frame, role);
                // if reading the captured frame failed, the parent never marks the half done: allow a retry
                setTimeout(() => { haveRef.current = propHave.current; }, 7000);
              } else {
                const d = h.days.filter((x) => x.punched).map((x) => x.n);
                const a = h.adv.filter((x) => x.punched).map((x) => x.n);
                const pm = h.pm.filter((x) => x.punched).length;
                const seen = `days ${d.length ? d.join(',') : 'none'}${h.payload.spec.halves ? ` · second-half circles ${pm}` : ''} · advances ${a.length ? a.join(',') : 'none'}`;
                const tip = h.edgeCoverage < 0.5 ? ' Tip: keep fingers off the wavy edge so it can be checked.' : '';
                setHint((autoRef.current ? `✓ ${label} half detected (${seen}). Hold still…` : `✓ ${label} half detected (${seen}). Tap capture.`) + tip);
              }
            })
            .catch(() => undefined)
            .finally(() => { busy.current = false; });
        }, 450);
      } catch (e) {
        const name = (e as DOMException)?.name;
        setErr(name === 'NotAllowedError' ? 'permission was denied. Allow the camera for this site in your browser settings, then try again'
          : name === 'NotFoundError' ? 'no camera was found on this device'
          : name === 'NotReadableError' ? 'another app is using the camera. Close it and try again'
          : e instanceof Error ? e.message : 'camera unavailable');
      }
    })();
    const onVis = () => {
      const v = vref.current;
      paused.current = document.hidden;
      if (!v) return;
      if (document.hidden) v.pause(); else v.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      alive = false;
      window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (err)
    return (
      <div className="card">
        <p>Camera not available: {err}. You can use “Choose photos” instead (the camera needs https or localhost).</p>
        <button onClick={onClose}>Close</button>
      </div>
    );
  return (
    <div>
      <div className="cam" style={{ outline: tone === 'ok' ? '4px solid var(--green)' : tone === 'warn' ? '4px solid var(--amber)' : 'none' }}>
        <video ref={vref} playsInline muted />
        <div className={`viewfinder ${tone}`} aria-hidden><b /><b /><b /><b /><span className="beam" /></div>
        {flash && <div className="shutter" aria-hidden />}
        <div className="hint">{flash || hint}</div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <span className={`pill ${have.S ? 'ok' : ''}`}>{have.S ? '✓' : '○'} worker half</span>
        <span className={`pill ${have.F ? 'ok' : ''}`}>{have.F ? '✓' : '○'} employer half</span>
        <label className="row sans" style={{ margin: 0, gap: 6 }}>
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-capture
        </label>
        {torchOk && (
          <button className={torch ? 'primary' : ''} onClick={() => { const next = !torch; setTorch(next); trackRef.current?.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] }).catch(() => setTorch(false)); }} aria-pressed={torch}><BtnIcon name="bulb" /> Light</button>
        )}
        <button disabled={!vref.current?.videoWidth} onClick={() => { const img = videoFrameToRGBA(vref.current!, 1600); onCapture(img, 'S'); }}>📸 Capture now</button>
        <button onClick={onClose}>Close camera</button>
      </div>
    </div>
  );
}
