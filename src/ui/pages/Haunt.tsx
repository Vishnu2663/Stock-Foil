import { useEffect, useRef, useState } from 'react';
import { speak, speechSupported, stopSpeaking } from '../../ai/speech';
import { newCardSpec } from '../../core/card';
import type { Captured } from '../components/Results';
import { rgbaToCanvas } from '../imageIO';
import { defer, forgedWave, simulate } from '../sim';
import { useApp } from '../ctx';

const spec = newCardSpec({ id: 'HAUNT026', year: 2026, month: 10, rateMinor: 60000, advMinor: 20000, worker: 'Ramesh', employer: 'Sharma Builders', lang: 'en' });
const FIVE = [5, 6, 7, 8, 9];
const camS = { angle: 0.1, noise: 0.01, gradient: 0.25, gradDir: 1.1 };
const camF = { angle: -0.18, noise: 0.015, gradient: 0.2, gradDir: 3.5, blur: 0.5, px: 0.0003 };

type Run = { stock: Captured; foil: Captured } | null;

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

export function Haunt() {
  const { settings } = useApp();
  const [i, setI] = useState(0);
  const [play, setPlay] = useState(false);
  const [voice, setVoice] = useState(false);
  const [run, setRun] = useState<Run>(null);
  const [verdictText, setVerdictText] = useState('');
  const [burn, setBurn] = useState(false);
  const token = useRef(0);

  const scenes: { title: string; text: string; art: 'fire' | 'split' | 'card' | 'claim' | 'sneaky' | 'forged' | 'end' }[] = [
    { title: '1834 · The fire', text: 'For seven hundred years England kept its accounts on notched hazel sticks. In October 1834 the old sticks were fed to the furnaces beneath the House of Lords. The chimneys caught fire, and the Houses of Parliament burned down.', art: 'fire' },
    { title: 'Why a stick? It was split.', text: 'A tally was split lengthwise. The creditor kept the stock, the debtor kept the foil. To cheat you had to match a grain nobody can see. The cut was the signature.', art: 'split' },
    { title: 'It comes back from the dead', text: 'Today millions of workers are still paid by the day, in cash, with nothing in writing. Stock and Foil resurrects the tally: a card cut in two along a wavy line that is unique to that card. The worker keeps one half, the employer the other.', art: 'card' },
    { title: 'The claim', text: 'Contractor: you only worked four days. Ramesh has no phone, no payslip, no witness. But his half has five holes, punched together with the employer, every evening.', art: 'claim' },
    { title: 'The sneaky hole', text: 'Someone punches a sixth hole into one half only. The other half never got it. The scanner compares both halves and shows the hole that exists on one side alone. It is never paid.', art: 'sneaky' },
    { title: 'The forgery', text: 'Now someone prints a fake foil with the right name and the right numbers. But it cannot copy the cut. The wavy edges do not fit, and the forgery burns.', art: 'forged' },
    { title: 'Back from the dead', text: 'The tally sticks that burned Parliament have come back from the dead. Paper is the security. Both sides hold the same record, and nobody has to trust an app, a server, or each other.', art: 'end' },
  ];
  const sc = scenes[i];

  // run the real scanner when a scanning scene opens
  useEffect(() => {
    const my = ++token.current;
    setBurn(false);
    setVerdictText('');
    if (sc.art !== 'claim' && sc.art !== 'sneaky' && sc.art !== 'forged') { setRun(null); return; }
    setRun(null);
    defer(() => simulate({
      spec,
      stockDays: sc.art === 'sneaky' ? [...FIVE, 12] : FIVE,
      foilDays: FIVE,
      stockAdv: [1],
      foilAdv: [1],
      foilWave: sc.art === 'forged' ? forgedWave(11) : undefined,
      condS: camS,
      condF: camF,
    })).then(async (r) => {
      if (my !== token.current || 'error' in r) return;
      setRun(r);
      const { verifyPair } = await import('../../vision/pair');
      const v = verifyPair(r.stock.half, r.foil.half);
      const dsp = v.pay.agreed;
      setVerdictText(
        v.verdict === 'pair-mismatch' ? '⛔ These halves do NOT belong together.'
          : v.verdict === 'genuine-disputed' ? `⚠ Genuine pair, but day ${[...v.cmp.stockOnlyDays, ...v.cmp.foilOnlyDays].join(', ')} is on one half only. Agreed: ${dsp.days} days.`
            : `✅ Genuine pair. ${dsp.days} days agree on both halves.`,
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

  // auto-advance
  useEffect(() => {
    if (!play || i >= scenes.length - 1) { if (play && i >= scenes.length - 1) setPlay(false); return; }
    const needsRun = ['claim', 'sneaky', 'forged'].includes(sc.art);
    if (needsRun && !run) return;
    const t = setTimeout(() => setI((x) => x + 1), needsRun ? 9000 : 8000);
    return () => clearTimeout(t);
  }, [play, i, run, sc.art, scenes.length]);

  return (
    <div className="haunt">
      <div className="kicker" style={{ color: '#ffb37a' }}>🎃 Story mode</div>
      <h1 style={{ fontSize: '2.2rem', color: '#fff3dc' }}>{sc.title}</h1>
      <div className="card haunt-card">
        {sc.art === 'fire' && <Fire />}
        {sc.art === 'split' && <Split />}
        {sc.art === 'card' && <CardArt />}
        {sc.art === 'end' && <Fire />}
        {(sc.art === 'claim' || sc.art === 'sneaky' || sc.art === 'forged') && <Photos run={run} burn={burn} />}
        <p style={{ color: '#ffe9c7', fontSize: '1.15rem', marginTop: 12 }}>{sc.text}</p>
        {verdictText && <p className="verdict-line" style={{ color: burn ? '#ff9a6a' : '#ffe9c7' }}>{verdictText}</p>}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>◀ Back</button>
        <button className="primary" onClick={() => setPlay((p) => !p)}>{play ? '⏸ Pause' : '▶ Autoplay'}</button>
        <button onClick={() => setI(Math.min(scenes.length - 1, i + 1))} disabled={i === scenes.length - 1}>Next ▶</button>
        <button onClick={() => { setI(0); setPlay(false); }}>↺ Restart</button>
        {speechSupported() && <label className="row sans" style={{ margin: 0, gap: 6, color: '#ffe2b8' }}><input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Narrate</label>}
        <span className="small" style={{ color: '#ffe2b8' }}>Scene {i + 1} / {scenes.length}</span>
      </div>
    </div>
  );
}
