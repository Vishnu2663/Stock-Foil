import { useState } from 'react';
import { formatMoney } from '../../core/card';
import { speak, speechSupported, stopSpeaking } from '../../ai/speech';
import { offlineExplain } from '../../ai';
import { LANGS, monthName, t } from '../../i18n';
import { splitDays } from '../../core/wages';
import type { PairResult } from '../../vision/pair';
import { useApp } from '../ctx';
import { printArea } from '../imageIO';

/** Pay-envelope slip: days x rate - advances = total, with pictures and local-language labels. */
export function Slip({ r, lang, explain }: { r: PairResult; lang: string; explain?: string }) {
  const { settings } = useApp();
  const { spec, pay, cmp } = r;
  const a = pay.agreed;
  const m = (v: number) => formatMoney(v, spec.currency, lang);
  const oneSided = [...new Set([...cmp.stockOnlyDays, ...cmp.foilOnlyDays, ...cmp.stockOnlyPm, ...cmp.foilOnlyPm])].sort((x, y) => x - y);
  const dt = splitDays(cmp);
  const text = explain ?? offlineExplain(r, lang);
  const [speaking, setSpeaking] = useState(false);
  return (
    <div>
      <div className="slip print-area" lang={lang}>
        <h3>
          {t(lang, 'slipTitle')} · {monthName(lang, spec.month)} {spec.year}
        </h3>
        <div className="small" style={{ textAlign: 'center', marginBottom: 6 }}>
          {spec.worker || '—'} ⟷ {spec.employer || '—'} · {t(lang, 'cardCode')} {r.code}
        </div>
        <div className="line">
          <span className="e">🧱</span>
          <span className="l">{t(lang, 'slipDays')}{cmp.halves && <small style={{ display: 'block', fontWeight: 400 }}>{dt.full.length} full + {dt.half.length} half (half wage each)</small>}</span>
          <b>{a.days}</b>
        </div>
        <div className="tokens" aria-hidden>
          {cmp.halves
            ? (
              <>
                {dt.full.map((d) => <span className="tok" key={'f' + d} title={`${d} · full day`}>✓</span>)}
                {dt.half.map((d) => <span className="tok half" key={'h' + d} title={`${d} · half day`}>½</span>)}
              </>
            )
            : cmp.agreedDays.map((d) => (
              <span className="tok" key={d} title={String(d)}>✓</span>
            ))}
          {oneSided.map((d) => (
            <span className="tok dis" key={'d' + d} title={String(d)}>?</span>
          ))}
        </div>
        <div className="line">
          <span className="e">💵</span>
          <span className="l">{t(lang, 'slipRate')}</span>
          <b>{m(a.rateMinor)}</b>
        </div>
        {a.rateChange && (
          <div className="line">
            <span className="e">↗</span>
            <span className="l">{t(lang, 'slipWageChange', { n: a.rateChange.fromDay })}</span>
            <b>{a.rateChange.daysAfter} × {m(a.rateChange.rateMinor)}</b>
          </div>
        )}
        <div className="line">
          <span className="e">＝</span>
          <span className="l">{a.days} × {m(a.rateMinor)} — {t(lang, 'slipGross')}</span>
          <b>{m(a.grossMinor)}</b>
        </div>
        <div className="line">
          <span className="e">➖</span>
          <span className="l">{t(lang, 'slipAdvances')} ({a.advances} × {m(a.advMinor)})</span>
          <b>{m(a.advancesMinor)}</b>
        </div>
        {a.advances > 0 && (
          <div className="tokens" aria-hidden>
            {cmp.agreedAdv.map((i) => (
              <span className="tok adv" key={i}>•</span>
            ))}
          </div>
        )}
        {a.carryMinor !== 0 && (
          <div className="line">
            <span className="e">↪</span>
            <span className="l">{t(lang, 'slipCarry')}</span>
            <b>{a.carryMinor < 0 ? '−' : '+'}{m(Math.abs(a.carryMinor))}</b>
          </div>
        )}
        <div className="total">
          <span>{a.netMinor >= 0 ? `✅ ${t(lang, 'slipTotal')}` : t(lang, 'slipOwed')}</span>
          <span>{m(Math.abs(a.netMinor))}</span>
        </div>
        {oneSided.length > 0 && (
          <div className="small" style={{ marginTop: 10, color: '#8a4b00' }}>
            ⚠ {t(lang, 'slipDisputed')}: {oneSided.join(', ')} ({m(pay.disputedMinor)}). {t(lang, 'slipAgreedNote')}
          </div>
        )}
        <div className="small" style={{ marginTop: 8, color: '#555' }}>{text}</div>
        <div className="small" style={{ marginTop: 8, color: '#888', textAlign: 'center' }}>Stock &amp; Foil</div>
      </div>
      <div className="row no-print" style={{ justifyContent: 'center', marginTop: 12 }}>
        <button className="primary" onClick={() => printArea()}>🖨 Print slip</button>
        {speechSupported() && (
          <button
            onClick={() => {
              if (speaking) { stopSpeaking(); setSpeaking(false); return; }
              setSpeaking(speak(text, lang, settings.speakRate));
            }}
          >
            🔊 {speaking ? 'Stop' : t(lang, 'slipSpeak')}
          </button>
        )}
      </div>
    </div>
  );
}

export function LangPicker({ value, onChange }: { value: string; onChange: (l: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Language" style={{ width: 'auto' }}>
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>{l.name}</option>
      ))}
    </select>
  );
}
