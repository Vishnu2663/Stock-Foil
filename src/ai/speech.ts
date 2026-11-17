/** Free, offline text-to-speech via the browser (Web Speech API). For workers who cannot read. */
import { langInfo } from '../i18n';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  /** BCP-47 tag to use instead of the app language's default (e.g. for Story's extra languages) */
  tag?: string;
  /** add to the end of whatever is being spoken instead of replacing it */
  queue?: boolean;
}

/** Does this device have an installed voice for the language (matched on the base language)? */
export function hasVoiceFor(tag: string): boolean {
  if (!speechSupported()) return false;
  const base = tag.split('-')[0].toLowerCase();
  return speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith(base));
}

export function speak(text: string, lang: string, rate = 0.9, opts: SpeakOptions = {}): boolean {
  if (!speechSupported()) return false;
  const u = new SpeechSynthesisUtterance(text);
  const tag = opts.tag ?? langInfo(lang).speech;
  u.lang = tag;
  u.rate = rate;
  const base = tag.split('-')[0].toLowerCase();
  const voices = speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
  if (voice) u.voice = voice;
  if (!opts.queue) speechSynthesis.cancel();
  speechSynthesis.speak(u);
  return true;
}

export function stopSpeaking() {
  if (speechSupported()) speechSynthesis.cancel();
}
