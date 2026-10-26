import React from 'react';
const { create, act } = require('react-test-renderer');
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Keep the real deck renderer; advance its animation in steps so that the
// visible incoming card can be checked before the index commits.
jest.mock('react-native', () => {
  class Value {
    constructor(public value = 0) {}
    interpolate({ inputRange, outputRange }: any): any {
      const source = this;
      return { read() {
        const x = Math.max(inputRange[0], Math.min(inputRange[inputRange.length - 1], source.value));
        const i = Math.max(0, inputRange.findIndex((n: number) => n >= x) - 1);
        const t = (x - inputRange[i]) / (inputRange[i + 1] - inputRange[i]);
        const a = outputRange[i], b = outputRange[i + 1];
        const value = parseFloat(a) + (parseFloat(b) - parseFloat(a)) * t;
        return typeof a === 'string' ? `${value}deg` : value;
      } };
    }
  }
  class ValueXY {
    x = new Value(); y = new Value();
    setValue(v: any) { this.x.value = v.x; this.y.value = v.y; }
    stopAnimation() {}
  }
  let pending: any;
  return {
    View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', Modal: 'Modal',
    TextInput: 'TextInput', KeyboardAvoidingView: 'KeyboardAvoidingView', TouchableOpacity: 'TouchableOpacity',
    Platform: { OS: 'web' }, StyleSheet: { create: (s: any) => s },
    useWindowDimensions: () => ({ width: 390, height: 844 }),
    AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
    Easing: { cubic: (x: number) => x, inOut: (f: any) => f, out: (f: any) => f },
    PanResponder: { create: (handlers: any) => ({ panHandlers: handlers }) },
    Animated: {
      View: 'AnimatedView', ValueXY,
      timing: (value: any, options: any) => ({ start: (callback: any) => { pending = { value, options, callback }; } }),
      finish: () => { const p = pending; pending = undefined; p.value.setValue(p.options.toValue); p.callback?.({ finished: true }); },
    },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: 'Icon' }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: async () => null, setItem: async () => {} }));
jest.mock('../utils/cardDeck', () => ({
  ...jest.requireActual('../utils/cardDeck'),
  CardDeckPicker: class { open(_key: string, cards: any[]) { return Promise.resolve(cards); } },
}));
jest.mock('../models/CardModels', () => ({
  CardCategory: { Act: 'act', Favorites: 'favorites' }, CardSubtype: {},
  CardCategoryInfo: { act: { title: 'Act', accentColor: '#22C55E', icon: 'star' } },
  ALL_CARDS: ['a', 'b', 'c'].map(id => ({ id, category: 'act', subtype: 'dare', text: `Prompt ${id}` })),
}));
jest.mock('../store/useCustomCardsStore', () => {
  const state = { customCards: [], addCustomCard: jest.fn() };
  return { useCustomCardsStore: () => state };
});
jest.mock('../store/useSavedCardsStore', () => {
  const state = { savedCardIds: [], toggleCard: jest.fn(), isCardSaved: () => false };
  return { useSavedCardsStore: () => state };
});
import { Animated } from 'react-native';
import { CardsDeckRenderer } from '../components/tools/CardsDeckRenderer';
import { CardCategory } from '../models/CardModels';

let screen: any;
const card = (id: string) => screen.root.findByProps({ testID: id });
const faceID = (node: any) => node.findAll((n: any) => n.type === 'View' && n.props.testID?.startsWith('card-face-'))[0].props.testID;
const pose = (node: any) => {
  const s = node.props.style[1];
  return { transform: s.transform.map((t: any) => Object.fromEntries(Object.entries(t).map(([k, v]: any) => [k, v.read()]))), opacity: s.opacity.read() };
};
const press = async (id: string) => act(async () => card(id).props.onPress());
const finish = async () => act(async () => (Animated as any).finish());
beforeEach(async () => { await act(async () => { screen = create(<CardsDeckRenderer categoryId={CardCategory.Act} />); }); });
afterEach(async () => { await act(async () => screen.unmount()); });

test('left then right promotes the exact incoming card without changing its face or geometry', async () => {
  const first = card('front-card');
  const second = card('stack-card-1');
  expect(faceID(first)).toBe('card-face-a');
  await press('card-language-fa');
  const originalText = card('card-english-text');
  const originalTranslation = card('card-translation-text');
  await press('deck-next-button');
  await finish();
  expect(card('front-card')).toBe(second);
  expect(faceID(card('front-card'))).toBe('card-face-b');
  const previous = card('previous-card');
  expect(previous).toBe(first);
  expect(faceID(previous)).toBe('card-face-a');
  const next = card('stack-card-1');
  const nextRest = pose(next);
  // Drag toward Previous before releasing. The following card must recede,
  // not advance into the front and have its text swapped at commit.
  await act(async () => card('front-card').props.onPanResponderMove(null, { dx: 489, dy: 0 }));
  expect(pose(previous).transform).toEqual([{ translateX: 0 }, { translateY: 0 }, { scale: 1 }, { rotate: '0deg' }]);
  expect(pose(previous).opacity).toBe(1);
  expect(pose(next)).not.toEqual(nextRest);
  const beforeCommit = pose(previous);
  const nextAtEnd = pose(next);
  await act(async () => card('front-card').props.onPanResponderRelease(null, { dx: 489, dy: 0 }));
  await finish();
  expect(card('front-card')).toBe(previous);
  expect(faceID(card('front-card'))).toBe('card-face-a');
  expect(pose(card('front-card'))).toEqual(beforeCommit);
  expect(pose(card('stack-card-2'))).toEqual(nextAtEnd);
  expect(card('card-english-text')).toBe(originalText);
  expect(card('card-english-text').props.children).toBe('Prompt a');
  expect(card('card-translation-text')).toBe(originalTranslation);
});

test('cancelled right drags retain the current card, and first-card right drags stay put', async () => {
  const first = card('front-card');
  const initial = pose(first);
  await act(async () => first.props.onPanResponderMove(null, { dx: 100, dy: 0 }));
  expect(pose(first)).toEqual(initial);
  await press('deck-next-button'); await finish();
  const current = card('front-card');
  await act(async () => current.props.onPanResponderMove(null, { dx: 40, dy: 0 }));
  await act(async () => current.props.onPanResponderRelease(null, { dx: 40, dy: 0 }));
  await finish();
  expect(card('front-card')).toBe(current);
  expect(faceID(current)).toBe('card-face-b');
  expect(pose(card('previous-card')).opacity).toBe(0);
});

test('rapid navigation is locked until animation completes, then exhausted decks can go back', async () => {
  await press('deck-next-button');
  await press('deck-next-button');
  await finish();
  expect(faceID(card('front-card'))).toBe('card-face-b');
  await press('deck-next-button'); await finish();
  await press('deck-next-button'); await finish();
  expect(card('cards-empty-deck')).toBeDefined();
  await press('deck-previous-button');
  expect(faceID(card('front-card'))).toBe('card-face-c');
});
