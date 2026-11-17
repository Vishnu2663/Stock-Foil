import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useApp } from '../ctx';
import { TallyCard3D } from '../components/TallyCard3D';

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
        <TallyCard3D mode="hero" />
      </section>

      <div className="tally-rule" />
      <div className="grid2">
        <div className="card steps" data-tilt="4">
          <h2>How it works</h2>
          <div className="step"><b>Print and cut</b>The app prints a calendar card with a unique wavy cut line. Cut along it with scissors.</div>
          <div className="step"><b>Punch both, daily</b>At the end of each workday, stack the halves and punch one hole through both. No phone, no reading needed.</div>
          <div className="step"><b>Scan on payday</b>Photograph both halves. The app checks the cut edges fit, compares every hole and flags any hole on only one half.</div>
          <div className="step"><b>Get a picture slip</b>days × rate − advances = total, in your language, with pictures and read-aloud.</div>
        </div>
        <div className="card" data-tilt="4">
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
