#!/usr/bin/env node
/**
 * generate-challenge-sounds.js
 * Generates WAV audio files for the Drum Challenge game modes.
 * 
 * - whitney_challenge.wav: A dramatic musical build-up → dramatic pause → beat drop at ~11.8s
 * - phil_challenge.wav: A moody atmospheric build → dramatic pause → beat drop at ~10.5s
 * - metronome_challenge.wav: A steady click track (used by metronome mode tick logic)
 * 
 * Run: node scripts/generate-challenge-sounds.js
 * 
 * Format: 16-bit PCM, 44100 Hz, stereo
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const CHANNELS = 2;
const BITS_PER_SAMPLE = 16;
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

function writeWav(filepath, samplesLeft, samplesRight) {
  const numSamples = samplesLeft.length;
  const bytesPerSample = BITS_PER_SAMPLE / 8;
  const dataSize = numSamples * CHANNELS * bytesPerSample;
  const fileSize = 44 + dataSize;

  const buf = Buffer.alloc(fileSize);
  let o = 0;

  // RIFF header
  buf.write('RIFF', o); o += 4;
  buf.writeUInt32LE(fileSize - 8, o); o += 4;
  buf.write('WAVE', o); o += 4;

  // fmt chunk
  buf.write('fmt ', o); o += 4;
  buf.writeUInt32LE(16, o); o += 4;
  buf.writeUInt16LE(1, o); o += 2;          // PCM
  buf.writeUInt16LE(CHANNELS, o); o += 2;
  buf.writeUInt32LE(SAMPLE_RATE, o); o += 4;
  buf.writeUInt32LE(SAMPLE_RATE * CHANNELS * bytesPerSample, o); o += 4;
  buf.writeUInt16LE(CHANNELS * bytesPerSample, o); o += 2;
  buf.writeUInt16LE(BITS_PER_SAMPLE, o); o += 2;

  // data chunk
  buf.write('data', o); o += 4;
  buf.writeUInt32LE(dataSize, o); o += 4;

  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, samplesLeft[i]));
    const r = Math.max(-1, Math.min(1, samplesRight[i]));
    buf.writeInt16LE(Math.round(l * 32767), o); o += 2;
    buf.writeInt16LE(Math.round(r * 32767), o); o += 2;
  }

  fs.writeFileSync(filepath, buf);
  const duration = (numSamples / SAMPLE_RATE).toFixed(2);
  const sizeMB = (buf.length / (1024 * 1024)).toFixed(2);
  console.log(`✓ ${path.basename(filepath)}  (${duration}s, ${sizeMB} MB)`);
}

// ─── Utility functions ───

function fadeIn(t, duration) {
  if (t < 0) return 0;
  if (t > duration) return 1;
  return t / duration;
}

function fadeOut(t, start, duration) {
  if (t < start) return 1;
  if (t > start + duration) return 0;
  return 1 - (t - start) / duration;
}

function envelope(t, attack, sustain, release) {
  if (t < attack) return t / attack;
  if (t < attack + sustain) return 1;
  if (t < attack + sustain + release) return 1 - (t - attack - sustain) / release;
  return 0;
}

// ─── Whitney-style challenge ───
// Concept: Dramatic piano/string-like build → silence → BEAT DROP at 11.8s
// Total duration: ~14s (allows time for beat to ring out)
function generateWhitneyChallenge() {
  const totalDuration = 14.5;
  const beatTime = 11.8; // the exact moment the beat drops
  const n = Math.floor(SAMPLE_RATE * totalDuration);
  const left = new Float64Array(n);
  const right = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let sampleL = 0;
    let sampleR = 0;

    // Phase 1: Musical build-up (0s - 8.5s)
    // Ascending chord progression with growing intensity
    if (t < 8.5) {
      const intensity = fadeIn(t, 2.0) * 0.6;
      
      // Pad chords — warm evolving synth
      const chordProgress = t / 8.5;
      const baseFreq = 220 * Math.pow(2, chordProgress * 0.5); // slowly rising pitch
      
      // Fundamental + harmonics for richness
      const pad = (
        Math.sin(2 * Math.PI * baseFreq * t) * 0.3 +
        Math.sin(2 * Math.PI * baseFreq * 1.5 * t) * 0.2 + // fifth
        Math.sin(2 * Math.PI * baseFreq * 2 * t) * 0.15 +   // octave
        Math.sin(2 * Math.PI * baseFreq * 2.5 * t) * 0.1 +   // tenth
        Math.sin(2 * Math.PI * baseFreq * 3 * t) * 0.05      // twelfth
      ) * intensity;
      
      // Add a slow LFO vibrato
      const vibrato = 1 + 0.003 * Math.sin(2 * Math.PI * 5 * t);
      
      // Subtle arpeggio pattern
      const arpFreq = baseFreq * (1 + 0.5 * Math.floor((t * 2) % 4) / 4);
      const arp = Math.sin(2 * Math.PI * arpFreq * vibrato * t) * 0.15 * intensity * 
                  envelope((t * 2) % 0.5, 0.01, 0.15, 0.34);
      
      // Build tension in last 2 seconds
      const tensionGain = t > 6.5 ? Math.min(1, (t - 6.5) / 2) * 0.3 : 0;
      const tension = Math.sin(2 * Math.PI * 440 * t) * tensionGain *
                       (1 + 0.5 * Math.sin(2 * Math.PI * 8 * t)); // tremolo
      
      sampleL = pad + arp * 0.8 + tension;
      sampleR = pad + arp * 1.2 + tension;
    }

    // Phase 2: The vocal-like sustain (8.5s - 9.8s)
    // Mimics "...and IIIIII..."
    if (t >= 8.5 && t < 9.8) {
      const localT = t - 8.5;
      const env = envelope(localT, 0.1, 0.8, 0.3);
      
      // Rich vocal-like harmonics
      const f0 = 330; // E4
      const vocal = (
        Math.sin(2 * Math.PI * f0 * t) * 0.4 +
        Math.sin(2 * Math.PI * f0 * 2 * t) * 0.3 +
        Math.sin(2 * Math.PI * f0 * 3 * t) * 0.15 +
        Math.sin(2 * Math.PI * f0 * 4 * t) * 0.08 +
        Math.sin(2 * Math.PI * f0 * 5 * t) * 0.04
      ) * env * 0.7;
      
      sampleL = vocal;
      sampleR = vocal;
    }

    // Phase 3: DRAMATIC SILENCE (9.8s - 11.8s)
    // Complete silence — this is the hard part!
    // (samples already 0)

    // Phase 4: THE BEAT DROP (11.8s)
    if (t >= beatTime && t < beatTime + 2.5) {
      const localT = t - beatTime;
      
      // Massive kick drum
      const kickFreq = 60 * Math.exp(-localT * 20); // pitch drops rapidly
      const kick = Math.sin(2 * Math.PI * kickFreq * localT) *
                   Math.exp(-localT * 8) * 0.9;
      
      // Snare/crash noise burst  
      const snareEnv = Math.exp(-localT * 12);
      const snare = (Math.random() * 2 - 1) * snareEnv * 0.5;
      
      // Cymbal wash
      const cymbalEnv = Math.exp(-localT * 3);
      const cymbal = (Math.random() * 2 - 1) * cymbalEnv * 0.2;
      
      // Big chord that rings out
      const chordEnv = Math.exp(-localT * 1.5);
      const chord = (
        Math.sin(2 * Math.PI * 220 * t) * 0.25 +
        Math.sin(2 * Math.PI * 277 * t) * 0.2 +
        Math.sin(2 * Math.PI * 330 * t) * 0.2 +
        Math.sin(2 * Math.PI * 440 * t) * 0.15
      ) * chordEnv;
      
      // Sub bass rumble
      const sub = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-localT * 4) * 0.3;
      
      sampleL = kick + snare * 0.9 + cymbal * 0.7 + chord + sub;
      sampleR = kick + snare * 1.1 + cymbal * 1.3 + chord + sub;
    }

    // Overall fade-in at start, fade-out at end
    const masterGain = fadeIn(t, 0.5) * fadeOut(t, totalDuration - 0.5, 0.5);
    left[i] = sampleL * masterGain * 0.85;
    right[i] = sampleR * masterGain * 0.85;
  }

  return { left, right, duration: totalDuration };
}

// ─── Phil Collins-style challenge ───
// Concept: Moody atmospheric synth → silence → massive drum fill at 10.5s
function generatePhilChallenge() {
  const totalDuration = 13.5;
  const beatTime = 10.5;
  const n = Math.floor(SAMPLE_RATE * totalDuration);
  const left = new Float64Array(n);
  const right = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let sampleL = 0;
    let sampleR = 0;

    // Phase 1: Dark atmospheric pad (0s - 7.5s)
    if (t < 7.5) {
      const intensity = fadeIn(t, 3.0) * 0.5;
      
      // Dark minor chord — Am (A2, C3, E3)
      const pad = (
        Math.sin(2 * Math.PI * 110 * t) * 0.3 +
        Math.sin(2 * Math.PI * 131 * t) * 0.25 + // C3
        Math.sin(2 * Math.PI * 165 * t) * 0.2 +   // E3
        Math.sin(2 * Math.PI * 220 * t) * 0.15 +   // A3
        Math.sin(2 * Math.PI * 330 * t) * 0.08     // E4
      ) * intensity;
      
      // Slow pulsing effect
      const pulse = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t);
      
      // Eerie high tone
      const eerieEnv = 0.1 * Math.sin(2 * Math.PI * 0.1 * t) + 0.1;
      const eerie = Math.sin(2 * Math.PI * 880 * t + Math.sin(2 * Math.PI * 3 * t) * 2) * eerieEnv * intensity;
      
      sampleL = pad * pulse + eerie * 0.7;
      sampleR = pad * pulse + eerie * 1.3;
    }

    // Phase 2: Rising tension (7.5s - 9.0s)
    if (t >= 7.5 && t < 9.0) {
      const localT = t - 7.5;
      const riseGain = localT / 1.5;
      
      // Rising tone
      const riseFreq = 200 + riseGain * 300;
      const rise = Math.sin(2 * Math.PI * riseFreq * t) * riseGain * 0.4;
      
      // Continued pad, fading out
      const padFade = 1 - localT / 1.5;
      const pad = (
        Math.sin(2 * Math.PI * 110 * t) * 0.2 +
        Math.sin(2 * Math.PI * 165 * t) * 0.15
      ) * padFade * 0.5;
      
      // Drum roll building
      const rollRate = 4 + localT * 12; // speeds up
      const rollEnv = Math.abs(Math.sin(2 * Math.PI * rollRate * t)) * riseGain * 0.3;
      const roll = (Math.random() * 2 - 1) * rollEnv;
      
      sampleL = rise + pad + roll * 0.9;
      sampleR = rise + pad + roll * 1.1;
    }

    // Phase 3: SILENCE (9.0s - 10.5s)
    // The famous pause before "In The Air Tonight" drum fill

    // Phase 4: THE ICONIC DRUM FILL (10.5s)
    if (t >= beatTime && t < beatTime + 3.0) {
      const localT = t - beatTime;
      
      // Multiple big tom hits in sequence (the iconic fill)
      const hits = [0, 0.25, 0.5, 0.65, 0.8, 1.0, 1.25];
      let drumFill = 0;
      for (const hitTime of hits) {
        const dt = localT - hitTime;
        if (dt >= 0 && dt < 0.4) {
          // Each tom hit — deep resonant drum
          const tomFreq = 80 + (hitTime / 1.25) * 40; // pitch rises slightly
          const tomBody = Math.sin(2 * Math.PI * tomFreq * dt * Math.exp(-dt * 5)) *
                          Math.exp(-dt * 6) * 0.7;
          // Attack transient
          const attack = (Math.random() * 2 - 1) * Math.exp(-dt * 30) * 0.5;
          drumFill += tomBody + attack;
        }
      }
      
      // Big reverb crash on beat 1
      const crashEnv = Math.exp(-localT * 2);
      const crash = (Math.random() * 2 - 1) * crashEnv * 0.25;
      
      // Bass note after fill
      if (localT > 1.4) {
        const bassT = localT - 1.4;
        const bass = Math.sin(2 * Math.PI * 82.4 * t) * Math.exp(-bassT * 2) * 0.4; // E2
        drumFill += bass;
      }
      
      sampleL = drumFill * 0.9 + crash * 0.7;
      sampleR = drumFill * 1.1 + crash * 1.3;
    }

    const masterGain = fadeIn(t, 0.5) * fadeOut(t, totalDuration - 0.5, 0.5);
    left[i] = sampleL * masterGain * 0.85;
    right[i] = sampleR * masterGain * 0.85;
  }

  return { left, right, duration: totalDuration };
}

// ─── Metronome click ───
// A single sharp click sound used by the metronome logic for ticking
function generateMetronomeChallenge() {
  const totalDuration = 0.08; // very short click
  const n = Math.floor(SAMPLE_RATE * totalDuration);
  const left = new Float64Array(n);
  const right = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Sharp woodblock-like click
    const env = Math.exp(-t * 80);
    const click = (
      Math.sin(2 * Math.PI * 1200 * t) * 0.5 +
      Math.sin(2 * Math.PI * 2400 * t) * 0.3 +
      Math.sin(2 * Math.PI * 4800 * t) * 0.1
    ) * env;
    
    left[i] = click * 0.8;
    right[i] = click * 0.8;
  }

  return { left, right, duration: totalDuration };
}

// ─── Generate ───

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('Generating drum challenge audio files...\n');

const whitney = generateWhitneyChallenge();
writeWav(path.join(OUTPUT_DIR, 'whitney_challenge.wav'), whitney.left, whitney.right);

const phil = generatePhilChallenge();
writeWav(path.join(OUTPUT_DIR, 'phil_challenge.wav'), phil.left, phil.right);

const metronome = generateMetronomeChallenge();
writeWav(path.join(OUTPUT_DIR, 'metronome_challenge.wav'), metronome.left, metronome.right);

console.log('\n✅ Done! Challenge audio files generated.');
