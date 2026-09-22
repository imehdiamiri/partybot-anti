jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/tool.wav' }) } }));
const mockPlayers: any[] = [];
const mockSettings = { isSoundEnabled: true };
let mockSettingsListener: (state: typeof mockSettings) => void;
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn(() => {
  const player = { isLoaded: true, volume: 0, setPlaybackRate: jest.fn(), seekTo: jest.fn(async () => {}), play: jest.fn(), pause: jest.fn(), remove: jest.fn() };
  mockPlayers.push(player); return player;
}) }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: {
  getState: () => mockSettings,
  subscribe: (callback: typeof mockSettingsListener) => { mockSettingsListener = callback; return jest.fn(); },
} }));
import { ToolAudio } from '../services/ToolAudio';
import { TOOL_KINDS, toolTickVolume } from '../services/ToolSoundDesign';

beforeEach(() => { mockPlayers.length = 0; mockSettings.isSoundEnabled = true; jest.useFakeTimers(); });
afterEach(() => jest.useRealTimers());

test.each(TOOL_KINDS)('%s bundles distinct PCM recordings without clipping', kind => {
  const fs = require('fs'), path = require('path');
  const files = ['tick', 'end'].map(cue => fs.readFileSync(path.join(__dirname, '../../assets/sounds/tools', `${kind}-${cue}.wav`)));
  expect(files[0].equals(files[1])).toBe(false);
  for (const wav of files) {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(44100);
    let peak = 0;
    for (let i = 44; i < wav.length; i += 2) peak = Math.max(peak, Math.abs(wav.readInt16LE(i)) / 32768);
    expect(peak).toBeGreaterThan(0.02); expect(peak).toBeLessThan(0.5);
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

test.each(['bottle', 'dice', 'coin', 'teams'] as const)('%s motion plays once without a repeating grain or loop', async kind => {
  const audio = new ToolAudio(kind); audio.prepare(); audio.begin(8000);
  await Promise.resolve();
  expect(mockPlayers[0].loop).toBe(false);
  for (let i = 0; i < 60; i++) { jest.advanceTimersByTime(100); audio.tick(); }
  await Promise.resolve();
  expect(mockPlayers.reduce((total, player) => total + player.play.mock.calls.length, 0)).toBe(1);
  audio.finish(); await Promise.resolve();
  expect(mockPlayers[0].pause).toHaveBeenCalled();
  expect(mockPlayers[3].play).toHaveBeenCalledTimes(1);
  audio.dispose();
});

test('wheel detents are rate limited even when animation crosses many segments', async () => {
  const audio = new ToolAudio('wheel'); audio.prepare(); audio.begin(8000); await Promise.resolve();
  for (let i = 0; i < 100; i++) { jest.advanceTimersByTime(10); audio.tick(); await Promise.resolve(); }
  expect(mockPlayers.reduce((total, player) => total + player.play.mock.calls.length, 0)).toBeLessThanOrEqual(6);
  expect(mockPlayers.every(player => player.volume <= .3)).toBe(true);
  audio.dispose();
});
