import { useEffect, useRef } from 'react';
import { reducedMotion } from '../fx';

/**
 * Faint punched holes drifting up behind the whole app, at different depths, with a gentle
 * parallax towards the pointer. About 30 shapes at 30 fps; paused when the tab is hidden.
 */
export function HolesField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || reducedMotion()) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { c.width = innerWidth * dpr; c.height = innerHeight * dpr; };
    size();
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const mk = (init: boolean) => ({ x: Math.random(), y: init ? Math.random() : 1.1, z: 0.25 + Math.random() * 0.75, ph: Math.random() * 6.28 });
    const ps = Array.from({ length: 30 }, () => mk(true));
    let mx = 0, my = 0, tx = 0, ty = 0, raf = 0, last = 0;
    const move = (e: PointerEvent) => { tx = e.clientX / innerWidth - 0.5; ty = e.clientY / innerHeight - 0.5; };
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || document.body.classList.contains('is-scrolling') || t - last < 33) return;
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      ctx.clearRect(0, 0, c.width, c.height);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.ph += dt * (0.4 + p.z);
        p.y -= dt * 0.012 * (0.4 + p.z);
        p.x += Math.sin(p.ph) * dt * 0.004;
        if (p.y < -0.12) ps[i] = mk(false);
        const r = (10 + p.z * 46) * dpr;
        const x = (p.x + mx * 0.05 * p.z) * c.width;
        const y = (p.y + my * 0.05 * p.z) * c.height;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 6.283);
        ctx.fillStyle = dark.matches ? `rgba(0,0,0,${0.10 + p.z * 0.1})` : `rgba(110,80,30,${0.03 + p.z * 0.04})`;
        ctx.fill();
        ctx.lineWidth = Math.max(1, p.z * 2.2 * dpr);
        ctx.strokeStyle = dark.matches ? `rgba(255,225,185,${0.04 + p.z * 0.07})` : `rgba(110,80,30,${0.07 + p.z * 0.09})`;
        ctx.stroke();
      }
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('resize', size);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', move); window.removeEventListener('resize', size); };
  }, []);
  return <canvas ref={ref} aria-hidden className="holes-field" />;
}
