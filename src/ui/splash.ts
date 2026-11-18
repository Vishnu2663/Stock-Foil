/**
 * Opening loader. index.html paints it straight away: a scaled-up copy of the header brand with a slow
 * progress line. Once the app has rendered (and fonts are ready, and the loader has been up long enough to
 * read as intentional) the copy flies to the header brand and scales down to exactly its size, the cover
 * fades, and the real brand takes over on the very frame the copy lands. Same geometry, so there is never
 * a second logo on screen.
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
  const hidden = !logo || !logo.getBoundingClientRect().width; // e.g. the header is not laid out yet
  if (reducedMotion() || !mark || !logo || !wm || hidden) {
    sp.classList.add('gone');
    setTimeout(end, 480);
    return;
  }
  setTimeout(() => {
    const a = logo.getBoundingClientRect();
    const b = wm.getBoundingClientRect();
    const left = Math.min(a.left, b.left);
    const top = Math.min(a.top, b.top);
    sp.classList.add('merge');
    mark.style.transform = `translate(${left}px, ${top}px) scale(1)`;
    let landed = false;
    const land = () => { if (landed) return; landed = true; end(); };
    mark.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') land(); });
    setTimeout(land, 1200); // safety net if no transition event arrives
  }, 380);
}
