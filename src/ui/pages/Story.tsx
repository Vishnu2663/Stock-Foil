import { useEffect, useRef, useState } from 'react';
import { speak, speechSupported, stopSpeaking } from '../../ai/speech';
import { newCardSpec } from '../../core/card';
import { newPairing } from '../../core/pairing';
import { verifyPair } from '../../vision/pair';
import type { Captured } from '../components/Results';
import { rgbaToCanvas } from '../imageIO';
import { defer, forgedWave, simulate } from '../sim';
import { useApp } from '../ctx';

// a PAIRED card, like every card the app issues by default
const spec = { ...newCardSpec({ id: 'STORY026', year: 2026, month: 10, rateMinor: 60000, advMinor: 20000, worker: 'Ramesh', employer: 'Sharma Builders', lang: 'en' }), pairing: newPairing() };
const FIVE = [5, 6, 7, 8, 9];
const camS = { angle: 0.1, noise: 0.01, gradient: 0.25, gradDir: 1.1 };
const camF = { angle: -0.18, noise: 0.015, gradient: 0.2, gradDir: 3.5, blur: 0.5, px: 0.0003 };

type Run = { stock: Captured; foil: Captured } | null;

/** Drifting embers behind the fire scenes. Off for reduced motion. */
function Embers({ on }: { on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!on || !c || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = c.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => { c.width = Math.max(1, c.clientWidth * dpr); c.height = Math.max(1, c.clientHeight * dpr); };
    size();
    const spawn = (init: boolean) => ({ x: Math.random(), y: init ? Math.random() : 1.04, vx: (Math.random() - 0.5) * 0.03, vy: -(0.06 + Math.random() * 0.14), r: 0.7 + Math.random() * 2.4, ph: Math.random() * 6.28 });
    const ps = Array.from({ length: 64 }, () => spawn(true));
    let last = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.ph += dt * 3;
        p.x += (p.vx + Math.sin(p.ph) * 0.012) * dt * 4;
        p.y += p.vy * dt;
        if (p.y < -0.05) ps[i] = spawn(false);
        const a = Math.max(0, Math.min(1, p.y * 1.3)) * (0.55 + 0.45 * Math.sin(p.ph * 2));
        const g = ctx.createRadialGradient(p.x * c.width, p.y * c.height, 0, p.x * c.width, p.y * c.height, p.r * 5 * dpr);
        g.addColorStop(0, `rgba(255,190,90,${0.9 * a})`);
        g.addColorStop(0.4, `rgba(255,110,30,${0.35 * a})`);
        g.addColorStop(1, 'rgba(255,60,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, p.r * 5 * dpr, 0, 6.283);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('resize', size);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [on]);
  return <canvas ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', borderRadius: 10 }} />;
}

function Fire() {
  return (
    <svg viewBox="0 0 520 260" className="haunt-art" role="img" aria-label="Tally sticks burning in a furnace beneath the Houses of Parliament">
      <defs>
        <radialGradient id="glow" cx="50%" cy="100%" r="80%"><stop offset="0" stopColor="#ff9a2e" stopOpacity=".9" /><stop offset="1" stopColor="#ff4d00" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="520" height="260" fill="#14080a" />
      <ellipse cx="260" cy="260" rx="300" ry="170" fill="url(#glow)" className="flick" />
      {/* Parliament silhouette */}
      <g fill="#05030a" opacity=".95">
        <rect x="90" y="130" width="340" height="80" />
        <rect x="120" y="90" width="28" height="60" /><polygon points="120,90 134,60 148,90" />
        <rect x="372" y="70" width="34" height="90" /><polygon points="372,70 389,32 406,70" />
        <rect x="250" y="110" width="22" height="40" /><polygon points="250,110 261,86 272,110" />
        {Array.from({ length: 14 }, (_, i) => <rect key={i} x={104 + i * 24} y={150} width="8" height="14" fill="#ffb347" opacity={i % 3 === 0 ? 0.9 : 0.35} className="flick2" />)}
      </g>
      {/* flames */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <path key={i} className="flame" style={{ animationDelay: `${i * 0.18}s`, transformOrigin: `${130 + i * 42}px 232px` }} d={`M${112 + i * 42},232 Q${120 + i * 42},170 ${130 + i * 42},150 Q${140 + i * 42},180 ${150 + i * 42},232Z`} fill={i % 2 ? '#ff7a18' : '#ffb347'} />
      ))}
      {/* tally sticks sliding into the fire */}
      {[0, 1, 2].map((i) => (
        <g key={i} className="stick" style={{ animationDelay: `${i * 1.1}s` }}>
          <rect x="30" y={196 + i * 8} width="120" height="9" rx="2" fill="#c9a66b" />
          {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={44 + k * 17} y={196 + i * 8} width="3" height="9" fill="#6b4a1f" />)}
        </g>
      ))}
      <text x="260" y="248" textAnchor="middle" fontSize="13" fill="#ffe2b8" fontFamily="system-ui" opacity=".9">October 1834 · the furnaces under the House of Lords</text>
    </svg>
  );
}

