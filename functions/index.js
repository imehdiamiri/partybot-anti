/**
 * Firebase Cloud Functions — PartyBot secure backend layer.
 *
 * Functions:
 *   - claimDailyReward: Transactional once-per-day star reward.
 *   - syncRevenueCat:  Pulls authoritative entitlement from RC and mirrors it.
 *   - redeemInvite:    Server-authoritative invite redemption (+stars, idempotent).
 *   - searchUsers:     Indexed prefix search over usernames.
 *   - sweepStaleRooms: Scheduled GC of abandoned rooms (TTL based on lastActivityAt).
 *   - recordHostMigration: Append-only counter for live host-migration events.
 *
 * Deploy:
 *   firebase deploy --only functions
 *
 * Set secrets:
 *   firebase functions:secrets:set REVENUECAT_SECRET
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { resumableClaim, settleInvite } = require('./invite-rewards');

function validDatabaseId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128
    && !/[.#$\[\]/\u0000-\u001f\u007f]/.test(value);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

if (!admin.apps.length) {
  admin.initializeApp();
}

const REVENUECAT_SECRET = defineSecret('REVENUECAT_SECRET');
const BOOTSTRAP_ADMIN_TOKEN = defineSecret('BOOTSTRAP_ADMIN_TOKEN');
const DAILY_REWARD = 5;
const INVITER_REWARD = 30;
const INVITEE_REWARD = 10;

// Star pack catalogue — keep in sync with App Store Connect / Play Console / RC.
const STAR_PACKS = {
  stars_50: 50,
  stars_200: 200,
  stars_400: 400,
  stars_1000: 1000,
};

const PREMIUM_ENTITLEMENT = 'Premium';
const LIFETIME_PRODUCT_IDS = ['lifetime', 'partybot_lifetime'];

// Room TTLs (ms). Sweeper deletes anything past these thresholds.
const ROOM_TTL_WAITING_MS = 30 * 60 * 1000;     // 30 min waiting → GC
const ROOM_TTL_PLAYING_MS = 6 * 60 * 60 * 1000;  // 6h playing → GC
const ROOM_TTL_CLOSED_MS  = 5 * 60 * 1000;       // 5 min closed → GC

// ──────────────────────── Rate-limit helper ────────────────────────

/**
 * Token-bucket-ish guard backed by RTDB. Bumps a per-uid counter at
 * `rateLimits/$key/$uid` and rejects if the caller exceeds `max` calls in the
 * trailing `windowMs`. Cheap, transactional, and good enough to keep abuse
 * vectors closed without standing up a dedicated rate-limit service.
 */
async function rateLimit(uid, key, max, windowMs) {
  const ref = admin.database().ref(`rateLimits/${key}/${uid}`);
  const now = Date.now();
  const result = await ref.transaction((cur) => {
    const c = cur || { count: 0, windowStart: now };
    if (now - (c.windowStart || 0) > windowMs) {
      return { count: 1, windowStart: now };
    }
    return { count: (c.count || 0) + 1, windowStart: c.windowStart || now };
  });
  const count = result.snapshot.val()?.count || 0;
  if (count > max) {
    throw new HttpsError('resource-exhausted', 'Too many requests, slow down.');
  }
}

// ──────────────────────── Moderation ────────────────────────

const UNSAFE_PATTERNS = [
  /\b(kill|murder|suicide|rape|assault|weapon|gun|knife|bomb|drugs?|cocaine|heroin|meth)\b/i,
  /\b(racist|sexist|homophobic|slur|hate\s*speech)\b/i,
  /\b(child|minor|underage)\b/i,
  /\b(nazi|terrorist|extremist)\b/i,
];

const isSafe = (text) => !UNSAFE_PATTERNS.some((p) => p.test(text));

// ──────────────────────── recordHostMigration ────────────────────────

/**
 * Lightweight counter for observability. The client invokes this whenever it
 * successfully promotes itself to host. We bucket by UTC day so the admin
 * dashboard can chart migration volume without scanning room history.
 */
