/**
 * Firebase Cloud Functions — PartyBot secure backend layer.
 *
 * Functions:
 *   - generateCard:    Proxy to Gemini for AI card generation.
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
 * Set the Gemini key (one-time):
 *   firebase functions:secrets:set GEMINI_API_KEY
 *   firebase functions:secrets:set REVENUECAT_SECRET
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const REVENUECAT_SECRET = defineSecret('REVENUECAT_SECRET');
const BOOTSTRAP_ADMIN_TOKEN = defineSecret('BOOTSTRAP_ADMIN_TOKEN');
const GEMINI_MODEL = 'gemini-2.0-flash';
const FREE_DAILY_LIMIT = 5;
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

// ──────────────────────── Rate Limit ────────────────────────

async function bumpAndCheckUsage(uid, isPremium) {
  if (isPremium) return;
  const today = new Date().toISOString().split('T')[0];
  const ref = admin.database().ref(`aiUsage/${uid}/${today}`);
  const snap = await ref.transaction((v) => (v || 0) + 1);
  const used = snap.snapshot.val() || 0;
  if (used > FREE_DAILY_LIMIT) {
    throw new HttpsError(
      'resource-exhausted',
      `Daily limit reached (${FREE_DAILY_LIMIT} cards). Upgrade to Premium for unlimited.`
    );
  }
}

// ──────────────────────── generateCard ────────────────────────

exports.generateCard = onCall(
  { secrets: [GEMINI_API_KEY], cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
    // Per-user burst protection separate from the daily AI quota: stops a
    // misbehaving client (or compromised token) from spinning up Gemini calls.
    await rateLimit(uid, 'generateCard', 30, 60 * 1000);

    const { system, user } = request.data || {};
    if (typeof system !== 'string' || typeof user !== 'string') {
      throw new HttpsError('invalid-argument', 'system and user prompts are required.');
    }
    if (system.length > 4000 || user.length > 2000) {
      throw new HttpsError('invalid-argument', 'Prompt too large.');
    }
    if (!isSafe(user)) {
      throw new HttpsError('failed-precondition', 'Prompt failed moderation.');
    }

    const userSnap = await admin.database().ref(`users/${uid}`).once('value');
    const isPremium = !!userSnap.val()?.isPremium;
    await bumpAndCheckUsage(uid, isPremium);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY.value()}`;
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 256 },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error('Gemini error', resp.status, body);
      throw new HttpsError('internal', `Gemini request failed (${resp.status})`);
    }

    const data = await resp.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new HttpsError('internal', 'Empty Gemini response');

    const flagged = !isSafe(text);

    // Moderation queue — every generated card lands here for admin review.
    // Server-only writes (closed to clients via rules); admins page can paginate it.
    try {
      await admin.database().ref('aiModerationLog').push({
        uid,
        prompt: user.slice(0, 500),
        text: text.slice(0, 1000),
        flagged,
        at: Date.now(),
      });
    } catch (e) {
      console.warn('aiModerationLog write failed', e);
    }

    if (flagged) {
      throw new HttpsError('failed-precondition', 'Generated content failed moderation.');
    }

    return { text };
  }
);

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
  const roomCode = String(request.data?.roomCode || '').slice(0, 12);
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
 * Atomicity: each side is bumped via a `wallet` transaction so concurrent
 * redemptions can't lose updates. Idempotency: invitee's `invitedBy` field
 * is rules-protected (server-only) so it can only be set here, and it's the
 * gate that prevents double-claims.
 */
