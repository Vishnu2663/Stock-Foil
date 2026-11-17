/** Free, offline text-to-speech via the browser (Web Speech API). For workers who cannot read. */
import { langInfo } from '../i18n';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speak(text: string, lang: string, rate = 0.9): boolean {
  if (!speechSupported()) return false;
  const u = new SpeechSynthesisUtterance(text);
  const tag = langInfo(lang).speech;
  u.lang = tag;
  u.rate = rate;
  const voice = speechSynthesis.getVoices().find((v) => v.lang === tag) ?? speechSynthesis.getVoices().find((v) => v.lang.startsWith(lang));
  if (voice) u.voice = voice;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (speechSupported()) speechSynthesis.cancel();
}