exports.recordHostMigration = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'recordHostMigration', 60, 60 * 1000);
  const roomCode = request.data?.roomCode;
  if (typeof roomCode !== 'string' || !/^[0-9]{6}$/.test(roomCode)) {
    throw new HttpsError('invalid-argument', 'Invalid room code.');
  }
  const room = (await admin.database().ref(`rooms/${roomCode}`).once('value')).val();
  if (!room || room.hostId !== uid || !Object.hasOwn(room.players || {}, uid)) {
    throw new HttpsError('permission-denied', 'Only the active room host may report migration.');
  }
  const reason = String(request.data?.reason || 'host_gone').slice(0, 32);
  const day = new Date().toISOString().split('T')[0];
  const ref = admin.database().ref(`metrics/hostMigrations/${day}`);
  await ref.transaction((v) => (v || 0) + 1);
  await admin.database().ref('metrics/hostMigrationsLog').push({
    uid, roomCode, reason, at: Date.now(),
  });
  return { ok: true };
});

// ──────────────────────── claimDailyReward ────────────────────────

exports.claimDailyReward = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'claimDailyReward', 10, 60 * 60 * 1000);

  const today = new Date().toISOString().split('T')[0];
  const walletRef = admin.database().ref(`users/${uid}/wallet`);

  const result = await walletRef.transaction((current) => {
    const wallet = current || { balance: 0, lastDailyClaim: null, updatedAt: 0 };
    if (wallet.lastDailyClaim === today) return; // abort
    wallet.balance = (wallet.balance || 0) + DAILY_REWARD;
    wallet.lastDailyClaim = today;
    wallet.updatedAt = Date.now();
    return wallet;
  });

  if (!result.committed) {
    throw new HttpsError('failed-precondition', 'Already claimed today.');
  }

  return {
    granted: DAILY_REWARD,
    balance: result.snapshot.val()?.balance || 0,
    lastDailyClaim: today,
  };
});

// ──────────────────────── redeemInvite ────────────────────────

/**
 * Server-authoritative invite redemption. Replaces the unsafe client-side
 * wallet writes that were rejected by RTDB rules anyway.
 *
 * Each wallet commits with a server-owned receipt. Pending claims can resume
 * after interruption; completed and legacy claims cannot be paid twice.
 */
exports.redeemInvite = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'redeemInvite', 5, 60 * 60 * 1000);

  const raw = typeof request.data?.code === 'string' ? request.data.code.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,12}$/.test(raw)) {
    throw new HttpsError('invalid-argument', 'Invalid invite code.');
  }

  const user = (await admin.database().ref(`users/${uid}`).once('value')).val();
  const pending = resumableClaim(user, raw);
  if ((user?.invitedBy || user?.inviteReward) && !pending) {
    throw new HttpsError('failed-precondition', 'You already redeemed an invite code.');
  }

  // 1. Check global registry first.
  let inviterUid = pending?.inviterUid || null;
  if (!pending) {
    const registryRef = admin.database().ref(`inviteCodes/${raw}`);
    const registrySnap = await registryRef.once('value');
    if (registrySnap.exists()) {
      inviterUid = registrySnap.val();
    } else {
      // 2. Fallback to legacy index search (for codes generated before the registry).
      const lookup = await admin
        .database()
        .ref('users')
        .orderByChild('inviteCode')
        .equalTo(raw)
        .limitToFirst(1)
        .once('value');

      if (lookup.exists()) {
        let legacyUid = null;
        lookup.forEach((c) => { legacyUid = c.key; });
        if (legacyUid) {
          // Atomic migration: only write if still empty, preventing race overwrites
          const migTxn = await registryRef.transaction((cur) => (cur ? undefined : legacyUid));
          if (migTxn.committed) {
            inviterUid = legacyUid;
          } else {
            // If a concurrent reservation/migration claimed this code, use the authoritative registry winner
            inviterUid = migTxn.snapshot.val() || legacyUid;
          }
        }
      }
    }

  }
  if (!validDatabaseId(inviterUid)) {
    throw new HttpsError('not-found', 'Invalid invite code.');
  }

  if (inviterUid === uid) {
    throw new HttpsError('failed-precondition', 'You cannot redeem your own code.');
  }

  if (!pending && !(await admin.database().ref(`users/${inviterUid}`).once('value')).exists()) {
    throw new HttpsError('not-found', 'Inviter account is unavailable.');
  }
  return settleInvite(admin.database(), uid, raw, inviterUid, INVITEE_REWARD, INVITER_REWARD);
});

