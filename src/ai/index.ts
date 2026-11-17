/**
 * Free AI layer. Every AI feature has a deterministic offline fallback, so the
 * app is fully usable with AI off. Providers, in order of privacy:
 *
 *   builtin       Chrome's on-device model (Prompt API, `LanguageModel`). Free,
 *                 offline, nothing leaves the phone. Used when available.
 *   custom        Any OpenAI-compatible endpoint with the user's own free key,
 *                 e.g. OpenRouter ":free" models, Groq or Gemini free tiers.
 *                 Only anonymised numbers are sent, never names.
 *   off           Deterministic offline explanation (also the fallback whenever
 *                 a provider is unavailable or errors).
 *
 * (A keyless public endpoint was removed: Pollinations now demands a bot-check
 * token from anonymous browser callers, which an app must not try to bypass.)
 */
import type { Settings } from '../store';
import { langInfo, t } from '../i18n';
import { formatMoney } from '../core/card';
import type { PairResult } from '../vision/pair';

export interface ChatMsg { role: 'system' | 'user' | 'assistant'; content: string }

interface BuiltinSession { prompt(text: string): Promise<string>; destroy?: () => void }
interface BuiltinApi {
  availability?: () => Promise<string>;
  create: (opts?: unknown) => Promise<BuiltinSession>;
}

function builtinApi(): BuiltinApi | null {
  const g = globalThis as unknown as { LanguageModel?: BuiltinApi; ai?: { languageModel?: BuiltinApi } };
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

export async function builtinAvailable(): Promise<boolean> {
  const api = builtinApi();
  if (!api) return false;
  try {
    if (api.availability) return (await api.availability()) !== 'unavailable';
    return true;
  } catch {
    return false;
  }
}

async function viaBuiltin(msgs: ChatMsg[]): Promise<string> {
  const api = builtinApi();
  if (!api) throw new Error('On-device AI is not available in this browser');
  const sys = msgs.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const session = await api.create(sys ? { initialPrompts: [{ role: 'system', content: sys }] } : undefined);
  try {
    return await session.prompt(msgs.filter((m) => m.role !== 'system').map((m) => m.content).join('\n\n'));
  } finally {
    session.destroy?.();
  }
}

async function viaCustom(s: Settings, msgs: ChatMsg[], signal?: AbortSignal): Promise<string> {
  const r = await fetch(s.customUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.customKey}` },
    body: JSON.stringify({ model: s.customModel, messages: msgs, temperature: 0.3 }),
    signal,
  });
  if (!r.ok) throw new Error(`AI service error ${r.status}`);
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content ?? '').trim();
}

export async function ask(s: Settings, msgs: ChatMsg[], signal?: AbortSignal): Promise<string> {
  if (s.aiProvider === 'off') throw new Error('AI is turned off');
  if (s.aiProvider === 'builtin') {
    if (await builtinAvailable()) return viaBuiltin(msgs);
    throw new Error('On-device AI is not available here. Choose another provider in Settings.');
  }
  if (!s.customKey) throw new Error('Add an API key for your provider in Settings.');
  return viaCustom(s, msgs, signal);
}

/** Facts only: no names, no ids. Safe to send to a cloud model. */
export function anonymisedFacts(r: PairResult): string {
  const c = r.cmp;
  const p = r.pay;
  return [
    `Month: ${r.spec.year}-${String(r.spec.month).padStart(2, '0')}`,
    `Day rate: ${formatMoney(r.spec.rateMinor, r.spec.currency)}; advance token: ${formatMoney(r.spec.advMinor, r.spec.currency)}`,
    `Days punched on both halves: ${c.agreedDays.length} (days ${c.agreedDays.join(', ') || 'none'})`,
    `Days only on worker half: ${c.stockOnlyDays.join(', ') || 'none'}`,
    `Days only on employer half: ${c.foilOnlyDays.join(', ') || 'none'}`,
    `Advances agreed: ${c.agreedAdv.length}; only worker: ${c.stockOnlyAdv.length}; only employer: ${c.foilOnlyAdv.length}`,
    ...(p.agreed.carryMinor ? [`Balance brought forward from last month: ${formatMoney(p.agreed.carryMinor, r.spec.currency)} (negative means the worker still owed it)`] : []),
    `Agreed pay: ${formatMoney(p.agreed.netMinor, r.spec.currency)}; amount in dispute: ${formatMoney(p.disputedMinor, r.spec.currency)}`,
    `Verdict: ${r.verdict}`,
  ].join('\n');
}

const SYSTEM = (lang: string) =>
  `You help a daily-wage worker understand a pay calculation. Write in ${langInfo(lang).name} (${lang}), in at most 5 very short, simple sentences, as if speaking aloud to someone who cannot read well. Use only the facts given. Never invent numbers. Be neutral and fair to both worker and employer. If records disagree, say which days are only on one half and suggest both sides sit together and decide; do not accuse anyone.`;

/** Plain-language explanation for the worker. Always returns text (falls back offline). */
export async function explainPay(s: Settings, r: PairResult, lang: string): Promise<{ text: string; source: 'ai' | 'offline' }> {
  if (s.aiProvider !== 'off') {
    try {
      const text = await ask(s, [
        { role: 'system', content: SYSTEM(lang) },
        { role: 'user', content: anonymisedFacts(r) },
      ]);
      if (text) return { text, source: 'ai' };
    } catch {
      /* fall through to offline */
    }
  }
  return { text: offlineExplain(r, lang), source: 'offline' };
}

/** Deterministic explanation, no AI required. */
export function offlineExplain(r: PairResult, lang: string): string {
  const cur = r.spec.currency;
  const m = (v: number) => formatMoney(v, cur, lang);
  const a = r.pay.agreed;
  const lines: string[] = [];
  if (r.verdict === 'pair-mismatch') lines.push(t(lang, 'vMismatch'));
  else {
    lines.push(`${a.days} ${t(lang, 'slipDays')} × ${m(a.rateMinor)} = ${m(a.grossMinor)}.`);
    if (a.advances) lines.push(`− ${a.advances} ${t(lang, 'slipAdvances')} (${m(a.advancesMinor)}).`);
    if (a.carryMinor) lines.push(`${a.carryMinor < 0 ? '−' : '+'} ${t(lang, 'slipCarry')} (${m(Math.abs(a.carryMinor))}).`);
    lines.push(a.netMinor >= 0 ? `${t(lang, 'slipTotal')}: ${m(a.netMinor)}.` : `${t(lang, 'slipOwed')}: ${m(-a.netMinor)}.`);
    const c = r.cmp;
    const one = [...c.stockOnlyDays, ...c.foilOnlyDays];
    if (one.length) lines.push(`${t(lang, 'slipDisputed')}: ${one.join(', ')} (${m(r.pay.disputedMinor)}).`);
  }
  return lines.join(' ');
}

/** Translate the UI's English strings to a language the app doesn't ship. */
export async function translateUi(s: Settings, lang: string, dict: Record<string, string>): Promise<Record<string, string>> {
  const out = await ask(s, [
    { role: 'system', content: `Translate the JSON values from English into ${lang}. Keep keys, {placeholders} and emoji unchanged. Reply with JSON only.` },
    { role: 'user', content: JSON.stringify(dict) },
  ]);
  const m = out.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Translation failed');
  return JSON.parse(m[0]);
}
