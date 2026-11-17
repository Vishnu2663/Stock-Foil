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
let scrollReady = false;
/** Pauses background motion while the page scrolls and resumes shortly after, on every device. */
export function initScrollPause() {
  if (scrollReady || typeof window === 'undefined') return;
  scrollReady = true;
  let st = 0;
  window.addEventListener('scroll', () => {
    document.body.classList.add('is-scrolling');
    window.clearTimeout(st);
    st = window.setTimeout(() => document.body.classList.remove('is-scrolling'), 140);
  }, { passive: true });
}

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
  // one style write per frame, however fast the pointer moves
  let pending: PointerEvent | null = null;
  let scheduled = false;
  const apply = () => {
    scheduled = false;
    const e = pending;
    pending = null;
    if (!e) return;
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
  };
  document.addEventListener('pointermove', (e) => {
    pending = e;
    if (!scheduled) { scheduled = true; requestAnimationFrame(apply); }
  }, { passive: true });

  document.addEventListener('pointerleave', () => { reset(cur); cur = null; }, true);
}

/**
 * Scroll reveal: cards, steps and previews rise into view as they enter the screen, one after
 * another. Uses the individual `translate`/`scale` properties so it never fights the pointer
 * tilt, which owns `transform`. Elements added later (a scan result, say) are picked up too.
 */
export function initReveal(): () => void {
  if (reducedMotion() || typeof IntersectionObserver === 'undefined') return () => undefined;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        (e.target as HTMLElement).classList.add('in');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.08, rootMargin: '0px 0px -5% 0px' });
  let pending = 0;
  const scan = () => {
    pending = 0;
    const els = document.querySelectorAll<HTMLElement>('main.wrap .card:not(.rv), main.wrap .step:not(.rv), main.wrap .sheetprev:not(.rv), main.wrap .flip:not(.rv)');
    let k = 0;
    els.forEach((el) => {
      el.classList.add('rv');
      el.style.setProperty('--d', String(Math.min(k++, 8)));
      io.observe(el);
    });
  };
  const mo = new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(scan); });
  mo.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
  scan();
  return () => { mo.disconnect(); io.disconnect(); if (pending) cancelAnimationFrame(pending); };
}

/** Material-style ripple on every button press. */
export function initRipple() {
  if (reducedMotion()) return;
  document.addEventListener('pointerdown', (e) => {
    const b = (e.target as HTMLElement | null)?.closest?.('button, .btn') as HTMLElement | null;
    if (!b || (b as HTMLButtonElement).disabled) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.cssText = `left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;width:${size}px;height:${size}px`;
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  }, { passive: true });
}
