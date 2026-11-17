/**
 * Small, dependency-free effects. Every effect checks the user's reduced-motion
 * preference and does nothing when it is on, so the app stays calm for those who
 * ask for that.
 */
import { useEffect, useRef, useState } from 'react';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animated count towards `value` (easing out). Returns the number to display right now. */
export function useCountUp(value: number, ms = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (reducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return shown;
}

/** A short burst of paper confetti from near the top of the screen. */
export function confetti(opts: { x?: number; y?: number; count?: number } = {}) {
  if (reducedMotion() || typeof document === 'undefined') return;
  const c = document.createElement('canvas');
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:200';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  const colors = ['#7a1f1f', '#c2571a', '#ffb347', '#1f7a4a', '#f4ead2', '#e6d6ad'];
  const ox = (opts.x ?? 0.5) * c.width;
  const oy = (opts.y ?? 0.28) * c.height;
  const ps = Array.from({ length: opts.count ?? 90 }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
    const v = (6 + Math.random() * 9) * dpr;
    return { x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: (5 + Math.random() * 7) * dpr, h: (3 + Math.random() * 5) * dpr, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, col: colors[(Math.random() * colors.length) | 0] };
  });
  const t0 = performance.now();
  const tick = (t: number) => {
    const life = (t - t0) / 1700;
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of ps) {
      p.vy += 0.32 * dpr;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - life * life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.abs(Math.cos(p.r * 1.3)) * 0.9 + 0.1); // tumbling
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (life < 1) requestAnimationFrame(tick);
    else c.remove();
  };
  requestAnimationFrame(tick);
}

let tiltReady = false;
/**
 * Pointer tilt for any element carrying data-tilt: it leans towards the cursor and a soft
 * glare follows it. Event delegation on the document, so it works for anything rendered later.
 */
export function initTilt() {
  if (tiltReady || typeof window === 'undefined' || reducedMotion() || !window.matchMedia('(hover: hover)').matches) return;
  tiltReady = true;
  let cur: HTMLElement | null = null;
  const reset = (el: HTMLElement | null) => {
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--lift', '0px');
  };
  document.addEventListener('pointermove', (e) => {
    const el = (e.target as HTMLElement | null)?.closest?.('[data-tilt]') as HTMLElement | null;
    if (cur && cur !== el) reset(cur);
    cur = el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const max = Number(el.dataset.tilt) || 6;
    el.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
    el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
    el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    el.style.setProperty('--lift', '6px');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { reset(cur); cur = null; }, true);
}
