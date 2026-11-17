/**
 * Free, offline text-to-speech via the browser (Web Speech API). For workers who cannot read.
 *
 * Built for storytelling rather than announcements:
 *  - text is read sentence by sentence with a short breath between them. Long utterances make
 *    several browsers stall or cut off after ~15 s, and one flat block never sounds like a story;
 *  - the most natural installed voice is chosen (neural / enhanced / premium / Google first,
 *    robotic and novelty voices last), and the listener can pick another one;
 *  - a close relative's voice is used when a language has none (Marathi → Hindi, same script).
 */
import { langInfo } from '../i18n';

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export interface SpeakOptions {
  /** BCP-47 tag to use instead of the app language's default (e.g. for Story's extra languages) */
  tag?: string;
  /** add to the end of whatever is being spoken instead of replacing it */
  queue?: boolean;
  /** a specific voice (voiceURI) chosen by the listener */
  voiceURI?: string;
  /** called when everything queued so far has been spoken */
  onEnd?: () => void;
}

/** Languages that can borrow a close relative's voice when they have none of their own. */
const FALLBACK: Record<string, string> = { mr: 'hi', ne: 'hi' };

const base = (tag: string) => tag.split('-')[0].toLowerCase();
const voices = () => (speechSupported() ? speechSynthesis.getVoices() : []);

/** Quality score: higher is more natural. Novelty / robotic voices are pushed to the bottom. */
function score(v: SpeechSynthesisVoice, tag: string): number {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  let s = 0;
  if (v.lang.replace('_', '-').toLowerCase() === tag.toLowerCase()) s += 30;
  if (/premium|enhanced|neural|natural|studio|wavenet|online/.test(n)) s += 40;
  if (/google/.test(n)) s += 25;
  if (/siri/.test(n)) s += 20;
  if (/microsoft/.test(n) && /online|natural/.test(n)) s += 20;
  if (!v.localService) s += 6; // network voices are usually the better ones, local is the offline safety net
  if (/compact|espeak|festival|flite/.test(n)) s -= 40;
  if (/albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox/.test(n)) s -= 100;
  return s;
}

/** 'natural' = neural / enhanced / premium / online voices; 'basic' = the plain offline voice that sounds robotic. */
export function voiceQuality(v: SpeechSynthesisVoice): 'natural' | 'basic' {
  const n = `${v.name} ${v.voiceURI}`.toLowerCase();
  return /premium|enhanced|neural|natural|studio|wavenet|online|siri/.test(n) || /google/.test(n) || !v.localService ? 'natural' : 'basic';
}

/** Installed voices for a language, best first (own language only). */
export function voicesFor(tag: string): SpeechSynthesisVoice[] {
  const b = base(tag);
  return voices()
    .filter((v) => base(v.lang.replace('_', '-')) === b)
    .sort((a, c) => score(c, tag) - score(a, tag));
}

export type VoiceStatus = { kind: 'native' | 'fallback' | 'none'; voice?: SpeechSynthesisVoice; via?: string; /** every candidate voice was found to be silent */ broken?: boolean };

/**
 * Some systems list a voice that was never downloaded: it "speaks" without a sound (or says only the
 * digits). A voice that finishes far too fast for its text, twice, is marked broken and skipped.
 */
const broken = new Set<string>();
const strikes = new Map<string, number>();
const healthCbs = new Set<() => void>();
export function subscribeVoiceHealth(cb: () => void): () => void { healthCbs.add(cb); return () => { healthCbs.delete(cb); }; }
export const isVoiceBroken = (v: SpeechSynthesisVoice) => broken.has(v.voiceURI);
function judge(v: SpeechSynthesisVoice, text: string, rate: number, ms: number) {
  const letters = text.replace(/[\d\s\p{P}\p{S}]/gu, '').length;
  if (letters < 14) return;
  const fast = ms < (letters * 28) / Math.max(0.5, rate); // far quicker than any real speech
  const n = (strikes.get(v.voiceURI) ?? 0) + (fast ? 1 : 0); // a real voice is never this quick, so no reset on a slow one
  strikes.set(v.voiceURI, n);
  if (n >= 2 && !broken.has(v.voiceURI)) { broken.add(v.voiceURI); healthCbs.forEach((f) => f()); }
}

/** What will actually speak this language on this device. */
export function voiceStatus(tag: string, voiceURI?: string): VoiceStatus {
  if (!speechSupported()) return { kind: 'none' };
  const all = voicesFor(tag);
  const own = all.filter((v) => !broken.has(v.voiceURI));
  if (own.length) return { kind: 'native', voice: own.find((v) => v.voiceURI === voiceURI) ?? own[0] };
  const fb = FALLBACK[base(tag)];
  if (fb) {
    const rel = voicesFor(fb).filter((v) => !broken.has(v.voiceURI));
    if (rel.length) return { kind: 'fallback', voice: rel[0], via: fb };
  }
  return { kind: 'none', broken: all.length > 0 };
}

