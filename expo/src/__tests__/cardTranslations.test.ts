import { ALL_CARDS } from '../models/CardModels';
import translations from '../content/cardTranslations.json';
import corrections from '../content/cardTranslationCorrections.json';

const bank = translations as Record<string, Record<string, string>>;
const languages = ['ar', 'de', 'fa', 'fr', 'tr'];
test('every built-in card has exactly five non-empty offline translations', () => {
  expect(Object.keys(bank).sort()).toEqual(ALL_CARDS.map(c => c.id).sort());
  expect(ALL_CARDS).toHaveLength(2888);
  for (const card of ALL_CARDS) {
    expect(Object.keys(bank[card.id]).sort()).toEqual(languages);
    for (const lang of languages) {
      const value = bank[card.id][lang];
      expect(value.trim().length).toBeGreaterThan(1);
      expect(value).not.toMatch(/__\w+__|<\/s>|undefined|NaN/);
      if (lang === 'fa' || lang === 'ar') expect(value).toMatch(/[\u0600-\u06FF]/);
    }
  }
});
test('reviewed discussion questions are present in each translated scenario', () => {
  const question = 'In this specific situation, what compromise could respect both sides?';
  for (const lang of languages) {
    expect(bank['relationships-20260907-1-1'][lang]).toContain(corrections[question][lang as keyof typeof corrections[typeof question]]);
  }
});
