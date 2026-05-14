#!/usr/bin/env node
/**
 * generate-sounds.js
 * Generates minimal WAV sound effect files for the party game suite.
 * Run: node scripts/generate-sounds.js
 * 
 * Each file is a tiny PCM WAV (8-bit, 22050 Hz, mono).
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

function generateWav(samples) {
  const numSamples = samples.length;
  const dataSize = numSamples;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buf.write('RIFF', offset); offset += 4;
  buf.writeUInt32LE(fileSize - 8, offset); offset += 4;
  buf.write('WAVE', offset); offset += 4;

  // fmt chunk
  buf.write('fmt ', offset); offset += 4;
  buf.writeUInt32LE(16, offset); offset += 4; // chunk size
  buf.writeUInt16LE(1, offset); offset += 2;  // PCM
  buf.writeUInt16LE(1, offset); offset += 2;  // mono
  buf.writeUInt32LE(SAMPLE_RATE, offset); offset += 4;
  buf.writeUInt32LE(SAMPLE_RATE, offset); offset += 4; // byte rate
  buf.writeUInt16LE(1, offset); offset += 2;  // block align
  buf.writeUInt16LE(8, offset); offset += 2;  // bits per sample

  // data chunk
  buf.write('data', offset); offset += 4;
  buf.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    buf.writeUInt8(Math.max(0, Math.min(255, Math.round(samples[i] * 127 + 128))), offset++);
  }

  return buf;
}

function sine(freq, duration, volume = 1.0) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.min(1, (n - i) / (n * 0.2)) * Math.min(1, i / (n * 0.02));
    samples.push(Math.sin(2 * Math.PI * freq * t) * volume * env);
  }
  return samples;
}

function noise(duration, volume = 0.3) {
  const n = Math.floor(SAMPLE_RATE * duration);
  const samples = [];
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, (n - i) / (n * 0.3));
    samples.push((Math.random() * 2 - 1) * volume * env);
  }
  return samples;
}

function concat(...arrays) {
  return [].concat(...arrays);
}

// ═══ Sound Definitions ═══

const sounds = {
  // Tile flip — short click-like tone
  tile_flip: sine(800, 0.05, 0.6),

  // Match found — ascending two-note chime
  match: concat(sine(523, 0.08, 0.5), sine(784, 0.15, 0.6)),

  // Wrong — descending buzz
  wrong: concat(sine(300, 0.06, 0.7), sine(200, 0.12, 0.5)),

  // Countdown tick
  countdown: sine(440, 0.04, 0.4),

  // Countdown final — higher pitch urgent beep
  countdown_final: concat(sine(880, 0.06, 0.7), sine(880, 0.06, 0.7)),

  // Success — triumphant ascending arpeggio
  success: concat(sine(523, 0.1, 0.5), sine(659, 0.1, 0.5), sine(784, 0.15, 0.6), sine(1047, 0.25, 0.7)),

  // Fail — descending sad tone
  fail: concat(sine(400, 0.1, 0.5), sine(300, 0.15, 0.4), sine(200, 0.2, 0.3)),

  // Bottle spin — whoosh (noise sweep)
  bottle_spin: (() => {
    const n = Math.floor(SAMPLE_RATE * 0.8);
    const samples = [];
    for (let i = 0; i < n; i++) {
      const t = i / SAMPLE_RATE;
      const freq = 200 + 600 * Math.sin(t * Math.PI * 3);
      const env = Math.sin((i / n) * Math.PI) * 0.4;
      samples.push(Math.sin(2 * Math.PI * freq * t) * env + (Math.random() * 2 - 1) * env * 0.15);
    }
    return samples;
  })(),

  // Button tap — soft pop
  button_tap: sine(600, 0.03, 0.4),

  // Phase change — smooth transition swoosh
  phase_change: concat(sine(300, 0.08, 0.3), sine(500, 0.1, 0.4), sine(700, 0.08, 0.3)),

  // Score up — quick happy ding
  score_up: concat(sine(700, 0.06, 0.5), sine(1050, 0.1, 0.6)),

  // Game over — dramatic descending with echo
  game_over: concat(
    sine(600, 0.15, 0.6),
    sine(500, 0.15, 0.5),
    sine(400, 0.2, 0.4),
    sine(300, 0.3, 0.3)
  ),

  // Wheel spin — ratcheting tick-tick sound that accelerates then decelerates
  wheel_spin: (() => {
    const totalDuration = 2.5;
    const n = Math.floor(SAMPLE_RATE * totalDuration);
    const samples = new Array(n).fill(0);
    // Generate a series of clicks with varying intervals
    const totalClicks = 35;
    for (let c = 0; c < totalClicks; c++) {
      // Acceleration phase (0-0.4) then deceleration (0.4-1.0)
      const progress = c / totalClicks;
      const clickTime = progress < 0.4
        ? totalDuration * 0.4 * (progress / 0.4) ** 0.5
        : totalDuration * 0.4 + totalDuration * 0.6 * ((progress - 0.4) / 0.6) ** 2;
      const startSample = Math.floor(clickTime * SAMPLE_RATE);
      const clickLen = Math.floor(SAMPLE_RATE * 0.012);
      const freq = 1200 + Math.random() * 400;
      const vol = 0.35 + 0.25 * (1 - progress);
      for (let i = 0; i < clickLen && startSample + i < n; i++) {
        const t = i / SAMPLE_RATE;
        const env = 1 - i / clickLen;
        samples[startSample + i] += Math.sin(2 * Math.PI * freq * t) * vol * env;
      }
    }
    return samples;
  })(),

  // Wheel win — bright celebratory fanfare
  wheel_win: concat(
    sine(659, 0.08, 0.5),
    sine(784, 0.08, 0.5),
    sine(988, 0.1, 0.6),
    sine(1319, 0.2, 0.7),
    sine(1319, 0.15, 0.4)
  ),
};

// ═══ Generate Files ═══

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

for (const [name, samples] of Object.entries(sounds)) {
  const wav = generateWav(samples);
  const filepath = path.join(OUTPUT_DIR, `${name}.wav`);
  fs.writeFileSync(filepath, wav);
  const duration = (samples.length / SAMPLE_RATE).toFixed(3);
  console.log(`✓ ${name}.wav  (${duration}s, ${wav.length} bytes)`);
}

console.log(`\n✅ Generated ${Object.keys(sounds).length} sound effects in ${OUTPUT_DIR}`);
