import React from 'react';
const { create, act } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'ios' }, StyleSheet: { create: (s: unknown) => s },
  Alert: { alert: jest.fn() }, AppState: { addEventListener: () => ({ remove() {} }) },
}));
jest.mock('../theme/Colors', () => ({ Colors: { red: '#f00', green: '#0f0', yellow: '#ff0' } }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: 'Icon' }));
jest.mock('../components/LiquidGlass', () => ({ LiquidGlass: 'Glass' }));
jest.mock('../utils/platform', () => ({ isWeb: false }));
jest.mock('expo-sharing', () => ({}));
jest.mock('../utils/browserMediaAdapter', () => ({ revokeWebAudioUrl: jest.fn(), getWebAudioContext: () => null }));
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system/legacy', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: async (uri: string) => mockFiles.get(uri),
  writeAsStringAsync: async (uri: string, b64: string) => { mockFiles.set(uri, b64); },
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri) }),
}));
const mockSounds: any[] = [];
let mockTake = 0;
let mockWav: string;
const mockMode = jest.fn();
jest.mock('../services/GameAudio', () => ({
  Audio: {
    requestPermissionsAsync: async () => ({ granted: true }), setAudioModeAsync: (...args: any[]) => mockMode(...args),
    Recording: { createAsync: async () => {
      const uri = `file:///take-${++mockTake}.wav`;
      return { recording: { stopAndUnloadAsync: async () => { mockFiles.set(uri, mockWav); }, getURI: () => uri } };
    } },
    Sound: { createAsync: async ({ uri }: { uri: string }) => {
      if (!mockFiles.has(uri)) throw new Error('Missing audio file');
      const sound = { uri, playAsync: jest.fn(), unloadAsync: jest.fn(async () => {}),
        setRateAsync: jest.fn(async () => {}), setOnPlaybackStatusUpdate: jest.fn() };
      mockSounds.push(sound); return { sound };
    } },
  },
}));
import { pcm16ToWav } from '../utils/pcmWav';
import { ReverseSingingSession } from '../components/games/ReverseSingingSession';

test('native source and mimic reversal produce playable WAVs; replay and Retry keep only the source record locked', async () => {
  const pcm = new Uint8Array(100);
  const view = new DataView(pcm.buffer);
  for (let i = 0; i < 50; i++) view.setInt16(i * 2, i * 300 - 7500, true);
  mockWav = Buffer.from(pcm16ToWav([pcm], 44100, 1)).toString('base64');
  let screen: any;
  await act(async () => { screen = create(React.createElement(ReverseSingingSession, {
    session: { players: [{ displayName: 'Alex' }, { displayName: 'Sam' }] } as any,
  })); });
  const button = (id: string) => screen.root.findByProps({ testID: 'reverse-singing-' + id });
  const press = async (id: string) => {
    expect(button(id).props.disabled).not.toBe(true);
    await act(async () => { await button(id).props.onPress(); });
  };
  try {
    await press('p1-record'); await press('p1-record');
    expect(button('p1-record').props.disabled).toBe(true);
    await press('p1-play-reverse');
    expect(mockSounds.at(-1).uri).toBe('file:///take-1_reversed.wav');
    expect(mockSounds.at(-1).playAsync).toHaveBeenCalled();
    const reversed = Buffer.from(mockFiles.get('file:///take-1_reversed.wav')!, 'base64');
    expect(reversed.readInt16LE(44)).toBe(view.getInt16(98, true));
    await press('p1-play-slow');
    expect(mockSounds.at(-1).setRateAsync).toHaveBeenCalledWith(.5, true, 1);
    await press('p2-record'); await press('p2-record');
    await press('p2-result');
    expect(mockSounds.at(-1).uri).toBe('file:///take-2_reversed.wav');
    await press('p1-play-reverse');
    expect(mockSounds.at(-1).uri).toBe('file:///take-1_reversed.wav');
    await press('p2-result');
    const playing = mockSounds.at(-1);
    await press('retry');
    expect(playing.unloadAsync).toHaveBeenCalled();
    expect(button('p1-record').props.disabled).toBeFalsy();
    expect(button('p2-result').props.disabled).toBe(true);
    expect(mockMode).toHaveBeenCalledWith({ allowsRecordingIOS: false, playsInSilentModeIOS: true, playThroughEarpieceAndroid: false });
  } finally { await act(async () => screen.unmount()); }
});
