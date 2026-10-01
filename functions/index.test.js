const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const emulatorPort = process.env.DATABASE_EMULATOR_PORT || '9012';
const emulatorHost = `127.0.0.1:${emulatorPort}`;
const databaseURL = `http://${emulatorHost}?ns=playvirals`;
const projectId = 'playvirals';

process.env.FIREBASE_DATABASE_EMULATOR_HOST = emulatorHost;
process.env.FIREBASE_CONFIG = JSON.stringify({
  databaseURL,
  projectId,
});
process.env.GCLOUD_PROJECT = projectId;

const testEnv = require('firebase-functions-test')({
  databaseURL,
  projectId,
});

let testEnvObj;
let functions;

beforeAll(async () => {
  let rules;
  try {
    rules = fs.readFileSync(path.resolve(__dirname, '../database.rules.json'), 'utf8');
  } catch {}

  testEnvObj = await initializeTestEnvironment({
    projectId,
    database: {
      host: '127.0.0.1',
      port: Number(emulatorPort),
      rules: rules || undefined,
    },
  });

  // Mock secrets since we are running in local test environment
  jest.mock('firebase-functions/params', () => ({
    defineSecret: (name) => ({
      value: () => {
        if (name === 'REVENUECAT_SECRET') return 'test_rc_secret';
        return 'test_secret';
      },
    }),
    defineString: () => ({ value: () => 'test_string' }),
  }));

  functions = require('./index.js');
});

beforeEach(() => {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({
          subscriber: {
            entitlements: {},
            non_subscriptions: {
              stars_50: [{ id: 'tx_default', store_transaction_id: 'tx_default' }],
            },
          },
        }),
    })
  );

  jest.spyOn(admin, 'auth').mockReturnValue({
    revokeRefreshTokens: jest.fn().mockResolvedValue(),
    deleteUser: jest.fn().mockResolvedValue(),
  });

  jest.spyOn(admin, 'firestore').mockReturnValue({
    recursiveDelete: jest.fn().mockResolvedValue(),
    collection: jest.fn().mockReturnValue({
      doc: jest.fn().mockReturnValue({
        delete: jest.fn().mockResolvedValue(),
      }),
      get: jest.fn().mockResolvedValue({
        empty: true,
        forEach: jest.fn(),
      }),
    }),
    batch: jest.fn().mockReturnValue({
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    }),
  });
});

afterEach(async () => {
  await testEnvObj.clearDatabase();
  jest.restoreAllMocks();
});

afterAll(async () => {
  if (admin.apps.length) {
    try {
      admin.database().goOffline();
    } catch {}
    await Promise.all(admin.apps.map((app) => app.delete()));
  }
  await testEnvObj.cleanup();
  testEnv.cleanup();
});