exports.redeemInvite = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  await rateLimit(uid, 'redeemInvite', 5, 60 * 60 * 1000);

  const raw = String(request.data?.code || '').trim().toUpperCase();
  if (!raw || raw.length < 4 || raw.length > 12) {
    throw new HttpsError('invalid-argument', 'Invalid invite code.');
  }

  // Already redeemed?
  const invitedBySnap = await admin.database().ref(`users/${uid}/invitedBy`).once('value');
  if (invitedBySnap.exists()) {
    throw new HttpsError('failed-precondition', 'You already redeemed an invite code.');
  }

  // Find inviter by indexed code.
  const lookup = await admin
    .database()
    .ref('users')
    .orderByChild('inviteCode')
    .equalTo(raw)
    .limitToFirst(1)
    .once('value');

  if (!lookup.exists()) {
    throw new HttpsError('not-found', 'Invalid invite code.');
  }

  let inviterUid = null;
  lookup.forEach((c) => { inviterUid = c.key; });
  if (!inviterUid || inviterUid === uid) {
    throw new HttpsError('failed-precondition', 'You cannot redeem your own code.');
  }

  const now = Date.now();

  // 1. Mark invitee — this is the single point of idempotency.
  const inviteeMark = await admin
    .database()
    .ref(`users/${uid}/invitedBy`)
    .transaction((cur) => (cur ? undefined : inviterUid));
  if (!inviteeMark.committed) {
    throw new HttpsError('failed-precondition', 'You already redeemed an invite code.');
  }

  // 2. Credit invitee.
  await admin.database().ref(`users/${uid}/wallet`).transaction((w) => {
    const wallet = w || { balance: 0, updatedAt: 0 };
    wallet.balance = (wallet.balance || 0) + INVITEE_REWARD;
    wallet.updatedAt = now;
    return wallet;
  });

  // 3. Credit inviter + bump stats.
  await admin.database().ref(`users/${inviterUid}/wallet`).transaction((w) => {
    const wallet = w || { balance: 0, updatedAt: 0 };
    wallet.balance = (wallet.balance || 0) + INVITER_REWARD;
    wallet.updatedAt = now;
    return wallet;
  });
  await admin.database().ref(`users/${inviterUid}/inviteStats`).transaction((s) => {
    const stats = s || { totalInvites: 0, starsEarned: 0 };
    stats.totalInvites = (stats.totalInvites || 0) + 1;
    stats.starsEarned = (stats.starsEarned || 0) + INVITER_REWARD;
    return stats;
  });

  return { credited: INVITEE_REWARD, inviterCredited: INVITER_REWARD };
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

  // 6-char base36 — collision odds are negligible at our scale; if we ever
  // worry, retry on collision via transaction.
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  await ref.set(code);
  return { code };
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

    const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${uid}`, {
      headers: { Authorization: `Bearer ${secret}`, Accept: 'application/json' },
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error('RC fetch failed', resp.status, body);
      throw new HttpsError('internal', `RevenueCat sync failed (${resp.status})`);
    }

    const data = await resp.json();
    const subscriber = data.subscriber || {};
    const entitlements = subscriber.entitlements || {};
    const nonSubs = subscriber.non_subscriptions || {};

    const now = Date.now();
    const premiumEnt = entitlements[PREMIUM_ENTITLEMENT];
    const expiresMs = premiumEnt?.expires_date
      ? Date.parse(premiumEnt.expires_date)
      : null;
    const isPremium = !!premiumEnt && (expiresMs === null || expiresMs > now);
    const isLifetime =
      !!premiumEnt && expiresMs === null
        ? true
        : Object.keys(nonSubs).some((pid) => LIFETIME_PRODUCT_IDS.includes(pid));

    const processedRef = admin.database().ref(`users/${uid}/processedTransactions`);
    const processedSnap = await processedRef.once('value');
    const processed = processedSnap.val() || {};

    let credited = 0;
    const updates = {};
    for (const [pid, items] of Object.entries(nonSubs)) {
      const stars = STAR_PACKS[pid];
      if (!stars || !Array.isArray(items)) continue;
      for (const item of items) {
        const txid = item.id || item.store_transaction_id;
        if (!txid || processed[txid]) continue;
        credited += stars;
        updates[txid] = { productId: pid, stars, at: now };
      }
    }

    if (credited > 0) {
      const walletRef = admin.database().ref(`users/${uid}/wallet`);
      await walletRef.transaction((current) => {
        const wallet = current || { balance: 0, updatedAt: 0 };
        wallet.balance = (wallet.balance || 0) + credited;
        wallet.updatedAt = now;
        return wallet;
      });
      await processedRef.update(updates);
    }

    await admin.database().ref(`users/${uid}`).update({
      isPremium,
      isLifetime,
      entitlementUpdatedAt: now,
    });

    return { isPremium, isLifetime, credited };
  }
);

// ──────────────────────── searchUsers ────────────────────────

exports.searchUsers = onCall({ cors: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');

  await rateLimit(uid, 'searchUsers', 30, 60 * 1000);

  const query = String(request.data?.query || '').trim().toLowerCase();
  if (query.length < 2) return { results: [] };

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
exports.sweepStaleRooms = onSchedule('every 10 minutes', async () => {
  const now = Date.now();
  const roomsRef = admin.database().ref('rooms');
  const snap = await roomsRef.once('value');
  if (!snap.exists()) return;

  const updates = {};
  let removed = 0;
  snap.forEach((child) => {
    const room = child.val() || {};
    const last = room.lastActivityAt || room.createdAt || 0;
    const status = room.status || 'waiting';

    let ttl = ROOM_TTL_WAITING_MS;
    if (status === 'playing') ttl = ROOM_TTL_PLAYING_MS;
    else if (status === 'closed') ttl = ROOM_TTL_CLOSED_MS;

    if (now - last > ttl) {
      updates[child.key] = null;
      removed++;
    }
  });

  if (Object.keys(updates).length > 0) {
    await roomsRef.update(updates);
  }

  const day = new Date().toISOString().split('T')[0];
  await admin.database().ref(`metrics/sweeper/${day}`).transaction((v) => {
    const m = v || { runs: 0, removed: 0, lastRunAt: 0 };
    m.runs = (m.runs || 0) + 1;
    m.removed = (m.removed || 0) + removed;
    m.lastRunAt = now;
    return m;
  });

  console.log(`sweepStaleRooms: removed ${removed} room(s).`);
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

  if (!targetUid || targetUid === uid) {
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
  if (!targetUid || targetUid === uid) {
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
  if (!targetUid) throw new HttpsError('invalid-argument', 'Invalid target.');
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

  // 4. Wipe presence + AI usage history + invite ownership.
  friendUpdates[`presence/${uid}`] = null;
  friendUpdates[`aiUsage/${uid}`] = null;
  friendUpdates[`crashLogs/${uid}`] = null;
  friendUpdates[`rateLimits/searchUsers/${uid}`] = null;
  friendUpdates[`rateLimits/redeemInvite/${uid}`] = null;
  friendUpdates[`rateLimits/reportUser/${uid}`] = null;
  friendUpdates[`rateLimits/blockUser/${uid}`] = null;
  friendUpdates[`rateLimits/deleteAccount/${uid}`] = null;

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

  // 6. Delete the user node last so other paths can be enumerated first.
  friendUpdates[`users/${uid}`] = null;

  await db.ref().update(friendUpdates);

  // 7. Firestore mirror.
  try { await admin.firestore().collection('users').doc(uid).delete(); } catch {}

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
