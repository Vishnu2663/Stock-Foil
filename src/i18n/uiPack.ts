/**
 * The matching half of the whole-app translator. A pack maps an English UI string to its translation.
 * Keys that contain {0}, {1}... are templates: the text in those places is carried over unchanged
 * (numbers, names, amounts), so "Day {0}" matches "Day 12" and becomes the translated template.
 */
export type UiPack = Record<string, string>;

export interface CompiledPack {
  exact: Map<string, string>;
  /** every translated string (used by the dev coverage helper) */
  values: Set<string>;
  patterns: { re: RegExp; tpl: string }[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const HAS_PH = /\{\d+\}/;

export function compilePack(pack: UiPack): CompiledPack {
  const exact = new Map<string, string>();
  const patterns: { re: RegExp; tpl: string }[] = [];
  const values = new Set<string>();
  for (const [k, v] of Object.entries(pack)) {
    if (!v) continue;
    values.add(v.replace(/\s+/g, ' ').trim());
    if (HAS_PH.test(k)) patterns.push({ re: new RegExp('^' + k.split(/\{\d+\}/).map(esc).join('(.*?)') + '$'), tpl: v });
    else exact.set(k, v);
  }
  // the most specific templates (most literal text) first
  patterns.sort((a, b) => b.re.source.length - a.re.source.length);
  return { exact, values, patterns };
}

/** Translation of one whitespace-normalised string, or null when the pack has none. */
export function lookup(c: CompiledPack, text: string): string | null {
  const hit = c.exact.get(text);
  if (hit !== undefined) return hit;
  if (!/[A-Za-z]/.test(text)) return null; // numbers and amounts are never translated
  for (const p of c.patterns) {
    const m = p.re.exec(text);
    if (m) return p.tpl.replace(/\{(\d+)\}/g, (_, i) => m[Number(i) + 1] ?? '');
  }
  return null;
}

/** Translates text that may have leading/trailing whitespace; unchanged when there is no translation. */
export function translateText(c: CompiledPack | null, raw: string): string {
  if (!c) return raw;
  const lead = /^\s*/.exec(raw)![0];
  const trail = raw.length > lead.length ? /\s*$/.exec(raw)![0] : '';
  const core = raw.slice(lead.length, raw.length - trail.length).replace(/\s+/g, ' ');
  if (!core) return raw;
  const hit = lookup(c, core);
  return hit === null ? raw : lead + hit + trail;
}
