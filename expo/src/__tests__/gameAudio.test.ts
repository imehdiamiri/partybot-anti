const mockPlayer = {
  isLoaded: true, volume: 1, shouldCorrectPitch: true,
  currentStatus: { isLoaded: true, currentTime: 1.25, didJustFinish: false },
  play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), remove: jest.fn(),
  setPlaybackRate: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })),
};
const mockSetMode = jest.fn();
const mockStream = {
  start: jest.fn(async () => {}), stop: jest.fn(), release: jest.fn(),
  addListener: jest.fn((_event: string, _callback: (buffer: { data: ArrayBuffer; sampleRate: number; channels: number }) => void) => ({ remove: jest.fn() })),
};
const mockWrite = jest.fn(async (_data: Uint8Array) => {});
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer), setAudioModeAsync: (...args: unknown[]) => mockSetMode(...args),
  requestRecordingPermissionsAsync: jest.fn(), AudioModule: { AudioStream: jest.fn(() => mockStream) },
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(() => ({ uri: 'cache/recording.wav', write: mockWrite })), Paths: { cache: 'cache' } }));
import { Audio } from '../services/GameAudio';

beforeEach(() => { jest.clearAllMocks(); mockPlayer.isLoaded = true; });
test('audio adapter preserves millisecond timing and pitch behavior', async () => {
  const { sound } = await Audio.Sound.createAsync(1, { volume: 0.5 });
  expect(mockPlayer.volume).toBe(0.5);
  await sound.setPositionAsync(500);
  expect(mockPlayer.seekTo).toHaveBeenCalledWith(0.5);
  expect((await sound.getStatusAsync()).positionMillis).toBe(1250);
  await sound.setRateAsync(1.5, false);
  expect(mockPlayer.shouldCorrectPitch).toBe(false);
  expect(mockPlayer.setPlaybackRate).toHaveBeenCalledWith(1.5, 'high');
});
test('audio cleanup is idempotent and prevents playback after release', async () => {
  const { sound } = await Audio.Sound.createAsync(1);
  await sound.unloadAsync(); await sound.unloadAsync(); await sound.playAsync();
  expect(mockPlayer.pause).toHaveBeenCalledTimes(1);
  expect(mockPlayer.pause.mock.invocationCallOrder[0]).toBeLessThan(mockPlayer.remove.mock.invocationCallOrder[0]);
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  expect(mockPlayer.play).not.toHaveBeenCalled();
});
test('recording mode changes do not reset unrelated playback settings', async () => {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true });
  expect(mockSetMode).toHaveBeenCalledWith({ allowsRecording: true });
});
test('failed audio loading releases its player', async () => {
  jest.useFakeTimers();
  mockPlayer.isLoaded = false;
  const pending = expect(Audio.Sound.createAsync(1)).rejects.toThrow('Audio load timed out');
  await jest.advanceTimersByTimeAsync(15000);
  await pending;
  expect(mockPlayer.remove).toHaveBeenCalledTimes(1);
  jest.useRealTimers();
});

test('recording does not expose its URI until the asynchronous WAV write completes', async () => {
  let finishWrite!: () => void;
  mockWrite.mockImplementationOnce(() => new Promise(resolve => { finishWrite = resolve; }));
  const { recording } = await Audio.Recording.createAsync();
  mockStream.addListener.mock.calls[0][1]({ data: new Int16Array([200, -200, 100, -100]).buffer, sampleRate: 44100, channels: 1 });
  const stopped = recording.stopAndUnloadAsync();
  expect(recording.stopAndUnloadAsync()).toBe(stopped);
  expect(recording.getURI()).toBeNull();
  expect(mockStream.release).not.toHaveBeenCalled();
  expect(String.fromCharCode(...mockWrite.mock.calls[0][0].subarray(0, 4))).toBe('RIFF');
  finishWrite();
  await stopped;
  expect(recording.getURI()).toBe('cache/recording.wav');
  expect(mockStream.release).toHaveBeenCalledTimes(1);
});

test('a failed WAV write releases the microphone and never advertises a playable file', async () => {
  mockWrite.mockRejectedValueOnce(new Error('No disk space'));
  const { recording } = await Audio.Recording.createAsync();
  mockStream.addListener.mock.calls[0][1]({ data: new Int16Array([200, -200]).buffer, sampleRate: 44100, channels: 1 });
  await expect(recording.stopAndUnloadAsync()).rejects.toThrow('No disk space');
  expect(recording.getURI()).toBeNull();
  expect(mockStream.release).toHaveBeenCalledTimes(1);
});
