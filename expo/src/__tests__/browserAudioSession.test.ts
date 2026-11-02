import { setBrowserAudioSession } from '../utils/browserAudioSession';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete (globalThis as any).navigator;
});
const navigatorWith = (value: unknown) => Object.defineProperty(globalThis, 'navigator', { configurable: true, value });

test('supported browsers switch between capture and normal media output', () => {
  const session = { type: 'auto' };
  navigatorWith({ audioSession: session });
  setBrowserAudioSession('play-and-record');
  expect(session.type).toBe('play-and-record');
  setBrowserAudioSession('playback');
  expect(session.type).toBe('playback');
});

test('absent or read-only audio sessions cannot break playback, native imports or static export', () => {
  navigatorWith(undefined);
  expect(() => setBrowserAudioSession('playback')).not.toThrow();
  navigatorWith({});
  expect(() => setBrowserAudioSession('playback')).not.toThrow();
  navigatorWith({ audioSession: Object.freeze({ type: 'auto' }) });
  expect(() => setBrowserAudioSession('playback')).not.toThrow();
});
