// Checks a UI translation pack against the English source list. Usage: node scripts/check-ui-pack.mjs hi
import fs from 'node:fs';
const lang = process.argv[2];
if (!lang) { console.error('usage: node scripts/check-ui-pack.mjs <lang>'); process.exit(2); }
const src = JSON.parse(fs.readFileSync('src/i18n/ui/source.json', 'utf8'));
let pack;
try { pack = JSON.parse(fs.readFileSync(`src/i18n/ui/${lang}.json`, 'utf8')); } catch (e) { console.error(`cannot read src/i18n/ui/${lang}.json: ${e.message}`); process.exit(1); }
const ph = (s) => (s.match(/\{\d+\}/g) || []).sort().join(',');
const missing = src.filter((k) => !(k in pack));
const empty = src.filter((k) => k in pack && !String(pack[k]).trim());
const badPh = src.filter((k) => k in pack && ph(k) !== ph(String(pack[k])));
const extra = Object.keys(pack).filter((k) => !src.includes(k));
console.log(`${lang}: ${src.length - missing.length}/${src.length} translated; missing ${missing.length}, empty ${empty.length}, placeholder problems ${badPh.length}, unknown keys ${extra.length}`);
if (missing.length) console.log('  missing e.g.', missing.slice(0, 5));
if (badPh.length) console.log('  placeholder problems e.g.', badPh.slice(0, 5));
if (extra.length) console.log('  unknown keys e.g.', extra.slice(0, 5));
process.exit(missing.length || empty.length || badPh.length ? 1 : 0);