function Split() {
  return (
    <svg viewBox="0 0 520 220" className="haunt-art" role="img" aria-label="A tally stick split lengthwise into stock and foil">
      <rect width="520" height="220" fill="#14080a" />
      <g className="half-top"><rect x="60" y="70" width="400" height="34" rx="6" fill="#c9a66b" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={90 + i * 42} y={70} width="5" height="34" fill="#6b4a1f" />)}<text x="70" y="62" fontSize="13" fill="#ffe2b8" fontFamily="system-ui">STOCK · creditor keeps</text></g>
      <g className="half-bot"><rect x="60" y="106" width="400" height="34" rx="6" fill="#b8955a" />{Array.from({ length: 9 }, (_, i) => <rect key={i} x={90 + i * 42} y={106} width="5" height="34" fill="#6b4a1f" />)}<text x="70" y="168" fontSize="13" fill="#ffe2b8" fontFamily="system-ui">FOIL · debtor keeps</text></g>
      <text x="260" y="205" textAnchor="middle" fontSize="13" fill="#ffe2b8" fontFamily="system-ui" opacity=".9">Only the matching grain proves they belong together.</text>
    </svg>
  );
}

function CardArt() {
  return (
    <svg viewBox="0 0 520 260" className="haunt-art" role="img" aria-label="A printed card cut in two along a wavy line, with matching punched holes">
      <rect width="520" height="260" fill="#14080a" />
      <g className="half-top"><path d="M40 30 H480 V118 Q440 134 400 118 T320 120 T240 128 T160 116 T100 128 T40 118Z" fill="#fffaf0" stroke="#cdbb8f" /><text x="56" y="56" fontSize="14" fontWeight="700" fill="#231f1a" fontFamily="system-ui">STOCK · worker keeps</text>{[90, 170, 250, 330, 410].map((x) => <circle key={x} cx={x} cy={88} r={11} fill="#14080a" />)}</g>
      <g className="half-bot"><path d="M40 138 Q80 152 120 144 T200 138 T280 146 T360 138 T440 144 T480 138 V232 H40Z" fill="#f4ead2" stroke="#cdbb8f" /><text x="56" y="222" fontSize="14" fontWeight="700" fill="#231f1a" fontFamily="system-ui">FOIL · employer keeps</text>{[90, 170, 250, 330, 410].map((x) => <circle key={x} cx={x} cy={176} r={11} fill="#14080a" />)}</g>
    </svg>
  );
}

type Scenario = 'claim' | 'sneaky' | 'sloppy' | 'forged';
interface Scene { title: string; short: string; text: string; art: 'fire' | 'split' | 'card' | 'scan' | 'end'; scenario?: Scenario }

