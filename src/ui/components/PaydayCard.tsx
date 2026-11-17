import { useMemo, useState } from 'react';
import { cardCode, daysInMonth, firstWeekday, waveSeed, type CardSpec } from '../../core/card';
import type { CellStatus } from '../../core/wages';
import { makeWave } from '../../core/wave';
import { monthName, weekdayShort } from '../../i18n';
import { reducedMotion, useCountUp } from '../fx';

const W = 560;
const H = 420;
const CUT_Y = 212;
const S = W / 186; // card frame is 186 mm wide
const TONE = { ok: '#2fbf71', warn: '#f6a609', bad: '#ff5a48' } as const;

export interface PaydayCardProps {
  spec: CardSpec;
  lang: string;
  /** 'ok' genuine · 'warn' disputed / needs a look · 'bad' rejected */
  tone: keyof typeof TONE;
  /** one or two words for the big rubber stamp */
  stamp: string;
  title: string;
  dayStatus: CellStatus[];
  advStatus: CellStatus[];
  agreedDays: number;
  agreedAdv: number;
  netMinor: number;
  disputedMinor: number;
  money: (minor: number) => string;
  payState: 'paid' | 'unpaid' | 'none';
  /** the formula in words, e.g. "3 days × ₹700 − 1 × ₹100" */
  formula: string;
}

/**
 * The scan, as a card. Everything on it comes from the scanned card: the real wavy cut for that
 * card id, its month's calendar with each punched day lighting up (green both, red one side only),
 * a ring that fills to the days counted, the agreed amount counting up, a verdict stamp that slams
 * down, and a PAID / YET TO PAY stamp that appears when you record the payment.
 */
export function PaydayCard(p: PaydayCardProps) {
  const [run, setRun] = useState(0); // bumping the key remounts everything, so the whole show replays
  return <PaydayCardShow key={run} {...p} onReplay={() => setRun((n) => n + 1)} />;
}

