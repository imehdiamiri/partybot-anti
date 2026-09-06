import { IMPOSTER_TRANSLATIONS_LIFE } from './imposterTranslationsLife';
import { IMPOSTER_TRANSLATIONS_WORLD } from './imposterTranslationsWorld';
import { IMPOSTER_TRANSLATIONS_CULTURE } from './imposterTranslationsCulture';
import { IMPOSTER_TRANSLATIONS_NATURE } from './imposterTranslationsNature';

export const IMPOSTER_LANGUAGES = [
  { code: 'fa', name: 'فارسی', english: 'Persian', direction: 'rtl' },
  { code: 'tr', name: 'Türkçe', english: 'Turkish', direction: 'ltr' },
  { code: 'es', name: 'Español', english: 'Spanish', direction: 'ltr' },
  { code: 'de', name: 'Deutsch', english: 'German', direction: 'ltr' },
  { code: 'fr', name: 'Français', english: 'French', direction: 'ltr' },
] as const;
export type ImposterLanguage = typeof IMPOSTER_LANGUAGES[number]['code'];

// Exact English words remain the stable IDs used by the existing shuffle/history.
export const IMPOSTER_TRANSLATIONS: Record<string, [string, string, string, string, string]> = {
  ...IMPOSTER_TRANSLATIONS_LIFE, ...IMPOSTER_TRANSLATIONS_WORLD,
  ...IMPOSTER_TRANSLATIONS_CULTURE, ...IMPOSTER_TRANSLATIONS_NATURE,
};
export function translateImposterWord(word: string, language: ImposterLanguage, category = 'random'): string | null {
  const index = IMPOSTER_LANGUAGES.findIndex(item => item.code === language);
  // Cricket is present as both an insect and a sport in the existing banks.
  if (word === 'Cricket') {
    const insect = IMPOSTER_TRANSLATIONS_LIFE[word]?.[index];
    const sport = IMPOSTER_TRANSLATIONS_NATURE[word]?.[index];
    if (category === 'animals') return insect ?? null;
    if (category === 'sports') return sport ?? null;
    return insect && sport ? `${insect} / ${sport}` : null;
  }
  return IMPOSTER_TRANSLATIONS[word]?.[index] ?? null;
}