const SCENES: Scene[] = [
  { title: '1834 · The fire', short: 'The fire', art: 'fire', text: 'For seven hundred years England kept its accounts on notched hazel sticks. In October 1834 the old sticks were fed to the furnaces beneath the House of Lords. The chimneys caught fire, and the Houses of Parliament burned down.' },
  { title: 'Why a stick? It was split.', short: 'The split', art: 'split', text: 'A tally was split lengthwise. The creditor kept the stock, the debtor kept the foil. To cheat you had to match a grain nobody can see. The two halves were the proof.' },
  { title: 'It comes back from the dead', short: 'Resurrection', art: 'card', text: 'Today millions of workers are still paid by the day, in cash, with nothing in writing. Stock and Foil resurrects the tally: a card cut in two along a wavy line. The worker keeps one half, the employer the other, and every evening both are punched together.' },
  { title: 'The claim', short: 'The claim', art: 'scan', scenario: 'claim', text: 'Contractor: you only worked four days. Ramesh has no phone, no payslip, no witness. But his half has five holes, and the scanner confirms the pair is genuine: both halves carry matching secret codes.' },
  { title: 'The sneaky hole', short: 'Extra hole', art: 'scan', scenario: 'sneaky', text: 'Someone punches a sixth hole into one half only. The other half never got it. The scanner compares both halves and shows the hole that exists on one side alone. It is never paid.' },
  { title: 'A sloppy cut? No problem.', short: 'Sloppy cut', art: 'scan', scenario: 'sloppy', text: 'Hand cutting is never perfect. Here the foil was cut along a completely different line, so the wavy edges do not fit. Old paper tallies would have been rejected. But the QR codes carry a pairing secret, so the pair is still proven genuine.' },
  { title: 'The forgery that fits perfectly', short: 'The forgery', art: 'scan', scenario: 'forged', text: 'Now someone prints a fake foil using everything on the worker’s half: the name, the numbers, even the same cut. The edges fit perfectly. But the secret in the QR cannot be copied from one half to invent the other, so the forgery fails, and burns.' },
  { title: 'Paid once. Only once.', short: 'Paid', art: 'end', text: 'At payday the agreed days become a pay slip, the money is recorded in a tamper-evident ledger, and the card cannot be paid twice. A balance owed carries forward to next month, locked into the next card.' },
  { title: 'Back from the dead', short: 'The end', art: 'end', text: 'The tally sticks that burned Parliament have come back from the dead. Paper is the security. Both sides hold the same record, and nobody has to trust an app, a server, or each other.' },
];

function Photos({ run, burn }: { run: Run; burn: boolean }) {
  if (!run) return <div className="small" style={{ color: '#ffe2b8' }}><span className="spin" /> Running the real scanner…</div>;
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <canvas className="photo" ref={(el) => { if (el) rgbaToCanvas(run.stock.photo, el, 520); }} />
        <div className="small" style={{ color: '#ffe2b8', marginTop: 4 }}>Worker half</div>
      </div>
      <div style={{ flex: 1, minWidth: 220, position: 'relative' }}>
        <div className={burn ? 'burning' : ''} style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
          <canvas className="photo" ref={(el) => { if (el) rgbaToCanvas(run.foil.photo, el, 520); }} />
          {burn && <div className="flames-overlay" aria-hidden />}
        </div>
        <div className="small" style={{ color: burn ? '#ff9a6a' : '#ffe2b8', marginTop: 4 }}>{burn ? '🔥 forged half: burned' : 'Employer half'}</div>
      </div>
    </div>
  );
}

