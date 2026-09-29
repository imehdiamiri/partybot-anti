/* Bounded, emulator-only multiplayer workload. Never accepts a production host. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { performance } = require('node:perf_hooks');
const { initializeTestEnvironment, assertFails } = require('@firebase/rules-unit-testing');
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (host !== '127.0.0.1:9014') throw new Error('Requires isolated emulator at 127.0.0.1:9014');
const output = path.resolve(__dirname, '../.security/benchmark-results.json');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const summary = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const q = p => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)].toFixed(2) : null;
  return { count: sorted.length, p50Ms: q(.5), p95Ms: q(.95), p99Ms: q(.99), maxMs: q(1) };
};
async function scenario(count) {
  const env = await initializeTestEnvironment({ projectId: 'demo-partybot-benchmark', database: {
    host: '127.0.0.1', port: 9014, rules: fs.readFileSync(path.resolve(__dirname, '../database.rules.json'), 'utf8'),
  }});
  const latency = {}, errors = [], clients = [], listeners = [], delivered = new Map();
  let snapshots = 0, snapshotBytes = 0, peakRss = process.memoryUsage().rss;
  const sample = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 250);
  const measure = async (kind, fn) => {
    const start = performance.now();
    try { const result = await fn(); (latency[kind] ||= []).push(performance.now() - start); return result; }
    catch (e) { errors.push({ kind, code: e.code || e.message }); throw e; }
  };
  const watch = (ref, cb) => { ref.on('value', cb, e => errors.push({ kind: 'listener', code: e.code })); listeners.push(() => ref.off('value', cb)); };
  try {
    await env.clearDatabase();
    const setupStart = performance.now();
    for (let i = 0; i < count; i++) {
      clients.push({ uid: `bench-${i}`, room: String(700000 + Math.floor(i / 4)), db: env.authenticatedContext(`bench-${i}`).database() });
    }
    const hosts = clients.filter((_, i) => i % 4 === 0);
    // Ramp connections in bounded batches; all remain connected through the steady workload.
    for (let offset = 0; offset < hosts.length; offset += 25) {
      await Promise.all(hosts.slice(offset, offset + 25).map(c => measure('createRoom', () => c.db.ref(`rooms/${c.room}`).set({
        roomCode: c.room, hostId: c.uid, gameId: 'reaction', status: 'waiting', createdAt: Date.now(),
        players: { [c.uid]: { id: c.uid, displayName: c.uid } },
      }))));
    }
    const guests = clients.filter((_, i) => i % 4 !== 0);
    for (let offset = 0; offset < guests.length; offset += 50) {
      await Promise.all(guests.slice(offset, offset + 50).map(c => measure('joinRoom', async () => {
        await c.db.ref(`rooms/${c.room}/players/${c.uid}`).set({ id: c.uid, displayName: c.uid });
        await c.db.ref(`rooms/${c.room}`).once('value');
      })));
    }
    for (const c of clients) {
      watch(c.db.ref(`rooms/${c.room}`), s => { snapshots++; snapshotBytes += Buffer.byteLength(JSON.stringify(s.val())); });
      watch(c.db.ref(`rooms/${c.room}/gameState`), s => { if (s.exists()) delivered.set(c.uid, s.val().version); });
      watch(c.db.ref(`rooms/${c.room}/presence`), () => {});
    }
    // Actual connection acknowledgements, not merely 1,000 allocated JS objects.
    await Promise.all(clients.map(c => new Promise((resolve, reject) => {
      const r = c.db.ref('.info/connected');
      const timeout = setTimeout(() => { r.off('value', cb); reject(new Error('connection timeout')); }, 30000);
      const cb = s => { if (s.val() === true) { clearTimeout(timeout); r.off('value', cb); resolve(); } };
      r.on('value', cb);
    })));
    const setupMs = performance.now() - setupStart;
    const security = [];
    for (const [name, attempt] of [
      ['anonymous room read', () => env.unauthenticatedContext().database().ref('rooms/700000').once('value')],
      ['outsider room read', () => env.authenticatedContext('outsider').database().ref('rooms/700000').once('value')],
      ['guest state overwrite', () => clients[1].db.ref('rooms/700000/gameState').set({ version: 900 })],
      ['wallet forgery', () => clients[0].db.ref('users/bench-0/wallet').set({ balance: 999999 })],
      ['foreign action', () => clients[1].db.ref('rooms/700000/actions/forged').set({ playerId: 'bench-0', type: 'tap', ts: Date.now() })],
    ]) { await assertFails(attempt()); security.push({ name, denied: true }); }
    const start = performance.now();
    const baselineOps = Object.values(latency).reduce((n, a) => n + a.length, 0);
    const waveLatenessMs = [];
    for (let wave = 0; wave < 6; wave++) {
      const target = start + wave * 5000;
      await sleep(Math.max(0, target - performance.now()));
      waveLatenessMs.push(performance.now() - target);
      await Promise.all(clients.map(c => measure('heartbeat', () => c.db.ref(`rooms/${c.room}/presence/${c.uid}`).set({ online: true, lastSeen: Date.now() }))));
      if (wave % 2 === 0) {
        await Promise.all(guests.map(c => measure('action', () => c.db.ref(`rooms/${c.room}/actions/${c.uid}-${wave}`).set({ playerId: c.uid, type: 'tap', data: { elapsed: 321 }, ts: Date.now() }))));
        await Promise.all(hosts.map(c => measure('drainActions', async () => {
          const snap = await c.db.ref(`rooms/${c.room}/actions`).once('value');
          if (snap.numChildren() !== 3) throw new Error(`Expected 3 actions, got ${snap.numChildren()}`);
          const keys = [];
          snap.forEach(s => { keys.push(s.key); });
          // Match GameSyncService's separate watermark and acknowledgement writes.
          for (const key of keys) {
            await c.db.ref(`rooms/${c.room}/processedActions/${key}`).set(Date.now());
            await c.db.ref(`rooms/${c.room}/actions/${key}`).remove();
          }
        })));
      }
      await Promise.all(hosts.map(c => measure('stateBroadcast', () => c.db.ref(`rooms/${c.room}/gameState`).set({
        version: wave + 1, phase: 'playing', lastUpdatedAt: Date.now(), turnData: JSON.stringify({ round: wave, sample: 'x'.repeat(1024) }),
      }))));
      const deadline = performance.now() + 10000;
      while (clients.some(c => delivered.get(c.uid) !== wave + 1) && performance.now() < deadline) await sleep(10);
      if (clients.some(c => delivered.get(c.uid) !== wave + 1)) throw new Error('State delivery incomplete');
    }
    await sleep(Math.max(0, start + 30000 - performance.now()));
    const durationMs = performance.now() - start;
    const operations = Object.values(latency).reduce((n, a) => n + a.length, 0) - baselineOps;
    return { users: count, rooms: hosts.length, connectedClientsVerified: count, setupMs: +setupMs.toFixed(1),
      durationMs: +durationMs.toFixed(1), operations, operationsPerSecond: +(operations / durationMs * 1000).toFixed(2),
      latency: Object.fromEntries(Object.entries(latency).map(([k, v]) => [k, summary(v)])),
      waveLateness: summary(waveLatenessMs), errors, security, finalVersionRecipients: delivered.size,
      snapshots, applicationSnapshotBytes: snapshotBytes, loadGeneratorPeakRssMB: +(peakRss / 1024 / 1024).toFixed(1),
    };
  } finally {
    clearInterval(sample);
    listeners.forEach(off => off());
    await env.cleanup();
  }
}
async function main() {
  const report = { at: new Date().toISOString(), environment: 'local RTDB emulator; not production capacity certification',
    status: 'running', machine: { platform: process.platform, node: process.version, cpu: os.cpus()[0].model, cores: os.cpus().length, totalMemoryGB: +(os.totalmem() / 1024 ** 3).toFixed(1) }, scenarios: [] };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  try {
    for (const count of [100, 1000]) {
      console.log(`Starting ${count} authenticated concurrent clients`);
      report.scenarios.push(await scenario(count));
      fs.writeFileSync(output, JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report.scenarios.at(-1)));
    }
    report.status = 'completed';
  } catch (e) {
    report.status = 'failed';
    report.failure = e.code || e.message;
    throw e;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
  }
}
const watchdog = setTimeout(() => { console.error('Benchmark exceeded 10 minute deadline'); process.exit(1); }, 600000);
main().then(() => { clearTimeout(watchdog); process.exit(0); }, e => { console.error(e); process.exit(1); });
