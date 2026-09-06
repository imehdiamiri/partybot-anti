/** Original short, event-driven cues. No ambient loops or rhythm hints during play. */
export const GAME_SOUND_FILES = {
  tileFlip: 'tile_flip', match: 'match', wrong: 'wrong', countdown: 'countdown',
  countdownFinal: 'countdown_final', success: 'success', fail: 'fail',
  bottleSpin: 'bottle_spin', buttonTap: 'button_tap', phaseChange: 'phase_change',
  scoreUp: 'score_up', gameOver: 'game_over', wheelSpin: 'wheel_spin', wheelWin: 'wheel_win',
} as const;
export type GameSoundId = keyof typeof GAME_SOUND_FILES;
export const GAME_SAMPLE_RATE = 22050;
const patterns: Record<GameSoundId, number[]> = {
  tileFlip: [460, 680], match: [660, 880, 1100], wrong: [240, 190],
  countdown: [740], countdownFinal: [1110], success: [523, 659, 784],
  fail: [330, 247], bottleSpin: [980, 620], buttonTap: [420],
  phaseChange: [440, 660], scoreUp: [880, 1320], gameOver: [440, 330, 262],
  wheelSpin: [680], wheelWin: [587, 740, 880],
};
export function synthesizeGameCue(id: GameSoundId): Float32Array {
  const notes = patterns[id];
  const short = id === 'tileFlip' || id === 'buttonTap' || id === 'wheelSpin';
  const step = short ? 0.035 : 0.075;
  const duration = notes.length * step + (short ? 0.05 : 0.16);
  const samples = new Float32Array(Math.ceil(duration * GAME_SAMPLE_RATE));
  let seed = 137;
  for (let i = 0; i < samples.length; i++) {
    const t = i / GAME_SAMPLE_RATE;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 0xffffffff * 2 - 1;
    let value = 0;
    notes.forEach((hz, index) => {
      const x = t - index * step;
      if (x < 0) return;
      const envelope = Math.min(1, x / 0.004) * Math.exp(-x / (short ? 0.02 : 0.055));
      const tone = Math.sin(2 * Math.PI * hz * x) + 0.12 * Math.sin(2 * Math.PI * hz * 2.01 * x);
      value += envelope * (id === 'tileFlip' ? tone * 0.35 + noise * 0.4 : tone * 0.6);
    });
    samples[i] = Math.max(-0.8, Math.min(0.8, value)) * Math.min(1, (duration - t) / 0.012);
  }
  return samples;
}