export function Story({ go }: { go: (r: string) => void }) {
  const { settings } = useApp();
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const [voice, setVoice] = useState(false);
  const [run, setRun] = useState<Run>(null);
  const [verdictText, setVerdictText] = useState('');
  const [burn, setBurn] = useState(false);
  const token = useRef(0);
  const sc = SCENES[i];
  const last = i === SCENES.length - 1;

  // run the real scanner when a scanning chapter opens
  useEffect(() => {
    const my = ++token.current;
    setBurn(false);
    setVerdictText('');
    setRun(null);
    if (sc.art !== 'scan') return;
    const k = sc.scenario!;
    const fake = { ...spec, pairing: newPairing() }; // the forger copies the card's details but cannot know the secret
    defer(() => simulate({
      spec,
      stockDays: k === 'sneaky' ? [...FIVE, 12] : FIVE,
      foilDays: FIVE,
      stockAdv: [1],
      foilAdv: [1],
      foilSpec: k === 'forged' ? fake : undefined,
      foilWave: k === 'sloppy' ? forgedWave(11) : undefined,
      condS: camS,
      condF: camF,
    })).then((r) => {
      if (my !== token.current || 'error' in r) return;
      setRun(r);
      const v = verifyPair(r.stock.half, r.foil.half);
      const a = v.pay.agreed;
      setVerdictText(
        v.verdict === 'pair-mismatch' ? (v.pairing === 'failed' ? '⛔ The pairing codes do not fit. The cut matched perfectly, but the secret could not be copied.' : '⛔ These halves do NOT belong together.')
          : v.verdict === 'genuine-disputed' ? `⚠ Genuine pair, but day ${[...v.cmp.stockOnlyDays, ...v.cmp.foilOnlyDays].join(', ')} is on one half only. Agreed: ${a.days} days.`
            : v.pairing === 'verified' && v.edge.verdict !== 'match' ? `✅ Genuine pair, even though the cut edges do not fit: the pairing code proves it. ${a.days} days agree.`
              : `✅ Genuine pair, pairing code verified. ${a.days} days agree on both halves.`,
      );
      if (v.verdict === 'pair-mismatch') setTimeout(() => my === token.current && setBurn(true), 900);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // narration
  useEffect(() => {
    stopSpeaking();
    if (voice) speak(`${sc.title}. ${sc.text}`, 'en', settings.speakRate);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voice]);

  // autoplay
  useEffect(() => {
    if (!play) return;
    if (last) { setPlay(false); return; }
    if (sc.art === 'scan' && !run) return;
    const t = setTimeout(() => setI((x) => x + 1), sc.art === 'scan' ? 10000 : 8000);
    return () => clearTimeout(t);
  }, [play, i, run, sc.art, last]);

  // keyboard: arrows to move, space to play/pause
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === 'ArrowRight') setI((x) => Math.min(SCENES.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className="haunt story-page">
      <div className="kicker" style={{ color: '#ffb37a' }}>🎃 Story · chapter {i + 1} of {SCENES.length}</div>
      <h1 style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', color: '#fff3dc' }}>{sc.title}</h1>
      <div className="story-progress" role="progressbar" aria-valuemin={1} aria-valuemax={SCENES.length} aria-valuenow={i + 1}><i style={{ width: `${((i + 1) / SCENES.length) * 100}%` }} /></div>

      <div className="card haunt-card" key={i}>
        <div style={{ position: 'relative' }}>
          {sc.art === 'fire' && <Fire />}
          {sc.art === 'split' && <Split />}
          {sc.art === 'card' && <CardArt />}
          {sc.art === 'end' && <Fire />}
          {sc.art === 'scan' && <Photos run={run} burn={burn} />}
          <Embers on={sc.art === 'fire' || sc.art === 'end'} />
        </div>
        <p style={{ color: '#ffe9c7', fontSize: '1.15rem', marginTop: 12 }}>{sc.text}</p>
        {verdictText && <p className="verdict-line" style={{ color: burn ? '#ff9a6a' : '#ffe9c7' }}>{verdictText}</p>}
        {last && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={() => go('issue')}>＋ Make a card</button>
            <button onClick={() => go('demo')}>▶ Try the demo</button>
            <button onClick={() => go('scan')}>📷 Scan a card</button>
          </div>
        )}
      </div>

      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀ Back</button>
        <button className="primary" onClick={() => { if (last) { setI(0); setPlay(true); } else setPlay((p) => !p); }}>{play ? '⏸ Pause' : last ? '↺ Replay' : '▶ Autoplay'}</button>
        <button onClick={() => setI(Math.min(SCENES.length - 1, i + 1))} disabled={last}>Next ▶</button>
        {speechSupported() && <label className="row sans" style={{ margin: 0, gap: 6, color: '#ffe2b8' }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Narrate</label>}
      </div>
      <nav className="story-dots" aria-label="Chapters">
        {SCENES.map((s2, k) => (
          <button key={k} className={`${k === i ? 'on' : ''} ${k < i ? 'seen' : ''}`} onClick={() => { setI(k); setPlay(false); }} aria-label={`Chapter ${k + 1}: ${s2.short}`} aria-current={k === i ? 'step' : undefined}>
            <span className="dot" /><span className="lbl">{s2.short}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
