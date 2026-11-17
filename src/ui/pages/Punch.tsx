export function Punch() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>The daily punch</h1>
      <p className="muted">At the end of each workday: stack, align, punch once through both. That single hole is the whole protocol.</p>
      <div className="grid2">
        <div className="card">
          <svg viewBox="0 0 400 260" className="punchdemo" role="img" aria-label="A hole punch going through both halves of the card">
            <style>{`
              @keyframes press { 0%,55%{transform:translateY(-34px)} 70%{transform:translateY(0)} 85%,100%{transform:translateY(-34px)} }
              @keyframes hole { 0%,68%{opacity:0} 72%,100%{opacity:1} }
              .pn{animation:press 3.2s ease-in-out infinite}.hl{animation:hole 3.2s linear infinite}
            `}</style>
            <path d="M30 120 H370 V150 Q340 165 310 150 T250 150 T190 160 T130 148 T70 160 T30 150Z" fill="#fffaf0" stroke="#cdbb8f" />
            <path d="M30 150 Q60 165 100 160 T160 148 T220 160 T280 150 T340 150 T370 150 V215 H30Z" fill="#ebdcb8" stroke="#cdbb8f" opacity=".9" />
            <text x="40" y="112" fontSize="12" fontFamily="system-ui" fill="#5d5547">worker half ▲ on top of ▼ employer half, edges aligned</text>
            <circle className="hl" cx="200" cy="148" r="11" fill="#f4ead2" stroke="#7a1f1f" strokeWidth="1.5" />
            <g className="pn">
              <rect x="170" y="40" width="60" height="22" rx="6" fill="#7a1f1f" />
              <rect x="192" y="62" width="16" height="44" fill="#444" />
              <rect x="186" y="104" width="28" height="8" rx="2" fill="#222" />
            </g>
            <text x="200" y="245" fontSize="13" fontFamily="system-ui" textAnchor="middle" fill="#231f1a">one hole · two records · same moment</text>
          </svg>
        </div>
        <div className="card">
          <h2>Rules that keep it honest</h2>
          <ol className="sans">
            <li><b>Both people present.</b> The supervisor punches while the worker watches the halves line up.</li>
            <li><b>Punch inside the day’s circle.</b> Late punches for an earlier day are fine; the hole is in that day’s box.</li>
            <li><b>Advances use the token row.</b> One hole per advance on both halves, same moment.</li>
            <li><b>Never punch just one half.</b> A one-sided hole will be flagged on payday, and that flag is a feature.</li>
            <li><b>Missed a day?</b> Don’t patch it later alone. Agree together and punch both.</li>
          </ol>
          <h3 style={{ marginTop: 14 }}>Why it can’t be quietly changed</h3>
          <p className="small sans">A hole can be added to a half but not made to match on the other half without having both halves. Holes can’t be removed from paper. A replacement half must fit the original’s wavy cut and carry the same card code, and neither is possible to fake from a photo.</p>
        </div>
      </div>
    </div>
  );
}