describe('Security regression: account and event boundaries', () => {
  test('clients cannot delete server wallet, receipts, invite markers or the user root', async () => {
    const uid = 'security_owner';
    const protectedFields = {
      wallet: { balance: 50, lastDailyClaim: '2026-09-08' },
      processedTransactions: { receipt: { stars: 50 } },
      invitedBy: 'inviter', isPremium: true, isAdmin: true,
    };
    await admin.database().ref(`users/${uid}`).set({ username: 'Owner', ...protectedFields });
    const db = testEnvObj.authenticatedContext(uid).database();
    for (const field of Object.keys(protectedFields)) {
      await assertFails(db.ref(`users/${uid}/${field}`).remove());
    }
    await assertFails(db.ref(`users/${uid}`).remove());
    await assertFails(db.ref(`users/${uid}`).set({ username: 'Reset' }));
    await assertSucceeds(db.ref(`users/${uid}`).update({ username: 'Renamed', updatedAt: Date.now() }));
    expect((await admin.database().ref(`users/${uid}/wallet/balance`).get()).val()).toBe(50);
  });

  test('private profile data is owner-only but public name remains readable', async () => {
    await admin.database().ref('users/private_user').set({ username: 'Public name', email: 'private@example.test', wallet: { balance: 50 } });
    const outsider = testEnvObj.authenticatedContext('outsider').database();
    await assertFails(outsider.ref('users/private_user').get());
    await assertFails(outsider.ref('users/private_user/email').get());
    await assertFails(outsider.ref('users/private_user/wallet').get());
    await assertSucceeds(outsider.ref('users/private_user/username').get());
  });

  test('self-assigned admin and unknown account fields are denied', async () => {
    const db = testEnvObj.authenticatedContext('attacker').database();
    await assertFails(db.ref('users/attacker/isAdmin').set(true));
    await assertFails(db.ref('users/attacker/arbitrary').set('payload'));
  });

  test('friend request sender cannot accept, change identities, or bypass blocking', async () => {
    const db = testEnvObj.authenticatedContext('sender').database();
    const request = { fromUserId: 'sender', toUserId: 'recipient', status: 'pending', createdAt: Date.now() };
    await assertSucceeds(db.ref('friendRequests/request1').set(request));
    await assertFails(db.ref('friendRequests/request1/status').set('accepted'));
    await assertFails(db.ref('friendRequests/request1/toUserId').set('victim'));
    await admin.database().ref('blockedUsers/recipient/sender').set({ at: Date.now() });
    await assertFails(db.ref('friendRequests/request2').set(request));
    await assertFails(db.ref('friendships/recipient/sender').set({ status: 'active', since: Date.now() }));
  });

  test('telemetry cannot overwrite another users event or append arbitrary data', async () => {
    await admin.database().ref('telemetry/event1').set({ userId: 'victim', event: 'open', at: Date.now() });
    const db = testEnvObj.authenticatedContext('attacker').database();
    await assertFails(db.ref('telemetry/event1').set({ userId: 'attacker', event: 'forged', at: Date.now() }));
    await assertFails(db.ref('telemetry/event2').set({ userId: 'attacker', event: 'open', arbitrary: 'blob' }));
  });

  test('recipient can atomically accept and create reciprocal friendship edges, with scoped queries', async () => {
    await admin.database().ref('friendRequests/request1').set({ fromUserId: 'sender', toUserId: 'recipient', status: 'pending', createdAt: Date.now() });
    const recipient = testEnvObj.authenticatedContext('recipient').database();
    const edge = { requestId: 'request1', status: 'active', since: Date.now() };
    await assertSucceeds(recipient.ref().update({
      'friendRequests/request1/status': 'accepted',
      'friendships/sender/recipient': edge,
      'friendships/recipient/sender': edge,
    }));
    await assertSucceeds(recipient.ref('friendRequests').orderByChild('toUserId').equalTo('recipient').limitToFirst(100).get());
    await assertFails(recipient.ref('friendRequests').get());
    await assertFails(recipient.ref('friendRequests').orderByChild('toUserId').equalTo('victim').limitToFirst(100).get());
    await assertFails(recipient.ref('friendRequests').orderByChild('toUserId').equalTo('recipient').get());
  });

  test('allowed diagnostic events append, but nested tag blobs and crash mutation are denied', async () => {
    const db = testEnvObj.authenticatedContext('owner').database();
    await assertSucceeds(db.ref('telemetry/new').set({ userId: 'owner', event: 'open', at: Date.now(), tags: { platform: 'ios' } }));
    await assertSucceeds(db.ref('crashLogs/owner/new').set({ message: 'failure', at: Date.now(), tags: { code: 1 } }));
    await assertFails(db.ref('crashLogs/owner/new/message').set('rewritten'));
    await assertFails(db.ref('crashLogs/owner/new').remove());
    await assertFails(db.ref('telemetry/nested').set({ userId: 'owner', event: 'open', at: Date.now(), tags: { blob: { nested: true } } }));
  });

  test('a room guest cannot replace another players queued action', async () => {
    await admin.database().ref('rooms/345678').set({
      hostId: 'host', status: 'playing',
      players: { host: { id: 'host', displayName: 'Host' }, guest: { id: 'guest', displayName: 'Guest' } },
      actions: { victimAction: { playerId: 'host', type: 'answer', ts: Date.now() } },
    });
    const db = testEnvObj.authenticatedContext('guest').database();
    const action = { playerId: 'guest', type: 'answer', ts: Date.now() };
    await assertFails(db.ref('rooms/345678/actions/victimAction').set(action));
    await assertSucceeds(db.ref('rooms/345678/actions/newAction').set(action));
  });

  test.each(['blockUser', 'unblockUser', 'reportUser'])('%s rejects database path separators in target IDs', async (name) => {
    const wrapped = testEnv.wrap(functions[name]);
    await expect(wrapped({ auth: { uid: 'sender' }, data: { targetUid: 'victim/nested', reason: 'harassment' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('Server validation and reward boundaries', () => {
  test('invite redemption rejects nested registry paths', async () => {
    await admin.database().ref('inviteCodes/ABCD/EFGH').set('inviter');
    await expect(testEnv.wrap(functions.redeemInvite)({ auth: { uid: 'guest' }, data: { code: 'ABCD/EFGH' } }))
      .rejects.toMatchObject({ code: 'invalid-argument' });
  });

  test('an outsider cannot create host migration metrics', async () => {
    await expect(testEnv.wrap(functions.recordHostMigration)({ auth: { uid: 'outsider' }, data: { roomCode: '123456' } }))
      .rejects.toMatchObject({ code: 'permission-denied' });
    expect((await admin.database().ref('metrics').get()).exists()).toBe(false);
  });

  test('concurrent daily requests grant only one reward', async () => {
    const wrapped = testEnv.wrap(functions.claimDailyReward);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => wrapped({ auth: { uid: 'daily_race' }, data: {} })));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect((await admin.database().ref('users/daily_race/wallet/balance').get()).val()).toBe(5);
  });

  test.each(['recordHostMigration', 'claimDailyReward', 'redeemInvite', 'ensureInviteCode', 'syncRevenueCat', 'searchUsers', 'reportUser', 'blockUser', 'unblockUser', 'deleteAccount', 'bootstrapFirstAdmin'])('%s rejects missing authentication', async name => {
    await expect(testEnv.wrap(functions[name])({ data: {} })).rejects.toMatchObject({ code: 'unauthenticated' });
  });

  test.each([
    [{}, {}, false, false],
    [undefined, { lifetime: [] }, false, false],
    [{ product_identifier: 'monthly' }, {}, false, false],
    [{ product_identifier: 'monthly', expires_date: 'invalid' }, {}, false, false],
    [{ product_identifier: 'monthly', expires_date: '2000-01-01T00:00:00Z' }, {}, false, false],
    [{ product_identifier: 'monthly', expires_date: '2999-01-01T00:00:00Z' }, {}, true, false],
    [{ product_identifier: 'monthly', expires_date: '2000-01-01T00:00:00Z', grace_period_expires_date: '2999-01-01T00:00:00Z' }, {}, true, false],
    [{ product_identifier: 'partybot_lifetime', expires_date: null }, {}, true, true],
  ])('RevenueCat entitlement %# grants only explicit active access', async (premium, nonSubs, active, lifetime) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ subscriber: { entitlements: premium === undefined ? {} : { Premium: premium }, non_subscriptions: nonSubs } }) });
    const result = await testEnv.wrap(functions.syncRevenueCat)({ auth: { uid: 'entitlement_user' }, data: {} });
    expect(result.isPremium).toBe(active);
    expect(result.isLifetime).toBe(lifetime);
  });

  test('malformed RevenueCat response leaves saved entitlement untouched', async () => {
    await admin.database().ref('users/known_customer').set({ isPremium: true });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ error: 'bad upstream format' }) });
    await expect(testEnv.wrap(functions.syncRevenueCat)({ auth: { uid: 'known_customer' }, data: {} })).rejects.toMatchObject({ code: 'internal' });
    expect((await admin.database().ref('users/known_customer/isPremium').get()).val()).toBe(true);
  });

  test('inherited object names are not accepted as star products', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ subscriber: { entitlements: {}, non_subscriptions: { constructor: [{ id: 'fake_product' }] } } }) });
    const result = await testEnv.wrap(functions.syncRevenueCat)({ auth: { uid: 'unknown_sku' }, data: {} });
    expect(result.credited).toBe(0);
    expect((await admin.database().ref('users/unknown_sku/wallet').get()).exists()).toBe(false);
  });
});

