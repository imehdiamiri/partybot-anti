const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

// Run with the Firestore emulator; ordinary RTDB-only runs explicitly skip it.
const describeFirestore = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;
describeFirestore('Firestore private profile security', () => {
  let env;
  beforeAll(async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    env = await initializeTestEnvironment({
      projectId: 'demo-partybot-security',
      firestore: { host, port: Number(port), rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8') },
    });
  });
  afterEach(async () => { await env.clearFirestore(); });
  afterAll(async () => { await env.cleanup(); });

  test('only the owner may read a private profile or history', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.firestore();
      await db.doc('users/owner').set({ username: 'Owner', email: 'private@example.test' });
      await db.doc('users/owner/history/event').set({ game: 'test' });
    });
    const owner = env.authenticatedContext('owner').firestore();
    const outsider = env.authenticatedContext('outsider').firestore();
    await assertSucceeds(owner.doc('users/owner').get());
    await assertFails(outsider.doc('users/owner').get());
    await assertFails(outsider.doc('users/owner/history/event').get());
    await assertFails(env.unauthenticatedContext().firestore().doc('users/owner').get());
  });

  test('profile merges cannot delete, forge or modify server fields', async () => {
    await env.withSecurityRulesDisabled(async ctx => {
      await ctx.firestore().doc('users/owner').set({ username: 'Owner', wallet: { balance: 50 }, isAdmin: true });
    });
    const ref = env.authenticatedContext('owner').firestore().doc('users/owner');
    await assertSucceeds(ref.set({ username: 'Renamed' }, { merge: true }));
    await assertFails(ref.set({ username: 'Reset' }));
    await assertFails(ref.update({ isAdmin: false }));
    await assertFails(ref.update({ wallet: { balance: 999 } }));
    await assertFails(ref.delete());
    await assertFails(env.authenticatedContext('new').firestore().doc('users/new').set({ username: 'New', isAdmin: true }));
  });
});
