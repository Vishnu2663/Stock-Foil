import { useEffect, useRef, useState } from 'react';
import type { RGBA } from '../../vision/image';
import { applyH } from '../../core/homography';
import { FRAME_H, FRAME_W, HOLE_R, fiducialCentres, punchCells } from '../../core/layout';
import type { HalfScan } from '../../vision/detect';
import { scanPhotoAsync } from '../scanAsync';
import { videoFrameToRGBA } from '../imageIO';
import { useApp } from '../ctx';
import { BtnIcon } from './BtnIcon';
import { speak } from '../../ai/speech';

/**
 * Live camera that captures by itself. About twice a second a frame goes through
 * the same scanner used on payday. When a half that is still needed is read
 * cleanly (QR + all four corner squares, no warnings) on two frames in a row, a
 * full-resolution frame is captured automatically. The camera stays open until
 * the parent has both halves, so the user just shows one half, then the other.
 */
export function Camera({ have, onCapture, onClose }: { have: { S: boolean; F: boolean }; onCapture: (img: RGBA, role: 'S' | 'F') => void; onClose: () => void }) {
  const { settings, t: tr } = useApp();
  const sayCtx = useRef({ settings, tr });
  sayCtx.current = { settings, tr };
  const lastSay = useRef({ k: '', at: 0 });
  /** pictures-and-voice mode: short spoken instructions, never repeating the same one within a few seconds */
  const say = (k: string) => {
    const { settings: st, tr: tt } = sayCtx.current;
    if (!st.simple) return;
    const now = Date.now();
    if ((lastSay.current.k === k && now - lastSay.current.at < 7000) || (typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking)) return;
    lastSay.current = { k, at: now };
    speak(tt(k), st.lang, st.speakRate);
  };
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
  const ovRef = useRef<HTMLCanvasElement>(null);
  /** the latest scan, drawn over the live picture so you can SEE what the camera understands */
  const lastScan = useRef<{ halves: HalfScan[]; fw: number; fh: number; at: number } | null>(null);
  const born = useRef(new Map<string, number>());
  const toneRef = useRef<'idle' | 'warn' | 'ok'>('idle');
  const autoRef = useRef(true);
  const haveRef = useRef(have);
  const propHave = useRef(have);
  const busy = useRef(false);
  const streak = useRef<{ role: string; n: number }>({ role: '', n: 0 });
  const lastCapture = useRef(0);

  useEffect(() => { autoRef.current = auto; }, [auto]);
  useEffect(() => { toneRef.current = tone; }, [tone]);
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
              lastScan.current = { halves: s.halves, fw: frame.width, fh: frame.height, at: performance.now() };
              if (!s.halves.length) born.current.clear();
              const need = (r: 'S' | 'F') => !haveRef.current[r];
              const h = s.halves.find((x) => need(x.payload.role)) ?? s.halves[0];
              if (!h) {
                streak.current = { role: '', n: 0 };
                setTone('idle');
                say(haveRef.current.S ? 'spkEmployer' : 'spkWorker');
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
              const reason = h.ambiguousSurface ? 'The table is the same shade as the grey discs: put the card on a darker or lighter surface.' : h.fiducialsFound < 4 ? `Only ${h.fiducialsFound}/4 corner squares seen: show the whole half, flat to the camera.`
                : unseen ? 'Some punch spots are cut off: show the whole half.'
                : h.pxPerMm < 2.5 ? 'Move the half closer to the camera.'
                : !(h.paperRef > 0.15) ? 'Too dark: add light.'
                : '';
              if (reason) {
                streak.current = { role: '', n: 0 };
                setTone('warn');
                setHint(reason);
                say(h.ambiguousSurface ? 'spkSurface' : h.fiducialsFound < 4 || unseen ? 'spkWhole' : h.pxPerMm < 2.5 ? 'spkCloser' : 'spkLight');
                return;
              }
              streak.current = { role, n: streak.current.role === role ? streak.current.n + 1 : 1 };
              setTone('ok');
              say('spkHold');
              if (autoRef.current && streak.current.n >= 2) {
                streak.current = { role: '', n: 0 };
                lastCapture.current = Date.now();
                haveRef.current = { ...haveRef.current, [role]: true };
                navigator.vibrate?.(60); // a felt confirmation on phones
                lastSay.current = { k: '', at: 0 };
                if (sayCtx.current.settings.simple) { try { speechSynthesis.cancel(); } catch { /* ignore */ } speak(sayCtx.current.tr('spkDone'), sayCtx.current.settings.lang, sayCtx.current.settings.speakRate); }
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
    // ---- overlay: the card outline, the corner squares, and every hole as the scanner reads it
    let raf = 0;
    const paint = () => {
      raf = requestAnimationFrame(paint);
      const c = ovRef.current;
      const v = vref.current;
      if (!c || !v) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = c.clientWidth, ch = c.clientHeight;
      if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(ch * dpr)) { c.width = Math.round(cw * dpr); c.height = Math.round(ch * dpr); }
      const ctx = c.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      const ls = lastScan.current;
      if (!ls || !v.videoWidth || !ls.halves.length) return;
      const now = performance.now();
      const age = now - ls.at;
      const fade = age < 2200 ? 1 : age < 3000 ? 1 - (age - 2200) / 800 : 0;
      if (fade <= 0) return;
      // video pixels -> what is on screen (the video is letter-boxed by object-fit: contain)
      const sc = Math.min(cw / v.videoWidth, ch / v.videoHeight);
      const ox = (cw - v.videoWidth * sc) / 2, oy = (ch - v.videoHeight * sc) / 2;
      const kx = (v.videoWidth / ls.fw) * sc, ky = (v.videoHeight / ls.fh) * sc;
      ctx.globalAlpha = fade;
      for (const h of ls.halves) {
        const toScr = (x: number, y: number) => { const p = applyH(h.H, { x, y }); return { x: ox + p.x * kx, y: oy + p.y * ky }; };
        const needed = !haveRef.current[h.payload.role];
        const col = !needed ? '#8fb4ff' : toneRef.current === 'ok' ? '#2fbf71' : '#f6a609';
        const mm = h.pxPerMm * kx; // screen pixels per millimetre of card
        // outline with corner brackets
        const q = [toScr(0, 0), toScr(FRAME_W, 0), toScr(FRAME_W, FRAME_H), toScr(0, FRAME_H)];
        ctx.lineJoin = 'round';
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = fade * 0.55;
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
        ctx.globalAlpha = fade; ctx.lineWidth = 4; ctx.lineCap = 'round';
        q.forEach((p, i) => {
          const a = q[(i + 1) % 4], b = q[(i + 3) % 4];
          const u = (t: { x: number; y: number }) => { const d = Math.hypot(t.x - p.x, t.y - p.y) || 1; const L = Math.min(22, d * 0.2); return { x: p.x + ((t.x - p.x) / d) * L, y: p.y + ((t.y - p.y) / d) * L }; };
          ctx.beginPath(); ctx.moveTo(u(a).x, u(a).y); ctx.lineTo(p.x, p.y); ctx.lineTo(u(b).x, u(b).y); ctx.stroke();
        });
        ctx.shadowBlur = 0;
        // the four corner squares the scanner locked onto
        ctx.fillStyle = col;
        for (const f of fiducialCentres()) { const p = toScr(f.x, f.y); ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(3, mm * 1.2), 0, 6.283); ctx.globalAlpha = fade * 0.5; ctx.fill(); ctx.globalAlpha = fade; }
        // every punch target: filled ring that pops in for a hole, dashed amber when unsure, a faint dot for an empty spot
        for (const cell of punchCells(h.payload.spec)) {
          const list = cell.kind === 'day' ? h.days : cell.kind === 'pm' ? h.pm : h.adv;
          const r = list.find((x) => x.n === cell.n);
          if (!r) continue;
          const p = toScr(cell.cx, cell.cy);
          const R = Math.max(3, HOLE_R * mm * 1.25);
          const key = `${h.payload.role}${cell.kind}${cell.n}`;
          if (r.punched) {
            if (!born.current.has(key)) born.current.set(key, now);
            const t = Math.min(1, (now - born.current.get(key)!) / 280);
            const rad = R * (0.35 + 0.65 * (1 + 1.7 * Math.pow(t - 1, 3) + 0.7 * Math.pow(t - 1, 2)));
            ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.283);
            ctx.fillStyle = 'rgba(47,191,113,.2)'; ctx.fill();
            ctx.strokeStyle = '#2fbf71'; ctx.lineWidth = 2.4; ctx.setLineDash([]); ctx.stroke();
          } else if (r.uncertain) {
            ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283);
            ctx.strokeStyle = '#f6a609'; ctx.lineWidth = 2; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
          } else {
            born.current.delete(key);
            ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1.4, R * 0.18), 0, 6.283);
            ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(paint);
    const onVis = () => {
      const v = vref.current;
      paused.current = document.hidden;
      if (!v) return;
      if (document.hidden) v.pause(); else v.play().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf);
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
        <canvas ref={ovRef} className="cam-ov" aria-hidden />
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
