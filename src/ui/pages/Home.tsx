import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../ctx';
import { TallyCard3D } from '../components/TallyCard3D';
import { reducedMotion } from '../fx';

/** QR of the current address, so a phone can open the app by scanning the laptop screen. */
const PUBLIC_URL = 'https://vishnu2663.github.io/Stock-Foil/';

function PhoneQR() {
  const [src, setSrc] = useState('');
  const here = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(typeof location !== 'undefined' ? location.hostname : '');
  // opened from localhost: point the code at the public hosted app so a phone can use it
  const url = local ? PUBLIC_URL : here;
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setSrc).catch(() => undefined);
  }, [url]);
  return (
    <div className="card phone-qr" style={{ marginTop: 16 }}>
      <div className="row" style={{ alignItems: 'center', gap: 18 }}>
        {src && <img src={src} width={140} height={140} alt="QR code of this page" style={{ borderRadius: 8, background: '#fff', padding: 4 }} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ marginBottom: 6 }}>Open on your phone</h2>
          <p className="sans small" style={{ margin: 0 }}>Scan this code with a phone camera to open this page there.</p>
          {local && <p className="sans small" style={{ color: 'var(--muted)' }}>You are on a local copy, so this code opens the public hosted app: {PUBLIC_URL}</p>}
        </div>
      </div>
    </div>
  );
}

const TILES = [
  { icon: '🔐', title: 'Pair authentication', back: 'Each half carries a secret in its QR that must match the other. A sloppy cut can never fail a genuine pair, and nobody can invent the other half.' },
  { icon: '📷', title: 'Camera scanner', back: 'Reads through rotation, tilt, blur, noise and uneven light. Live guidance, and it captures by itself when the half is clear.' },
  { icon: '🧩', title: 'Never guesses', back: 'A hole it cannot read is flagged “unsure” for a person to check. It is never silently counted, and a bad photo is refused.' },
  { icon: '📒', title: 'Tamper-evident ledger', back: 'Payday receipts are chained with SHA-256. Edit or delete a past receipt and every later link breaks. Paid cards cannot be paid twice.' },
  { icon: '🧾', title: 'Picture pay slip', back: 'Days × wage − advances, in six languages, with pictures and read-aloud. Mid-month raises and balances carried forward are shown too.' },
  { icon: '🪪', title: 'Income proof', back: 'Turns agreed months into a one-page certificate with a QR that anyone holding the ledger can verify.' },
  { icon: '🤖', title: 'Free optional AI', back: 'On-device or your own free key explains disputes in simple words. Only anonymised numbers ever leave the phone, and it works fine without AI.' },
  { icon: '🧪', title: 'Test lab', back: 'Render thousands of fake phone photos, forge halves, and watch the scanner catch them. The same engine the tests use.' },
];

const KICKERS = ['Cut it · Punch it · Prove it', 'Two halves · one truth', 'Paper that cannot lie', 'The 1834 tally, reborn', 'No phone · no server · no trust needed'];

/** The line above the headline: short taglines that flip in one after another. */
function Kicker({ style }: { style: React.CSSProperties }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const t = setInterval(() => setI((x) => (x + 1) % KICKERS.length), 3400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="kicker rise kick3d" style={style} aria-label={KICKERS[0]}>
      <span key={i} className="kick-word" aria-hidden>{KICKERS[i]}</span>
    </div>
  );
}

/** A tile that turns over in 3D to show the detail: on hover, focus, tap or Enter. */
function Flip({ icon, title, back }: { icon: string; title: string; back: string }) {
  const [on, setOn] = useState(false);
  const toggle = () => setOn((v) => !v);
  return (
    <div className={`flip ${on ? 'on' : ''}`} role="button" tabIndex={0} aria-pressed={on} aria-label={`${title}. ${back}`} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}>
      <div className="flip-in">
        <div className="flip-f"><span className="fi" aria-hidden>{icon}</span><b>{title}</b><small>hover or tap</small></div>
        <div className="flip-b"><b>{title}</b><p>{back}</p></div>
      </div>
    </div>
  );
}

export function Home({ go }: { go: (r: string) => void }) {
  const { t } = useApp();
  const hero = useRef<HTMLElement>(null);
  /** pointer position inside the hero, -1..1, drives the floating parallax layers */
  const onMove = (e: React.PointerEvent) => {
    const el = hero.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
    el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
  };
  const k = (n: number) => ({ ['--k' as string]: n });
  return (
    <div>
      <section className="hero" ref={hero} onPointerMove={onMove}>
        <div className="hero-text">
          <Kicker style={k(0)} />
          <h1 className="rise" style={k(1)}>The tally stick, <span className="grad">back from the dead.</span></h1>
          <p className="lead rise" style={k(2)}>{t('tagline')} A paper card is cut in two along a one-of-a-kind wavy line. The worker keeps one half, the employer the other. Every day both are punched together.</p>
          <div className="row rise" style={k(3)}>
            <button className="primary" onClick={() => go('story')}>🎃 See the story</button>
            <button onClick={() => go('demo')}>▶ 4-vs-5 days demo</button>
            <button onClick={() => go('issue')}>＋ Make a card</button>
            <button onClick={() => go('scan')}>📷 Payday scan</button>
          </div>
          <div className="chips rise" style={k(4)}>
            {['Free', 'Works offline', 'No account', 'No server', 'The worker needs no phone'].map((c) => <span key={c} className="chip">{c}</span>)}
          </div>
        </div>
        <div className="hero-stage">
          <TallyCard3D mode="hero" />
        </div>
      </section>

      <div className="tally-rule" />
      <div className="card steps" data-tilt="3">
        <h2>How it works</h2>
        <div className="step"><b>Print and cut</b>The app prints a calendar card with a unique wavy cut line. Cut along it with scissors.</div>
        <div className="step"><b>Punch both, daily</b>At the end of each workday, stack the halves and punch one hole through both. No phone, no reading needed.</div>
        <div className="step"><b>Scan on payday</b>Photograph both halves. The app proves they were issued together, compares every hole and flags any hole on only one half.</div>
        <div className="step"><b>Get a picture slip</b>days × rate − advances = total, in your language, with pictures and read-aloud.</div>
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>What is in the box</h2>
      <div className="flip-grid">
        {TILES.map((x) => <Flip key={x.title} {...x} />)}
      </div>

      <PhoneQR />

      <div className="card" style={{ marginTop: 16 }} data-tilt="3">
        <h2>Why paper beats an app here</h2>
        <p>Neither side has to trust a server, a phone or each other. Adding a hole to one half only is visible the moment the halves are compared; a half made up from the other fails its pairing secret. The record survives dead batteries, no network and illiteracy, and it protects honest employers just as much as workers.</p>
        <div className="row">
          <button onClick={() => go('lab')}>🧪 Open the test lab</button>
          <button onClick={() => go('about')}>📜 About &amp; security</button>
        </div>
      </div>
    </div>
  );
}
