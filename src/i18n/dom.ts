/**
 * Whole-app language switch. Most of the interface is written in English in its components, so
 * instead of editing every screen, the chosen language's pack (src/i18n/ui/<code>.json) is applied
 * to the page's text and its placeholder / title / aria-label / alt attributes, and kept applied as
 * the page changes. Only text values are replaced (never nodes), so React keeps working normally.
 * English restores the original text. Anything a pack does not cover stays in English.
 */
import { compilePack, translateText, type CompiledPack, type UiPack } from './uiPack';

const loaders = import.meta.glob('./ui/*.json', { import: 'default' }) as Record<string, () => Promise<UiPack>>;
const compiled = new Map<string, CompiledPack | null>();

const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'] as const;
const SKIP = '[data-notranslate], script, style, textarea, pre, code';

const textOrig = new WeakMap<Node, string>();
const textOut = new WeakMap<Node, string>();
const attrOrig = new WeakMap<Element, Record<string, string>>();
const attrOut = new WeakMap<Element, Record<string, string>>();

let active: CompiledPack | null = null;
let observer: MutationObserver | null = null;

const skipped = (n: Node) => {
  const el = n.nodeType === 1 ? (n as Element) : n.parentElement;
  return !el || !!el.closest(SKIP);
};

function applyText(node: Text) {
  if (skipped(node)) return;
  const cur = node.nodeValue ?? '';
  // still the text we wrote: translate from the saved English original. Anything else (a new node, or
  // React writing fresh text) becomes the new original. (Our own writes echo back through the observer,
  // so the saved original must survive that echo.)
  const written = textOut.get(node);
  let base: string;
  if (written !== undefined && written === cur && textOrig.has(node)) base = textOrig.get(node)!;
  else { base = cur; textOrig.set(node, cur); textOut.delete(node); }
  const out = translateText(active, base);
  if (out !== cur) {
    textOut.set(node, out);
    node.nodeValue = out;
  }
}

function applyAttrs(el: Element) {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null) continue;
    const orig = (attrOrig.get(el) ?? {});
    const out = (attrOut.get(el) ?? {});
    const base = out[a] === cur && a in orig ? orig[a] : cur;
    orig[a] = base;
    attrOrig.set(el, orig);
    const next = translateText(active, base);
    if (next !== cur) {
      out[a] = next;
      attrOut.set(el, out);
      el.setAttribute(a, next);
    }
  }
}

function walk(root: Node) {
  if (root.nodeType === 3) { applyText(root as Text); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (el.matches?.(SKIP)) return;
  applyAttrs(el);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) applyText(n as Text);
  el.querySelectorAll('[placeholder],[title],[aria-label],[alt]').forEach(applyAttrs);
}

function observe() {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') applyText(r.target as Text);
      else if (r.type === 'attributes') applyAttrs(r.target as Element);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

async function packFor(lang: string): Promise<CompiledPack | null> {
  if (lang === 'en') return null;
  if (compiled.has(lang)) return compiled.get(lang)!;
  const load = loaders[`./ui/${lang}.json`];
  const c = load ? compilePack(await load()) : null; // a language without a pack (e.g. added with AI) stays English
  compiled.set(lang, c);
  return c;
}

/** Applies a language to the whole page, and keeps applying it as the page changes. */
export async function setUiLanguage(lang: string): Promise<void> {
  const c = await packFor(lang);
  active = c;
  document.documentElement.lang = lang;
  observe();
  walk(document.body);
}

/** Dev helper: visible English text the active language does not cover yet. */
export function untranslatedStrings(): string[] {
  const out = new Set<string>();
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
    if (!t || skipped(n) || !/[A-Za-z]{2}/.test(t)) continue;
    if (textOut.get(n) === n.nodeValue) continue; // translated by us
    if (active?.values.has(t)) continue; // already in the active language (translated elsewhere)
    if (/^[\d\s.,:;/+\-−×₹%()·•→←↑↓✓⚠\u2190-\u21FF]+$/.test(t)) continue; // numbers and symbols
    out.add(t);
  }
  return [...out];
}
if (typeof window !== 'undefined') (window as unknown as { __sfUntranslated?: () => string[] }).__sfUntranslated = untranslatedStrings;
