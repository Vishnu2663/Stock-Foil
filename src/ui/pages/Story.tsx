import { useEffect, useRef, useState } from 'react';
import { hasVoiceFor, speak, speechSupported, stopSpeaking } from '../../ai/speech';
import { newCardSpec } from '../../core/card';
import { newPairing } from '../../core/pairing';
import { formatVerdict, STORY_LANGS, storyPack, type VerdictKind } from '../../i18n/story';
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

/** One flame tongue: a teardrop that leans, with a pointed top. */
const tongue = (cx: number, base: number, w: number, h: number, lean: number) =>
  `M${cx - w},${base} C${cx - w * 1.05},${base - h * 0.35} ${cx - w * 0.35 + lean * 0.4},${base - h * 0.6} ${cx + lean},${base - h} C${cx + w * 0.3 + lean * 0.5},${base - h * 0.58} ${cx + w * 1.05},${base - h * 0.32} ${cx + w},${base}Z`;
const TONGUES = [
  [112, 30, 52, -4], [138, 36, 84, 6], [166, 32, 62, -5], [192, 40, 108, 4], [222, 34, 80, -6], [250, 44, 138, 3], [280, 36, 96, -4],
  [308, 40, 118, 6], [336, 32, 74, -3], [362, 38, 100, 5], [390, 30, 66, -5], [414, 26, 46, 3],
];

function Fire() {
  const calm = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = 238;
  return (
    <svg viewBox="0 0 520 296" className="haunt-art" role="img" aria-label="Tally sticks burning in a furnace beneath the Houses of Parliament">
      <defs>
        <radialGradient id="glow" cx="50%" cy="100%" r="80%"><stop offset="0" stopColor="#ff9a2e" stopOpacity=".75" /><stop offset=".5" stopColor="#c2310a" stopOpacity=".3" /><stop offset="1" stopColor="#ff4d00" stopOpacity="0" /></radialGradient>
        <linearGradient id="fOuter" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ff5a0a" /><stop offset=".55" stopColor="#d12c05" stopOpacity=".9" /><stop offset="1" stopColor="#7a0f02" stopOpacity="0" /></linearGradient>
        <linearGradient id="fMid" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#ffb02e" /><stop offset=".6" stopColor="#ff7a14" stopOpacity=".95" /><stop offset="1" stopColor="#ff4d00" stopOpacity="0" /></linearGradient>
        <linearGradient id="fCore" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fffbe0" /><stop offset=".5" stopColor="#ffe27a" stopOpacity=".95" /><stop offset="1" stopColor="#ffc247" stopOpacity="0" /></linearGradient>
        <linearGradient id="coal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff7a18" /><stop offset=".4" stopColor="#a8280a" /><stop offset="1" stopColor="#2a0a05" /></linearGradient>
        {/* turns clean teardrops into licking, ragged flames; the noise drifts upward over time */}
        <filter id="lick" x="-20%" y="-40%" width="140%" height="160%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035 0.05" numOctaves="2" seed="4" result="n">
            {!calm && <animate attributeName="baseFrequency" dur="5s" values="0.035 0.05;0.045 0.075;0.035 0.05" repeatCount="indefinite" />}
            {!calm && <animate attributeName="seed" dur="0.9s" values="2;5;3;7;4;6;2" calcMode="discrete" repeatCount="indefinite" />}
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="n" scale="20" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.1" />
        </filter>
        <filter id="soft"><feGaussianBlur stdDeviation="7" /></filter>
        <filter id="haze" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.01 0.05" numOctaves="2" seed="9"><animate attributeName="baseFrequency" dur="6s" values="0.01 0.05;0.014 0.07;0.01 0.05" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="6" /></filter>
      </defs>
      <rect width="520" height="296" fill="#12060a" />
      <ellipse cx="260" cy="262" rx="320" ry="190" fill="url(#glow)" className="flick" />
      {/* Parliament silhouette, seen through the heat */}
      <g filter={calm ? undefined : 'url(#haze)'}>
        <g fill="#05030a" opacity=".96">
          <rect x="90" y="130" width="340" height="80" />
          <rect x="120" y="90" width="28" height="60" /><polygon points="120,90 134,60 148,90" />
          <rect x="372" y="70" width="34" height="90" /><polygon points="372,70 389,32 406,70" />
          <rect x="250" y="110" width="22" height="40" /><polygon points="250,110 261,86 272,110" />
        </g>
      </g>
      <g>{Array.from({ length: 14 }, (_, i) => <rect key={i} x={104 + i * 24} y={150} width="8" height="14" fill="#ffb347" opacity={i % 3 === 0 ? 0.85 : 0.3} className="flick2" style={{ animationDelay: `${(i * 0.37) % 1.3}s` }} />)}</g>
      {/* furnace glow behind the flames */}
      <g filter="url(#soft)" opacity=".85" className="flick">
        {TONGUES.map(([cx, w, h, lean], i) => <path key={i} d={tongue(cx, base, w * 1.1, h * 0.9, lean)} fill="#ff5a0a" />)}
      </g>
      {/* three flame layers: red edge, orange body, white-hot core */}
      <g filter="url(#lick)" style={{ mixBlendMode: 'screen' }}>
        {TONGUES.map(([cx, w, h, lean], i) => (
          <g key={i} className="tongue" style={{ animationDelay: `${(i * 0.23) % 1.1}s`, animationDuration: `${0.9 + (i % 3) * 0.22}s`, transformOrigin: `${cx}px ${base}px` }}>
            <path d={tongue(cx, base, w, h, lean)} fill="url(#fOuter)" />
            <path d={tongue(cx, base, w * 0.72, h * 0.78, lean * 0.7)} fill="url(#fMid)" />
            <path d={tongue(cx, base, w * 0.38, h * 0.5, lean * 0.4)} fill="url(#fCore)" />
          </g>
        ))}
      </g>
      {/* tally sticks sliding in, glowing and charring as they reach the fire */}
      {[0, 1, 2].map((i) => (
        <g key={i} className="stick" style={{ animationDelay: `${i * 1.1}s` }}>
          <rect x="30" y={214 + i * 9} width="120" height="9" rx="2" fill="#c9a66b" />
          {[0, 1, 2, 3, 4, 5].map((k) => <rect key={k} x={44 + k * 17} y={214 + i * 9} width="3" height="9" fill="#6b4a1f" />)}
          <rect className="stick-burn" x="30" y={214 + i * 9} width="120" height="9" rx="2" fill="#ff7a18" style={{ animationDelay: `${i * 1.1}s` }} />
        </g>
      ))}
      {/* coal bed */}
      <rect x="86" y={base - 2} width="348" height="24" rx="10" fill="url(#coal)" />
      <g className="flick2">{Array.from({ length: 16 }, (_, i) => <ellipse key={i} cx={104 + i * 21 + (i % 2) * 5} cy={base + 6 + (i % 3) * 4} rx={7 + (i % 3) * 2} ry="2.6" fill={i % 2 ? '#ffb347' : '#ff7a18'} opacity={0.55 + (i % 3) * 0.15} style={{ animationDelay: `${(i * 0.21) % 1.2}s` }} />)}</g>
      <rect x="0" y="266" width="520" height="30" fill="#0c0407" /><rect x="0" y="266" width="520" height="1.5" fill="#ff7a18" opacity=".45" /><text x="260" y="285" textAnchor="middle" fontSize="12.5" letterSpacing=".4" fill="#ffe2b8" fontFamily="system-ui">October 1834 · the furnaces under the House of Lords</text>
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
      <rect width="520" height="296" fill="#14080a" />
      <g className="half-top"><path d="M40 30 H480 V118 Q440 134 400 118 T320 120 T240 128 T160 116 T100 128 T40 118Z" fill="#fffaf0" stroke="#cdbb8f" /><text x="56" y="56" fontSize="14" fontWeight="700" fill="#231f1a" fontFamily="system-ui">STOCK · worker keeps</text>{[90, 170, 250, 330, 410].map((x) => <circle key={x} cx={x} cy={88} r={11} fill="#14080a" />)}</g>
      <g className="half-bot"><path d="M40 138 Q80 152 120 144 T200 138 T280 146 T360 138 T440 144 T480 138 V232 H40Z" fill="#f4ead2" stroke="#cdbb8f" /><text x="56" y="222" fontSize="14" fontWeight="700" fill="#231f1a" fontFamily="system-ui">FOIL · employer keeps</text>{[90, 170, 250, 330, 410].map((x) => <circle key={x} cx={x} cy={176} r={11} fill="#14080a" />)}</g>
    </svg>
  );
}

