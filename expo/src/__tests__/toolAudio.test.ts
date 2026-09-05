const mockPlayers: any[] = [];
const mockSettings = { isSoundEnabled: true };
let mockSettingsListener: (state: typeof mockSettings) => void;
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(() => {
  const player = { isLoaded: true, volume: 1, seekTo: jest.fn(async () => {}), play: jest.fn(), pause: jest.fn(), remove: jest.fn() };
  mockPlayers.push(player); return player;
}) }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: {
  getState: () => mockSettings,
  subscribe: (callback: typeof mockSettingsListener) => { mockSettingsListener = callback; return jest.fn(); },
} }));
import { ToolAudio } from '../services/ToolAudio';
import { TOOL_KINDS, synthesizeToolCue, toolTickVolume } from '../services/ToolSoundDesign';

beforeEach(() => { mockPlayers.length = 0; mockSettings.isSoundEnabled = true; jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

test.each(TOOL_KINDS)('%s has distinct, finite, bounded attack and stop samples', kind => {
  for (const cue of ['tick', 'end'] as const) {
    const pcm = synthesizeToolCue(kind, cue);
    expect(pcm.length).toBeGreaterThan(100);
    expect(pcm.every(value => Number.isFinite(value) && Math.abs(value) <= 0.85)).toBe(true);
    expect(pcm.some(value => Math.abs(value) > 0.02)).toBe(true);
    expect(Math.abs(pcm[pcm.length - 1])).toBeLessThan(0.001);
  }
});
test('ticks fade as motion slows and volume is clamped', () => {
  expect(toolTickVolume(0)).toBeGreaterThan(toolTickVolume(0.5));
  expect(toolTickVolume(0.5)).toBeGreaterThan(toolTickVolume(1));
  expect(toolTickVolume(10)).toBe(toolTickVolume(1));
});
test('idle ticks are silent, motion starts immediately, and finishing stops tick playback', async () => {
  const audio = new ToolAudio('wheel'); audio.prepare(); audio.tick();
  expect(mockPlayers.every(player => !player.play.mock.calls.length)).toBe(true);
  audio.begin(6200); await Promise.resolve();
  expect(mockPlayers[0].play).toHaveBeenCalledTimes(1);
  audio.finish(); await Promise.resolve(); audio.tick();
  expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
  audio.dispose();
});
test('mute immediately stops voices and blocks pending playback', async () => {
  const audio = new ToolAudio('coin'); audio.prepare(); audio.begin();
  mockSettings.isSoundEnabled = false; mockSettingsListener(mockSettings);
  await Promise.resolve(); audio.tick(); audio.finish();
  expect(mockPlayers.every(player => !player.play.mock.calls.length)).toBe(true);
  expect(mockPlayers.every(player => player.pause.mock.calls.length > 0)).toBe(true);
  audio.dispose();
});
test('navigation cancels deferred work and prevents delayed sound after disposal', async () => {
  const audio = new ToolAudio('bottle'); audio.prepare(); audio.begin();
  const callback = jest.fn(); audio.later(callback, 500); audio.dispose();
  await jest.runAllTimersAsync();
  expect(callback).not.toHaveBeenCalled();
  expect(mockPlayers.every(player => player.remove.mock.calls.length === 1)).toBe(true);
  expect(mockPlayers.every(player => !player.play.mock.calls.length)).toBe(true);
});
