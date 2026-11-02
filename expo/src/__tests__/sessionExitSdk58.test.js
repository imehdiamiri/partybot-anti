const React = require('react');
const { create, act } = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let mockPrevented = false;
const mockReplace = jest.fn(() => { if (mockPrevented) throw new Error('Navigation is still blocked'); });
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', Modal: 'Modal', ActivityIndicator: 'Spinner',
  StyleSheet: { create: x => x }, Platform: { OS: 'web' },
  BackHandler: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'color_match' }), useRouter: () => ({ replace: mockReplace }),
  Stack: { Screen: 'StackScreen' }, useFocusEffect: effect => React.useEffect(effect, [effect]),
  usePreventRemove: prevent => {
    React.useLayoutEffect(() => { mockPrevented = prevent; }, [prevent]);
    return () => { mockPrevented = false; };
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('@/src/store/useGameStore', () => ({ useGameStore: require('zustand').create(set => ({
  activeSession: { id: 's1', game: { name: 'Color Match' } }, exitActiveSession: () => set({ activeSession: null }),
})) }));
jest.mock('@/src/store/useMultiplayerStore', () => ({ useMultiplayerStore: () => ({ currentRoom: null }) }));
jest.mock('@/src/components/ScreenHeader', () => ({ ScreenHeader: 'ScreenHeader' }));
jest.mock('@/src/components/games/GameActivity', () => ({ GameActivityBanner: 'Banner' }));
jest.mock('@/src/components/games/GameSessionRenderer', () => ({ GameSessionRenderer: 'Game' }));
jest.mock('@/src/components/AppBackgroundView', () => ({ AppBackgroundView: 'Background' }));
jest.mock('@/src/components/MultiplayerStatusBanner', () => ({ MultiplayerStatusBanner: 'Multiplayer' }));
jest.mock('@/src/contexts/GameSkipContext', () => ({ GameSkipProvider: ({ children }) => children, useSkipState: () => ({}) }));
jest.mock('@/src/components/ResponsiveWebContainer', () => ({ resetWebScrollOffsets: () => {} }));
const Session = require('../../app/game/[id]/session').default;
const { useGameStore } = require('@/src/store/useGameStore');

test('SDK 58 removal protection survives cancelled Exit and permits only confirmed Exit', async () => {
  global.requestAnimationFrame = jest.fn(() => 1);
  global.cancelAnimationFrame = jest.fn();
  let screen;
  await act(async () => { screen = create(React.createElement(Session)); });
  expect(mockPrevented).toBe(true);
  expect(screen.root.findByType('StackScreen').props.options.gestureEnabled).toBe(false);
  await act(async () => screen.root.findByType('ScreenHeader').props.onLeftPress());
  await act(async () => screen.root.findByProps({ testID: 'action-cancel' }).props.onPress());
  expect(mockPrevented).toBe(true);
  expect(useGameStore.getState().activeSession).not.toBeNull();
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => screen.root.findByType('ScreenHeader').props.onLeftPress());
  await act(async () => screen.root.findByProps({ testID: 'action-confirm' }).props.onPress());
  expect(mockPrevented).toBe(false);
  expect(useGameStore.getState().activeSession).toBeNull();
  expect(mockReplace).toHaveBeenCalledTimes(1);
  expect(mockReplace).toHaveBeenCalledWith('/(tabs)');
  await act(async () => screen.unmount());
});
