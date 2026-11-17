import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../ctx';

/** QR of the current address, so a phone can open the app by scanning the laptop screen. */
function PhoneQR() {
  const [src, setSrc] = useState('');
  const url = typeof location !== 'undefined' ? location.href.split('#')[0] : '';
  const local = /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(typeof location !== 'undefined' ? location.hostname : '');
  useEffect(() => {
    QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setSrc).catch(() => undefined);
  }, [url]);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row" style={{ alignItems: 'center', gap: 18 }}>
        {src && <img src={src} width={140} height={140} alt="QR code of this page" style={{ borderRadius: 8, background: '#fff', padding: 4 }} />}
        <div style={{ flex: 1, minWidth: 220 }}>
          <h2 style={{ marginBottom: 6 }}>Open on your phone</h2>
          <p className="sans small" style={{ margin: 0 }}>Scan this code with a phone camera to open this page there.</p>
          {local && <p className="sans small" style={{ color: 'var(--amber)' }}>This is a local address, so a phone cannot reach it. Host the built app first (see DEPLOY.md: Netlify Drop or GitHub Pages, both free), and the code will point to the public link.</p>}
        </div>
      </div>
    </div>
  );
}

export function Home({ go }: { go: (r: string) => void }) {
  const { t } = useApp();
  return (
    <div>
      <section className="hero">
        <div>
          <div className="kicker">Resurrection · 1834 → today</div>
          <h1>The tally stick, back from the dead.</h1>
          <p className="lead">{t('tagline')} A paper card is cut in two along a one-of-a-kind wavy line. The worker keeps one half, the employer the other. Every day both are punched together.</p>
          <div className="row">
            <button className="primary" onClick={() => go('demo')}>▶ Watch the 4-vs-5 days demo</button>
            <button onClick={() => go('issue')}>＋ Make a card</button>
            <button onClick={() => go('scan')}>📷 Payday scan</button>
          </div>
          <p className="small muted sans" style={{ marginTop: 14 }}>Free · works offline · no account · no server · the worker never needs a phone.</p>
        </div>
        <svg viewBox="0 0 420 300" role="img" aria-label="Two halves of a tally card with matching holes">
          <defs>
            <filter id="sh"><feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.25" /></filter>
          </defs>
          <g filter="url(#sh)">
            <path d="M20 20 H400 V140 Q370 160 340 140 T280 140 T220 150 T160 135 T100 150 T20 140Z" fill="#fffaf0" stroke="#cdbb8f" />
            <path d="M20 160 Q50 140 100 170 T160 155 T220 170 T280 160 T340 160 T400 160 V285 H20Z" fill="#f4ead2" stroke="#cdbb8f" />
          </g>
          {[60, 120, 180, 240, 300, 360].map((x, i) => (
            <g key={x}>
              <circle cx={x} cy={62} r={9} fill="var(--paper)" stroke="#cdbb8f" opacity={i === 4 ? 0.2 : 1} />
              <circle cx={x} cy={222} r={9} fill="var(--paper)" stroke="#cdbb8f" opacity={i === 4 ? 0.2 : 1} />
            </g>
          ))}
          <text x="30" y="44" fontSize="13" fontWeight="700" fill="#231f1a" fontFamily="system-ui">STOCK · worker keeps</text>
          <text x="30" y="270" fontSize="13" fontWeight="700" fill="#231f1a" fontFamily="system-ui">FOIL · employer keeps</text>
          <text x="210" y="156" fontSize="12" fontWeight="700" textAnchor="middle" fill="#ffd9a8" fontFamily="system-ui" style={{ paintOrder: 'stroke' }} stroke="#14080a" strokeWidth="3">✂ the cut is the signature</text>
        </svg>
      </section>

      <div className="tally-rule" />
      <div className="grid2">
        <div className="card steps">
          <h2>How it works</h2>
          <div className="step"><b>Print and cut</b>The app prints a calendar card with a unique wavy cut line. Cut along it with scissors.</div>
          <div className="step"><b>Punch both, daily</b>At the end of each workday, stack the halves and punch one hole through both. No phone, no reading needed.</div>
          <div className="step"><b>Scan on payday</b>Photograph both halves. The app checks the cut edges fit, compares every hole and flags any hole on only one half.</div>
          <div className="step"><b>Get a picture slip</b>days × rate − advances = total, in your language, with pictures and read-aloud.</div>
        </div>
        <div className="card">
          <h2>What is in the box</h2>
          <ul className="sans" style={{ paddingLeft: 18, margin: 0 }}>
            <li><b>Pair authentication</b>: card code binds names, month and rate; the physical cut edge must fit.</li>
            <li><b>Camera scanner</b> that survives rotation, tilt, blur, noise and uneven light, with live capture guidance.</li>
            <li><b>Uncertainty-aware</b>: unclear holes are flagged for a human, never guessed.</li>
            <li><b>Tamper-evident ledger</b>: payday receipts form a hash chain.</li>
            <li><b>Picture pay slip</b> in 6 languages, printable, with voice read-aloud.</li>
            <li><b>Free AI</b>: on-device or free endpoints explain disputes simply; fully optional.</li>
            <li><b>Test lab</b>: render thousands of fake photos, forge halves, watch the scanner catch them.</li>
          </ul>
        </div>
      </div>

      <PhoneQR />

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Why paper beats an app here</h2>
        <p>Neither side has to trust a server, a phone or each other. Adding a hole to one half only is visible the moment the halves are compared; replacing a half fails the cut-edge fit. The record survives dead batteries, no network and illiteracy, and it protects honest employers just as much as workers.</p>
        <div className="row">
          <button onClick={() => go('lab')}>🧪 Open the test lab</button>
          <button onClick={() => go('about')}>📜 Read the story</button>
        </div>
      </div>
    </div>
  );
}
