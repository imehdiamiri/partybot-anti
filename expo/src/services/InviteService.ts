import { rtdb as database, auth, functions } from '../lib/firebase';
import { ref, get } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';

/**
 * InviteService — thin client wrapper around the server-authoritative invite
 * Cloud Functions.
 *
 * All wallet credit + idempotency lives in `functions/index.js`:
 *   - `ensureInviteCode`   — lazily mints (and caches) the user's invite code.
 *   - `redeemInvite`       — atomically credits both sides exactly once.
 *
 * The client used to do the credit math itself, which the RTDB rules now
 * (correctly) reject. Don't re-introduce direct wallet writes here.
 */
export class InviteService {
  static async getMyInviteCode(): Promise<string> {
    const uid = auth.currentUser?.uid;
    if (!uid) return '';

    // Read directly first — fastest path when the code already exists.
    const snap = await get(ref(database, `users/${uid}/inviteCode`));
    if (snap.exists()) return String(snap.val() || '');

    // Otherwise mint via Cloud Function (the only writer for inviteCode).
    try {
      const fn = httpsCallable<{}, { code: string }>(functions, 'ensureInviteCode');
      const res = await fn({});
      return res.data?.code || '';
    } catch (e) {
      console.warn('InviteService: ensureInviteCode failed', (e as Error)?.message);
      return '';
    }
  }

  static async getInviteStats(): Promise<{ totalInvites: number; starsEarned: number }> {
    const uid = auth.currentUser?.uid;
    if (!uid) return { totalInvites: 0, starsEarned: 0 };

    const snap = await get(ref(database, `users/${uid}/inviteStats`));
    const v = snap.val() || {};
    return {
      totalInvites: v.totalInvites || 0,
      starsEarned: v.starsEarned || 0,
    };
  }

  static async redeemCode(code: string): Promise<boolean> {
    const uid = auth.currentUser?.uid;
    if (!uid || !code.trim()) throw new Error('Invalid input');

    const fn = httpsCallable<{ code: string }, { credited: number }>(
      functions,
      'redeemInvite'
    );
    await fn({ code: code.trim().toUpperCase() });
    return true;
  }
}
