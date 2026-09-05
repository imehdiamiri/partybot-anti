import { ALL_CARDS, ORIGINAL_CARDS, CardCategory, CardSubtype } from '../models/CardModels';
import { EXPANSION_CARDS, CARD_CONTENT_PACKS } from '../content/cardExpansion';
import { ALL_IMPOSTER_WORDS, IMPOSTER_BANKS, IMPOSTER_CATEGORY_LABELS, imposterWords } from '../content/imposterWords';
import { shuffled } from '../utils/shuffle';
import { ImposterWordPicker, IMPOSTER_HISTORY_KEY, selectImposterWord } from '../utils/imposterWordPicker';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
test('adds 1,200 original cards and at least doubles every playable category', () => {
  expect(EXPANSION_CARDS).toHaveLength(1200);
  const counts: Record<string, { before: number; after: number }> = {};
  for (const category of Object.values(CardCategory).filter(c => c !== CardCategory.Favorites)) {
    const before = ORIGINAL_CARDS.filter(c => c.category === category).length;
    const after = ALL_CARDS.filter(c => c.category === category).length;
    expect(after).toBeGreaterThanOrEqual(before * 2);
    counts[category] = { before, after };
  }
  console.info('Card counts', counts);
  expect(ALL_CARDS).toHaveLength(2216);
});

test('new cards have stable unique IDs, valid filters, no duplicate text or spicy content', () => {
  expect(new Set(ALL_CARDS.map(c => c.id)).size).toBe(ALL_CARDS.length);
  expect(new Set(CARD_CONTENT_PACKS.map(p => p.id)).size).toBe(CARD_CONTENT_PACKS.length);
  const seen = new Set(ORIGINAL_CARDS.map(c => normalize(c.text)));
  const repeated: string[] = [];
  for (const c of EXPANSION_CARDS) {
    if (seen.has(normalize(c.text))) repeated.push(c.text);
    seen.add(normalize(c.text));
    expect(Object.values(CardCategory)).toContain(c.category);
    expect(Object.values(CardSubtype)).toContain(c.subtype);
    expect(c.isSpicy).toBe(false);
    expect(c.text.length).toBeGreaterThan(20);
    expect(c.text.length).toBeLessThanOrEqual(160);
  }
  expect(repeated).toEqual([]);
  // Existing saved-card IDs survive the expansion unchanged.
  expect(ALL_CARDS.slice(0, ORIGINAL_CARDS.length)).toEqual(ORIGINAL_CARDS);
});

test('all topics uses the entire unique offline bank, including every original default word', () => {
  expect(ALL_IMPOSTER_WORDS.length).toBeGreaterThan(1000);
  for (const bank of Object.values(IMPOSTER_BANKS)) {
    expect(bank.length).toBeGreaterThanOrEqual(90);
    expect(new Set(bank.map(normalize)).size).toBe(bank.length);
    expect(bank.every(word => word.trim() === word && word.length <= 42)).toBe(true);
  }
  expect(imposterWords('random')).toEqual(ALL_IMPOSTER_WORDS);
  expect(imposterWords('old-missing-category')).toEqual(ALL_IMPOSTER_WORDS);
  expect(Object.keys(IMPOSTER_CATEGORY_LABELS).length).toBe(12);
  for (const w of ['Umbrella', 'Telescope', 'Volcano', 'Diamond', 'Castle', 'Pirate', 'Rainbow', 'Robot', 'Dragon', 'Treasure', 'Compass', 'Candle', 'Bridge', 'Clock', 'Mirror']) expect(ALL_IMPOSTER_WORDS).toContain(w);
  console.info('Imposter word count', ALL_IMPOSTER_WORDS.length);
});

function memoryStorage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: jest.fn(async (_key: string) => value),
    setItem: jest.fn(async (_key: string, next: string) => { value = next; }),
  };
}

test('a full topic cycle has no repeats, survives app restart, and avoids the boundary repeat', async () => {
  const storage = memoryStorage();
  const picker = new ImposterWordPicker(storage, () => .5);
  const words = imposterWords('movies');
  const first = await Promise.all(words.slice(0, 25).map(() => picker.draw('movies')));
  const restarted = new ImposterWordPicker(storage, () => .5);
  const rest = await Promise.all(words.slice(25).map(() => restarted.draw('movies')));
  expect(new Set([...first, ...rest]).size).toBe(words.length);
  expect(await restarted.draw('movies')).not.toBe(rest[rest.length - 1]);
  expect(storage.getItem).toHaveBeenCalledWith(IMPOSTER_HISTORY_KEY);
});

test('switching topics does not reset globally used words; random covers every topic', async () => {
  const storage = memoryStorage();
  const picker = new ImposterWordPicker(storage, () => 0);
  const animal = await picker.draw('animals');
  const firstAll = await picker.draw('random');
  expect(firstAll).not.toBe(animal);
  const all = [animal, firstAll];
  for (let i = 2; i < ALL_IMPOSTER_WORDS.length; i++) all.push(await picker.draw('random'));
  expect(new Set(all)).toEqual(new Set(ALL_IMPOSTER_WORDS));
});

test('choice is random within unused candidates and resets only after exhaustion', () => {
  const pool = ['A', 'B', 'C'];
  const history = { counts: {}, last: '' };
  expect(selectImposterWord(pool, history, () => 0)).toBe('A');
  expect(selectImposterWord(pool, history, () => .5)).toBe('B');
  expect(selectImposterWord(pool, history, () => .999)).toBe('C');
  expect(selectImposterWord(pool, { counts: { A: 1, B: 1 }, last: 'B' }, () => 0)).toBe('C');
  expect(selectImposterWord(pool, { counts: { A: 1, B: 1, C: 1 }, last: 'A' }, () => 0)).toBe('B');
});

test('corrupt or blocked storage cannot prevent offline rounds or poison the queue', async () => {
  for (const raw of ['not json', '{"version":1,"counts":{"Dog":-1,"Cat":"oops"},"last":5}', 'null']) {
    expect(ALL_IMPOSTER_WORDS).toContain(await new ImposterWordPicker(memoryStorage(raw)).draw());
  }
  const unavailable = {
    getItem: jest.fn(async () => { throw new Error('unavailable'); }),
    setItem: jest.fn(async () => { throw new Error('full'); }),
  };
  const picker = new ImposterWordPicker(unavailable, () => 0);
  expect(await picker.draw()).not.toBe(await picker.draw());
});

test('Fisher-Yates preserves input and all cards, including tiny decks', () => {
  const input = ['a', 'b', 'c', 'd'];
  expect(shuffled(input, () => 0)).toEqual(['b', 'c', 'd', 'a']);
  expect(input).toEqual(['a', 'b', 'c', 'd']);
  expect(shuffled([])).toEqual([]);
  expect(shuffled(['x'])).toEqual(['x']);
});

