import React from 'react';
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
import { compareEyeSightDigits } from '../utils/eyeSightFeedback';
import { GAME_HINTS } from '../constants/GameHints';
import { GameLibrary } from '../models/AppModels';

let screen: any;
const button = (id: string) => screen.root.findByProps({ testID: id });
async function press(id: string) { await act(async () => button(id).props.onPress()); }
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); jest.spyOn(Math, 'random').mockReturnValue(0.5); });
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

test('setup difficulty is honored and a wrong first answer is scored', async () => {
  await act(async () => {
    screen = create(React.createElement(EyeSightSession, {
      session: { gameConfig: { difficulty: 'easy' }, players: [{ id: '1', displayName: 'Mehdi' }] } as any,
    }));
  });
  expect(screen.root.findAllByProps({ testID: 'eyesight-diff-easy' })).toHaveLength(0);
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
