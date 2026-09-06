import React from 'react';
import { act, create } from 'react-test-renderer';
import { ALL_IMPOSTER_WORDS } from '../content/imposterWords';
import { IMPOSTER_LANGUAGES, IMPOSTER_TRANSLATIONS, translateImposterWord } from '../content/imposterTranslations';
import { ImposterWordTranslation } from '../components/games/ImposterWordTranslation';

jest.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (styles: unknown) => styles } }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Rect: 'Rect', Circle: 'Circle', Path: 'Path' }));

test('every bundled Imposter word has all five offline translations', () => {
  expect(Object.keys(IMPOSTER_TRANSLATIONS).sort()).toEqual([...ALL_IMPOSTER_WORDS].sort());
  for (const word of ALL_IMPOSTER_WORDS) {
    expect(IMPOSTER_TRANSLATIONS[word]).toHaveLength(5);
    for (const language of IMPOSTER_LANGUAGES) {
      expect(translateImposterWord(word, language.code)?.trim().length).toBeGreaterThan(0);
    }
  }
});
test('unknown words are explicitly unavailable, never fabricated', () => {
  expect(translateImposterWord('__unknown__', 'fa')).toBeNull();
});
test('Cricket resolves its insect and sport meanings by category', () => {
  expect(translateImposterWord('Cricket', 'fa', 'animals')).toBe('جیرجیرک');
  expect(translateImposterWord('Cricket', 'fa', 'sports')).toBe('کریکت');
  expect(translateImposterWord('Cricket', 'fa')).toBe('جیرجیرک / کریکت');
});
test('language controls reveal the selected meaning and reset for the next player', async () => {
  let screen: any;
  await act(async () => { screen = create(<ImposterWordTranslation key="p1" word="Lightning" />); });
  expect(screen.root.findAllByProps({ testID: 'imposter-translated-word' })).toHaveLength(0);
  for (const language of IMPOSTER_LANGUAGES) {
    await act(async () => screen.root.findByProps({ testID: `imposter-language-${language.code}` }).props.onPress());
    const translated = screen.root.findByProps({ testID: 'imposter-translated-word' });
    expect(translated.props.children).toBe(translateImposterWord('Lightning', language.code));
    expect(translated.props.style[1].writingDirection).toBe(language.code === 'fa' ? 'rtl' : 'ltr');
  }
  await act(async () => screen.update(<ImposterWordTranslation key="p2" word="Lightning" />));
  expect(screen.root.findAllByProps({ testID: 'imposter-translated-word' })).toHaveLength(0);
  await act(async () => screen.unmount());
});
