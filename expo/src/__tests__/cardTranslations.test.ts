import { ALL_CARDS } from '../models/CardModels';
import translations from '../content/cardTranslations.json';
import corrections from '../content/cardTranslationCorrections.json';
import { RELATIONSHIP_PERSIAN } from '../content/relationshipPersian';

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

test('every Persian card uses its AI-reviewed English source unit', () => {
  const reviewed = corrections as Record<string, Record<string, string>>;
  for (const card of ALL_CARDS) {
    if (card.id.startsWith('relationships-')) {
      const [, , scenario] = card.id.split('-');
      const question = card.text.slice(card.text.indexOf('. ') + 2);
      expect(bank[card.id].fa).toBe(`${RELATIONSHIP_PERSIAN[Number(scenario) - 1]} ${reviewed[question].fa}`);
    } else {
      expect(reviewed[card.text]?.fa).toBeTruthy();
      expect(bank[card.id].fa).toBe(reviewed[card.text].fa);
    }
  }
});

test('Persian preserves the actor, action and comparative question', () => {
  expect(bank['act-12'].fa).toContain('پدربزرگ');
  expect(bank['act-22'].fa).toContain('پَر');
  expect(bank['talk-250'].fa).toBe('آیا پول از خوشبختی مهم‌تر است؟');
  expect(bank['talk-312'].fa).toContain('دیگران را');
  expect(bank['mlt-adv-2'].fa).toContain('کوسه');
  expect(bank['couple-653'].fa).toContain('آهنگِ مخصوص رابطه');
});
test('reviewed discussion questions are present in each translated scenario', () => {
  const question = 'In this specific situation, what compromise could respect both sides?';
  for (const lang of languages) {
    expect(bank['relationships-20260907-1-1'][lang]).toContain(corrections[question][lang as keyof typeof corrections[typeof question]]);
  }
});
