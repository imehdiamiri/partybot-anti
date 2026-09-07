import { navigateCardIndex } from '../utils/cardDeck';
import fs from 'fs';
import path from 'path';
import { ALL_CARDS } from '../models/CardModels';
import { RELATIONSHIP_DISCUSSION_CARDS, RELATIONSHIP_SITUATIONS } from '../content/cardsRelationshipDiscussion';

test('next followed by previous returns to the same card, not a reshuffle', () => {
  expect(navigateCardIndex(navigateCardIndex(7, 20, 'left'), 20, 'right')).toBe(7);
});
test('decorative watermark cannot intercept language buttons', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/tools/CardsDeckRenderer.tsx'), 'utf8');
  expect(source).toContain('<View pointerEvents="none" style={styles.watermark}>');
});
test('first, last, exhausted and empty decks stay within bounds', () => {
  expect(navigateCardIndex(0, 20, 'right')).toBe(0);
  expect(navigateCardIndex(19, 20, 'left')).toBe(20);
  expect(navigateCardIndex(20, 20, 'right')).toBe(19);
  expect(navigateCardIndex(20, 20, 'left')).toBe(20);
  expect(navigateCardIndex(0, 0, 'right')).toBe(0);
});
test('672 relationship discussions bring the built-in catalog to exactly 2888', () => {
  expect(RELATIONSHIP_SITUATIONS).toHaveLength(112);
  expect(RELATIONSHIP_DISCUSSION_CARDS).toHaveLength(672);
  expect(ALL_CARDS).toHaveLength(2888);
  expect(ALL_CARDS.filter(c => c.category === 'talk')).toHaveLength(1609);
  const normalized = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
  const previous = new Set(ALL_CARDS.slice(0,2216).map(c => normalized(c.text)));
  for (const c of RELATIONSHIP_DISCUSSION_CARDS) {
    expect(c.subtype).toBe('discussion');
    expect(c.category).toBe('talk');
    expect(c.text.length).toBeLessThan(260);
    expect(previous.has(normalized(c.text))).toBe(false);
    previous.add(normalized(c.text));
  }
});
