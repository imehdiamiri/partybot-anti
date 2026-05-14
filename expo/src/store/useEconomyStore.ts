import { create } from 'zustand';
import { rtdb, functions } from '../lib/firebase';
import { ref, onValue, off } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { showToast } from '../components/ToastOverlay';

/**
 * useEconomyStore — single source of truth for the user wallet and
 * subscription entitlement. State is read live from Firebase RTDB; all
 * mutations go through Cloud Functions so the client cannot tamper with
 * the wallet (RTDB rules forbid client writes to users/$uid/wallet and
 * users/$uid/isPremium).
 *
 * Bridged to RevenueCat via usePaywallStore — the paywall calls
 * `syncEntitlement(uid)` after configure / purchase / restore which in
 * turn invokes the Cloud Function that mirrors the RC subscriber state
 * onto Firebase.
 */

type GameUnlockStatus = 'free' | 'subscriberUnlocked' | 'trialUsed';

interface EconomyState {
  starsBalance: number;
  isPremium: boolean;
  isLifetime: boolean;
  lastDailyClaim: string | null;
  isProcessingWalletAction: boolean;
  isHydrated: boolean;

  // Lifecycle
  attach: (uid: string) => void;
  detach: () => void;

  // Actions (all server-side via Cloud Functions)
  claimDailyReward: () => Promise<void>;
  syncEntitlement: () => Promise<{ isPremium: boolean; isLifetime: boolean; credited: number } | null>;

  // Helpers
  unlockStatus: (gameId: string, isPremiumGame: boolean) => GameUnlockStatus;
  canClaimDailyToday: () => boolean;
}

let attachedUid: string | null = null;
let unsubscribe: (() => void) | null = null;

export const useEconomyStore = create<EconomyState>()((set, get) => ({
  starsBalance: 0,
  isPremium: false,
  isLifetime: false,
  lastDailyClaim: null,
  isProcessingWalletAction: false,
  isHydrated: false,

  attach: (uid: string) => {
    if (attachedUid === uid) return;
    get().detach();
    attachedUid = uid;

    const userRef = ref(rtdb, `users/${uid}`);
    const handler = onValue(
      userRef,
      (snap) => {
        const v = snap.val() || {};
        const wallet = v.wallet || {};
        set({
          starsBalance: typeof wallet.balance === 'number' ? wallet.balance : 0,
          lastDailyClaim: wallet.lastDailyClaim || null,
          isPremium: !!v.isPremium,
          isLifetime: !!v.isLifetime,
          isHydrated: true,
        });
      },
      (err) => {
        console.warn('Economy: live listener error', err.message);
        set({ isHydrated: true });
      }
    );

    unsubscribe = () => off(userRef, 'value', handler as any);
  },

  detach: () => {
    if (unsubscribe) {
      try { unsubscribe(); } catch {}
      unsubscribe = null;
    }
    attachedUid = null;
    set({
      starsBalance: 0,
      isPremium: false,
      isLifetime: false,
      lastDailyClaim: null,
      isHydrated: false,
    });
  },

  claimDailyReward: async () => {
    if (get().isProcessingWalletAction) return;
    if (!get().canClaimDailyToday()) {
      showToast.info('Already claimed — come back tomorrow.');
      return;
    }
    set({ isProcessingWalletAction: true });
    try {
      const fn = httpsCallable<{}, { granted: number; balance: number; lastDailyClaim: string }>(
        functions,
        'claimDailyReward'
      );
      const res = await fn({});
      // The realtime listener will reconcile the balance, but optimistically
      // surface the toast immediately.
      showToast.success(`+${res.data.granted} Stars — Daily reward claimed.`);
    } catch (e: any) {
      const msg = e?.message || 'Could not claim daily reward.';
      if (/already claimed/i.test(msg)) {
        showToast.info('Already claimed — come back tomorrow.');
      } else {
        showToast.error(msg);
      }
    } finally {
      set({ isProcessingWalletAction: false });
    }
  },

  syncEntitlement: async () => {
    try {
      const fn = httpsCallable<{}, { isPremium: boolean; isLifetime: boolean; credited: number; skipped?: boolean }>(
        functions,
        'syncRevenueCat'
      );
      const res = await fn({});
      if (res.data?.credited > 0) {
        showToast.success(`+${res.data.credited} Stars added to your wallet.`);
      }
      return res.data;
    } catch (e: any) {
      console.warn('Economy: syncEntitlement failed', e?.message);
      return null;
    }
  },

  unlockStatus: (_gameId: string, isPremiumGame: boolean): GameUnlockStatus => {
    if (!isPremiumGame) return 'free';
    return get().isPremium ? 'subscriberUnlocked' : 'trialUsed';
  },

  canClaimDailyToday: () => {
    const today = new Date().toISOString().split('T')[0];
    return get().lastDailyClaim !== today;
  },
}));

/** Cost in Stars to generate one AI card, based on entitlement. */
export function aiCardCost(isPremium: boolean): number {
  return isPremium ? 1 : 5;
}
