(async () => {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('Only main may publish');
  const res = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/commits/main`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok || (await res.json()).sha !== process.env.GITHUB_SHA) throw new Error('Revision superseded or could not verify main');
  console.log('Publishing current main revision.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
