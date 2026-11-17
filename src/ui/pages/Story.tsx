import { useEffect, useRef, useState } from 'react';
import { hasVoiceFor, speak, speechSupported, stopSpeaking, subscribeVoiceHealth, voiceQuality, voiceStatus, voicesFor } from '../../ai/speech';
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
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3dfae" /><stop offset=".5" stopColor="#d9b877" /><stop offset="1" stopColor="#a8803f" /></linearGradient>
        <linearGradient id="hot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ff7a18" stopOpacity="0" /><stop offset=".55" stopColor="#ff5a0a" stopOpacity=".6" /><stop offset="1" stopColor="#ffd070" /></linearGradient>
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
      <g aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          <path key={i} d={`M${112 + i * 41},166 v-14 a5,5 0 0 1 10,0 v14z`} fill="#ffeab0" stroke="#2a1a10" strokeWidth="1.2" opacity={i % 3 === 0 ? 0.7 : 0.32} className="flick2" style={{ animationDelay: `${(i * 0.37) % 1.3}s` }} />
        ))}
        <text x="430" y="132" textAnchor="end" fontSize="8.5" letterSpacing=".6" fill="#b9a384" fontFamily="system-ui" opacity=".85">PARLIAMENT · LIT WINDOWS</text>
      </g>
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
      {[0, 1].map((i) => {
        const y = 196 + i * 20;
        return (
          <g key={i} className="stick" style={{ animationDelay: `${i * 1.6}s` }}>
            <rect x="28" y={y + 2} width="150" height="15" rx="4" fill="#000" opacity=".35" />
            <rect x="28" y={y} width="150" height="15" rx="4" fill="url(#wood)" stroke="#fff1cf" strokeWidth="1.3" />
            {[0, 1, 2, 3, 4, 5, 6].map((k) => <path key={k} d={`M${44 + k * 19},${y} l3.2,7.5 l3.2,-7.5z`} fill="#4a2d10" />)}
            <rect x="28" y={y} width="150" height="15" rx="4" fill="url(#hot)" className="stick-burn" style={{ animationDelay: `${i * 1.6}s` }} />
          </g>
        );
      })}
      <g aria-hidden>
        <rect x="24" y="172" width="212" height="15" rx="7.5" fill="#1a0a06" opacity=".9" />
        <text x="130" y="182.6" textAnchor="middle" fontSize="8" letterSpacing=".35" fill="#ffe2b8" fontFamily="system-ui" fontWeight="700" textLength="196" lengthAdjust="spacing">TALLY STICKS · EACH NOTCH = A DEBT</text>
      </g>
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
  const [, setHealthTick] = useState(0);
  useEffect(() => subscribeVoiceHealth(() => setHealthTick((n) => n + 1)), []);
  const [textDone, setTextDone] = useState(false);
  const [verdictDone, setVerdictDone] = useState(false);
  const [voiceURI, setVoiceURIState] = useState<string>('');
  // storytelling pace: a touch slower than the app's read-aloud speed, remembered between visits
  const [pace, setPaceState] = useState<number>(() => { try { const v = Number(localStorage.getItem('sf.storyrate')); return v >= 0.6 && v <= 1.2 ? v : 0.85; } catch { return 0.85; } });
  const setPace = (n: number) => { setPaceState(n); try { localStorage.setItem('sf.storyrate', String(n)); } catch { /* ignore */ } };
  const setLang = (c: string) => { setLangState(c); try { localStorage.setItem('sf.storylang', c); } catch { /* ignore */ } };
  const [burn, setBurn] = useState(false);
  const token = useRef(0);
  const pack = storyPack(lang);
  const sc = { ...SCENES[i], title: pack.title[i], short: pack.short[i], text: pack.text[i] };
  const verdictText = verdict ? formatVerdict(pack, verdict.kind, verdict) : '';
  const vStatus = voicesReady > 0 ? voiceStatus(pack.speech, voiceURI || undefined) : { kind: 'none' as const };
  const voiceOk = !speechSupported() || voicesReady === 0 || vStatus.kind !== 'none';
  const voiceList = voicesReady > 0 ? voicesFor(vStatus.kind === 'fallback' && vStatus.via ? vStatus.via : pack.speech) : [];
  const speaking = voice && voiceOk && voicesReady > 0;
  const last = i === SCENES.length - 1;

  useEffect(() => {
    try { setVoiceURIState(localStorage.getItem(`sf.voice.${pack.speech}`) ?? ''); } catch { setVoiceURIState(''); }
  }, [pack.speech]);
  const setVoiceURI = (u: string) => { setVoiceURIState(u); try { localStorage.setItem(`sf.voice.${pack.speech}`, u); } catch { /* ignore */ } };

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

  // narration in the chosen language: title, then the story, sentence by sentence
  useEffect(() => {
    stopSpeaking();
    setTextDone(false);
    setVerdictDone(false);
    if (voice && voiceOk) speak(`${sc.title}.\n${sc.text}`, lang, pace, { tag: pack.speech, voiceURI: voiceURI || undefined, onEnd: () => setTextDone(true) });
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, voice, lang, voiceURI, pace, voiceOk]);
  // the scanner's verdict is read out after the chapter text
  useEffect(() => {
    if (voice && voiceOk && verdictText) speak(verdictText, lang, pace, { tag: pack.speech, voiceURI: voiceURI || undefined, queue: true, onEnd: () => setVerdictDone(true) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict, voice, lang, voiceURI, pace, voiceOk]);

  // autoplay
  useEffect(() => {
    if (!play) return;
    if (last) { setPlay(false); return; }
    if (sc.art === 'scan' && !run) return;
    if (speaking) {
      // move on only when the narrator has finished (plus a breath), never mid-sentence; 90 s safety net
      const ready = textDone && (sc.art !== 'scan' || verdictDone);
      const t = setTimeout(() => setI((x) => x + 1), ready ? 1400 : 90000);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setI((x) => x + 1), sc.art === 'scan' ? 10000 : 8000);
    return () => clearTimeout(t);
  }, [play, i, run, sc.art, last, speaking, textDone, verdictDone]);

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
          {voice && voiceList.length > 0 && (
            <label className="lang-chip" title="Choose the narrator's voice">
              <span aria-hidden>🎙</span>
              <select value={vStatus.voice?.voiceURI ?? ''} onChange={(e) => setVoiceURI(e.target.value)} aria-label="Narrator voice">
                {voiceList.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{voiceQuality(v) === 'natural' ? '★ ' : ''}{v.name.replace(/\s*\(.*\)\s*$/, '')}{voiceQuality(v) === 'basic' ? ' · basic' : ''}</option>)}
              </select>
            </label>
          )}
          {voice && (
            <label className="lang-chip pace" title="Narration speed">
              <span aria-hidden>🐢</span>
              <input type="range" min={0.6} max={1.1} step={0.05} value={pace} onChange={(e) => setPace(Number(e.target.value))} aria-label="Narration speed" />
              <span className="pace-n">{pace.toFixed(2)}×</span>
            </label>
          )}
          <label className="lang-chip story-lang">
            <svg className="chip-ico" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h9M8.5 3v2M6 5c.6 3.2 2.6 5.8 5.5 7.4M11.5 5c-.7 3.4-3.2 6.2-6.5 7.7" /><path d="M13 20l4-9 4 9M14.4 17h5.2" /></svg>
            <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Story language">
              {STORY_LANGS.map((p) => <option key={p.code} value={p.code}>{p.name}{voicesReady > 0 && speechSupported() && !hasVoiceFor(p.speech) ? ' · text only' : voicesReady > 0 && speechSupported() && voiceStatus(p.speech).kind === 'fallback' ? ' · Hindi voice' : ''}</option>)}
            </select>
          </label>
        </div>
      </div>
      {voice && !voiceOk && !('broken' in vStatus && vStatus.broken) && <p className="small sans" style={{ color: '#ffb37a', margin: '8px 0 0' }}>This device has no {pack.name} voice installed, so the story is shown but not spoken. Pick another language, or add a {pack.name} voice in your system’s speech settings (on a phone: Settings → Accessibility → Spoken content / Text-to-speech). Chrome and Edge usually offer more voices than Firefox.</p>}
      {voice && vStatus.kind === 'none' && 'broken' in vStatus && vStatus.broken && (
        <div className="voice-tip sans" style={{ borderColor: 'rgba(255,106,85,.5)', background: 'rgba(255,106,85,.1)' }}>
          <b>🔇 The {pack.name} voice on this device is listed but is not producing speech.</b> That usually means the voice was never downloaded, so it only says the numbers and skips the words.
          <ul>
            <li><b>Mac / iPhone:</b> Settings → Accessibility → Spoken Content → System Voice → Manage Voices → {pack.name} → download a voice (the <b>Enhanced</b> or <b>Premium</b> one is best). Reload this page afterwards.</li>
            <li><b>Windows:</b> open this page in <b>Microsoft Edge</b>, or add the language under Settings → Time &amp; language → Speech.</li>
            <li><b>Android:</b> use <b>Chrome</b> and install the language in Settings → Text-to-speech. The story text still shows on screen meanwhile.</li>
          </ul>
        </div>
      )}
      {voice && vStatus.voice && voiceQuality(vStatus.voice) === 'basic' && lang !== 'en' && (
        <div className="voice-tip sans">
          <b>🎙 This device only has a basic {pack.name} voice, which sounds robotic.</b> The app cannot improve it, but a better one is free:
          <ul>
            <li><b>Windows:</b> open this page in <b>Microsoft Edge</b>. Its online “Natural” voices (Tamil, Telugu, Bengali, Hindi, Marathi, Swahili, Arabic…) appear here automatically.</li>
            <li><b>Android:</b> in <b>Chrome</b>, the Google voices are used automatically. Install the language in Settings → Text-to-speech.</li>
            <li><b>Mac / iPhone:</b> Settings → Accessibility → Spoken Content → System Voice → Manage Voices, then download the <b>Enhanced</b> or <b>Premium</b> {pack.name} voice. Reload this page and it is picked first.</li>
          </ul>
          Slowing the speed a little (🐢) also helps a basic voice sound less choppy.
        </div>
      )}
      {voice && vStatus.kind === 'fallback' && <p className="small sans" style={{ color: '#d9c4a0', margin: '8px 0 0' }}>No {pack.name} voice is installed, so a Hindi voice reads it (same script). Install a {pack.name} voice for the best result.</p>}
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