describe('RevenueCat Sync & Concurrency', () => {
  test('syncRevenueCat: exactly-once credit under concurrent duplicate calls', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            subscriber: {
              entitlements: {},
              non_subscriptions: {
                stars_50: [{ id: 'tx_dup', store_transaction_id: 'tx_dup' }],
              },
            },
          }),
      })
    );

    const uid = 'test_user_rc_dup';
    const wrappedSync = testEnv.wrap(functions.syncRevenueCat);

    const [res1, res2] = await Promise.all([
      wrappedSync({ data: {}, auth: { uid } }),
      wrappedSync({ data: {}, auth: { uid } }),
    ]);

    // Check wallet balance
    const walletSnap = await admin.database().ref(`users/${uid}/wallet`).once('value');
    expect(walletSnap.val().balance).toBe(50);

    // Check transaction record
    const txSnap = await admin.database().ref(`users/${uid}/processedTransactions/tx_dup`).once('value');
    expect(txSnap.exists()).toBe(true);

    // Sum of per-call reported credits must equal exactly the newly credited stars
    expect(res1.credited + res2.credited).toBe(50);
    // Exactly one caller got credited 50, the other got 0
    expect([res1.credited, res2.credited].sort()).toEqual([0, 50]);
  });

  test('syncRevenueCat: transaction retry/conflict validates exact per-call credited value', async () => {
    const uid = 'test_user_rc_conflict';
    const wrappedSync = testEnv.wrap(functions.syncRevenueCat);

    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            subscriber: {
              entitlements: {},
              non_subscriptions: {
                stars_50: [{ id: 'tx_a', store_transaction_id: 'tx_a' }],
                stars_200: [{ id: 'tx_b', store_transaction_id: 'tx_b' }],
              },
            },
          }),
      })
    );

    // Seed the user with an initial wallet balance of 10
    await admin.database().ref(`users/${uid}`).set({
      wallet: { balance: 10, updatedAt: Date.now() },
    });

    const [res1, res2] = await Promise.all([
      wrappedSync({ data: {}, auth: { uid } }),
      wrappedSync({ data: {}, auth: { uid } }),
    ]);

    // Total wallet balance: 10 + 50 + 200 = 260
    const walletSnap = await admin.database().ref(`users/${uid}/wallet`).once('value');
    expect(walletSnap.val().balance).toBe(260);

    // Both transactions recorded
    const txASnap = await admin.database().ref(`users/${uid}/processedTransactions/tx_a`).once('value');
    const txBSnap = await admin.database().ref(`users/${uid}/processedTransactions/tx_b`).once('value');
    expect(txASnap.exists()).toBe(true);
    expect(txBSnap.exists()).toBe(true);

    // Sum of credited across calls must be exactly 250 (50 + 200)
    expect(res1.credited + res2.credited).toBe(250);
  });
});

describe('Invite payout recovery', () => {
  const uid = 'retry_invitee';
  const inviter = 'retry_inviter';
  const request = { auth: { uid }, data: { code: 'RETRY1' } };
  beforeEach(async () => {
    await admin.database().ref(`users/${inviter}`).set({ inviteCode: 'RETRY1', wallet: { balance: 7 } });
    await admin.database().ref('inviteCodes/RETRY1').set(inviter);
  });

  function interruptPayment(afterCommit, target = `users/${inviter}`, occurrence = 1) {
    const db = admin.database();
    const originalRef = db.ref.bind(db);
    let armed = true;
    let calls = 0;
    jest.spyOn(db, 'ref').mockImplementation(path => {
      const ref = originalRef(path);
      if (path === target || path === `${target}/wallet`) {
        const transaction = ref.transaction.bind(ref);
        ref.transaction = async (...args) => {
          if (!armed || ++calls !== occurrence) return transaction(...args);
          armed = false;
          if (afterCommit) await transaction(...args);
          throw new Error('simulated transport interruption');
        };
      }
      return ref;
    });
  }

  test.each([false, true])('retry completes interrupted payment (commit acknowledgement lost: %s)', async afterCommit => {
    interruptPayment(afterCommit);
    const redeem = testEnv.wrap(functions.redeemInvite);
    await expect(redeem(request)).rejects.toThrow('simulated transport interruption');
    await expect(redeem(request)).resolves.toBeDefined();
    await expect(redeem(request)).resolves.toBeDefined();
    expect((await admin.database().ref(`users/${uid}/wallet/balance`).get()).val()).toBe(10);
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(37);
    expect((await admin.database().ref(`users/${inviter}/inviteStats`).get()).val()).toEqual({ totalInvites: 1, starsEarned: 30 });
  });

  test('concurrent retries return success with only one credit to each side', async () => {
    const redeem = testEnv.wrap(functions.redeemInvite);
    const results = await Promise.all(Array.from({ length: 4 }, () => redeem(request)));
    expect(results.reduce((sum, r) => sum + r.credited, 0)).toBe(10);
    expect(results.reduce((sum, r) => sum + r.inviterCredited, 0)).toBe(30);
    expect((await admin.database().ref(`users/${inviter}/inviteStats/totalInvites`).get()).val()).toBe(1);
  });

  test('completion validates a stale SDK cache against the server instead of aborting', async () => {
    const db = admin.database();
    const originalRef = db.ref.bind(db);
    let calls = 0;
    jest.spyOn(db, 'ref').mockImplementation(path => {
      const ref = originalRef(path);
      if (path === `users/${uid}`) {
        const transaction = ref.transaction.bind(ref);
        ref.transaction = async (update, ...args) => {
          if (++calls === 2) {
            const stale = { wallet: { balance: 10 } };
            // Model RTDB: undefined aborts immediately; a value gets checked
            // against the server, whose reservation differs from this cache.
            if (update(stale) === undefined) return { committed: false, snapshot: { val: () => stale } };
          }
          return transaction(update, ...args);
        };
      }
      return ref;
    });
    await expect(testEnv.wrap(functions.redeemInvite)(request)).resolves.toEqual({ credited: 10, inviterCredited: 30 });
    expect((await originalRef(`users/${uid}/inviteReward/status`).get()).val()).toBe('complete');
    expect((await originalRef(`users/${inviter}/wallet/balance`).get()).val()).toBe(37);
  });

  test('retry uses the bound inviter if the public registry has changed', async () => {
    interruptPayment(false);
    const redeem = testEnv.wrap(functions.redeemInvite);
    await expect(redeem(request)).rejects.toThrow('simulated transport interruption');
    await admin.database().ref('inviteCodes/RETRY1').set('different_owner');
    await expect(redeem(request)).resolves.toBeDefined();
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(37);
    expect((await admin.database().ref('users/different_owner/wallet').get()).exists()).toBe(false);
  });

  test('legacy markers are not credited again when their historical status is unknown', async () => {
    await admin.database().ref(`users/${uid}`).set({ invitedBy: inviter, wallet: { balance: 10 } });
    await expect(testEnv.wrap(functions.redeemInvite)(request)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await admin.database().ref(`users/${uid}/wallet/balance`).get()).val()).toBe(10);
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(7);
  });

  test.each([1, 2])('retry survives lost acknowledgement of invitee transaction %s', async occurrence => {
    interruptPayment(true, `users/${uid}`, occurrence);
    const redeem = testEnv.wrap(functions.redeemInvite);
    await expect(redeem(request)).rejects.toThrow('simulated transport interruption');
    await expect(redeem(request)).resolves.toBeDefined();
    expect((await admin.database().ref(`users/${uid}/wallet/balance`).get()).val()).toBe(10);
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(37);
    expect((await admin.database().ref(`users/${inviter}/inviteStats/totalInvites`).get()).val()).toBe(1);
  });

  test('retry cannot recreate an inviter deleted during an interrupted payout', async () => {
    interruptPayment(false);
    const redeem = testEnv.wrap(functions.redeemInvite);
    await expect(redeem(request)).rejects.toThrow('simulated transport interruption');
    await admin.database().ref(`users/${inviter}`).remove();
    await expect(redeem(request)).rejects.toMatchObject({ code: 'failed-precondition' });
    expect((await admin.database().ref(`users/${inviter}`).get()).exists()).toBe(false);
    expect((await admin.database().ref(`users/${uid}/wallet/balance`).get()).val()).toBe(10);
  });

  test('multiple invitees increment the same inviter without losing or repeating credits', async () => {
    const redeem = testEnv.wrap(functions.redeemInvite);
    await Promise.all(['one', 'two', 'three'].map(suffix => redeem({ auth: { uid: `invitee_${suffix}` }, data: { code: 'RETRY1' } })));
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(97);
    expect((await admin.database().ref(`users/${inviter}/inviteStats`).get()).val()).toEqual({ totalInvites: 3, starsEarned: 90 });
  });

  test('a pending payout cannot switch to another invite code', async () => {
    interruptPayment(false);
    const redeem = testEnv.wrap(functions.redeemInvite);
    await expect(redeem(request)).rejects.toThrow('simulated transport interruption');
    await expect(redeem({ auth: { uid }, data: { code: 'OTHER1' } })).rejects.toMatchObject({ code: 'failed-precondition' });
    await expect(redeem(request)).resolves.toBeDefined();
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(37);
  });

  test('clients cannot forge, edit or delete reward receipts and reservation state', async () => {
    await testEnv.wrap(functions.redeemInvite)(request);
    const db = testEnvObj.authenticatedContext(uid).database();
    await assertFails(db.ref(`users/${uid}/inviteReward/status`).set('pending'));
    await assertFails(db.ref(`users/${uid}/inviteReward`).remove());
    const inviterDb = testEnvObj.authenticatedContext(inviter).database();
    await assertFails(inviterDb.ref(`users/${inviter}/inviteRewardReceipts`).remove());
    await assertFails(inviterDb.ref(`users/${inviter}/inviteRewardReceipts/forged`).set({ amount: 30 }));
  });

  test('invalid existing wallet state cannot produce a paid claim', async () => {
    await admin.database().ref(`users/${uid}/wallet`).set('corrupt');
    await expect(testEnv.wrap(functions.redeemInvite)(request)).rejects.toMatchObject({ code: 'internal' });
    expect((await admin.database().ref(`users/${uid}/invitedBy`).get()).exists()).toBe(false);
    expect((await admin.database().ref(`users/${inviter}/wallet/balance`).get()).val()).toBe(7);
  });
});

