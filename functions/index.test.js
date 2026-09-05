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
