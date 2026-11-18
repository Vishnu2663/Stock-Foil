import { useEffect, useRef } from 'react';
import { breakdown } from '../../core/cash';
import { speak, stopSpeaking } from '../../ai/speech';
import { t as trans } from '../../i18n';
import { offlineExplain } from '../../ai';
import type { PairResult } from '../../vision/pair';
import { useApp } from '../ctx';

const NOTE_HUES = ['#b9825a', '#6aa9ff', '#9be37a', '#f0a24b', '#c792ea', '#ff8a6a', '#7fd6d0', '#e0c46a'];

/** One day as a picture: a full sun, or a half sun for a half day. */
function Sun({ half }: { half?: boolean }) {
  return (
    <svg viewBox="0 0 40 40" width="38" height="38" aria-hidden>
      <circle cx="20" cy="20" r="9" fill={half ? 'none' : '#ffb347'} stroke="#ffb347" strokeWidth="2.4" />
      {half && <path d="M20 11a9 9 0 0 0 0 18z" fill="#ffb347" />}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="20" y1="4" x2="20" y2="8.5" stroke="#ffb347" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${a} 20 20)`} opacity={half && a > 0 && a < 180 ? 1 : half ? 0.35 : 1} />)}
    </svg>
  );
}

/**
 * The scan result for someone who cannot read it: the amount in big type, one sun per day (a half sun for a half
 * day), the notes to hand over drawn as notes, and the whole thing read aloud once, in their language.
 */
export function SimpleResult({ r, full, half, netMinor, money, currency, blocked }: { r: PairResult; full: number; half: number; netMinor: number; money: (m: number) => string; currency: string; blocked: boolean }) {
  const { settings, toast } = useApp();
  const spoken = useRef('');
  const pay = Math.max(0, netMinor);
  const notes = breakdown(pay, currency).notes;
  // the amount first, in the person's language, then how it was worked out
  const sentence = () => `${trans(settings.lang, 'slipTotal')}: ${money(pay)}.\n${offlineExplain(r, settings.lang)}`;

  // read the result aloud once per scan (a retake or a language change reads it again)
  useEffect(() => {
    if (blocked) return;
    const key = `${r.code}|${netMinor}|${settings.lang}`;
    if (spoken.current === key) return;
    spoken.current = key;
    speak(sentence(), settings.lang, settings.speakRate);
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.code, netMinor, settings.lang, blocked]);

  return (
    <section className="simple-result" aria-label="Result in pictures">
      <div className="sr-top">
        <div>
          <small>You get</small>
          <div className="sr-amount">{money(pay)}</div>
        </div>
        <button className="sr-listen" onClick={() => { if (!speak(sentence(), settings.lang, settings.speakRate)) toast('Voice is not supported on this device.'); }} aria-label="Listen">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 10v4h4l5 4V6L8 10z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>
          <span>Listen</span>
        </button>
      </div>
      <div className="sr-block">
        <small>Days worked</small>
        <div className="sr-suns">
          {Array.from({ length: full }, (_, i) => <Sun key={'f' + i} />)}
          {Array.from({ length: half }, (_, i) => <Sun key={'h' + i} half />)}
          {full + half === 0 && <span className="sr-none">0</span>}
        </div>
        {half > 0 && <div className="sr-key"><Sun /> full day <Sun half /> half day</div>}
      </div>
      {notes.length > 0 && (
        <div className="sr-block">
          <small>Pay in notes</small>
          <div className="sr-notes">
            {notes.map((n, i) => (
              <div className="sr-note" key={n.denom} style={{ ['--hue' as string]: NOTE_HUES[i % NOTE_HUES.length] }}>
                <b>{n.denom}</b>
                <i>× {n.count}</i>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