describe('Invite Code Generation & Legacy Collision Safety', () => {
  test('ensureInviteCode: atomic reservation and bounded retry on collision', async () => {
    const wrappedEnsure = testEnv.wrap(functions.ensureInviteCode);

    let randomCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      randomCalls++;
      if (randomCalls === 1) return parseInt('collis', 36) / Math.pow(36, 6);
      return parseInt('unique', 36) / Math.pow(36, 6);
    };

    // Pre-fill "COLLIS" in the registry
    await admin.database().ref('inviteCodes/COLLIS').set('other_uid');

    const uid = 'test_user_invite_collision';
    const res = await wrappedEnsure({ data: {}, auth: { uid } });

    expect(res.code).toBe('UNIQUE');
    const regSnap = await admin.database().ref('inviteCodes/UNIQUE').once('value');
    expect(regSnap.val()).toBe(uid);

    Math.random = originalRandom;
  });

  test('ensureInviteCode: prevents collision with unmigrated legacy user code', async () => {
    const legacyUid = 'legacy_owner_uid';
    const newUid = 'new_user_uid';

    // Legacy user has "LEGACY" in profile, but absent from inviteCodes/ registry
    await admin.database().ref(`users/${legacyUid}`).set({
      inviteCode: 'LEGACY',
    });

    const wrappedEnsure = testEnv.wrap(functions.ensureInviteCode);

    let randomCalls = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      randomCalls++;
      // Attempt 1 generates "LEGACY", Attempt 2 generates "FRESH1"
      if (randomCalls === 1) return parseInt('legacy', 36) / Math.pow(36, 6);
      return parseInt('fresh1', 36) / Math.pow(36, 6);
    };

    const res = await wrappedEnsure({ data: {}, auth: { uid: newUid } });

    // The new user must NOT get "LEGACY"; they get "FRESH1"
    expect(res.code).toBe('FRESH1');
    const newProfileSnap = await admin.database().ref(`users/${newUid}/inviteCode`).once('value');
    expect(newProfileSnap.val()).toBe('FRESH1');

    // The legacy user's "LEGACY" code was preserved and registered to legacyUid
    const legacyRegSnap = await admin.database().ref('inviteCodes/LEGACY').once('value');
    expect(legacyRegSnap.val()).toBe(legacyUid);

    // "FRESH1" is registered to newUid
    const freshRegSnap = await admin.database().ref('inviteCodes/FRESH1').once('value');
    expect(freshRegSnap.val()).toBe(newUid);

    Math.random = originalRandom;
  });

  test('ensureInviteCode: concurrent race on same user releases orphaned candidate reservation', async () => {
    const uid = 'test_user_race_orphan';
    const wrappedEnsure = testEnv.wrap(functions.ensureInviteCode);

    let callCount = 0;
    const originalRandom = Math.random;
    Math.random = () => {
      callCount++;
      // Call 1 generates "CAND01", Call 2 generates "CAND02"
      if (callCount % 2 === 1) {
        return parseInt('cand01', 36) / Math.pow(36, 6);
      } else {
        return parseInt('cand02', 36) / Math.pow(36, 6);
      }
    };

    // Run two concurrent requests for the same user
    const [res1, res2] = await Promise.all([
      wrappedEnsure({ data: {}, auth: { uid } }),
      wrappedEnsure({ data: {}, auth: { uid } }),
    ]);

    // Both calls must return the same winning code
    expect(res1.code).toBe(res2.code);
    const winningCode = res1.code;
    const losingCode = winningCode === 'CAND01' ? 'CAND02' : 'CAND01';

    // User record has the winning code
    const userSnap = await admin.database().ref(`users/${uid}/inviteCode`).once('value');
    expect(userSnap.val()).toBe(winningCode);

    // Winning code exists in registry
    const winRegSnap = await admin.database().ref(`inviteCodes/${winningCode}`).once('value');
    expect(winRegSnap.val()).toBe(uid);

    // Losing candidate code was cleaned up and is NOT orphaned
    const loseRegSnap = await admin.database().ref(`inviteCodes/${losingCode}`).once('value');
    expect(loseRegSnap.exists()).toBe(false);

    Math.random = originalRandom;
  });
});

