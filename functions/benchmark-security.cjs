// Adversarial payload probes, isolated emulator only. Acceptance is a finding.
const fs = require('node:fs');
const { initializeTestEnvironment } = require('@firebase/rules-unit-testing');
if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== '127.0.0.1:9014') throw new Error('Local emulator required');
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-partybot-payload-probe', database: {
    host: '127.0.0.1', port: 9014, rules: fs.readFileSync('database.rules.json', 'utf8'),
  }});
  try {
    const db = env.authenticatedContext('probe-host').database();
    await db.ref('rooms/800000').set({ hostId: 'probe-host', status: 'waiting', players: { 'probe-host': { id: 'probe-host', displayName: 'Probe' } } });
    const results = [];
    for (const [name, value] of [
      ['turnData accepts 201 children despite documented 200 cap', Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, 1]))],
      ['turnData nested string bypasses direct 4096 character cap', { nested: { text: 'a'.repeat(17000) } }],
    ]) {
      let accepted = false;
      try { await db.ref('rooms/800000/gameState/turnData').set(value); accepted = true; }
      catch (e) { if (e.code !== 'PERMISSION_DENIED') throw e; }
      results.push({ name, accepted });
    }
    fs.writeFileSync('.security/benchmark-security.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results));
  } finally { await env.cleanup(); }
})().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
