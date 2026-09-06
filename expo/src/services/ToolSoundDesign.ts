export const TOOL_KINDS = ['wheel', 'bottle', 'coin', 'dice', 'teams', 'hourglass'] as const;
export type ToolKind = typeof TOOL_KINDS[number];
export type ToolCue = 'tick' | 'end';
export const TOOL_SAMPLE_RATE = 22050;

const voices: Record<ToolKind, { hz: number; decay: number; noise: number; overtone: number }> = {
  wheel: { hz: 720, decay: 0.038, noise: 0.5, overtone: 1.7 },
  bottle: { hz: 1320, decay: 0.09, noise: 0.15, overtone: 2.4 },
  coin: { hz: 2450, decay: 0.12, noise: 0.04, overtone: 2.76 },
  dice: { hz: 260, decay: 0.052, noise: 0.72, overtone: 1.5 },
  teams: { hz: 440, decay: 0.055, noise: 0.8, overtone: 1.3 },
  hourglass: { hz: 920, decay: 0.065, noise: 0.08, overtone: 2 },
};

export function toolTickVolume(progress: number) {
  return 0.46 - 0.28 * Math.max(0, Math.min(1, progress));
}

/** Original, deterministic Foley-inspired samples; shared by web and bundled WAVs. */
export function synthesizeToolCue(kind: ToolKind, cue: ToolCue): Float32Array {
  const voice = voices[kind];
  const duration = cue === 'tick' ? voice.decay * 4 : kind === 'hourglass' ? 1.5 : 0.65;
  const samples = new Float32Array(Math.ceil(duration * TOOL_SAMPLE_RATE));
  let seed = 14731;
  for (let i = 0; i < samples.length; i++) {
    const t = i / TOOL_SAMPLE_RATE;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0xffffffff * 2 - 1;
    let value = 0;
    if (kind === 'bottle' && cue === 'tick') {
      // A textured glass-on-table scrape, not a pitched electronic beep.
      const env = Math.min(1, t / 0.012) * Math.exp(-t / 0.045);
      const friction = noise * (0.5 + 0.22 * Math.sin(2 * Math.PI * 53 * t));
      const glass = Math.sin(2 * Math.PI * 1830 * t) * 0.10 + Math.sin(2 * Math.PI * 2940 * t) * 0.05;
      value = env * (friction + glass);
    } else if (cue === 'tick') {
      const envelope = Math.min(1, t / 0.002) * Math.exp(-t / voice.decay);
      const fundamental = Math.sin(2 * Math.PI * voice.hz * t);
      const partial = Math.sin(2 * Math.PI * voice.hz * voice.overtone * t);
      value = envelope * ((fundamental * 0.65 + partial * 0.35) * (1 - voice.noise) + noise * voice.noise);
    } else {
      const notes = kind === 'hourglass' ? [1, 1.25, 1.5] : [1, 1.5];
      notes.forEach((ratio, index) => {
        const elapsed = t - index * (kind === 'hourglass' ? 0.32 : 0.12);
        if (elapsed < 0) return;
        const hz = Math.max(330, Math.min(880, voice.hz * 0.6)) * ratio;
        const env = Math.min(1, elapsed / 0.008) * Math.exp(-elapsed / 0.19);
        value += Math.sin(2 * Math.PI * hz * elapsed) * env * 0.42;
      });
    }
    const fadeOut = Math.min(1, (duration - t) / 0.01);
    samples[i] = Math.max(-0.85, Math.min(0.85, value * 0.72)) * fadeOut;
  }
  return samples;
}