// ──────────────────────── ensureInviteCode ────────────────────────

/**
 * Lazily mint a stable invite code for the caller. RTDB rules forbid the
 * client from writing this directly so every "show my invite code" path
 * funnels through here.
 */
exports.ensureInviteCode = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'ensureInviteCode', 30, 60 * 60 * 1000);

  const ref = admin.database().ref(`users/${uid}/inviteCode`);
  const snap = await ref.once('value');
  if (snap.exists()) return { code: snap.val() };

  let newCode = null;
  for (let i = 0; i < 5; i++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const indexRef = admin.database().ref(`inviteCodes/${code}`);
    const txn = await indexRef.transaction((cur) => (cur ? undefined : uid));
    if (txn.committed) {
      // Check if a legacy user already owned this code before the registry existed
      const legacyLookup = await admin
        .database()
        .ref('users')
        .orderByChild('inviteCode')
        .equalTo(code)
        .limitToFirst(1)
        .once('value');

      if (legacyLookup.exists()) {
        let legacyUid = null;
        legacyLookup.forEach((c) => { legacyUid = c.key; });
        if (legacyUid && legacyUid !== uid) {
          // This code belongs to a legacy user! Migrate it to the legacy owner so it's registered
          await indexRef.transaction((cur) => (cur === uid ? legacyUid : cur));
          // Retry generating a different code for the caller
          continue;
        }
      }

      newCode = code;
      break;
    }
  }

  if (!newCode) {
    throw new HttpsError('internal', 'Failed to generate a unique invite code. Please try again.');
  }

  const userTxn = await ref.transaction((cur) => (cur ? undefined : newCode));
  if (userTxn.committed) {
    return { code: newCode };
  } else {
    const existingCode = userTxn.snapshot.val();
    // If a concurrent call created a code first, release our orphaned reservation
    if (newCode && existingCode !== newCode) {
      try {
        await admin.database().ref(`inviteCodes/${newCode}`).transaction((cur) => {
          return cur === uid ? null : cur;
        });
      } catch (err) {
        console.warn(`Failed to clean up orphaned invite code ${newCode}:`, err);
      }
    }
    return { code: existingCode };
  }
});

// ──────────────────────── syncRevenueCat ────────────────────────

