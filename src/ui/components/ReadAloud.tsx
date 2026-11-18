import { useEffect, useState } from 'react';
import { speak, stopSpeaking, voiceStatus } from '../../ai/speech';
import { langInfo } from '../../i18n';
import { useApp } from '../ctx';

/**
 * "Listen": reads the page in front of you aloud, in the app language, for people who cannot read it. It reads
 * the page as it is on screen, so it follows the language switch (the page text is already translated).
 */
export function ReadAloud({ route }: { route: string }) {
  const { settings, toast } = useApp();
  const [on, setOn] = useState(false);
  useEffect(() => { stopSpeaking(); setOn(false); }, [route, settings.lang]);
  useEffect(() => () => stopSpeaking(), []);

  const text = () => {
    const main = document.querySelector('main');
    if (!main) return '';
    const bits: string[] = [];
    const h = main.querySelector('h1,h2');
    if (h) bits.push((h as HTMLElement).innerText);
    main.querySelectorAll('.lead, p').forEach((p) => {
      const el = p as HTMLElement;
      if (bits.length < 6 && el.offsetParent !== null && el.innerText.trim().length > 12 && !el.closest('.no-read')) bits.push(el.innerText.trim());
    });
    main.querySelectorAll('button.primary, a.primary').forEach((b) => {
      const el = b as HTMLElement;
      if (bits.length < 9 && el.offsetParent !== null) bits.push(el.innerText.trim());
    });
    return bits.join('\n');
  };

  const toggle = () => {
    if (on) { stopSpeaking(); setOn(false); return; }
    const tag = langInfo(settings.lang).speech;
    if (voiceStatus(tag).kind === 'none') {
      toast('This device has no voice for this language. Choose another language, or install a voice in your phone’s speech settings.');
      return;
    }
    const ok = speak(text(), settings.lang, settings.speakRate, { onEnd: () => setOn(false) });
    setOn(ok);
  };

  return (
    <button className={`listen-fab ${on ? 'on' : ''}`} onClick={toggle} aria-pressed={on} aria-label={on ? 'Stop' : 'Listen'}>
      <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 10v4h4l5 4V6L8 10z" />
        {on ? <path d="M16 9l4 6M20 9l-4 6" /> : <><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></>}
      </svg>
      <span>{on ? 'Stop' : 'Listen'}</span>
    </button>
  );
}
