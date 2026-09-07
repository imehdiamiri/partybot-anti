// Read-only quality report for the bundled offline card translations.
// This intentionally does not rewrite translations: a suspicious result must
// be reviewed rather than silently “fixed” by another unreliable heuristic.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const ts = require(path.join(root, 'expo/node_modules/typescript'));
require.extensions['.ts'] = (module, filename) => module._compile(
  ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  filename,
);

const { ALL_CARDS } = require(path.join(root, 'expo/src/models/CardModels.ts'));
const translations = JSON.parse(fs.readFileSync(path.join(root, 'expo/src/content/cardTranslations.json'), 'utf8'));
const languages = ['fa', 'tr', 'de', 'fr', 'ar'];
const rtl = new Set(['fa', 'ar']);
const report = [];

const latinWords = (value) => (value.match(/[A-Za-zÀ-ÿ]+/g) || []).map((word) => word.toLowerCase());
const sourceWords = (value) => new Set(latinWords(value));
const hasTargetScript = (value, lang) => rtl.has(lang)
  ? /[\u0600-\u06FF]/u.test(value)
  : /[A-Za-zÀ-ÿ]/u.test(value);
const suspiciousTokens = /(?:<\/?s>|__\w+__|undefined|NaN|▁|Ã.|Â.|�)/u;

for (const card of ALL_CARDS) {
  const source = card.text.trim();
  const sourceSet = sourceWords(source);
  for (const lang of languages) {
    const value = String(translations[card.id]?.[lang] || '').trim();
    const flags = [];
    if (!value) flags.push('missing');
    if (suspiciousTokens.test(value)) flags.push('artifact');
    if (!hasTargetScript(value, lang)) flags.push('wrong-script');
    if (lang !== 'fa' && lang !== 'ar' && value === source) flags.push('unchanged');

    const words = latinWords(value);
    const overlap = words.filter((word) => sourceSet.has(word)).length;
    const overlapRatio = words.length ? overlap / words.length : 0;
    // High overlap is a review signal, not proof of an error: names and short
    // prompts can legitimately retain English words.
    if (lang !== 'fa' && lang !== 'ar' && words.length >= 5 && overlapRatio >= 0.72) flags.push('high-source-overlap');
    if (value.length > Math.max(240, source.length * 3.4)) flags.push('too-long');
    if (value.length < 2) flags.push('too-short');
    if (flags.length) report.push({ id: card.id, lang, flags, source, translation: value });
  }
}

const counts = Object.fromEntries(languages.map((lang) => [lang, report.filter((item) => item.lang === lang).length]));
const output = { generatedAt: new Date().toISOString(), cardCount: ALL_CARDS.length, languages, counts, items: report };
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0 && process.argv[outIndex + 1]) {
  fs.writeFileSync(path.resolve(process.argv[outIndex + 1]), JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ cardCount: ALL_CARDS.length, counts, totalFlags: report.length }, null, 2));
console.log('This is a review queue, not an automatic translation verdict.');
