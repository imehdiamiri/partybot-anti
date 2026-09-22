jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-audio', () => ({ createAudioPlayer: jest.fn() }));
jest.mock('expo-asset', () => ({ Asset: { fromModule: () => ({ uri: '/recorded-tool.wav' }) } }));
const mockSettings = { isSoundEnabled: true };
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: {
  getState: () => mockSettings, subscribe: () => jest.fn(),
} }));
import { ToolAudio } from '../services/ToolAudio';
const sources: any[] = [];
const decoded = { duration: .7 };
const ctx = {
  resume: jest.fn(async () => {}), decodeAudioData: jest.fn(async () => decoded),
  createBufferSource: () => {
    const source = { buffer: null, loop: false, playbackRate: { value: 1 }, connect: jest.fn(node => node), disconnect: jest.fn(), start: jest.fn(), stop: jest.fn() };
    sources.push(source); return source;
  },
  createGain: () => ({ gain: { value: 1 }, connect: () => ({}), disconnect: jest.fn() }), destination: {},
};
beforeEach(() => {
  sources.length = 0; mockSettings.isSoundEnabled = true; jest.clearAllMocks();
  (global as any).window = { AudioContext: function () { return ctx; } };
  (global as any).document = { hidden: false };
});
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('web plays the bundled recording, plays bottle motion once, and stops on navigation', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })) as any;
  const audio = new ToolAudio('bottle'); audio.prepare(); await flush(); audio.begin();
  expect(fetch).toHaveBeenCalledWith('/recorded-tool.wav');
  expect(sources[0].buffer).toBe(decoded);
  expect(sources[0].loop).toBe(false);
  audio.tick(); audio.tick(); expect(sources).toHaveLength(1);
  expect(sources[0].start).toHaveBeenCalledTimes(1);
  audio.dispose(); expect(sources[0].stop).toHaveBeenCalledTimes(1);
});

test('a recording fetched after leaving the tool never starts playing', async () => {
  let resolve: (value: any) => void = () => {};
  const response = new Promise(r => { resolve = r; });
  global.fetch = jest.fn(() => response) as any;
  const audio = new ToolAudio('wheel'); audio.prepare(); audio.begin(); audio.dispose();
  resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }); await flush();
  expect(sources).toHaveLength(0);
});
