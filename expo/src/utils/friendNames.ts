export const cleanFriendName = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ');
export const friendNameKey = (name: string) => cleanFriendName(name).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک');

/** Only real, active names from a successfully started local game. */
export function newGameFriends(names: readonly string[], existing: readonly string[], self = ''): string[] {
  const seen = new Set([...existing, self].map(friendNameKey));
  const result: string[] = [];
  for (const raw of names) {
    const name = cleanFriendName(raw);
    const key = friendNameKey(name);
    if (!key || /^player\s*\d+$/i.test(name) || seen.has(key)) continue;
    seen.add(key);
    result.push(name);
  }
  return result;
}
