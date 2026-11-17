export function About() {
  return (
    <div>
      <div className="fire">
        <div className="kicker" style={{ color: '#ffb37a' }}>16 October 1834</div>
        <h2>The tally sticks that burned Parliament have come back from the dead.</h2>
        <p>For 700 years the English Exchequer kept accounts on notched hazel sticks, split lengthwise so debtor and creditor each held half. Forging one meant matching a grain no forger could see. In 1834 the obsolete sticks were fed into the furnaces under the House of Lords; the chimney flues caught fire and burned down most of the Palace of Westminster.</p>
        <p style={{ marginBottom: 0 }}>Stock &amp; Foil gives the split tally a second life for people still paid by the day in cash: the cut is the signature, and the hole is the record.</p>
      </div>

      <div className="grid2" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Why this is secure without a server</h2>
          <table className="t sans">
            <thead><tr><th>Attack</th><th>What stops it</th></tr></thead>
            <tbody>
              <tr><td>Add a hole to one half</td><td>The other half lacks it → flagged, never paid as agreed</td></tr>
              <tr><td>Patch/fill a hole</td><td>One-sided on payday → flagged</td></tr>
              <tr><td>Swap in a printed replacement half</td><td>Its cut must fit the original’s physical edge (shape correlation), and the card code must match</td></tr>
              <tr><td>Reprint with a higher rate or other month</td><td>Card code binds id, month, rate, advance value, names, language</td></tr>
              <tr><td>Pair halves from two cards</td><td>Id mismatch → “do NOT belong together”</td></tr>
              <tr><td>Edit the saved ledger later</td><td>SHA-256 hash chain breaks</td></tr>
              <tr><td>Camera misreads a hole</td><td>Ambiguous holes are flagged “unsure” for human check, not guessed</td></tr>
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Honest limits</h2>
          <ul className="sans">
            <li>If one person holds <i>both</i> halves they can punch both. The protocol assumes each side keeps their own half; use a witness (union, NGO) for disputes.</li>
            <li>The cut-edge fit is strong evidence, not cryptographic proof: a determined forger with the original in hand could trace its edge. It stops casual and in-the-moment fraud, which is the real-world threat.</li>
            <li>The scanner is tuned for ≈±25° rotation, mild tilt, blur ≤ ~1.3 px, noise and uneven light on a dark surface. Outside that it warns instead of guessing.</li>
            <li>Translations were AI-drafted and need native-speaker review before field use.</li>
            <li>Hand-cut edges vary by a few mm from the printed line. That is expected and is exactly what makes each cut unique.</li>
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Built with free, local-first tech</h2>
        <p className="sans">React + TypeScript + Vite · jsQR (QR decoding) · custom computer vision (homography, corner-square refinement, cut-edge tracing) · Web Speech for read-aloud · Chrome’s built-in on-device AI or free keyless endpoints for plain-language explanations · everything runs in the browser and works offline as a PWA.</p>
        <p className="sans small muted">Property-based tests (fast-check, spec-driven with Kiro) generate thousands of simulated photos with rotation, blur, noise and lighting changes, plus wage-math and tamper properties. See <span className="mono">.kiro/specs</span> and <span className="mono">tests/</span>.</p>
      </div>
    </div>
  );
}
