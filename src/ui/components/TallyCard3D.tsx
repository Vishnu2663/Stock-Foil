import { useEffect, useMemo, useState } from 'react';
import { FRAME_W, WAVE_AMP } from '../../core/layout';
import { mulberry32 } from '../../core/prng';
import { makeWave } from '../../core/wave';
import { reducedMotion } from '../fx';

const HOLES = [1, 2, 3, 5]; // the punched days shown
const DAYS = 7;

/** Decorative QR-like block, deterministic per seed, with the three finder squares. */
function QrBlock({ seed }: { seed: number }) {
  const cells = useMemo(() => {
    const r = mulberry32(seed);
    const n = 9;
    return Array.from({ length: n * n }, (_, i) => {
      const x = i % n, y = Math.floor(i / n);
      const block = (bx: number, by: number) => x >= bx && x < bx + 3 && y >= by && y < by + 3;
      if (block(0, 0)) return !(x === 1 && y === 1); // hollow finder squares
      if (block(6, 0)) return !(x === 7 && y === 1);
      if (block(0, 6)) return !(x === 1 && y === 7);
      return r() > 0.5;
    });
  }, [seed]);
  return <div className="tc-qr" aria-hidden>{cells.map((on, i) => <i key={i} className={on ? 'on' : ''} />)}</div>;
}

function Row({ punched, title, sub }: { punched: number[]; title: string; sub: string }) {
  return (
    <>
      <div className="tc-title"><b>{title}</b> {sub}</div>
      <div className="tc-row">
        {Array.from({ length: DAYS }, (_, i) => (
          <span key={i} className="tc-day">
            <em>{i + 4}</em>
            <i className={`tc-hole ${punched.includes(i) ? 'on' : ''}`} />
          </span>
        ))}
      </div>
    </>
  );
}

/**
 * hero:  one card whose two halves slowly separate along a REAL generated wavy cut and fit back
 *        together; it leans towards the pointer; click to cut or join by hand; new wave = new cut.
 * punch: the two halves stacked, a punch tool going through both at once, one hole at a time.
 */
export function TallyCard3D({ mode }: { mode: 'hero' | 'punch' }) {
  const [seed, setSeed] = useState(() => 4242 + Math.floor(Math.random() * 90000));
  const [apart, setApart] = useState<boolean | null>(null); // null = automatic loop
  const [n, setN] = useState(0); // holes punched so far (punch mode)
  const [tool, setTool] = useState<number | null>(null);

  const wave = useMemo(() => makeWave(seed), [seed]);
  const edge = (xp: number) => 54 + (wave((xp / 100) * FRAME_W) / WAVE_AMP) * 5;
  const pts = useMemo(() => Array.from({ length: 51 }, (_, i) => [i * 2, edge(i * 2)] as const), [wave]); // eslint-disable-line react-hooks/exhaustive-deps
  const stockClip = `polygon(0 0, 100% 0, ${[...pts].reverse().map(([x, y]) => `${x}% ${y.toFixed(2)}%`).join(', ')})`;
  const foilClip = `polygon(${pts.map(([x, y]) => `${x}% ${y.toFixed(2)}%`).join(', ')}, 100% 100%, 0 100%)`;

  // punch demo: one punch every ~1.2s, then a pause, then start over
  useEffect(() => {
    if (mode !== 'punch') return;
    if (reducedMotion()) { setN(HOLES.length); return; }
    let alive = true;
    let i = 0;
    const timers: number[] = [];
    const step = () => {
      if (!alive) return;
      if (i >= HOLES.length) {
        timers.push(window.setTimeout(() => { setN(0); setTool(null); i = 0; step(); }, 2600));
        return;
      }
      setTool(HOLES[i]);
      timers.push(window.setTimeout(() => { setN(i + 1); i++; }, 260));
      timers.push(window.setTimeout(step, 1250));
    };
    timers.push(window.setTimeout(step, 600));
    return () => { alive = false; timers.forEach(clearTimeout); };
  }, [mode]);

  if (mode === 'punch') {
    const punched = HOLES.slice(0, n);
    return (
      <div className="tc3d" data-tilt="9" aria-label="A hole punch going through both halves of the card at once" role="img">
        <div className="tc-stage">
          <div className="tc-card tc-stack">
            <div className="tc-shadow" />
            <div className="tc-face tc-layer foil"><Row punched={punched} title="FOIL" sub="employer keeps" /></div>
            <div className="tc-face tc-layer stock"><Row punched={punched} title="STOCK" sub="worker keeps" /><QrBlock seed={seed} /></div>
            {tool !== null && <div key={`${tool}-${n}`} className="tc-punch" style={{ ['--col' as string]: tool }}><span /></div>}
          </div>
        </div>
        <div className="tc-caption">one punch · two halves · same moment</div>
      </div>
    );
  }

  const cls = apart === null ? 'auto' : apart ? 'apart' : 'joined';
  return (
    <div className="tc3d" data-tilt="12">
      <div className="tc-stage" onClick={() => setApart((a) => (a === null ? true : !a))} role="button" tabIndex={0} aria-label="Cut or join the card" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setApart((a) => (a === null ? true : !a)); } }}>
        <div className={`tc-card tc-split ${cls}`}>
          <div className="tc-shadow" />
          <div className="tc-face tc-half stockh" style={{ clipPath: stockClip }}><Row punched={HOLES} title="STOCK" sub="worker keeps" /><QrBlock seed={seed} /></div>
          <div className="tc-face tc-half foilh" style={{ clipPath: foilClip }}><div className="tc-lower"><Row punched={HOLES} title="FOIL" sub="employer keeps" /></div></div>
          <svg className="tc-cut" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <polyline points={pts.map(([x, y]) => `${x},${y.toFixed(2)}`).join(' ')} fill="none" />
          </svg>
        </div>
      </div>
      <div className="tc-caption">
        ✂ every card’s cut is its own signature · click to cut and join ·{' '}
        <button className="tc-new" onClick={() => { setSeed(Math.floor(Math.random() * 1e6)); setApart(true); }}>new wave</button>
      </div>
    </div>
  );
}
