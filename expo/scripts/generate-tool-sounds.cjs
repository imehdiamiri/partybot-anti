// Reproducible original effects; run only when ToolSoundDesign changes.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const vm = require('vm');
function loadTs(relative) {
  const filename = path.join(__dirname, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, Float32Array, Uint8Array, DataView, Math, Number });
  return exports;
}
// Tools now use recorded CC0 Foley; never overwrite them with synthesized tones.
const { pcm16ToWav } = loadTs('../src/utils/pcmWav.ts');
const outputDir = path.join(__dirname, '../assets/sounds/tools');
const { GAME_SOUND_FILES, GAME_SAMPLE_RATE, synthesizeGameCue } = loadTs('../src/services/GameSoundDesign.ts');
for (const [id, filename] of Object.entries(GAME_SOUND_FILES)) {
  const samples = synthesizeGameCue(id);
  const pcm = new Uint8Array(samples.length * 2);
  const view = new DataView(pcm.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, Math.round(sample * 32767), true));
  fs.writeFileSync(path.join(outputDir, '..', filename + '.wav'), pcm16ToWav([pcm], GAME_SAMPLE_RATE, 1));
}
console.log('Generated 14 original game event effects.');