exports.syncRevenueCat = onCall(
  { secrets: [REVENUECAT_SECRET], cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    await rateLimit(uid, 'syncRevenueCat', 30, 60 * 60 * 1000);

    const secret = REVENUECAT_SECRET.value();
    if (!secret) {
      return { isPremium: false, isLifetime: false, credited: 0, skipped: true };
    }

    const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) {
      console.error('RC fetch failed', resp.status);
      throw new HttpsError('internal', `RevenueCat sync failed (${resp.status})`);
    }

    const data = await resp.json();
    // A successful HTTP status alone does not validate the upstream schema.
    // Preserve saved state if the response is incomplete or has changed shape.
    if (!isRecord(data?.subscriber) || !isRecord(data.subscriber.entitlements)
      || !isRecord(data.subscriber.non_subscriptions)) {
      throw new HttpsError('internal', 'Invalid purchase service response. Please retry.');
    }
    const subscriber = data.subscriber;
    const entitlements = subscriber.entitlements;
    const nonSubs = subscriber.non_subscriptions;

    const now = Date.now();
    const premiumEnt = entitlements[PREMIUM_ENTITLEMENT];
    const expiresMs = typeof premiumEnt?.expires_date === 'string'
      ? Date.parse(premiumEnt.expires_date) : NaN;
    const graceMs = typeof premiumEnt?.grace_period_expires_date === 'string'
      ? Date.parse(premiumEnt.grace_period_expires_date) : NaN;
    const isPremium = isRecord(premiumEnt)
      && typeof premiumEnt.product_identifier === 'string'
      && premiumEnt.product_identifier.length > 0
      && (premiumEnt.expires_date === null
        || (Number.isFinite(expiresMs) && (expiresMs > now || graceMs > now)));
    // A historical product key is not evidence of a currently valid lifetime
    // entitlement; missing expiry is also not the same as explicit null expiry.
    const isLifetime = isPremium && premiumEnt.expires_date === null
      && LIFETIME_PRODUCT_IDS.includes(premiumEnt.product_identifier);

    const processedRef = admin.database().ref(`users/${uid}/processedTransactions`);
    const processedSnap = await processedRef.once('value');
    const processedBefore = processedSnap.val() || {};

    let newlyCredited = 0;
    for (const [pid, items] of Object.entries(nonSubs)) {
      const stars = Object.hasOwn(STAR_PACKS, pid) ? STAR_PACKS[pid] : 0;
      if (!stars || !Array.isArray(items)) continue;
      for (const item of items) {
        const txid = item.id || item.store_transaction_id;
        if (!txid || processedBefore[txid]) continue;
        newlyCredited += stars;
      }
    }

    const userRef = admin.database().ref(`users/${uid}`);
    let actualCredited = 0;

    if (newlyCredited > 0) {
      const userTxn = await userRef.transaction((user) => {
        let u = user;
        if (!u) u = { wallet: { balance: 0, updatedAt: 0 }, processedTransactions: {} };
        
        u.processedTransactions = u.processedTransactions || {};
        u.wallet = u.wallet || { balance: 0, updatedAt: 0 };

        let txnCredited = 0;
        for (const [pid, items] of Object.entries(nonSubs)) {
          const stars = Object.hasOwn(STAR_PACKS, pid) ? STAR_PACKS[pid] : 0;
          if (!stars || !Array.isArray(items)) continue;
          for (const item of items) {
            const txid = item.id || item.store_transaction_id;
            if (!txid || u.processedTransactions[txid]) continue;

            u.processedTransactions[txid] = { productId: pid, stars, at: now };
            txnCredited += stars;
          }
        }

        if (txnCredited > 0) {
          u.wallet.balance += txnCredited;
          u.wallet.updatedAt = now;
        }
        
        u.isPremium = isPremium;
        u.isLifetime = isLifetime;
        u.entitlementUpdatedAt = now;

        actualCredited = txnCredited; // Track exactly what this execution attempt credited
        return u;
      });

      if (!userTxn.committed) {
        throw new HttpsError('internal', 'Transaction processing failed to commit. Please retry.');
      }
    } else {
      await userRef.update({
        isPremium,
        isLifetime,
        entitlementUpdatedAt: now,
      });
    }

    return { isPremium, isLifetime, credited: actualCredited };
  }
);

// ──────────────────────── searchUsers ────────────────────────

exports.searchUsers = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  await rateLimit(uid, 'searchUsers', 30, 60 * 1000);

  const query = String(request.data?.query || '').trim().toLowerCase();
  if (query.length < 2) return { results: [] };
  if (query.length > 32) throw new HttpsError('invalid-argument', 'Search must be at most 32 characters.');

  const snap = await admin
    .database()
    .ref('users')
    .orderByChild('usernameLower')
    .startAt(query)
    .endAt(query + '\uf8ff')
    .limitToFirst(20)
    .once('value');

  const results = [];
  snap.forEach((child) => {
    if (child.key === uid) return;
    const v = child.val() || {};
    results.push({
      id: child.key,
      username: v.username || '',
      avatarURL: v.avatarURL || undefined,
    });
  });
  return { results };
});

// ──────────────────────── sweepStaleRooms ────────────────────────

/**
 * Garbage-collect abandoned rooms. Replaces the destructive
 * `onDisconnect(roomRef).remove()` we used to hang off the host: a brief
 * host disconnect now leaves the room intact and either the host reconnects
 * or another player promotes via host migration. The sweeper only deletes
 * rooms that have actually gone silent past their TTL.
 */
