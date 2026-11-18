// Collects every user-visible English string in the UI source (JSX text, labels, titles, placeholders,
// toasts, nav items...) so each language pack can be checked for completeness. Run: node scripts/extract-ui-strings.mjs
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/ui', 'src/vision', 'src/ai', 'src/store', 'src/render'];
const files = [];
for (const root of roots) (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f)) files.push(p); } })(root);

const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label', 'hint', 'summary', 'stamp', 'sub', 'caption', 'tip']);
const CALLS = new Set(['toast', 'setMsg', 'setErr', 'confirm', 'alert', 'setHint', 'setFlash']);
const KEYS = new Set(['label', 'title', 'hint', 'back', 'desc', 'sub', 'note', 'caption', 'text', 'tip', 'msg', 'detail', 'what', 'name', 'short', 'warning', 'reason', 'explanation', 'help']);
const found = new Map(); // string -> Set(file)
const ENT = { amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…', times: '×', larr: '←', rarr: '→', middot: '·', bull: '•' };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m));
const add = (s, f, jsxText = false) => {
  // `jsxText` is also used for labelled values (label/sub/title...) where a lone lowercase word is real text
  s = decode(s).replace(/\s+/g, ' ').trim();
  if (s.length < 2 || !/[A-Za-z]/.test(s)) return;
  if (!jsxText && /^[a-z0-9_.:/#-]+$/.test(s) && !s.includes(' ')) return; // ids, routes, css-like tokens
  if (/=>|function\s|\bimport\b|<\/?[a-z]|^\.kiro|\.kiro\//.test(s)) return;
  if (!found.has(s)) found.set(s, new Set());
  found.get(s).add(path.basename(f));
};
const tpl = (n) => {
  if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isStringLiteral(n)) return n.text;
  if (ts.isTemplateExpression(n)) { let i = 0; return n.head.text + n.templateSpans.map((sp) => `{${i++}}` + sp.literal.text).join(''); }
  return null;
};
const strs = (n) => {
  if (!n) return [];
  const t = tpl(n);
  if (t !== null) return [t];
  if (ts.isConditionalExpression(n)) return [...strs(n.whenTrue), ...strs(n.whenFalse)];
  if (ts.isParenthesizedExpression(n)) return strs(n.expression);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) return [...strs(n.left), ...strs(n.right)];
  if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken || n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)) return [...strs(n.right)];
  return [];
};

for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isJsxText(n)) add(n.text, f, true);
    else if (ts.isJsxExpression(n) && n.parent && !ts.isJsxAttribute(n.parent)) strs(n.expression).forEach((s) => add(s, f));
    else if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText())) {
      const ini = n.initializer;
      if (ini && ts.isStringLiteral(ini)) add(ini.text, f);
      else if (ini && ts.isJsxExpression(ini)) strs(ini.expression).forEach((s) => add(s, f));
    } else if (ts.isCallExpression(n)) {
      const callee = ts.isIdentifier(n.expression) ? n.expression.text : '';
      if (CALLS.has(callee) && n.arguments[0]) strs(n.arguments[0]).forEach((s) => add(s, f));
    } else if (ts.isPropertyAssignment(n) && n.name && KEYS.has(n.name.getText())) {
      strs(n.initializer).forEach((s) => add(s, f, true));
    } else if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2 && n.elements.every((e) => ts.isStringLiteral(e) || ts.isArrayLiteralExpression(e))) {
      const flat = (e) => (ts.isArrayLiteralExpression(e) ? e.elements.flatMap(flat) : ts.isStringLiteral(e) ? [e.text] : []);
      n.elements.flatMap(flat).filter((t) => /^[A-Z⏳💰🧱]/u.test(t) || t.includes(' ')).forEach((t) => add(t, f));
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^(reason|hint|msg|tip)$/.test(n.name.text) && n.initializer) {
      strs(n.initializer).forEach((s) => add(s, f, true));
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && /^[A-Z_]{3,}$/.test(n.name.text) && n.initializer && ts.isArrayLiteralExpression(n.initializer)) {
      n.initializer.elements.forEach((e) => strs(e).forEach((s) => add(s, f)));
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
// the app's own English phrase book (src/i18n/index.ts `en`): languages that lack a key fall back to it
{
  const f = 'src/i18n/index.ts';
  const src = ts.createSourceFile(f, fs.readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  src.forEachChild(function visit(n) {
    if (ts.isVariableDeclaration(n) && n.name.getText() === 'en' && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      n.initializer.properties.forEach((p) => { if (ts.isPropertyAssignment(p)) strs(p.initializer).forEach((s) => { let i = 0; add(s.replace(/\{[A-Za-z]\w*\}/g, () => `{${i++}}`), f); }); });
    }
    ts.forEachChild(n, visit);
  });
}
// strings that are built in code or come from data (verdict names, the formula line), listed by hand
for (const x of JSON.parse(fs.readFileSync('scripts/extra-strings.json', 'utf8'))) add(x, 'scripts/extra-strings.json', true);
const list = [...found.keys()].sort((a, b) => a.localeCompare(b));
fs.writeFileSync(process.argv[2] ?? 'src/i18n/ui/source.json', JSON.stringify(list, null, 1));
console.log(`${list.length} strings from ${files.length} files`);