function PaydayCardShow(p: PaydayCardProps & { onReplay: () => void }) {
  const calm = reducedMotion();
  const { spec } = p;
  const nDays = daysInMonth(spec.year, spec.month);
  const off = firstWeekday(spec.year, spec.month);
  const tone = TONE[p.tone];

  const geo = useMemo(() => {
    const w = makeWave(waveSeed(spec));
    const y = (px: number) => CUT_Y + w(px / S) * S * 0.72;
    const pts: [number, number][] = [];
    for (let x = 0; x <= W; x += 4) pts.push([x, y(x)]);
    const line = pts.map(([x, yy], i) => `${i ? 'L' : 'M'}${x},${yy.toFixed(1)}`).join('');
    const rev = [...pts].reverse().map(([x, yy]) => `L${x},${yy.toFixed(1)}`).join('');
    return {
      top: `M0,0H${W}V${pts[pts.length - 1][1].toFixed(1)}${rev}Z`,
      bottom: `M0,${H}H${W}V${pts[pts.length - 1][1].toFixed(1)}${rev}Z`,
      line,
    };
  }, [spec.id]);

  const total = useCountUp(p.netMinor, 1500);
  const days = useCountUp(p.agreedDays, 1200);
  const pct = nDays ? Math.min(1, p.agreedDays / nDays) : 0;
  const R = 44;
  const C = 2 * Math.PI * R;

  const cell = (st: CellStatus | undefined) => (st === 'both' ? 'both' : st === 'stockOnly' || st === 'foilOnly' ? 'one' : 'none');

  return (
    <figure className={`pc tone-${p.tone}`} style={{ ['--tone' as string]: tone }} data-tilt="5">
      <div className="pc-aura" aria-hidden />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${p.stamp}. ${spec.worker || 'Worker'}, ${monthName(p.lang, spec.month)} ${spec.year}: ${p.agreedDays} days, ${p.money(p.netMinor)}.`}>
        <defs>
          <linearGradient id="pcStock" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fbf3df" /><stop offset="1" stopColor="#efe2c0" /></linearGradient>
          <linearGradient id="pcFoil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#efe3c6" /><stop offset="1" stopColor="#e2d1a6" /></linearGradient>
          <linearGradient id="pcSheen" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
          <filter id="pcShadow" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#000" floodOpacity=".45" /></filter>
          <filter id="pcGlow"><feGaussianBlur stdDeviation="3" /></filter>
          <clipPath id="pcClipTop"><path d={geo.top} /></clipPath>
          <clipPath id="pcClipBot"><path d={geo.bottom} /></clipPath>
          <clipPath id="pcClipAll"><rect x="0" y="0" width={W} height={H} rx="6" /></clipPath>
        </defs>

        {/* ---- stock half (worker) ---- */}
        <g className="pc-half pc-top" filter="url(#pcShadow)">
          <path d={geo.top} fill="url(#pcStock)" />
          <g clipPath="url(#pcClipTop)">
            <text x="24" y="28" className="pc-tiny">STOCK · THE WORKER KEEPS</text>
            <text x="536" y="28" textAnchor="end" className="pc-mono">{cardCode(spec)}</text>
            <text x="24" y="62" className="pc-month">{monthName(p.lang, spec.month)} {spec.year}</text>
            <text x="24" y="84" className="pc-name">{spec.worker || '—'}</text>

            {/* calendar: every day lights up from the real scan */}
            {Array.from({ length: 7 }, (_, c) => (
              <text key={c} x={24 + c * 33 + 16} y="106" textAnchor="middle" className="pc-wd">{weekdayShort(p.lang, c).slice(0, 2)}</text>
            ))}
            {Array.from({ length: nDays }, (_, d) => {
              const idx = off + d;
              const cx = 24 + (idx % 7) * 33 + 16;
              const cy = 112 + Math.floor(idx / 7) * 15 + 7.5;
              const k = cell(p.dayStatus[d]);
              return (
                <g key={d} className={`pc-day ${k}`} style={{ ['--i' as string]: d }}>
                  <rect x={cx - 15.5} y={cy - 7} width="31" height="14" rx="3" className="pc-cellbox" />
                  <text x={cx - 12.5} y={cy - 1.2} className="pc-dn">{d + 1}</text>
                  {k === 'none' ? (
                    <circle cx={cx + 6} cy={cy + 0.4} r="3.4" className="pc-hole-empty" />
                  ) : (
                    <>
                      <circle cx={cx + 6} cy={cy + 0.4} r="9" className="pc-ripple" />
                      <circle cx={cx + 6} cy={cy + 0.4} r="4.4" className="pc-hole" />
                    </>
                  )}
                </g>
              );
            })}

            {/* progress ring: days counted out of the month */}
            <g transform="translate(414 150)">
              <circle r={R} className="pc-ring-bg" />
              <circle r={R} className="pc-ring" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ ['--c' as string]: C, ['--to' as string]: C * (1 - pct) }} transform="rotate(-90)" />
              {p.tone === 'ok' && Array.from({ length: 14 }, (_, i) => <circle key={i} r="2.4" className="pc-spark" style={{ ['--a' as string]: `${(i * 360) / 14}deg`, ['--d' as string]: `${1.5 + (i % 4) * 0.08}s` }} />)}
              <text y="6" textAnchor="middle" className="pc-days">{Math.round(days)}</text>
              <text y="24" textAnchor="middle" className="pc-of">of {nDays} days</text>
            </g>
          </g>
        </g>

        {/* ---- foil half (employer) ---- */}
        <g className="pc-half pc-bot" filter="url(#pcShadow)">
          <path d={geo.bottom} fill="url(#pcFoil)" />
          <g clipPath="url(#pcClipBot)">
            <text x="24" y="252" className="pc-tiny">FOIL · THE EMPLOYER KEEPS</text>
            <text x="24" y="282" className="pc-name big">{spec.employer || '—'}</text>
            <text x="24" y="306" className="pc-formula">{p.formula}</text>
            {p.disputedMinor > 0 && <text x="24" y="324" className="pc-dispute">⚠ {p.money(p.disputedMinor)} in dispute, not included</text>}

            <text x="536" y="322" textAnchor="end" className="pc-amount">{p.money(Math.round(total))}</text>
            <text x="536" y="276" textAnchor="end" className="pc-tiny">AGREED AMOUNT</text>

            {/* advance tokens */}
            <text x="24" y="360" className="pc-tiny">ADVANCES</text>
            {Array.from({ length: 10 }, (_, i) => {
              const k = cell(p.advStatus[i]);
              return (
                <g key={i} className={`pc-adv ${k}`} style={{ ['--i' as string]: i }}>
                  <circle cx={34 + i * 25} cy="382" r="8.5" className="pc-advbox" />
                  {k === 'none' ? <circle cx={34 + i * 25} cy="382" r="3" className="pc-hole-empty" /> : <circle cx={34 + i * 25} cy="382" r="4.6" className="pc-hole" />}
                </g>
              );
            })}
            <text x="536" y="386" textAnchor="end" className="pc-adv-n">{p.agreedAdv} agreed</text>
          </g>
        </g>

        {/* the cut: draws itself, then a bright spark runs along it as the halves click together */}
        <path d={geo.line} className="pc-cut" pathLength={1} />
        <path d={geo.line} className="pc-cut-glow" pathLength={1} filter="url(#pcGlow)" />
        <g clipPath="url(#pcClipAll)"><rect x="-140" y="0" width="140" height={H} fill="url(#pcSheen)" className="pc-sheen" style={{ mixBlendMode: 'overlay' }} /></g>

        {/* verdict stamp */}
        <g transform="translate(402 232) rotate(-11)">
          <g className="pc-stamp">
            <rect x="-96" y="-27" width="192" height="54" rx="9" className="pc-stamp-box" />
            <rect x="-90" y="-21" width="180" height="42" rx="5" className="pc-stamp-in" />
            <text y="9" textAnchor="middle" className="pc-stamp-t">{p.stamp}</text>
          </g>
        </g>

        {/* payment stamp: appears when you press Paid or Yet to pay */}
        {p.payState !== 'none' && (
          <g transform="translate(120 244) rotate(8)" key={p.payState}>
            <g className={`pc-paystamp ${p.payState}`}>
              <rect x="-74" y="-23" width="148" height="46" rx="8" className="pc-pay-box" />
              <text y="8" textAnchor="middle" className="pc-pay-t">{p.payState === 'paid' ? 'PAID' : 'YET TO PAY'}</text>
            </g>
          </g>
        )}
      </svg>
      <figcaption>
        <span className="pc-cap"><i style={{ background: tone }} aria-hidden /> {p.title}</span>
        {!calm && <button type="button" className="sm ghost" onClick={p.onReplay} aria-label="Replay the animation">↻ Replay</button>}
      </figcaption>
    </figure>
  );
}