async function sweepStaleRoomsLogic(db, now = Date.now()) {
  const roomsRef = db.ref('rooms');
  const snap = await roomsRef.once('value');
  if (!snap.exists()) return { removed: 0 };

  const updates = {};
  let removed = 0;
  snap.forEach((child) => {
    const room = child.val() || {};
    // Ensure we check all activity indicators: lastActivityAt, createdAt, and active turn updates
    const last = Math.max(
      typeof room.lastActivityAt === 'number' ? room.lastActivityAt : 0,
      typeof room.createdAt === 'number' ? room.createdAt : 0,
      typeof room.gameState?.lastUpdatedAt === 'number' ? room.gameState.lastUpdatedAt : 0
    );

    // If timestamp is completely absent or 0, do not delete prematurely unless explicitly marked closed
    if (last <= 0 && room.status !== 'closed') return;

    const status = room.status || 'waiting';
    let ttl = ROOM_TTL_WAITING_MS;
    if (status === 'playing') ttl = ROOM_TTL_PLAYING_MS;
    else if (status === 'closed') ttl = ROOM_TTL_CLOSED_MS;

    if (now - last > ttl) {
      updates[child.key] = null;
      removed++;
    }
  });

  // Batch updates in chunks of 500 for scale safety
  const updateKeys = Object.keys(updates);
  if (updateKeys.length > 0) {
    for (let i = 0; i < updateKeys.length; i += 500) {
      const chunk = {};
      for (const k of updateKeys.slice(i, i + 500)) {
        chunk[k] = null;
      }
      await roomsRef.update(chunk);
    }
  }

  const day = new Date(now).toISOString().split('T')[0];
  await db.ref(`metrics/sweeper/${day}`).transaction((v) => {
    const m = v || { runs: 0, removed: 0, lastRunAt: 0 };
    m.runs = (m.runs || 0) + 1;
    m.removed = (m.removed || 0) + removed;
    m.lastRunAt = now;
    return m;
  });

  console.log(`sweepStaleRooms: removed ${removed} room(s).`);
  return { removed };
}

exports.sweepStaleRoomsLogic = sweepStaleRoomsLogic;
exports.sweepStaleRooms = onSchedule('every 10 minutes', async () => {
  await sweepStaleRoomsLogic(admin.database(), Date.now());
});

// ──────────────────────── reportUser / blockUser / unblockUser ────────────────────────

const REPORT_REASONS = new Set([
  'harassment', 'hate_speech', 'sexual_content', 'spam',
  'cheating', 'underage', 'other',
]);

/**
 * Submit a UGC report against another user. App-Store-required moderation
 * surface for any social product. We dedupe by (reporter, target, day) so a
 * spammer cannot flood the queue against the same person, but multiple
 * distinct reporters CAN still pile on (signal we want to keep for review).
 */
exports.reportUser = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'reportUser', 10, 60 * 60 * 1000);

  const targetUid = String(request.data?.targetUid || '').trim();
  const reason = String(request.data?.reason || '');
  const context = String(request.data?.context || '').slice(0, 500);

  if (!validDatabaseId(targetUid) || targetUid === uid) {
    throw new HttpsError('invalid-argument', 'Invalid target.');
  }
  if (!REPORT_REASONS.has(reason)) {
    throw new HttpsError('invalid-argument', 'Invalid reason.');
  }

  const day = new Date().toISOString().split('T')[0];
  const dedupKey = `${uid}_${targetUid}_${day}`;
  const dedupRef = admin.database().ref(`reportsDedup/${dedupKey}`);
  const dedupResult = await dedupRef.transaction((cur) => (cur ? undefined : Date.now()));
  if (!dedupResult.committed) {
    return { ok: true, deduplicated: true };
  }

  await admin.database().ref('reports').push({
    reporterUid: uid,
    targetUid,
    reason,
    context,
    at: Date.now(),
    status: 'pending',
  });

  // Bump per-target counter for the admin dashboard.
  await admin.database().ref(`reportCounts/${targetUid}`).transaction((c) => (c || 0) + 1);

  return { ok: true };
});

