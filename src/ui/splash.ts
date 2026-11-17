/**
 * Opening loader. index.html paints it straight away; once the app has rendered (and fonts are ready,
 * and the loader has been on screen long enough to read as intentional), the mark flies into the
 * header's brand spot while the cover fades, so the loader becomes the page.
 */
import { reducedMotion } from './fx';

/** how long the loader stays at least; `?splash=4000` in the URL holds it longer for inspection */
const MIN_SHOW_MS = Number(new URLSearchParams(location.search).get('splash')) || 1500;

export function dismissSplash(): void {
  const sp = document.getElementById('splash');
  if (!sp) return;
  const started = (window as unknown as { __sfT0?: number }).__sfT0 ?? performance.now();
  const wait = Math.max(0, MIN_SHOW_MS - (performance.now() - started));
  setTimeout(() => finish(sp), wait);
}

function finish(sp: HTMLElement) {
  sp.classList.add('done'); // the bar runs out to 100%
  const end = () => { sp.remove(); document.body.classList.remove('splashing'); };
  const mark = sp.querySelector<HTMLElement>('.sp-brand');
  const logo = document.querySelector<SVGElement>('.top .brand > svg');
  const wm = document.querySelector<HTMLElement>('.top .brand .wm');
  if (reducedMotion() || !mark || !logo || !wm) {
    sp.classList.add('gone');
    setTimeout(end, 450);
    return;
  }
  setTimeout(() => {
    const from = mark.getBoundingClientRect();
    const a = logo.getBoundingClientRect();
    const b = wm.getBoundingClientRect();
    const to = { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
    const scale = (to.right - to.left) / from.width;
    // land on the header brand, centred on it
    const dx = to.left - from.left;
    const dy = to.top + ((to.bottom - to.top) - from.height * scale) / 2 - from.top;
    sp.classList.add('merge');
    mark.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    // the real header brand appears exactly as the flying one arrives
    setTimeout(() => document.body.classList.remove('splashing'), 900);
    setTimeout(end, 1150);
  }, 380);
}
