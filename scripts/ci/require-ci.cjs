(async () => {
  const url = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/workflows/ci.yml/runs?head_sha=${process.env.GITHUB_SHA}&per_page=30`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.GH_TOKEN}` }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Unable to verify CI');
  const runs = (await response.json()).workflow_runs;
  if (!runs.some(r => r.head_sha === process.env.GITHUB_SHA && r.head_branch === 'main' && r.conclusion === 'success')) throw new Error('Run PartyBot CI successfully on this exact main commit before publishing');
  console.log('Exact commit already passed CI; tests are not rerun.');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