exports.blockUser = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'blockUser', 60, 60 * 60 * 1000);

  const targetUid = String(request.data?.targetUid || '').trim();
  if (!validDatabaseId(targetUid) || targetUid === uid) {
    throw new HttpsError('invalid-argument', 'Invalid target.');
  }

  const updates = {};
  updates[`blockedUsers/${uid}/${targetUid}`] = { at: Date.now() };
  // Tear down any existing friendship from both sides.
  updates[`friendships/${uid}/${targetUid}`] = null;
  updates[`friendships/${targetUid}/${uid}`] = null;
  await admin.database().ref().update(updates);
  return { ok: true };
});

exports.unblockUser = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'unblockUser', 60, 60 * 60 * 1000);
  const targetUid = String(request.data?.targetUid || '').trim();
  if (!validDatabaseId(targetUid)) throw new HttpsError('invalid-argument', 'Invalid target.');
  await admin.database().ref(`blockedUsers/${uid}/${targetUid}`).remove();
  return { ok: true };
});

// ──────────────────────── deleteAccount ────────────────────────

/**
 * Self-service account deletion (App Store requirement § 5.1.1(v)).
 *
 * Wipes every user-owned RTDB/Firestore footprint we can identify, revokes
 * all auth sessions, and finally deletes the auth record. The client signs
 * out and clears local state once this resolves.
 *
 * NOTE: anything we don't enumerate here (e.g. future paths) survives the
 * deletion. Keep this list in sync with the rules schema.
 */
exports.deleteAccount = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'deleteAccount', 3, 24 * 60 * 60 * 1000);

  const db = admin.database();

  // 1. Tear down friendship edges from both sides.
  const friendshipsSnap = await db.ref(`friendships/${uid}`).once('value');
  const friendUpdates = {};
  if (friendshipsSnap.exists()) {
    for (const fid of Object.keys(friendshipsSnap.val() || {})) {
      friendUpdates[`friendships/${fid}/${uid}`] = null;
    }
  }
  friendUpdates[`friendships/${uid}`] = null;

  // 2. Cancel friend requests touching this user.
  const reqsSnap = await db.ref('friendRequests').once('value');
  if (reqsSnap.exists()) {
    const reqs = reqsSnap.val() || {};
    for (const [rid, r] of Object.entries(reqs)) {
      if (r && (r.fromUserId === uid || r.toUserId === uid)) {
        friendUpdates[`friendRequests/${rid}`] = null;
      }
    }
  }

  // 3. Drop blockedUsers (both sides).
  friendUpdates[`blockedUsers/${uid}`] = null;
  const blockedBySnap = await db.ref('blockedUsers').once('value');
  if (blockedBySnap.exists()) {
    const all = blockedBySnap.val() || {};
    for (const [actor, list] of Object.entries(all)) {
      if (list && typeof list === 'object' && list[uid]) {
        friendUpdates[`blockedUsers/${actor}/${uid}`] = null;
      }
    }
  }

  // 4. Wipe presence + invite ownership + user rate limits.
  friendUpdates[`presence/${uid}`] = null;
  friendUpdates[`crashLogs/${uid}`] = null;
  friendUpdates[`rateLimits/searchUsers/${uid}`] = null;
  friendUpdates[`rateLimits/redeemInvite/${uid}`] = null;
  friendUpdates[`rateLimits/reportUser/${uid}`] = null;
  friendUpdates[`rateLimits/blockUser/${uid}`] = null;
  friendUpdates[`rateLimits/deleteAccount/${uid}`] = null;
  friendUpdates[`rateLimits/recordHostMigration/${uid}`] = null;
  friendUpdates[`rateLimits/claimDailyReward/${uid}`] = null;
  friendUpdates[`rateLimits/ensureInviteCode/${uid}`] = null;
  friendUpdates[`rateLimits/syncRevenueCat/${uid}`] = null;
  friendUpdates[`rateLimits/unblockUser/${uid}`] = null;
  friendUpdates[`rateLimits/bootstrapFirstAdmin/${uid}`] = null;

  // 5. Drop hosted rooms — guests get bounced cleanly via the existing
  //    closed/sweeper flow.
  const roomsSnap = await db.ref('rooms').once('value');
  if (roomsSnap.exists()) {
    const rooms = roomsSnap.val() || {};
    for (const [code, room] of Object.entries(rooms)) {
      if (!room) continue;
      if (room.hostId === uid) {
        friendUpdates[`rooms/${code}`] = null;
      } else if (room.players && room.players[uid]) {
        friendUpdates[`rooms/${code}/players/${uid}`] = null;
        friendUpdates[`rooms/${code}/presence/${uid}`] = null;
      }
    }
  }

  // 6. Clean up invite registry (ownership-safe: remove only if owned by this uid) and delete user node last.
  const userSnap = await db.ref(`users/${uid}`).once('value');
  const userData = userSnap.val() || {};
  if (userData.inviteCode) {
    try {
      await db.ref(`inviteCodes/${userData.inviteCode}`).transaction((cur) => {
        return cur === uid ? null : cur;
      });
    } catch (err) {
      console.warn('Failed ownership-safe inviteCode cleanup in deleteAccount:', err);
    }
  }
  friendUpdates[`users/${uid}`] = null;

  await db.ref().update(friendUpdates);

  // 7. Delete the entire Firestore subtree, including histories larger than one
  // write batch. Keep the auth account available for retry if deletion fails.
  const firestore = admin.firestore();
  await firestore.recursiveDelete(firestore.collection('users').doc(uid));

  // 8. Revoke all sessions and delete the auth record.
  try { await admin.auth().revokeRefreshTokens(uid); } catch {}
  try { await admin.auth().deleteUser(uid); } catch (e) {
    // If the user was already deleted (rare race) treat as success.
    if (e?.code !== 'auth/user-not-found') throw e;
  }

  return { ok: true };
});

