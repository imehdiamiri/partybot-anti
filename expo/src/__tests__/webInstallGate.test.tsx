import React from 'react';
const { create, act } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
jest.mock('react-native', () => ({
  Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
  StyleSheet: { create: (styles: any) => styles },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../services/webGoogleAuth', () => ({ hasPendingGoogleRedirect: jest.fn(() => false) }));
import { hasPendingGoogleRedirect } from '../services/webGoogleAuth';
import { WebInstallGate } from '../components/WebInstallGate.web';
import { INSTALL_GUIDE_KEY } from '../services/webInstall';

let screen: any;
let events: Record<string, (event?: any) => void>;
let values: Map<string, string>;
const render = (onboardingComplete: boolean, settingsReady = true) =>
  <WebInstallGate onboardingComplete={onboardingComplete} settingsReady={settingsReady}><span>Next screen</span></WebInstallGate>;
const visible = () => JSON.stringify(screen.toJSON());
beforeEach(() => {
  values = new Map(); events = {};
  (hasPendingGoogleRedirect as jest.Mock).mockReturnValue(false);
  (globalThis as any).navigator = { userAgent: 'Android Chrome', maxTouchPoints: 1 };
  (globalThis as any).window = {
    localStorage: { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) },
    matchMedia: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
    addEventListener: (name: string, callback: any) => { events[name] = callback; },
    removeEventListener: (name: string) => { delete events[name]; },
  };
});
afterEach(async () => { if (screen) await act(async () => screen.unmount()); });

test('onboarding remains first; completing it shows guidance; Continue persists and restores the next screen', async () => {
  await act(async () => { screen = create(render(false)); });
  expect(visible()).toContain('Next screen');
  expect(screen.root.findAllByProps({testID:'web-install-continue'})).toHaveLength(0);
  await act(async () => screen.update(render(true)));
  expect(visible()).not.toContain('Next screen');
  expect(visible()).toContain('Add to Home Screen');
  await act(async () => screen.root.findByProps({testID:'web-install-continue'}).props.onPress());
  expect(values.get(INSTALL_GUIDE_KEY)).toBe('1');
  expect(visible()).toContain('Next screen');
  await act(async () => screen.unmount());
  await act(async () => { screen = create(render(true)); });
  expect(visible()).toContain('Next screen');
});

test('settings hydration does not flash installation ahead of onboarding', async () => {
  await act(async () => { screen = create(render(true, false)); });
  expect(visible()).not.toContain('Add to Home Screen');
  await act(async () => screen.update(render(false, true)));
  expect(visible()).toContain('Next screen');
});

test('returning Google sign-in goes directly to its next screen', async () => {
  (hasPendingGoogleRedirect as jest.Mock).mockReturnValue(true);
  await act(async () => { screen = create(render(true)); });
  expect(visible()).toContain('Next screen');
  expect(screen.root.findAllByProps({testID:'web-install-continue'})).toHaveLength(0);
});

test('an early browser prompt is deferred until onboarding completes and a real tap requests it', async () => {
  await act(async () => { screen = create(render(false)); });
  const event = { preventDefault: jest.fn(), prompt: jest.fn().mockResolvedValue(undefined), userChoice: Promise.resolve({outcome:'dismissed'}) };
  await act(async () => events.beforeinstallprompt(event));
  expect(event.prompt).not.toHaveBeenCalled();
  expect(screen.root.findAllByProps({testID:'web-install'})).toHaveLength(0);
  await act(async () => screen.update(render(true)));
  await act(async () => screen.root.findByProps({testID:'web-install'}).props.onPress());
  expect(event.prompt).toHaveBeenCalledTimes(1);
  expect(values.has(INSTALL_GUIDE_KEY)).toBe(false);
  expect(visible()).toContain('You can add it later');
});