type Scenario = 'claim' | 'sneaky' | 'sloppy' | 'forged';
interface Scene { art: 'fire' | 'split' | 'card' | 'scan' | 'end'; scenario?: Scenario }

/** The nine chapters' structure. The words (title, label, text) come from the chosen language pack. */
const SCENES: Scene[] = [
  { art: 'fire' }, { art: 'split' }, { art: 'card' },
  { art: 'scan', scenario: 'claim' }, { art: 'scan', scenario: 'sneaky' }, { art: 'scan', scenario: 'sloppy' }, { art: 'scan', scenario: 'forged' },
  { art: 'end' }, { art: 'end' },
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
  const [verdict, setVerdict] = useState<{ kind: VerdictKind; n?: number; days?: string } | null>(null);
  const [lang, setLangState] = useState(() => {
    try { const v = localStorage.getItem('sf.storylang'); if (v && STORY_LANGS.some((p) => p.code === v)) return v; } catch { /* ignore */ }
    return STORY_LANGS.some((p) => p.code === settings.lang) ? settings.lang : 'en';
  });
  const [voicesReady, setVoicesReady] = useState(0);
  const setLang = (c: string) => { setLangState(c); try { localStorage.setItem('sf.storylang', c); } catch { /* ignore */ } };
  const [burn, setBurn] = useState(false);
  const token = useRef(0);
  const pack = storyPack(lang);
  const sc = { ...SCENES[i], title: pack.title[i], short: pack.short[i], text: pack.text[i] };
  const verdictText = verdict ? formatVerdict(pack, verdict.kind, verdict) : '';
  const voiceOk = !speechSupported() || voicesReady === 0 || hasVoiceFor(pack.speech);
  const last = i === SCENES.length - 1;

  // voices arrive asynchronously in most browsers
  useEffect(() => {
    if (!speechSupported()) return;
    const on = () => setVoicesReady(speechSynthesis.getVoices().length);
    on();
    speechSynthesis.addEventListener?.('voiceschanged', on);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', on);
  }, []);

  // run the real scanner when a scanning chapter opens
  useEffect(() => {
    const my = ++token.current;
    setBurn(false);
    setVerdict(null);
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
      setVerdict(
        v.verdict === 'pair-mismatch' ? { kind: v.pairing === 'failed' ? 'mismatchPairing' : 'mismatch' }
          : v.verdict === 'genuine-disputed' ? { kind: 'disputed', days: [...v.cmp.stockOnlyDays, ...v.cmp.foilOnlyDays].join(', '), n: a.days }
            : v.pairing === 'verified' && v.edge.verdict !== 'match' ? { kind: 'sloppy', n: a.days }
              : { kind: 'ok', n: a.days },
      );
      if (v.verdict === 'pair-mismatch') setTimeout(() => my === token.current && setBurn(true), 900);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // narration in the chosen language
  useEffect(() => {
    stopSpeaking();
    if (voice) speak(`${sc.title}. ${sc.text}`, lang, settings.speakRate, { tag: pack.speech });
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voice, lang]);
  // the scanner's verdict is read out after the chapter text
  useEffect(() => {
    if (voice && verdictText) speak(verdictText, lang, settings.speakRate, { tag: pack.speech, queue: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict, voice, lang]);

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
      <h1 dir={pack.rtl ? 'rtl' : 'ltr'} lang={pack.code} style={{ fontSize: 'clamp(1.7rem, 4vw, 2.4rem)', color: '#fff3dc' }}>{sc.title}</h1>
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
        <p dir={pack.rtl ? 'rtl' : 'ltr'} lang={pack.code} style={{ color: '#ffe9c7', fontSize: '1.15rem', marginTop: 12 }}>{sc.text}</p>
        {verdictText && <p dir={pack.rtl ? 'rtl' : 'ltr'} lang={pack.code} className="verdict-line" style={{ color: burn ? '#ff9a6a' : '#ffe9c7' }}>{verdictText}</p>}
        {last && (
          <div className="row" style={{ marginTop: 10 }}>
            <button className="primary" onClick={() => go('issue')}>＋ Make a card</button>
            <button onClick={() => go('demo')}>▶ Try the demo</button>
            <button onClick={() => go('scan')}>📷 Scan a card</button>
          </div>
        )}
      </div>

      <div className="story-dock">
        <div className="transport" role="group" aria-label="Playback">
          <button className="t-side" onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0} aria-label="Previous chapter"><span aria-hidden>◀</span><em>Back</em></button>
          <button className="t-play" onClick={() => { if (last) { setI(0); setPlay(true); } else setPlay((p) => !p); }} aria-label={play ? 'Pause' : last ? 'Replay' : 'Autoplay'}>
            <span aria-hidden>{play ? '⏸' : last ? '↺' : '▶'}</span><em>{play ? 'Pause' : last ? 'Replay' : 'Autoplay'}</em>
          </button>
          <button className="t-side" onClick={() => setI(Math.min(SCENES.length - 1, i + 1))} disabled={last} aria-label="Next chapter"><em>Next</em><span aria-hidden>▶</span></button>
        </div>
        <div className="dock-opts">
          {speechSupported() && (
            <label className={`switch mini ${voice ? 'on' : ''}`}>
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /><i aria-hidden /><span>🔊 Narrate</span>
            </label>
          )}
          <label className="lang-chip story-lang">
            <span aria-hidden>🌐</span>
            <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Story language">
              {STORY_LANGS.map((p) => <option key={p.code} value={p.code}>{p.name}{voicesReady > 0 && speechSupported() && !hasVoiceFor(p.speech) ? ' · text only' : ''}</option>)}
            </select>
          </label>
        </div>
      </div>
      {voice && !voiceOk && <p className="small sans" style={{ color: '#ffb37a', margin: '8px 0 0' }}>This device has no {pack.name} voice installed, so the story is shown but not spoken. Pick another language, or add a {pack.name} voice in your system’s speech settings.</p>}
      {lang !== 'en' && <p className="small sans" style={{ color: '#d9c4a0', margin: '6px 0 0' }}>Translations were drafted with AI and should be checked by a native speaker.</p>}
      <nav className="story-dots" aria-label="Chapters">
        {SCENES.map((_s, k) => (
          <button key={k} className={`${k === i ? 'on' : ''} ${k < i ? 'seen' : ''}`} onClick={() => { setI(k); setPlay(false); }} aria-label={`Chapter ${k + 1}: ${pack.short[k]}`} aria-current={k === i ? 'step' : undefined}>
            <span className="dot">{k < i ? '✓' : k + 1}</span><span className="lbl">{pack.short[k]}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
