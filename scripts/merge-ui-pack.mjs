// Merges <lang>.c*.json chunk files (each an object: English string -> translation) into <lang>.json
// and reports what is still missing. Usage: node scripts/merge-ui-pack.mjs hi
import fs from 'node:fs';
const lang = process.argv[2];
if (!lang) { console.error('usage: node scripts/merge-ui-pack.mjs <lang>'); process.exit(2); }
const dir = 'src/i18n/ui';
const src = JSON.parse(fs.readFileSync(`${dir}/source.json`, 'utf8'));
const merged = {};
for (const f of fs.readdirSync(dir).filter((f) => new RegExp(`^${lang}\\.c\\d+\\.json$`).test(f)).sort()) {
  try { Object.assign(merged, JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'))); } catch (e) { console.error(`${f}: invalid JSON (${e.message.slice(0, 80)})`); process.exit(1); }
}
fs.writeFileSync(`${dir}/${lang}.json`, JSON.stringify(merged, null, 1));
const missing = src.filter((k) => !(k in merged));
console.log(`${lang}: ${src.length - missing.length}/${src.length} translated, ${missing.length} still missing`);
fs.writeFileSync(`${dir}/${lang}.missing.json`, JSON.stringify(missing, null, 1));
if (missing.length) console.log(`still missing (first 3): ${JSON.stringify(missing.slice(0, 3))}  (full list: ${dir}/${lang}.missing.json)`);
