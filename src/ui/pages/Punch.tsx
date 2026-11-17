import { TallyCard3D } from '../components/TallyCard3D';

export function Punch() {
  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>The daily punch</h1>
      <p className="muted">At the end of each workday: stack, align, punch once through both. That single hole is the whole protocol.</p>
      <div className="grid2">
        <div className="card">
          <TallyCard3D mode="punch" />
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
