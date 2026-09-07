// Build-time only: local translation caches are not part of the app runtime.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { ALL_CARDS } = require('../src/models/CardModels.ts');
const corrections = require('../src/content/cardTranslationCorrections.json');
const { RELATIONSHIP_SITUATIONS } = require('../src/content/cardsRelationshipDiscussion.ts');
const { RELATIONSHIP_PERSIAN } = require('../src/content/relationshipPersian.ts');
if (RELATIONSHIP_PERSIAN.length !== RELATIONSHIP_SITUATIONS.length) throw new Error('Persian scenario count mismatch');
RELATIONSHIP_SITUATIONS.forEach((text, i) => { corrections[text] = { ...corrections[text], fa: RELATIONSHIP_PERSIAN[i] }; });
const languages = ['fa', 'tr', 'de', 'fr', 'ar'];
const cacheDir = process.argv[2];
if (!cacheDir) throw new Error('Pass the directory containing the five offline translation-cache-XX.json files.');
const caches = Object.fromEntries(languages.map(lang => [lang, JSON.parse(fs.readFileSync(path.join(cacheDir, `translation-cache-${lang}.json`), 'utf8'))]));
const usedCorrections = new Set();
const result = Object.fromEntries(ALL_CARDS.map(card => {
  const parts = card.id.startsWith('relationships-') ? [card.text.slice(0, card.text.indexOf('. ') + 1), card.text.slice(card.text.indexOf('. ') + 2)] : [card.text];
  return [card.id, Object.fromEntries(languages.map(lang => [lang, parts.map(text => {
    if (corrections[text]?.[lang]) usedCorrections.add(text);
    const translated = corrections[text]?.[lang] || caches[lang][text];
    if (!translated?.trim()) throw new Error(`Missing ${lang}: ${card.id}`);
    return translated;
  }).join(' ')]))];
}));
fs.writeFileSync(path.join(__dirname, '../src/content/cardTranslations.json'), JSON.stringify(result));
console.log(`${Object.keys(result).length} cards × ${languages.length} languages; ${usedCorrections.size} corrected source units.`);
console.log('Unused corrections:', Object.keys(corrections).filter(key => !usedCorrections.has(key)));