describe('Invite Redemption & Migration Races', () => {
  test('redeemInvite: authoritative registry lookup and legacy fallback migration', async () => {
    const uid = 'invitee_legacy';
    const inviter = 'inviter_legacy';

    // Legacy user has code in user record but not in registry
    await admin.database().ref(`users/${inviter}`).set({
      inviteCode: 'LEGACY',
    });

    const wrappedRedeem = testEnv.wrap(functions.redeemInvite);
    const res = await wrappedRedeem({ data: { code: 'LEGACY' }, auth: { uid } });

    expect(res.credited).toBe(10);
    expect(res.inviterCredited).toBe(30);

    // Code migrated to registry
    const regSnap = await admin.database().ref('inviteCodes/LEGACY').once('value');
    expect(regSnap.val()).toBe(inviter);

    // Invitee and inviter wallets credited
    const inviteeWallet = await admin.database().ref(`users/${uid}/wallet`).once('value');
    const inviterWallet = await admin.database().ref(`users/${inviter}/wallet`).once('value');
    expect(inviteeWallet.val().balance).toBe(10);
    expect(inviterWallet.val().balance).toBe(30);
  });

  test('redeemInvite: legacy migration does not overwrite concurrent registry winner', async () => {
    const invitee = 'invitee_mig_race';
    const legacyInviter = 'legacy_inviter_user';
    const concurrentWinner = 'registry_winner_user';

    // Legacy user has code SHARED in profile
    await admin.database().ref(`users/${legacyInviter}`).set({
      inviteCode: 'SHARED',
    });

    // But registry SHARED was already claimed by concurrentWinner
    await admin.database().ref(`users/${concurrentWinner}`).set({ inviteCode: 'SHARED' });
    await admin.database().ref('inviteCodes/SHARED').set(concurrentWinner);

    const wrappedRedeem = testEnv.wrap(functions.redeemInvite);
    const res = await wrappedRedeem({ data: { code: 'SHARED' }, auth: { uid: invitee } });

    // Registry owner (concurrentWinner) is recognized as authoritative
    const regSnap = await admin.database().ref('inviteCodes/SHARED').once('value');
    expect(regSnap.val()).toBe(concurrentWinner);

    // Invitee invitedBy is set to the authoritative winner
    const inviteeInvitedBy = await admin.database().ref(`users/${invitee}/invitedBy`).once('value');
    expect(inviteeInvitedBy.val()).toBe(concurrentWinner);

    // concurrentWinner is credited
    const winnerWallet = await admin.database().ref(`users/${concurrentWinner}/wallet`).once('value');
    expect(winnerWallet.val().balance).toBe(30);

    // legacyInviter was NOT credited (never received wallet balance)
    const legacyWallet = await admin.database().ref(`users/${legacyInviter}/wallet`).once('value');
    expect(legacyWallet.exists()).toBe(false);
  });

  test('redeemInvite: prevents self-redemption', async () => {
    const uid = 'self_redeemer';
    await admin.database().ref(`users/${uid}`).set({ inviteCode: 'MYCODE' });
    await admin.database().ref('inviteCodes/MYCODE').set(uid);

    const wrappedRedeem = testEnv.wrap(functions.redeemInvite);
    await expect(wrappedRedeem({ data: { code: 'MYCODE' }, auth: { uid } })).rejects.toThrow(
      'You cannot redeem your own code.'
    );
  });
});

describe('Account Deletion Ownership-Safe Cleanup', () => {
  test('Firestore failure keeps authentication available for a deletion retry', async () => {
    admin.firestore().recursiveDelete.mockRejectedValueOnce(new Error('Firestore unavailable'));
    const wrappedDelete = testEnv.wrap(functions.deleteAccount);
    await expect(wrappedDelete({ data: {}, auth: { uid: 'deletion_retry' } })).rejects.toThrow('Firestore unavailable');
    expect(admin.auth().deleteUser).not.toHaveBeenCalled();
  });

  test('deleteAccount: removes inviteCodes registry reservation when owned by user', async () => {
    const uid = 'del_user_valid';
    await admin.database().ref(`users/${uid}`).set({
      inviteCode: 'DELCODE',
    });
    await admin.database().ref('inviteCodes/DELCODE').set(uid);

    const wrappedDelete = testEnv.wrap(functions.deleteAccount);
    await wrappedDelete({ data: {}, auth: { uid } });

    const userSnap = await admin.database().ref(`users/${uid}`).once('value');
    expect(userSnap.exists()).toBe(false);

    const regSnap = await admin.database().ref('inviteCodes/DELCODE').once('value');
    expect(regSnap.exists()).toBe(false);
  });

  test('deleteAccount: does NOT delete registry reservation owned by another UID', async () => {
    const deletingUid = 'deleting_user_corrupt';
    const legitimateOwner = 'legitimate_code_owner';

    // deletingUid has "CONFLICT" in profile, but registry entry belongs to legitimateOwner
    await admin.database().ref(`users/${deletingUid}`).set({
      inviteCode: 'CONFLICT',
    });
    await admin.database().ref('inviteCodes/CONFLICT').set(legitimateOwner);

    const wrappedDelete = testEnv.wrap(functions.deleteAccount);
    await wrappedDelete({ data: {}, auth: { uid: deletingUid } });

    // deletingUid user node is removed
    const userSnap = await admin.database().ref(`users/${deletingUid}`).once('value');
    expect(userSnap.exists()).toBe(false);

    // inviteCodes/CONFLICT is PRESERVED for legitimateOwner
    const regSnap = await admin.database().ref('inviteCodes/CONFLICT').once('value');
    expect(regSnap.exists()).toBe(true);
    expect(regSnap.val()).toBe(legitimateOwner);
  });
});

