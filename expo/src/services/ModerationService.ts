/**
 * ModerationService — client wrapper for UGC report/block Cloud Functions.
 *
 * - reportUser(targetUid, reason, context?)  → callable `reportUser`
 * - blockUser(targetUid)                     → callable `blockUser`
 * - unblockUser(targetUid)                   → callable `unblockUser`
 * - listBlocked()                            → reads /blockedUsers/$me locally
 *
 * All mutations go through Cloud Functions so abuse, dedup, and admin
 * notification stay server-authoritative. Clients NEVER write to
 * /reports or /blockedUsers directly (RTDB rules forbid it).
 */

import { httpsCallable } from 'firebase/functions';
import { ref, get } from 'firebase/database';
import { auth, rtdb, functions } from '../lib/firebase';
import { Observability } from './Observability';

export type ReportReason =
  | 'harassment'
  | 'hate_speech'
  | 'sexual_content'
  | 'spam'
  | 'cheating'
  | 'underage'
  | 'other';

export const ReportReasonLabels: Record<ReportReason, string> = {
  harassment: 'Harassment or bullying',
  hate_speech: 'Hate speech',
  sexual_content: 'Sexual or explicit content',
  spam: 'Spam or scam',
  cheating: 'Cheating or exploits',
  underage: 'Suspected underage user',
  other: 'Something else',
};

class ModerationServiceImpl {
  async reportUser(targetUid: string, reason: ReportReason, context?: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required to report users.');
    if (uid === targetUid) throw new Error('You cannot report yourself.');

    try {
      const fn = httpsCallable<
        { targetUid: string; reason: ReportReason; context?: string },
        { ok: boolean }
      >(functions, 'reportUser');
      await fn({ targetUid, reason, context: (context || '').slice(0, 500) });
    } catch (e) {
      Observability.recordError(e, { source: 'reportUser', targetUid });
      throw e;
    }
  }

  async blockUser(targetUid: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required to block users.');
    if (uid === targetUid) throw new Error('You cannot block yourself.');
    try {
      const fn = httpsCallable<{ targetUid: string }, { ok: boolean }>(functions, 'blockUser');
      await fn({ targetUid });
    } catch (e) {
      Observability.recordError(e, { source: 'blockUser', targetUid });
      throw e;
    }
  }

  async unblockUser(targetUid: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('Sign-in required.');
    try {
      const fn = httpsCallable<{ targetUid: string }, { ok: boolean }>(functions, 'unblockUser');
      await fn({ targetUid });
    } catch (e) {
      Observability.recordError(e, { source: 'unblockUser', targetUid });
      throw e;
    }
  }

  async listBlocked(): Promise<string[]> {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    try {
      const snap = await get(ref(rtdb, `blockedUsers/${uid}`));
      if (!snap.exists()) return [];
      return Object.keys(snap.val() || {});
    } catch {
      return [];
    }
  }
}

export const moderationService = new ModerationServiceImpl();
