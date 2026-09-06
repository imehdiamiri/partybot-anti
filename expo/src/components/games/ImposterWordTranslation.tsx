import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { IMPOSTER_LANGUAGES, ImposterLanguage, translateImposterWord } from '@/src/content/imposterTranslations';

// Code-native flags remain crisp on web/native and do not depend on emoji fonts.
function LanguageFlag({ language }: { language: ImposterLanguage }) {
  return <Svg width={30} height={20} viewBox="0 0 30 20" accessible={false}>
    {language === 'fa' && <><Rect width={30} height={20} fill="#fff" /><Rect width={30} height={6.67} fill="#239F40" /><Rect y={13.33} width={30} height={6.67} fill="#DA0000" /><Path d="M15 8v4m-2-4c-2 3 0 5 2 4 2 1 4-1 2-4" fill="none" stroke="#DA0000" strokeWidth={0.8} /></>}
    {language === 'tr' && <><Rect width={30} height={20} fill="#E30A17" /><Circle cx={12} cy={10} r={5} fill="#fff" /><Circle cx={13.5} cy={9} r={4} fill="#E30A17" /><Path d="M19 6.5l1 2.5 2.6.2-2 1.7.6 2.6-2.2-1.4-2.2 1.4.6-2.6-2-1.7 2.6-.2z" fill="#fff" /></>}
    {language === 'es' && <><Rect width={30} height={20} fill="#AA151B" /><Rect y={5} width={30} height={10} fill="#F1BF00" /><Rect x={8} y={8} width={3} height={5} rx={1} fill="#AA151B" /></>}
    {language === 'de' && <><Rect width={30} height={20} fill="#FFCE00" /><Rect width={30} height={6.67} fill="#111" /><Rect y={6.67} width={30} height={6.67} fill="#DD0000" /></>}
    {language === 'fr' && <><Rect width={30} height={20} fill="#fff" /><Rect width={10} height={20} fill="#002395" /><Rect x={20} width={10} height={20} fill="#ED2939" /></>}
  </Svg>;
}

/** Mount only for non-imposters after their role has been revealed. */
export function ImposterWordTranslation({ word, category = 'random' }: { word: string; category?: string }) {
  const [language, setLanguage] = useState<ImposterLanguage | null>(null);
  const translation = language ? translateImposterWord(word, language, category) : null;
  return <View style={s.container} testID="imposter-word-translation">
    <Text style={s.hint}>Need a translation? Tap your language.</Text>
    <View style={s.languages}>
      {IMPOSTER_LANGUAGES.map(item => <Pressable key={item.code}
        testID={`imposter-language-${item.code}`} accessibilityRole="button"
        accessibilityLabel={`Translate word to ${item.english}`} accessibilityState={{ selected: language === item.code }}
        onPress={() => setLanguage(item.code)}
        style={({ pressed }) => [s.language, language === item.code && s.selected, pressed && { opacity: 0.75 }]}>
        <LanguageFlag language={item.code} /><Text style={s.languageName}>{item.name}</Text>
      </Pressable>)}
    </View>
    {language && <View style={s.translation} accessibilityLiveRegion="polite">
      <Text testID="imposter-translated-word" style={[s.word, { writingDirection: language === 'fa' ? 'rtl' : 'ltr' }]}>
        {translation ?? 'Translation unavailable'}
      </Text>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', marginBottom: 20, gap: 12 },
  hint: { color: '#C3CDD9', textAlign: 'center', fontSize: 14 },
  languages: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8 },
  language: { minWidth: 76, minHeight: 66, borderRadius: 12, borderWidth: 1, borderColor: '#384250', backgroundColor: '#1C2330', padding: 10, alignItems: 'center', justifyContent: 'center', gap: 6 },
  selected: { borderColor: '#68E8A8', backgroundColor: '#163329' },
  languageName: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  translation: { backgroundColor: '#153026', borderRadius: 14, padding: 16 },
  word: { color: '#8AF0B7', fontSize: 26, fontWeight: '600', textAlign: 'center' },
});