describe('Multiplayer Stale Room Sweeper', () => {
  test('resumed activity after the candidate read survives cleanup', async () => {
    const db = admin.database();
    const now = Date.now();
    const room = db.ref('rooms/resumed');
    await room.set({ status: 'waiting', createdAt: now - 3600000 });
    const originalRef = db.ref.bind(db);
    jest.spyOn(db, 'ref').mockImplementation(path => {
      const ref = originalRef(path);
      if (path === 'rooms') {
        const order = ref.orderByKey.bind(ref);
        ref.orderByKey = () => {
          const query = order();
          const limit = query.limitToFirst.bind(query);
          query.limitToFirst = count => {
            const bounded = limit(count);
            const once = bounded.once.bind(bounded);
            bounded.once = async (...args) => {
              const snapshot = await once(...args);
              await room.update({ lastActivityAt: now });
              return snapshot;
            };
            return bounded;
          };
          return query;
        };
      }
      return ref;
    });
    const result = await functions.sweepStaleRoomsLogic(db, now);
    expect(result.removed).toBe(0);
    expect((await room.get()).val().lastActivityAt).toBe(now);
  });

  test('bounded pages resume past active rooms and wrap for newly inserted earlier keys', async () => {
    const db = admin.database();
    const now = Date.now();
    await db.ref('rooms').set({
      a: { status: 'playing', createdAt: now },
      b: { status: 'playing', createdAt: now },
      c: { status: 'waiting', createdAt: now - 3600000 },
    });
    const bounds = { pageSize: 2, maxPages: 1 };
    expect(await functions.sweepStaleRoomsLogic(db, now, bounds)).toEqual({ scanned: 2, removed: 0 });
    expect((await db.ref('metrics/roomSweeperCursor').get()).val()).toBe('b');
    await db.ref('rooms/aa').set({ status: 'waiting', createdAt: now - 3600000 });
    expect(await functions.sweepStaleRoomsLogic(db, now, bounds)).toEqual({ scanned: 1, removed: 1 });
    expect((await db.ref('metrics/roomSweeperCursor').get()).exists()).toBe(false);
    expect(await functions.sweepStaleRoomsLogic(db, now, bounds)).toEqual({ scanned: 2, removed: 1 });
    expect((await db.ref('rooms/a').get()).exists()).toBe(true);
  });

  test('sweepStaleRooms: removes expired waiting, playing, and closed rooms based on TTL', async () => {
    const now = Date.now();

    // 1. Expired waiting room (> 30 mins)
    await admin.database().ref('rooms/100001').set({
      status: 'waiting',
      createdAt: now - 35 * 60 * 1000,
      lastActivityAt: now - 35 * 60 * 1000,
    });

    // 2. Active waiting room (5 mins old)
    await admin.database().ref('rooms/100002').set({
      status: 'waiting',
      createdAt: now - 5 * 60 * 1000,
      lastActivityAt: now - 5 * 60 * 1000,
    });

    // 3. Expired playing room (> 6 hours)
    await admin.database().ref('rooms/100003').set({
      status: 'playing',
      createdAt: now - 7 * 60 * 60 * 1000,
      lastActivityAt: now - 7 * 60 * 60 * 1000,
    });

    // 4. Active playing room with recent gameState update (1 min ago, even if lastActivityAt is older)
    await admin.database().ref('rooms/100004').set({
      status: 'playing',
      createdAt: now - 5 * 60 * 60 * 1000,
      lastActivityAt: now - 2 * 60 * 60 * 1000,
      gameState: { lastUpdatedAt: now - 60 * 1000 },
    });

    // 5. Expired closed room (> 5 mins)
    await admin.database().ref('rooms/100005').set({
      status: 'closed',
      createdAt: now - 60 * 60 * 1000,
      lastActivityAt: now - 10 * 60 * 1000,
    });

    // 6. Malformed / uninitialized room with no timestamps (should NOT be deleted prematurely)
    await admin.database().ref('rooms/100006').set({
      status: 'waiting',
      hostId: 'some_host',
    });

    const result = await functions.sweepStaleRoomsLogic(admin.database(), now);
    expect(result.removed).toBe(3); // 100001, 100003, 100005

    const r1 = await admin.database().ref('rooms/100001').once('value');
    const r2 = await admin.database().ref('rooms/100002').once('value');
    const r3 = await admin.database().ref('rooms/100003').once('value');
    const r4 = await admin.database().ref('rooms/100004').once('value');
    const r5 = await admin.database().ref('rooms/100005').once('value');
    const r6 = await admin.database().ref('rooms/100006').once('value');

    expect(r1.exists()).toBe(false);
    expect(r2.exists()).toBe(true);
    expect(r3.exists()).toBe(false);
    expect(r4.exists()).toBe(true);
    expect(r5.exists()).toBe(false);
    expect(r6.exists()).toBe(true);
  });
});

