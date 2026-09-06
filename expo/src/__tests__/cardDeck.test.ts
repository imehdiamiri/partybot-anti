import { CardDeckPicker, shuffleCardDeck } from '../utils/cardDeck';

const cards = ['a', 'b', 'c'].map(id => ({ id }));
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) || null,
    setItem: async (key: string, value: string) => { values.set(key, value); },
  };
}

test('shuffle preserves all cards and excludes the previous opener', () => {
  for (const previous of cards) {
    const result = shuffleCardDeck(cards, previous.id, () => 0);
    expect(result[0].id).not.toBe(previous.id);
    expect(new Set(result)).toEqual(new Set(cards));
  }
  expect(cards.map(c => c.id)).toEqual(['a', 'b', 'c']);
  expect(shuffleCardDeck([], 'a')).toEqual([]);
  expect(shuffleCardDeck([cards[0]], 'a')).toEqual([cards[0]]);
});

test('openers do not repeat across navigation or app restart', async () => {
  const disk = storage();
  const picker = new CardDeckPicker(disk, () => 0);
  const first = await picker.open('talk:all', cards);
  const second = await picker.open('talk:all', cards);
  const third = await new CardDeckPicker(disk, () => 0).open('talk:all', cards);
  expect(second[0].id).not.toBe(first[0].id);
  expect(third[0].id).not.toBe(second[0].id);
});

test('rapid requests serialize and manual shuffle avoids the visible card', async () => {
  const picker = new CardDeckPicker(storage(), () => 0);
  const [first, second] = await Promise.all([picker.open('talk', cards), picker.open('talk', cards)]);
  expect(first[0].id).not.toBe(second[0].id);
  expect((await picker.open('talk', cards, 'b'))[0].id).not.toBe('b');
});

test('blocked persistence still retains session history', async () => {
  const picker = new CardDeckPicker({
    getItem: async () => { throw new Error('blocked'); },
    setItem: async () => { throw new Error('full'); },
  }, () => 0);
  const first = await picker.open('talk', cards);
  const second = await picker.open('talk', cards);
  expect(first[0].id).not.toBe(second[0].id);
});
