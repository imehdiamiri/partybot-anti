import React from 'react';
import { act, create } from 'react-test-renderer';
import { StyleSheet } from 'react-native';
import { AppBackgroundView } from '../components/AppBackgroundView';

jest.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => style },
}));

test.each([undefined, 'default', 'simple'] as const)('plain backdrop for variant %s', async variant => {
  let screen: any;
  await act(async () => { screen = create(<AppBackgroundView variant={variant} />); });
  const surface = screen.root.findByProps({ testID: 'app-background' });
  expect(StyleSheet.flatten(surface.props.style).backgroundColor).toBe('#08080F');
  expect(surface.props.pointerEvents).toBe('none');
  expect(screen.toJSON().children).toBeNull();
  await act(async () => screen.unmount());
});
