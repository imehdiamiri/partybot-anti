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
const { TOOL_KINDS, TOOL_SAMPLE_RATE, synthesizeToolCue } = loadTs('../src/services/ToolSoundDesign.ts');
const { pcm16ToWav } = loadTs('../src/utils/pcmWav.ts');
const outputDir = path.join(__dirname, '../assets/sounds/tools');
fs.mkdirSync(outputDir, { recursive: true });
for (const kind of TOOL_KINDS) for (const cue of ['tick', 'end']) {
  const samples = synthesizeToolCue(kind, cue);
  const pcm = new Uint8Array(samples.length * 2);
  const view = new DataView(pcm.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, Math.round(sample * 32767), true));
  fs.writeFileSync(path.join(outputDir, `${kind}-${cue}.wav`), pcm16ToWav([pcm], TOOL_SAMPLE_RATE, 1));
}
console.log('Generated 12 original tool effects.');