/** Does this device have a voice that can read the language (own or a close relative's)? */
export function hasVoiceFor(tag: string): boolean {
  return voiceStatus(tag).kind !== 'none';
}

interface Chunk { text: string; tag: string; rate: number; voiceURI?: string; pause: number }
let queue: Chunk[] = [];
let playing = false;
let gen = 0;
let endCbs: Array<() => void> = [];

/** Split into sentences (Latin, Devanagari danda, Arabic question mark), long ones at commas. A newline is a longer pause. */
export function sentences(text: string): { t: string; pause: number }[] {
  const out: { t: string; pause: number }[] = [];
  for (const para of text.split(/\n+/)) {
    const parts = para.match(/[^.!?।؟…]+[.!?।؟…]*["”’)]*\s*/g) ?? [para];
    const pieces: string[] = [];
    for (const raw of parts) {
      const p = raw.trim();
      if (!p) continue;
      if (p.length <= 170) { pieces.push(p); continue; }
      // very long sentence: break at commas/semicolons so no utterance runs long
      let cur = '';
      for (const seg of p.split(/(?<=[,;:،])\s+/)) {
        if (cur && (cur + ' ' + seg).length > 150) { pieces.push(cur); cur = seg; } else cur = cur ? `${cur} ${seg}` : seg;
      }
      if (cur) pieces.push(cur);
    }
    pieces.forEach((t, i) => out.push({ t, pause: i === pieces.length - 1 ? 650 : /[,;:،]$/.test(t) ? 160 : 280 }));
  }
  return out;
}

// Browsers drop the reference to an utterance that has no owner, and its "end" event then never fires
// (a known Chrome bug that stalls or restarts narration), so every live utterance is kept here.
const live = new Set<SpeechSynthesisUtterance>();

function next(my: number) {
  if (my !== gen) return;
  const c = queue.shift();
  if (!c) {
    playing = false;
    const cbs = endCbs;
    endCbs = [];
    cbs.forEach((f) => f());
    return;
  }
  const u = new SpeechSynthesisUtterance(c.text);
  u.lang = c.tag;
  u.rate = c.rate;
  u.pitch = 1;
  const st = voiceStatus(c.tag, c.voiceURI);
  if (st.voice) { u.voice = st.voice; u.lang = st.voice.lang; }
  live.add(u);
  let done = false;
  let startedAt = 0;
  u.onstart = () => { startedAt = performance.now(); };
  // each utterance moves the story on exactly once, whether it ends, errors or hangs
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    live.delete(u);
    if (my === gen) setTimeout(() => next(my), c.pause);
  };
  // if the engine hangs (some online voices never report the end), move on after a sensible time
  const watchdog = setTimeout(() => { if (my === gen) { speechSynthesis.cancel(); } finish(); }, 4000 + (c.text.length * 140) / Math.max(0.5, c.rate));
  u.onend = () => { if (u.voice && startedAt) judge(u.voice, c.text, c.rate, performance.now() - startedAt); finish(); };
  u.onerror = (e) => { if (e.error === 'canceled' || e.error === 'interrupted') { done = true; clearTimeout(watchdog); live.delete(u); } else finish(); };
  speechSynthesis.speak(u);
}

let lastKey = '';
let lastAt = 0;

export function speak(text: string, lang: string, rate = 0.9, opts: SpeakOptions = {}): boolean {
  if (!speechSupported()) return false;
  const tag = opts.tag ?? langInfo(lang).speech;
  if (!opts.queue) {
    // the same text asked for again within a moment is a duplicate start, not a request to restart it
    const key = `${tag}|${opts.voiceURI ?? ''}|${rate}|${text}`;
    const now = Date.now();
    if (key === lastKey && now - lastAt < 700 && playing) { if (opts.onEnd) endCbs.push(opts.onEnd); return true; }
    lastKey = key;
    lastAt = now;
    gen++;
    queue = [];
    endCbs = [];
    playing = false;
    speechSynthesis.cancel();
  }
  for (const s of sentences(text)) queue.push({ text: s.t, tag, rate, voiceURI: opts.voiceURI, pause: s.pause });
  if (opts.onEnd) endCbs.push(opts.onEnd);
  if (!playing) {
    playing = true;
    // a tiny delay after cancel() avoids the first sentence being swallowed in Chrome
    const my = gen;
    setTimeout(() => next(my), opts.queue ? 0 : 60);
  }
  return true;
}

export function stopSpeaking() {
  if (!speechSupported()) return;
  gen++;
  queue = [];
  endCbs = [];
  playing = false;
  speechSynthesis.cancel();
}
