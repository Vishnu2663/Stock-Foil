import { useEffect, useState } from 'react';
import { ask, builtinAvailable, translateUi } from '../../ai';
import { addRuntimeTranslations, englishDict, LANGS } from '../../i18n';
import { speak, speechSupported } from '../../ai/speech';
import { useApp } from '../ctx';

const PRESETS = [
  { name: 'OpenRouter (free model)', url: 'https://openrouter.ai/api/v1/chat/completions', model: 'meta-llama/llama-3.3-70b-instruct:free' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  { name: 'Gemini', url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.0-flash' },
];

export function Settings() {
  const { settings, setSettings, toast } = useApp();
  const [builtin, setBuiltin] = useState<boolean | null>(null);
  const [test, setTest] = useState('');
  const [busy, setBusy] = useState(false);
  const [newLang, setNewLang] = useState('');
  const set = (p: Partial<typeof settings>) => setSettings({ ...settings, ...p });

  useEffect(() => {
    builtinAvailable().then(setBuiltin);
  }, []);

  const runTest = async () => {
    setBusy(true);
    setTest('');
    try {
      setTest(await ask(settings, [{ role: 'user', content: 'Reply with one short friendly sentence in Hindi about fair pay.' }]));
    } catch (e) {
      setTest('✗ ' + (e instanceof Error ? e.message : 'failed'));
    }
    setBusy(false);
  };

  const doTranslate = async () => {
    if (!newLang.trim()) return;
    setBusy(true);
    try {
      const d = await translateUi(settings, newLang.trim(), englishDict());
      addRuntimeTranslations(newLang.trim().toLowerCase().slice(0, 2), d);
      toast(`UI strings translated to ${newLang}. Review before field use.`);
    } catch (e) {
      toast('Translation failed: ' + (e instanceof Error ? e.message : ''));
    }
    setBusy(false);
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem' }}>Settings</h1>
      <div className="grid2">
        <div className="card">
          <h3>Language &amp; voice</h3>
          <div className="field"><label>Language</label>
            <select value={settings.lang} onChange={(e) => set({ lang: e.target.value })}>{LANGS.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}</select>
            <div className="small muted sans" style={{ marginTop: 4 }}>The one language for the whole app: scan results, the pay slip, the plain-words explanation and read-aloud. New cards are printed in it too (you can still change that per card).</div>
          </div>
          <label className={`switch ${settings.simple ? 'on' : ''}`} style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={!!settings.simple} onChange={(e) => set({ simple: e.target.checked })} />
            <i aria-hidden />
            <span><b>Pictures and voice mode</b> <em className="pill ok">for workers who cannot read</em>
              <small>Big pictures and buttons, a Listen button on every page, spoken instructions while scanning, and the result shown as suns for the days and notes to hand over, read aloud in your language.</small>
            </span>
          </label>
          <div className="field"><label>Read-aloud speed: {settings.speakRate}</label><input type="range" min={0.5} max={1.4} step={0.05} value={settings.speakRate} onChange={(e) => set({ speakRate: Number(e.target.value) })} /></div>
          <button disabled={!speechSupported()} onClick={() => speak('Stock and Foil', settings.lang, settings.speakRate)}>🔊 Test voice</button>
          {!speechSupported() && <span className="small muted sans"> Voice not supported here.</span>}
          <h3 style={{ marginTop: 18 }}>Add another language with AI</h3>
          <div className="row"><input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="e.g. mr (Marathi), te (Telugu)" style={{ flex: 1 }} /><button onClick={doTranslate} disabled={busy || settings.aiProvider === 'off'}>Translate</button></div>
          <p className="small muted sans">Uses the AI provider you choose. Sends only the app’s English UI strings, never your data.</p>
        </div>

        <div className="card">
          <h3>Free AI</h3>
          <p className="small muted sans">Optional. Used to explain pay and disputes in simple words. Without it, a built-in offline explanation is used.</p>
          <div className="field">
            <label>Provider</label>
            <select value={settings.aiProvider} onChange={(e) => set({ aiProvider: e.target.value as typeof settings.aiProvider })}>
              <option value="builtin">On-device (Chrome built-in AI) · private, offline</option>
              <option value="custom">Online · your own free API key (OpenRouter, Groq, Gemini…)</option>
              <option value="off">Off</option>
            </select>
            {settings.aiProvider === 'builtin' && <div className="small sans" style={{ marginTop: 4 }}>{builtin === null ? 'Checking…' : builtin ? <span className="pill ok">available in this browser</span> : <span className="pill warn">not available here: try Chrome desktop, or pick another provider</span>}</div>}
          </div>
          {settings.aiProvider === 'custom' && (
            <>
              <div className="row" style={{ marginBottom: 8 }}>
                {PRESETS.map((p) => <button key={p.name} className="sm" onClick={() => set({ customUrl: p.url, customModel: p.model })}>{p.name}</button>)}
              </div>
              <div className="small muted sans" style={{ marginBottom: 8 }}>Presets only fill the endpoint and a model name; free models and limits change, so check your provider and edit the model if needed. Not verified against live services.</div>
              <div className="field"><label>Endpoint (chat completions)</label><input value={settings.customUrl} onChange={(e) => set({ customUrl: e.target.value })} /></div>
              <div className="field"><label>Model</label><input value={settings.customModel} onChange={(e) => set({ customModel: e.target.value })} /></div>
              <div className="field"><label>API key (kept only in this browser)</label><input type="password" value={settings.customKey} onChange={(e) => set({ customKey: e.target.value })} autoComplete="off" /></div>
            </>
          )}
          <div className="card flat small sans" style={{ margin: '8px 0' }}>
            <b>Privacy:</b> cloud providers only ever receive anonymised numbers (days, rate, amounts). Names, card ids and photos are never sent. Photos are processed entirely on your device.
          </div>
          <button onClick={runTest} disabled={busy || settings.aiProvider === 'off'}>{busy ? <span className="spin" /> : '🤖'} Test AI</button>
          {test && <p className="card flat" style={{ marginTop: 8 }}>{test}</p>}
        </div>
      </div>
    </div>
  );
}