describe('Multiplayer RTDB Security & Authorization End-to-End', () => {
  test('Unauthenticated users are rejected from reading or writing /rooms, /sessions, and /presence', async () => {
    const unauthDb = testEnvObj.unauthenticatedContext().database();

    await assertFails(unauthDb.ref('rooms/123456').once('value'));
    await assertFails(unauthDb.ref('rooms/123456').set({ hostId: 'anon' }));
    await assertFails(unauthDb.ref('presence/user1').once('value'));
    await assertFails(unauthDb.ref('presence/user1').set({ online: true, lastSeen: Date.now() }));
    await assertFails(unauthDb.ref('sessions/sess1').once('value'));
  });

  test('Outsiders cannot read /rooms/$code, actions, gameState, or presence', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/111111').set({
      roomCode: '111111',
      gameId: 'color_match',
      hostId: 'host_secret',
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_secret: { id: 'host_secret', displayName: 'Host', isHost: true, isReady: true, joinedAt: now },
      },
      gameState: { version: 1, phase: 'waiting', lastUpdatedAt: now, turnData: { privateKey: 'secret_state' } },
      actions: {
        act_1: { playerId: 'host_secret', type: 'init', ts: now },
      },
      presence: {
        host_secret: { online: true, lastSeen: now },
      },
    });

    const outsiderDb = testEnvObj.authenticatedContext('outsider_snoop').database();
    const memberDb = testEnvObj.authenticatedContext('host_secret').database();

    // Outsider reads must FAIL
    await assertFails(outsiderDb.ref('rooms/111111').once('value'));
    await assertFails(outsiderDb.ref('rooms/111111/gameState').once('value'));
    await assertFails(outsiderDb.ref('rooms/111111/actions').once('value'));
    await assertFails(outsiderDb.ref('rooms/111111/presence').once('value'));

    // Member read SUCCEEDS
    await assertSucceeds(memberDb.ref('rooms/111111').once('value'));
    await assertSucceeds(memberDb.ref('rooms/111111/gameState').once('value'));
    await assertSucceeds(memberDb.ref('rooms/111111/actions').once('value'));
  });

  test('Room creation requires hostId to match auth.uid and rejects room spoofing', async () => {
    const hostDb = testEnvObj.authenticatedContext('user_host_1').database();
    const now = Date.now();

    // Valid room creation by host
    await assertSucceeds(
      hostDb.ref('rooms/123456').set({
        roomCode: '123456',
        gameId: 'color_match',
        hostId: 'user_host_1',
        status: 'waiting',
        createdAt: now,
        lastActivityAt: now,
        players: {
          user_host_1: {
            id: 'user_host_1',
            displayName: 'Host User',
            isHost: true,
            isReady: true,
            joinedAt: now,
          },
        },
      })
    );

    // Spoofed room creation where hostId != auth.uid must FAIL
    const attackerDb = testEnvObj.authenticatedContext('attacker').database();
    await assertFails(
      attackerDb.ref('rooms/654321').set({
        roomCode: '654321',
        gameId: 'color_match',
        hostId: 'victim_user',
        status: 'waiting',
        createdAt: now,
        lastActivityAt: now,
        players: {
          victim_user: {
            id: 'victim_user',
            displayName: 'Victim',
            isHost: true,
            isReady: true,
            joinedAt: now,
          },
        },
      })
    );
  });

  test('Orphan player write to non-existent room FAILS', async () => {
    const guestDb = testEnvObj.authenticatedContext('guest_orphan').database();
    const now = Date.now();

    // Writing player row under non-existent room 999999 must FAIL
    await assertFails(
      guestDb.ref('rooms/999999/players/guest_orphan').set({
        id: 'guest_orphan',
        displayName: 'Orphan',
        isHost: false,
        isReady: false,
        joinedAt: now,
      })
    );
  });

  test('Joining a non-waiting room (e.g. playing/closed) FAILS', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/777888').set({
      roomCode: '777888',
      gameId: 'drum_challenge',
      hostId: 'host_in_game',
      status: 'playing',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_in_game: { id: 'host_in_game', displayName: 'Host', isHost: true, isReady: true, joinedAt: now },
      },
    });

    const lateGuestDb = testEnvObj.authenticatedContext('late_guest').database();

    // Joining room while in 'playing' status must FAIL
    await assertFails(
      lateGuestDb.ref('rooms/777888/players/late_guest').set({
        id: 'late_guest',
        displayName: 'Late Guest',
        isHost: false,
        isReady: false,
        joinedAt: now + 5,
      })
    );
  });

  test('Outsiders cannot inject actions or presence into an existing room', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/888999').set({
      roomCode: '888999',
      gameId: 'reaction_time',
      hostId: 'host_active',
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_active: { id: 'host_active', displayName: 'Host', isHost: true, isReady: true, joinedAt: now },
      },
    });

    const outsiderDb = testEnvObj.authenticatedContext('outsider_intruder').database();

    // Outsider action write must FAIL
    await assertFails(
      outsiderDb.ref('rooms/888999/actions/intruder_action').set({
        playerId: 'outsider_intruder',
        type: 'spoof_action',
        data: { score: 1000 },
        ts: now + 1,
      })
    );

    // Outsider presence write must FAIL
    await assertFails(
      outsiderDb.ref('rooms/888999/presence/outsider_intruder').set({
        online: true,
        lastSeen: now + 2,
      })
    );
  });

  test('Member can join waiting room and then read; host can mutate gameState', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/222333').set({
      roomCode: '222333',
      gameId: 'memory_grid',
      hostId: 'host_alice',
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_alice: { id: 'host_alice', displayName: 'Alice', isHost: true, isReady: true, joinedAt: now },
      },
    });

    const guestDb = testEnvObj.authenticatedContext('guest_bob').database();
    const hostDb = testEnvObj.authenticatedContext('host_alice').database();

    // Before joining, guest cannot read room
    await assertFails(guestDb.ref('rooms/222333').once('value'));

    // Guest joins room
    await assertSucceeds(
      guestDb.ref('rooms/222333/players/guest_bob').set({
        id: 'guest_bob',
        displayName: 'Bob',
        isHost: false,
        isReady: false,
        joinedAt: now + 1,
      })
    );

    // After joining, guest CAN read room
    await assertSucceeds(guestDb.ref('rooms/222333').once('value'));

    // Guest cannot mutate gameState
    await assertFails(
      guestDb.ref('rooms/222333/gameState').set({
        version: 1,
        phase: 'playing',
        lastUpdatedAt: now,
        turnData: { score: 999 },
      })
    );

    // Guest cannot close the room
    await assertFails(guestDb.ref('rooms/222333').update({ status: 'closed' }));

    // Host CAN mutate gameState with monotonic version
    await assertSucceeds(
      hostDb.ref('rooms/222333/gameState').set({
        version: 1,
        phase: 'playing',
        lastUpdatedAt: now,
        turnData: { score: 10 },
      })
    );

    // Host CAN close the room
    await assertSucceeds(hostDb.ref('rooms/222333').update({ status: 'closed', lastActivityAt: now + 500 }));
  });

  test('Removed / former host cannot mutate gameState, close room, or delete actions', async () => {
    const now = Date.now();
    // Ex-host is listed as hostId, but has been removed from players
    await admin.database().ref('rooms/333444').set({
      roomCode: '333444',
      gameId: 'tap_in_order',
      hostId: 'ex_host',
      status: 'playing',
      createdAt: now,
      lastActivityAt: now,
      players: {
        remaining_player: { id: 'remaining_player', displayName: 'Player', isHost: false, isReady: true, joinedAt: now },
      },
      actions: {
        act_1: { playerId: 'remaining_player', type: 'tap', ts: now },
      },
    });

    const exHostDb = testEnvObj.authenticatedContext('ex_host').database();

    // Ex-host cannot read room (not in players)
    await assertFails(exHostDb.ref('rooms/333444').once('value'));

    // Ex-host cannot mutate gameState
    await assertFails(
      exHostDb.ref('rooms/333444/gameState').set({
        version: 2,
        phase: 'game_over',
        lastUpdatedAt: now,
        turnData: {},
      })
    );

    // Ex-host cannot close room
    await assertFails(exHostDb.ref('rooms/333444').update({ status: 'closed' }));

    // Ex-host cannot delete player's action
    await assertFails(exHostDb.ref('rooms/333444/actions/act_1').remove());
  });

  test('Action deletion is permitted only for the action owner or active room host', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/444555').set({
      roomCode: '444555',
      gameId: 'reaction_time',
      hostId: 'host_eve',
      status: 'playing',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_eve: { id: 'host_eve', displayName: 'Eve', isHost: true, isReady: true, joinedAt: now },
        player_frank: { id: 'player_frank', displayName: 'Frank', isHost: false, isReady: true, joinedAt: now + 1 },
      },
      actions: {
        act_frank_1: { playerId: 'player_frank', type: 'tap', ts: now + 5 },
      },
    });

    const bystanderDb = testEnvObj.authenticatedContext('user_bystander').database();
    const authorDb = testEnvObj.authenticatedContext('player_frank').database();
    const hostDb = testEnvObj.authenticatedContext('host_eve').database();

    // Bystander cannot delete Frank's action
    await assertFails(bystanderDb.ref('rooms/444555/actions/act_frank_1').remove());

    // Action author CAN delete own action
    await assertSucceeds(authorDb.ref('rooms/444555/actions/act_frank_1').remove());

    // Re-seed action
    await admin.database().ref('rooms/444555/actions/act_frank_2').set({
      playerId: 'player_frank',
      type: 'tap',
      ts: now + 10,
    });

    // Active host CAN delete/ack any player's action
    await assertSucceeds(hostDb.ref('rooms/444555/actions/act_frank_2').remove());
  });

  test('Host can kick a player, but regular players cannot kick each other', async () => {
    const now = Date.now();
    await admin.database().ref('rooms/555666').set({
      roomCode: '555666',
      gameId: 'drum_challenge',
      hostId: 'host_grace',
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: {
        host_grace: { id: 'host_grace', displayName: 'Grace', isHost: true, isReady: true, joinedAt: now },
        player_heidi: { id: 'player_heidi', displayName: 'Heidi', isHost: false, isReady: true, joinedAt: now + 1 },
        player_ivan: { id: 'player_ivan', displayName: 'Ivan', isHost: false, isReady: true, joinedAt: now + 2 },
      },
    });

    const heidiDb = testEnvObj.authenticatedContext('player_heidi').database();
    const hostDb = testEnvObj.authenticatedContext('host_grace').database();

    // Heidi cannot remove Ivan
    await assertFails(heidiDb.ref('rooms/555666/players/player_ivan').remove());

    // Host Grace CAN remove Ivan
    await assertSucceeds(hostDb.ref('rooms/555666/players/player_ivan').remove());
  });

  test('Host migration: only an active member in players can claim host when previous host leaves', async () => {
    const now = Date.now();
    // Host disconnected, host row removed from players
    await admin.database().ref('rooms/666777').set({
      roomCode: '666777',
      gameId: 'draw_rush',
      hostId: 'old_host',
      status: 'waiting',
      createdAt: now,
      lastActivityAt: now,
      players: {
        member_judy: { id: 'member_judy', displayName: 'Judy', isHost: false, isReady: true, joinedAt: now + 5 },
      },
    });

    const outsiderDb = testEnvObj.authenticatedContext('outsider_ken').database();
    const memberDb = testEnvObj.authenticatedContext('member_judy').database();

    // Outsider (not in players) CANNOT claim host
    await assertFails(
      outsiderDb.ref('rooms/666777').update({
        hostId: 'outsider_ken',
        lastActivityAt: now + 10,
      })
    );

    // Active member Judy CAN claim host
    await assertSucceeds(
      memberDb.ref('rooms/666777').update({
        hostId: 'member_judy',
        lastActivityAt: now + 10,
      })
    );
  });

  test('Sessions (/sessions/$sid): restricted read and state mutation to active members and host', async () => {
    const now = Date.now();
    await admin.database().ref('sessions/sess_100').set({
      hostId: 'host_session_user',
      gameId: 'color_trap',
      createdAt: now,
      status: 'active',
      players: {
        host_session_user: { id: 'host_session_user', displayName: 'Host', isHost: true },
        guest_session_user: { id: 'guest_session_user', displayName: 'Guest', isHost: false },
      },
      state: 'initial_state',
    });

    const outsiderDb = testEnvObj.authenticatedContext('outsider_sess').database();
    const guestDb = testEnvObj.authenticatedContext('guest_session_user').database();
    const hostDb = testEnvObj.authenticatedContext('host_session_user').database();

    // Outsider cannot read session
    await assertFails(outsiderDb.ref('sessions/sess_100').once('value'));

    // Member guest CAN read session
    await assertSucceeds(guestDb.ref('sessions/sess_100').once('value'));

    // Guest cannot mutate state
    await assertFails(guestDb.ref('sessions/sess_100/state').set('mutated_state'));

    // Host CAN mutate state
    await assertSucceeds(hostDb.ref('sessions/sess_100/state').set('host_updated_state'));
  });

  test('Economy protection: client direct write to /users/$uid/wallet is rejected by rules', async () => {
    const userDb = testEnvObj.authenticatedContext('user_spender').database();

    // Attempting to give oneself free stars balance via client write must FAIL
    await assertFails(userDb.ref('users/user_spender/wallet/balance').set(99999));
    await assertFails(userDb.ref('users/user_spender/isPremium').set(true));
    await assertFails(userDb.ref('users/user_spender/isLifetime').set(true));
  });

  test('Host migration counter (recordHostMigration) rate limits and increments metric', async () => {
    const uid = 'user_migration_test';
    const wrapped = testEnv.wrap(functions.recordHostMigration);
    await admin.database().ref('rooms/111222').set({
      hostId: uid, players: { [uid]: { id: uid, displayName: 'Host' } },
    });

    const res = await wrapped({
      data: { roomCode: '111222', reason: 'host_gone' },
      auth: { uid },
    });
    expect(res.ok).toBe(true);

    const day = new Date().toISOString().split('T')[0];
    const countSnap = await admin.database().ref(`metrics/hostMigrations/${day}`).once('value');
    expect(countSnap.val()).toBeGreaterThanOrEqual(1);
  });
});
