const mockPlayer = {
  isLoaded: true, volume: 1, shouldCorrectPitch: true,
  currentStatus: { isLoaded: true, currentTime: 1.25, didJustFinish: false },
  play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(), remove: jest.fn(),
  setPlaybackRate: jest.fn(), addListener: jest.fn(() => ({ remove: jest.fn() })),
};
const mockSetMode = jest.fn();
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => mockPlayer), setAudioModeAsync: (...args: unknown[]) => mockSetMode(...args),
  requestRecordingPermissionsAsync: jest.fn(), AudioModule: {},
}));
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: 'cache' } }));
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
