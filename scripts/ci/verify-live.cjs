const fs = require('node:fs');
(async () => {
  const expected = JSON.parse(fs.readFileSync('website/public/ci-release.json', 'utf8'));
  const res = await fetch(`https://partybot.games/ci-release.json?revision=${expected.commit}`, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Release receipt HTTP ${res.status}`);
  const actual = await res.json();
  if (actual.commit !== expected.commit || actual.sha256 !== expected.sha256) throw new Error('Live release does not match tested artifact');
  const home = await fetch('https://partybot.games/', { signal: AbortSignal.timeout(20000) });
  if (!home.ok || !(await home.text()).includes(expected.entry)) throw new Error('Live HTML does not reference expected entry');
  const summary = `Web published and verified: https://partybot.games\nSource: ${expected.commit}\nEntry: ${expected.entry}\n`;
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  console.log(summary);
})().catch(e => { console.error(e.message); process.exitCode = 1; });
