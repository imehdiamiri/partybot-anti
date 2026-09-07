import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import translations from '@/src/content/cardTranslations.json';

export const CARD_LANGUAGES = [
  { code: 'fa', label: 'فارسی', rtl: true },
  { code: 'tr', label: 'Türkçe', rtl: false },
  { code: 'de', label: 'Deutsch', rtl: false },
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
] as const;
export type CardLanguage = typeof CARD_LANGUAGES[number]['code'];
const bank = translations as Record<string, Record<CardLanguage, string>>;
export function translatedCard(cardId: string, language: CardLanguage): string | undefined {
  return bank[cardId]?.[language];
}

export function CardLanguageButtons({ selected, onSelect }: { selected: CardLanguage | null; onSelect: (language: CardLanguage | null) => void }) {
  return <View style={styles.languages}>
    {CARD_LANGUAGES.map(language => <Pressable key={language.code}
      testID={`card-language-${language.code}`} accessibilityRole="radio"
      accessibilityLabel={`Translate to ${language.label}`} accessibilityState={{ checked: selected === language.code }}
      onPress={() => onSelect(selected === language.code ? null : language.code)}
      style={[styles.language, selected === language.code && styles.selected]}>
      <Text style={[styles.label, selected === language.code && styles.selectedLabel]}>{language.label}</Text>
    </Pressable>)}
  </View>;
}
export function CardTranslationText({ cardId, language }: { cardId: string; language: CardLanguage | null }) {
  if (!language) return null;
  const text = translatedCard(cardId, language);
  const rtl = CARD_LANGUAGES.find(l => l.code === language)?.rtl;
  return <View style={styles.translation}>
    {text && <Text style={styles.note}>Translation · preview</Text>}
    <Text testID="card-translation-text" accessibilityLiveRegion="polite"
      style={[styles.text, { writingDirection: rtl ? 'rtl' : 'ltr' }]}>
      {text || 'Offline translations are available for built-in cards only.'}
    </Text>
  </View>;
}
const styles = StyleSheet.create({
  languages: { zIndex: 3, flexDirection: 'row', paddingHorizontal: 8, gap: 3, paddingBottom: 8 },
  language: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#ECEEF2', paddingHorizontal: 2 },
  selected: { backgroundColor: '#1C293D' },
  label: { color: '#354052', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  selectedLabel: { color: 'white' },
  translation: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderColor: '#D5DAE2', width: '100%' },
  text: { color: '#334155', fontSize: 18, lineHeight: 28, textAlign: 'center' },
  note: { color: '#667085', fontSize: 11, textAlign: 'center', marginBottom: 8 },
});
