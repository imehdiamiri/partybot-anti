import { redirectSystemPath } from '../../app/+native-intent';

test.each([
  ['partybot://onboarding', '/onboarding'],
  ['partybot:///game/memory_grid/setup?mode=singleDevice', '/game/memory_grid/setup?mode=singleDevice'],
  ['https://partybot.games/invite?code=ABC123', '/invite?code=ABC123'],
  ['https://www.partybot.games/invite?code=ABC123', '/invite?code=ABC123'],
  ['invite://ABC123', '/invite?code=ABC123'],
  ['/invite?code=ABC123', '/invite?code=ABC123'],
  ['https://untrusted.example/invite', '/'],
  ['//untrusted.example/path', '/'],
  ['not a URL', '/'],
])('routes native link %s safely', (path, expected) => {
  expect(redirectSystemPath({ path, initial: true })).toBe(expected);
  expect(redirectSystemPath({ path, initial: false })).toBe(expected);
});
