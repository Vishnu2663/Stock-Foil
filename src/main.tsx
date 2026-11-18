import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import { dismissSplash } from './ui/splash';

// phones and touch screens: drop the heavy background effects (see body.lite in styles.css)
const lite = window.matchMedia('(max-width: 1000px), (pointer: coarse)');
const applyLite = () => document.body.classList.toggle('lite', lite.matches);
applyLite();
lite.addEventListener?.('change', applyLite);

createRoot(document.getElementById('root')!).render(<App />);
// once the first frame and the fonts are ready, hand the screen over from the loader to the page
requestAnimationFrame(() => requestAnimationFrame(() => { (document.fonts?.ready ?? Promise.resolve()).then(dismissSplash, dismissSplash); }));

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  // when a NEW version takes over a page that was already controlled, reload once to use it
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').catch(() => undefined);
}
