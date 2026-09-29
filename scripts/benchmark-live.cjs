// Finite read-only Hosting probe: 22 requests, <= 2 in flight, no app mutations.
const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const origin = 'https://partybot.games';
const results = [];
async function probe(route) {
  const start = performance.now();
  try {
    const res = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(20000), redirect: 'error' });
    const ttfbMs = performance.now() - start;
    const body = await res.text();
    results.push({ route, status: res.status, ttfbMs: +ttfbMs.toFixed(1), totalMs: +(performance.now() - start).toFixed(1),
      decodedBytes: Buffer.byteLength(body), headers: Object.fromEntries(['cache-control', 'content-encoding', 'content-length', 'strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options'].map(k => [k, res.headers.get(k)])) });
    return body;
  } catch (e) { results.push({ route, error: e.message }); return ''; }
}
(async () => {
  const html = await probe('/');
  const entry = html.match(/src="([^"\s]*entry-[^"\s]+\.js)"/);
  if (entry) await probe(entry[1]);
  for (let i = 0; i < 10; i++) {
    await Promise.all([probe('/'), probe('/privacy')]);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  fs.mkdirSync('.security', { recursive: true });
  fs.writeFileSync('.security/benchmark-live.json', JSON.stringify({ at: new Date().toISOString(), origin, results }, null, 2));
  console.log(JSON.stringify(results));
  if (results.some(r => r.error || r.status !== 200)) process.exitCode = 1;
})();
