export function redirectSystemPath({
  path,
}: { path: string; initial: boolean }) {
  try {
    if (path.startsWith('/') && !path.startsWith('//')) return path;
    const url = new URL(path);
    if (url.protocol === 'https:' && ['partybot.games', 'www.partybot.games'].includes(url.hostname)) {
      return url.pathname + url.search;
    }
    if (url.protocol === 'partybot:') {
      return `/${url.hostname}${url.pathname}`.replace(/\/{2,}/g, '/') + url.search;
    }
    if (url.protocol === 'invite:') {
      const code = url.searchParams.get('code') || url.hostname || url.pathname.slice(1);
      return `/invite?code=${encodeURIComponent(code)}`;
    }
  } catch {
    // Invalid external links should never prevent the app from opening.
  }
  return '/';
}
