// Deterministic original cue: no sampled recording or external media.
const fs = require('fs');
const path = require('path');
const sampleRate = 44100;
const duration = 12;
const beatTime = 9.7;
const samples = Math.ceil(sampleRate * duration);
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
let seed = 20260908;
for (let i = 0; i < samples; i++) {
  const t = i / sampleRate;
  let value = 0;
  if (t < 8.5) {
    const pulse = t % 0.5;
    const fade = Math.min(1, t * 3, (8.5 - t) * 5);
    value = fade * (0.16 * Math.sin(2 * Math.PI * 110 * t)
      + 0.12 * Math.sin(2 * Math.PI * 220 * t) * Math.exp(-pulse * 14)
      + 0.08 * Math.sin(2 * Math.PI * 440 * t) * Math.exp(-pulse * 28));
  } else if (t >= beatTime) {
    const d = t - beatTime;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0x100000000 * 2 - 1;
    value = 0.65 * Math.sin(2 * Math.PI * (48 * d + 10 * (1 - Math.exp(-18 * d)))) * Math.exp(-5 * d)
      + 0.25 * noise * Math.exp(-18 * d);
  }
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value)) * 32767), 44 + i * 2);
}
fs.writeFileSync(path.join(__dirname, '../assets/sounds/music_drop.wav'), wav);
console.log(`Original music drop: ${duration}s, target beat ${beatTime}s`);