// ──────────────────────── bootstrapFirstAdmin ────────────────────────

/**
 * One-shot bootstrap for the first admin user.
 *
 * Security model:
 *   - Caller must be authenticated.
 *   - Caller must present the BOOTSTRAP_ADMIN_TOKEN secret value.
 *   - `meta/bootstrap/firstAdminUid` is a transactional gate: once written it
 *     is never overwritten, so this callable becomes a permanent no-op after
 *     the first successful run.
 *   - On success the caller gets `admin: true` custom claim and
 *     `users/$uid/isAdmin = true` (read by the admin website).
 *
 * After bootstrap, destroy the secret to disable the function entirely:
 *   firebase functions:secrets:destroy BOOTSTRAP_ADMIN_TOKEN
 */
exports.bootstrapFirstAdmin = onCall(
  { secrets: [BOOTSTRAP_ADMIN_TOKEN], cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    await rateLimit(uid, 'bootstrapFirstAdmin', 5, 60 * 60 * 1000);

    const provided = (request.data || {}).token;
    let expected = '';
    try { expected = BOOTSTRAP_ADMIN_TOKEN.value(); } catch { expected = ''; }
    if (!expected) {
      throw new HttpsError(
        'failed-precondition',
        'Bootstrap is disabled (no token configured).'
      );
    }
    if (typeof provided !== 'string' || provided.length < 16 || provided !== expected) {
      throw new HttpsError('permission-denied', 'Invalid bootstrap token.');
    }

    const gateRef = admin.database().ref('meta/bootstrap/firstAdminUid');
    const txn = await gateRef.transaction((cur) => (cur ? undefined : uid));
    if (!txn.committed || txn.snapshot.val() !== uid) {
      throw new HttpsError(
        'already-exists',
        'First admin already bootstrapped. This function is now disabled.'
      );
    }

    await admin.auth().setCustomUserClaims(uid, { admin: true });
    await admin.database().ref(`users/${uid}/isAdmin`).set(true);
    await admin.database().ref('adminAuditLog').push({
      action: 'bootstrapFirstAdmin',
      uid,
      ts: admin.database.ServerValue.TIMESTAMP,
    });

    return {
      ok: true,
      uid,
      note: 'Sign out and back in for the admin claim to refresh on clients.',
    };
  }
);
