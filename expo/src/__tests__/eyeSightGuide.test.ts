import React from 'react';
let mockUserId = 'guide-user';
jest.mock('../store/useAuthStore', () => ({ useAuthStore: (selector: any) => selector({ currentUser: { uid: mockUserId } }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ __esModule: true, default: { getItem: jest.fn(async () => null), setItem: jest.fn(async () => {}) } }));
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameStartGuide } from '../components/games/GameStartGuide';
import { SinglePlayerContext, useSoloHandoff } from '../components/games/SinglePlayerContext';

const { create, act } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Platform: { OS: 'web' }, StyleSheet: { create: (s: unknown) => s },
  useWindowDimensions: () => ({ width: 390, height: 844 }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { Text: 'AnimatedText' },
  useSharedValue: (value: unknown) => ({ value }), useAnimatedStyle: () => ({}),
  withTiming: (value: unknown) => value, Easing: { out: () => null, quad: null },
}));
jest.mock('lucide-react-native', () => ({ Delete: 'Delete', Check: 'Check' }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: 'Icon' }));
jest.mock('../components/games/PhaseTransition', () => ({ PhaseTransition: 'Phase' }));
jest.mock('../components/games/ResultsScoreboard', () => ({ ResultsScoreboard: 'Scoreboard' }));
jest.mock('../components/games/SharedGameComponents', () => ({ GamePassPhoneView: 'Ready', GamePlayerCompleteView: 'Complete' }));
jest.mock('../contexts/GameSkipContext', () => ({ useRegisterSkip: () => () => {} }));
jest.mock('../utils/safeHaptics', () => ({ selectionAsync: jest.fn(), impactAsync: jest.fn(), notificationAsync: jest.fn(), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('../services/AudioManager', () => ({ AudioManager: { play: jest.fn() } }));

import { EyeSightSession } from '../components/games/EyeSightSession';
import { GameIntroGate, useReplayGuide } from '../components/games/GameStartGuide';
import { compareEyeSightDigits } from '../utils/eyeSightFeedback';
import { GAME_HINTS } from '../constants/GameHints';
import { GameLibrary } from '../models/AppModels';

let screen: any;
const button = (id: string) => screen.root.findByProps({ testID: id });
async function press(id: string) { await act(async () => button(id).props.onPress()); }
beforeEach(() => { mockUserId += '-next'; jest.clearAllMocks(); (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null); jest.useFakeTimers(); jest.spyOn(Math, 'random').mockReturnValue(0.5); });
afterEach(async () => { if (screen) await act(async () => screen.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });

test('every current game has three short action steps', () => {
  for (const game of GameLibrary) {
    expect(GAME_HINTS[game.id]?.tip.split(' | ')).toHaveLength(3);
    expect(GAME_HINTS[game.id].icon).toBeTruthy();
  }
});

test('comparison preserves positions, repeated digits and missing/extra digits', () => {
  expect(compareEyeSightDigits('316', '386').map(d => d.correct)).toEqual([true, false, true]);
  expect(compareEyeSightDigits('1001', '101').map(d => d.entered)).toEqual(['1', '0', '1', '—']);
  expect(compareEyeSightDigits('12', '123')[2].correct).toBe(false);
});

test('guide gates first mounting then bypasses replay and later sessions', async () => {
  const mounted = jest.fn(); const replayed = jest.fn();
  function Child() { const replay = useReplayGuide(); React.useEffect(mounted, []); return React.createElement('Replay', { onPress: () => replay(replayed) }); }
  await act(async () => { screen = create(React.createElement(GameIntroGate, { gameId: 'memory_grid', children: React.createElement(Child) })); });
  expect(mounted).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(60000));
  expect(mounted).not.toHaveBeenCalled();
  await press('game-guide-start'); expect(mounted).toHaveBeenCalledTimes(1);
  await act(async () => screen.root.findByType('Replay').props.onPress());
  expect(replayed).toHaveBeenCalledTimes(1);
  await act(async () => screen.update(React.createElement(GameIntroGate, { key: 'new', gameId: 'memory_grid', children: React.createElement(Child) })));
  expect(screen.root.findAllByProps({ testID: 'game-start-guide' })).toHaveLength(0);
  expect(mounted).toHaveBeenCalledTimes(2);
});

test('setup difficulty is honored after entry guide, no second chooser; wrong first answer is not skipped', async () => {
  await act(async () => { screen = create(React.createElement(GameIntroGate, {gameId:'eye_sight', children:React.createElement(EyeSightSession, { session: { gameConfig:{difficulty:'easy'}, players: [{ id: '1', displayName: 'Mehdi' }] } as any })})); });
  expect(screen.root.findAllByProps({ testID: 'eyesight-diff-easy' })).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(60000));
  expect(button('game-start-guide')).toBeDefined();
  expect(screen.root.findAllByType('AnimatedText')).toHaveLength(0);
  await press('game-guide-start');
  await act(async () => screen.root.findByType('Ready').props.onReady());
  await act(async () => jest.advanceTimersByTime(2100));
  const flash = screen.root.findByType('AnimatedText');
  expect(flash.props.children).toBe('555');
  expect(flash.props.style[0].fontWeight).toBe('500');
  expect(flash.props.style[0].textShadowRadius).toBeUndefined();
  await act(async () => jest.advanceTimersByTime(1400));
  await press('eyesight-key-5'); await press('eyesight-key-1'); await press('eyesight-key-5');
  await press('eyesight-key-submit');
  expect(button('eyesight-original').props.children).toBe('555');
  expect(button('eyesight-answer-digit-1').props.style[1].color).toBe('#ff7676');
  expect(button('eyesight-answer-digit-0').props.style[1].color).toBe('#72e3a1');
  expect(JSON.stringify(screen.toJSON())).toContain('Turn complete');
  await press('eyesight-continue-button');
  await act(async () => screen.root.findByType('Complete').props.onReady());
  expect(screen.root.findByType('Scoreboard').props.entries[0].isSkipped).toBe(false);
  await act(async () => screen.root.findByType('Scoreboard').props.onPlayAgain());
  expect(screen.root.findAllByProps({testID:'eyesight-diff-easy'})).toHaveLength(0);
  expect(screen.root.findByType('Ready').props.subtitle).toContain('Easy');
});


test('persisted history skips a guide after reload', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');
  const start = jest.fn();
  await act(async () => { screen = create(React.createElement(GameStartGuide, { gameId: 'color_match', onStart: start })); });
  expect(start).toHaveBeenCalledTimes(1);
  expect(screen.root.findAllByProps({ testID: 'game-start-guide' })).toHaveLength(0);
});
test('history is scoped to the game and account', async () => {
  const start = jest.fn();
  await act(async () => { screen = create(React.createElement(GameStartGuide, { gameId: 'color_match', onStart: start })); });
  await press('game-guide-start');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(expect.stringContaining(mockUserId), '1');
  await act(async () => screen.update(React.createElement(GameStartGuide, { gameId: 'sound_match', onStart: start })));
  expect(button('game-start-guide')).toBeDefined();
  mockUserId += '-another';
  await act(async () => screen.update(React.createElement(GameStartGuide, { gameId: 'color_match', onStart: start })));
  expect(button('game-start-guide')).toBeDefined();
});
test('storage failures do not block first play', async () => {
  (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('storage'));
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('quota'));
  const start = jest.fn();
  await act(async () => { screen = create(React.createElement(GameStartGuide, { gameId: 'color_match', onStart: start })); });
  await press('game-guide-start'); expect(start).toHaveBeenCalledTimes(1);
});
test('solo handoff advances once; multiplayer and final results stay visible', async () => {
  const ready = jest.fn();
  function Handoff({ final = false }: { final?: boolean }) { return useSoloHandoff(ready, final) ? null : React.createElement('Handoff'); }
  const render = (solo: boolean, final = false) => React.createElement(SinglePlayerContext.Provider, { value: solo }, React.createElement(Handoff, { final }));
  await act(async () => { screen = create(render(true)); });
  expect(ready).toHaveBeenCalledTimes(1);
  await act(async () => screen.update(render(true)));
  expect(ready).toHaveBeenCalledTimes(1); expect(screen.toJSON()).toBeNull();
  await act(async () => screen.update(render(false)));
  expect(screen.root.findByType('Handoff')).toBeDefined();
  await act(async () => screen.update(render(true, true)));
  expect(screen.root.findByType('Handoff')).toBeDefined();
  expect(ready).toHaveBeenCalledTimes(1);
});
