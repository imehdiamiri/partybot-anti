import React from 'react';
const { create, act } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'web' }, StyleSheet: { create: (s: unknown) => s },
  Alert: { alert: jest.fn() }, AppState: { addEventListener: () => ({ remove() {} }) },
}));
jest.mock('../theme/Colors', () => ({ Colors: { red: '#f00', green: '#0f0', yellow: '#ff0' } }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: 'Icon' }));
jest.mock('../components/LiquidGlass', () => ({ LiquidGlass: 'Glass' }));
jest.mock('../utils/platform', () => ({ isWeb: true }));

const mockSources: any[] = [];
const mockContext = {
  state: 'running', destination: {},
  createBuffer: (channels: number, length: number, sampleRate: number) => { const data = new Float32Array(length); return { length, numberOfChannels: channels, sampleRate, getChannelData: () => data }; },
  createBufferSource: jest.fn(() => {
    const source = { buffer: null, playbackRate: { value: 1 }, connect: jest.fn(),
      disconnect: jest.fn(), start: jest.fn(), stop: jest.fn(), onended: null };
    mockSources.push(source); return source;
  }),
};
let mockTake = 0;
const mockRecorder = {
  originalBuffer: null as any, reversedBuffer: null as any,
  start: jest.fn(async () => {}),
  stop: jest.fn(async () => {
    const take = ++mockTake;
    mockRecorder.originalBuffer = { take, reversed: false };
    mockRecorder.reversedBuffer = { take, reversed: true, numberOfChannels: 1, sampleRate: 44100, getChannelData: () => new Float32Array(4410) };
    return { originalWavUri: `blob:take-${take}`, reversedWavUri: `blob:reverse-${take}`, durationMs: 2500 };
  }),
  cleanup: jest.fn(), revokeAllCreatedUrls: jest.fn(),
};
jest.mock('../utils/browserMediaAdapter', () => ({
  WebAudioRecorder: jest.fn(() => mockRecorder), isWebMediaRecorderSupported: () => true,
  revokeWebAudioUrl: jest.fn(), getWebAudioContext: () => mockContext,
}));
import { ReverseSingingSession } from '../components/games/ReverseSingingSession';

let screen: any;
const button = (suffix: string) => screen.root.findByProps({ testID: 'reverse-singing-' + suffix });
const press = async (suffix: string) => {
  const target = button(suffix);
  expect(target.props.disabled).not.toBe(true);
  await act(async () => { await target.props.onPress(); });
};
async function record(player: number) { await press(`p${player}-record`); await press(`p${player}-record`); }

beforeEach(async () => {
  mockSources.length = 0; mockTake = 0;
  jest.clearAllMocks();
  await act(async () => { screen = create(React.createElement(ReverseSingingSession, {
    session: { players: [{ id: '1', displayName: 'Player 1' }, { id: '2', displayName: 'Player 2' }] } as any,
  })); });
});
afterEach(async () => { await act(async () => screen.unmount()); });

test('only source Record locks; reverse, slow play, mimic Result, replay and Retry all work', async () => {
  expect(button('p2-record').props.disabled).toBe(true);
  await record(1);
  expect(button('p1-record').props.disabled).toBe(true);
  expect(button('p1-play-reverse').props.disabled).toBe(false);
  expect(button('p2-record').props.disabled).toBe(false);
  expect(button('retry').parent).toBe(button('p1-record').parent);
  await press('p1-play-reverse');
  expect(mockSources.at(-1).buffer).toMatchObject({ take: 1, reversed: true });
  expect(mockSources.at(-1).start).toHaveBeenCalledTimes(1);
  await press('p1-play-slow');
  expect(mockSources.at(-1).playbackRate.value).toBe(1);
  expect(mockSources.at(-1).buffer.length).toBe(8820);
  const previousSource = mockSources.at(-1);
  await record(2);
  expect(previousSource.stop).toHaveBeenCalled();
  await press('p1-play-reverse');
  expect(mockSources.at(-1).buffer).toMatchObject({ take: 1, reversed: true });
  await press('p2-result');
  expect(mockSources.at(-1).buffer).toMatchObject({ take: 2, reversed: true });
  await press('p2-result');
  expect(mockSources.at(-1).start).toHaveBeenCalledTimes(1);
  await press('p1-play');
  expect(mockSources.at(-1).buffer).toEqual({ take: 1, reversed: false });
  await press('p2-play');
  expect(mockSources.at(-1).buffer).toEqual({ take: 2, reversed: false });
  await press('retry');
  expect(button('p1-record').props.disabled).toBeFalsy();
  expect(button('p1-play-reverse').props.disabled).toBe(true);
  expect(button('p2-result').props.disabled).toBe(true);
  expect(button('p2-record').props.disabled).toBe(true);
  await record(1);
  await press('p1-play-reverse');
  expect(mockSources.at(-1).buffer).toMatchObject({ take: 3, reversed: true });
});

test('all original action buttons have their original 100px size', () => {
  for (const suffix of ['p1-record', 'p1-play', 'p1-play-reverse', 'p1-play-slow', 'p2-record', 'p2-play', 'p2-result', 'p2-share']) {
    const style = Object.assign({}, ...button(suffix).props.style.filter(Boolean));
    expect(style.height ?? style.minHeight).toBe(100);
  }
});

test('source playback remains available while the mimic is being processed', async () => {
  await record(1); await press('p2-record');
  let finish!: (value: any) => void;
  mockRecorder.stop.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let stopping: Promise<void>;
  await act(async () => { stopping = button('p2-record').props.onPress(); });
  expect(button('p1-play-reverse').props.disabled).toBe(false);
  await press('p1-play-reverse');
  expect(mockSources.at(-1).buffer).toMatchObject({ take: 1, reversed: true });
  await act(async () => {
    finish({ originalWavUri: 'blob:mimic', reversedWavUri: 'blob:mimic-reversed', durationMs: 1000 });
    await stopping;
  });
});

test('a playback failure is visible and the same button can be retried', async () => {
  await record(1);
  mockContext.createBufferSource.mockImplementationOnce(() => {
    throw new Error('Audio output temporarily unavailable');
  });
  await press('p1-play-reverse');
  expect(button('mic-error')).toBeDefined();
  expect(JSON.stringify(screen.toJSON())).toContain('Audio output temporarily unavailable');
  await press('p1-play-reverse');
  expect(screen.root.findAllByProps({ testID: 'reverse-singing-mic-error' })).toHaveLength(0);
  expect(mockSources.at(-1).start).toHaveBeenCalled();
});
