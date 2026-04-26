/**
 * Catches a class of production bugs: ReferenceError from calling a function that
 * was never defined in a lexical scope (e.g. "scoreTextReliability is not defined").
 * Complements `node --check` which only checks syntax, not name resolution.
 *
 * Strategy: espree + eslint-scope; collect "through" references that bubble to
 * the global scope and are not in the `globals` browser+es environment.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parse } from 'espree';
import { analyze } from 'eslint-scope';
import { builtinModules } from 'node:module';
import globals from 'globals';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appPath = process.argv[2] || join(__dirname, '..', 'app.js');
const s = readFileSync(appPath, 'utf8');

const envNames = new Set([
  ...Object.keys(globals.browser || {}),
  ...Object.keys(globals.worker || {}),
  ...Object.keys(globals.es2021 || {}),
  ...Object.keys(globals.nodeBuiltin || {}),
  'Capacitor', 'cordova', 'Tesseract', 'saveAs', 'JSZip', 'pdfjsLib', 'PDFJS', 'pdfjsWorker', 'SpeechRecognition', 'webkitSpeechRecognition', 'MediaRecorder', 'showOpenFilePicker'
]);
for (const m of builtinModules) envNames.add(m);

const ast = parse(s, {
  ecmaVersion: 'latest',
  sourceType: 'script',
  loc: true,
  range: true,
  comment: true,
  ecmaFeatures: { impliedStrict: false }
});
const scopeManager = analyze(ast, { ecmaVersion: 'latest', sourceType: 'script' });
const globalScope = scopeManager.scopes[0];
if (!globalScope) {
  console.error('verify-app-js-symbols: no global scope from eslint-scope');
  process.exit(1);
}

const bad = new Map();
for (const ref of globalScope.through) {
  const n = ref.identifier?.name;
  if (!n) continue;
  if (envNames.has(n)) continue;
  const entry = ref.identifier.loc?.start;
  if (!bad.has(n)) bad.set(n, { count: 0, firstLine: entry?.line });
  const v = bad.get(n);
  v.count += 1;
  if (entry?.line) v.firstLine = Math.min(v.firstLine || entry?.line, entry.line);
}

if (bad.size > 0) {
  console.error('verify-app-js-symbols: unresolved (via global "through") identifiers not in env browser/es — likely ReferenceError at runtime:');
  for (const [name, info] of [...bad.entries()].sort((a, b) => a[0].localeCompare(b[0]))){
    console.error(`  ${name}  (≈${info.count} ref(s), first ~line ${info.firstLine || '?'})`);
  }
  process.exit(1);
}
console.log('verify-app-js-symbols: no suspicious unresolved globals (eslint-scope "through" vs globals env).');
process.exit(0);
