import { newGameFriends, friendNameKey } from '../utils/friendNames';

test('remembers only new real names, excluding self and placeholders', () => {
  expect(newGameFriends(['Mehdi', ' Ali ', 'Player 2', '', '   ', 'Sara'], ['ali'], 'mehdi')).toEqual(['Sara']);
});
test('deduplicates whitespace, case, Unicode and Persian keyboard variations', () => {
  expect(newGameFriends(['  Mary   Jane ', 'mary jane', 'علي', 'علی', 'Ａｌｉ', 'Ali'], [])).toEqual(['Mary Jane', 'علي', 'Ali']);
  expect(friendNameKey('كیوان')).toBe(friendNameKey('کیوان'));
});
test('restarting the game is idempotent and does not cap at twelve friends', () => {
  const names = Array.from({ length: 30 }, (_, i) => `Friend ${i}`);
  expect(newGameFriends(names, [])).toEqual(names);
  expect(newGameFriends(names, names)).toEqual([]);
});
