const React = require('react');
const { create, act } = require('react-test-renderer');
const path = require('node:path');
const routerBuild = relative => path.join(path.dirname(require.resolve('expo-router/package.json')), 'build', relative);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.__DEV__ = false;
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
const mockRouter = { navigate: mockNavigate, replace: mockReplace };
jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable',
  Platform: { OS: 'web', select: options => options.web ?? options.default },
  StyleSheet: { create: x => x },
  Keyboard: { addListener: () => ({ remove: jest.fn() }) },
}));
jest.mock('expo-router', () => ({
  Tabs: Object.assign('Tabs', { Screen: 'TabScreen' }), useRouter: () => mockRouter,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: 'AnimatedView' }, useSharedValue: value => ({ value }),
  useAnimatedStyle: () => ({}), withTiming: value => value,
}));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' } }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: 'Icon' }));
jest.mock('@/src/components/LiquidGlass', () => ({ LiquidGlass: 'Glass' }));

// Keep the SDK's real screen option processing and redirect hook. Only isolate
// navigator contexts/native views; a permissive router mock missed this migration.
jest.mock(routerBuild('standard-navigation'), () => ({ integrateWithRouter: (_view, _router, config) => config }));
jest.mock(routerBuild('react-navigation/bottom-tabs'), () => ({}));
jest.mock(routerBuild('react-navigation/bottom-tabs/navigators/createBottomTabNavigator'), () => ({}));
jest.mock(routerBuild('link/Link'), () => ({ Link: 'Link' }));
jest.mock(routerBuild('Route'), () => ({ useRouteNode: () => ({ contextKey: '/(tabs)/_layout', initialRouteName: 'index' }) }));
jest.mock(routerBuild('global-state/useRouterActions'), () => ({ useRouterActions: () => mockRouter }));
jest.mock(routerBuild('layouts/GuardContext'), () => ({ useGuardRedirect: () => undefined }));
jest.mock(routerBuild('link/preview/PreviewRouteContext'), () => ({ useIsPreview: () => false }));
jest.mock(routerBuild('react-navigation/native'), () => ({ useIsFocused: () => true }));
jest.mock(routerBuild('standard-navigation/useBuildHref'), () => ({ useBuildHref: () => route => `/${route.name}` }));

const { Platform } = require('react-native');
const Layout = require('../../app/(tabs)/_layout').default;
const { processScreens } = require(routerBuild('layouts/TabsClient')).default;
const { useVisibleTabsWithRedirect } = require(routerBuild('standard-navigation/useVisibleTabsWithRedirect'));
const routes = ['index', 'tools', 'friends', 'game/[id]'].map(name => ({ name, key: `${name}-key` }));
const declarations = () => React.Children.toArray(Layout().props.children).map(child => child.props);
function descriptorsFor(screens) {
  const processed = processScreens(screens);
  return Object.fromEntries(routes.map(route => {
    const screen = processed.find(screen => screen.name === route.name);
    return [route.key, { routeSource: screen ? 'layout' : 'filesystem', options: screen?.options ?? {} }];
  }));
}
function Probe({ screens }) {
  const result = useVisibleTabsWithRedirect({ routes, routeNames: routes.map(route => route.name),
    focusedRouteKey: 'game/[id]-key', descriptors: descriptorsFor(screens) });
  return React.createElement('Probe', result);
}
beforeEach(() => { jest.clearAllMocks(); });

test.each(['web', 'ios', 'android'])('%s: opening a game stays on its detail route under the SDK 58 redirect rules', async platform => {
  Platform.OS = platform;
  let screen;
  await act(async () => { screen = create(React.createElement(Probe, { screens: declarations() })); });
  const result = screen.root.findByType('Probe').props;
  expect(result.visibleRoutes[result.focusedIndex].name).toBe('game/[id]');
  expect(mockReplace).not.toHaveBeenCalled();
  await act(async () => screen.unmount());
});

test.each(['undeclared', 'href-null'])('SDK 58 reproduces the home redirect for %s game details', async failure => {
  const screens = declarations().flatMap(screen => screen.name !== 'game/[id]' ? [screen]
    : failure === 'undeclared' ? [] : [{ ...screen, options: { href: null } }]);
  let screen;
  await act(async () => { screen = create(React.createElement(Probe, { screens })); });
  expect(mockReplace).toHaveBeenCalledWith('/index');
  await act(async () => screen.unmount());
});

test.each(['web', 'ios', 'android'])('%s: all three tab buttons work with SDK 58 props and respect prevented presses', async platform => {
  Platform.OS = platform;
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: false })) };
  const navigateToTab = jest.fn();
  // SDK 58 does not supply a legacy navigation prop to custom tab bars.
  const props = { state: { routes, index: 3 }, descriptors: descriptorsFor(declarations()), emitter, navigateToTab };
  let screen;
  await act(async () => { screen = create(Layout().props.tabBar(props)); });
  expect(screen.root.findAllByType('Pressable').map(button => button.props.accessibilityLabel)).toEqual(['Games', 'Tools', 'Friends']);
  for (const name of ['tools', 'friends']) {
    await act(async () => screen.root.findByProps({ testID: `tab-btn-${name}` }).props.onPress());
    expect(navigateToTab).toHaveBeenLastCalledWith(`${name}-key`);
  }
  await act(async () => screen.root.findByProps({ testID: 'tab-btn-index' }).props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/(tabs)', params: { defaultTab: 'Games', resetAt: expect.any(String) } });
  emitter.emit.mockReturnValue({ defaultPrevented: true });
  navigateToTab.mockClear(); mockNavigate.mockClear();
  for (const name of ['index', 'tools', 'friends']) {
    await act(async () => screen.root.findByProps({ testID: `tab-btn-${name}` }).props.onPress());
  }
  expect(navigateToTab).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
  await act(async () => screen.unmount());
});
