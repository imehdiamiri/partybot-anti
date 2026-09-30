const { randomUUID } = require('node:crypto');
const { HttpsError } = require('firebase-functions/v2/https');

function resumableClaim(user, code) {
  const claim = user?.inviteReward;
  return claim?.version === 1 && claim.code === code
    && claim.inviterUid === user.invitedBy
    && typeof claim.receiptId === 'string'
    && /^[a-f0-9-]{36}$/.test(claim.receiptId)
    && ['pending', 'complete'].includes(claim.status) ? claim : null;
}

function increment(value, amount) {
  const number = value ?? 0;
  if (!Number.isSafeInteger(number) || number < 0 || !Number.isSafeInteger(number + amount)) {
    throw new HttpsError('internal', 'Invalid reward balance. Contact support.');
  }
  return number + amount;
}

function record(value) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpsError('internal', 'Invalid reward record. Contact support.');
  }
  return value;
}

async function transact(ref, update) {
  let validationError;
  // Do not expose speculative null/payment values to concurrent reads on the
  // shared Admin SDK connection while the server resolves transaction retries.
  const result = await ref.transaction(value => {
    validationError = undefined;
    try { return update(value); } catch (error) {
      // Retried callbacks can run asynchronously inside the SDK. Abort first
      // and reject outside the callback instead of leaving its promise hanging.
      validationError = error;
      return undefined;
    }
  }, undefined, false);
  if (validationError) throw validationError;
  return result;
}

// Each user's monetary change commits with its own receipt. The two users are
// deliberately not in a root transaction that reads/locks the entire user tree.
async function settleInvite(db, uid, code, inviterUid, inviteeReward, inviterReward) {
  const userRef = db.ref(`users/${uid}`);
  const receiptId = randomUUID();
  const now = Date.now();
  const reserved = await transact(userRef, user => {
    const u = record(user);
    if (u.invitedBy || u.inviteReward) return;
    u.wallet = record(u.wallet);
    u.wallet.balance = increment(u.wallet.balance, inviteeReward);
    u.wallet.updatedAt = now;
    u.invitedBy = inviterUid;
    u.inviteReward = { version: 1, code, inviterUid, receiptId, status: 'pending', at: now };
    return u;
  });
  const claim = resumableClaim(reserved.snapshot.val(), code);
  if (!claim) throw new HttpsError('failed-precondition', 'You already redeemed an invite code.');
  const credited = reserved.committed ? inviteeReward : 0;
  if (claim.status === 'complete') return { credited, inviterCredited: 0 };

  // Use the winning reservation, never a newly reassigned public invite code.
  const inviterRef = db.ref(`users/${claim.inviterUid}`);
  const payment = await transact(inviterRef, user => {
    // null may mean an empty SDK cache. Returning null forces a server hash
    // comparison/retry without creating a profile if the account is truly gone.
    if (!user) return null;
    const receipts = record(user.inviteRewardReceipts);
    if (Object.hasOwn(receipts, claim.receiptId)) return;
    user.wallet = record(user.wallet);
    user.wallet.balance = increment(user.wallet.balance, inviterReward);
    user.wallet.updatedAt = now;
    user.inviteStats = record(user.inviteStats);
    user.inviteStats.totalInvites = increment(user.inviteStats.totalInvites, 1);
    user.inviteStats.starsEarned = increment(user.inviteStats.starsEarned, inviterReward);
    // No invitee identity is retained in the inviter's deduplication receipt.
    receipts[claim.receiptId] = { amount: inviterReward, at: now };
    user.inviteRewardReceipts = receipts;
    return user;
  });
  const paidReceipt = payment.snapshot.val()?.inviteRewardReceipts?.[claim.receiptId];
  if (paidReceipt?.amount !== inviterReward) {
    throw new HttpsError('failed-precondition', 'Inviter account is unavailable. Contact support.');
  }

  const completed = await transact(userRef, user => {
    if (!user) return null;
    const saved = resumableClaim(user, code);
    // A callback can start with an incomplete local cache even after reservation.
    // A no-op value forces server hash validation; aborting here would mistake
    // stale cache for a missing account during concurrent retries.
    if (!saved || saved.receiptId !== claim.receiptId) return user;
    user.inviteReward.status = 'complete';
    return user;
  });
  const finalClaim = resumableClaim(completed.snapshot.val(), code);
  if (!completed.committed || finalClaim?.receiptId !== claim.receiptId || finalClaim?.status !== 'complete') {
    throw new HttpsError('failed-precondition', 'Invite account is unavailable.');
  }
  return { credited, inviterCredited: payment.committed ? inviterReward : 0 };
}

module.exports = { resumableClaim, settleInvite };
