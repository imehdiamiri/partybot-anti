import { create } from 'zustand';
import type { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useEconomyStore } from './useEconomyStore';
import { isWeb } from '../utils/platform';
import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export type { PurchasesPackage, CustomerInfo };

let Purchases: any = null;
if (!isWeb && !isExpoGo) {
  try {
    const rc = require('react-native-purchases');
    Purchases = rc.default || rc;
  } catch {}
}

/**
 * usePaywallStore — RevenueCat surface for the storefront UI.
 *
 * Single source of truth for premium/stars lives in useEconomyStore. After
 * any RC event (configure, purchase, restore, customer-info update) we call
 * `syncEntitlement()` which pulls the authoritative subscriber state from
 * RC server-side and mirrors it onto Firebase. The realtime listener in
 * useEconomyStore then propagates the new wallet/entitlement to the UI.
 *
 * On Web, RevenueCat is completely bypassed in favor of deliberate local-first play.
 */

interface PaywallState {
  isLoading: boolean;
  isPurchasing: boolean;
  error: string | null;
  packages: PurchasesPackage[];
  isConfigured: boolean;

  configure: (uid: string) => Promise<void>;
  logOut: () => Promise<void>;
  fetchOfferings: () => Promise<void>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  clearError: () => void;

  getSubscriptionPackages: () => PurchasesPackage[];
  getLifetimePackage: () => PurchasesPackage | undefined;
  getStarPackages: () => PurchasesPackage[];
  getDonationPackages: () => PurchasesPackage[];
}

const API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

let isSdkConfigured = false;
let currentConfiguredUid: string | null = null;
let activeGeneration = 0;
let removeListener: (() => void) | null = null;
let identityQueue: Promise<void> = Promise.resolve();

function enqueueIdentityOp<T>(op: () => Promise<T>): Promise<T> {
  const result = identityQueue.then(op, op);
  identityQueue = result.then(
    () => {},
    () => {}
  );
  return result;
}

function hasApiKey(): boolean {
  if (isWeb || isExpoGo || !Purchases) return false;
  if (Platform.OS === 'ios') return !!API_KEY_IOS;
  if (Platform.OS === 'android') return !!API_KEY_ANDROID;
  return false;
}

export const usePaywallStore = create<PaywallState>((set, get) => ({
  isLoading: false,
  isPurchasing: false,
  error: null,
  packages: [],
  isConfigured: false,

  configure: async (uid: string) => {
    if (!hasApiKey()) {
      // Dev / web — no IAP available. Leave the store dormant; the economy
      // store still drives free-tier behaviour.
      set({ isConfigured: false });
      return;
    }
    if (currentConfiguredUid === uid) return;

    const gen = ++activeGeneration;
    set({ isLoading: true, error: null });

    try {
      const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;

      await enqueueIdentityOp(async () => {
        if (!isSdkConfigured) {
          Purchases.configure({ apiKey, appUserID: uid });
          isSdkConfigured = true;
        } else {
          // Already initialized in this process — transition identity cleanly via logIn.
          await Purchases.logIn(uid);
        }
      });

      if (gen !== activeGeneration) return;

      currentConfiguredUid = uid;

      // Mirror any subsequent customer-info updates back to Firebase.
      removeListener?.();
      const handler = (_info: CustomerInfo) => {
        if (gen === activeGeneration) {
          useEconomyStore.getState().syncEntitlement();
        }
      };
      Purchases.addCustomerInfoUpdateListener(handler);
      removeListener = () => {
        try { Purchases.removeCustomerInfoUpdateListener(handler); } catch {}
      };

      // Pull authoritative state once for this identity.
      await useEconomyStore.getState().syncEntitlement();
      if (gen !== activeGeneration) return;

      await get().fetchOfferings();
      if (gen !== activeGeneration) return;

      set({ isConfigured: true });
    } catch (e: any) {
      if (gen === activeGeneration) {
        set({ error: e?.message || 'Purchases unavailable.' });
      }
    } finally {
      if (gen === activeGeneration) {
        set({ isLoading: false });
      }
    }
  },

  logOut: async () => {
    if (!hasApiKey()) return;
    const gen = ++activeGeneration;

    try {
      removeListener?.();
      removeListener = null;
    } catch {}

    try {
      await enqueueIdentityOp(async () => {
        if (isSdkConfigured) {
          try {
            await Purchases.logOut();
          } catch (e: any) {
            // Deliberate failure policy: log a non-sensitive diagnostic warning
            // but safely proceed to clear local state so sign-out is never blocked.
            console.warn('RevenueCat: Purchases.logOut failed', e?.message);
          }
        }
      });
    } catch {}

    if (gen === activeGeneration) {
      currentConfiguredUid = null;
      set({ isConfigured: false, packages: [], error: null, isLoading: false, isPurchasing: false });
    }
  },

  fetchOfferings: async () => {
    if (!hasApiKey()) {
      set({ packages: [] });
      return;
    }
    const gen = activeGeneration;
    set({ isLoading: true, error: null });
    try {
      const offerings = await Purchases.getOfferings();
      if (gen === activeGeneration) {
        set({
          packages: offerings.current?.availablePackages ?? [],
          isLoading: false,
        });
      }
    } catch (e: any) {
      if (gen === activeGeneration) {
        set({ error: e?.message || 'Failed to load offerings.', isLoading: false });
      }
    }
  },

  purchasePackage: async (pkg: PurchasesPackage) => {
    set({ isPurchasing: true, error: null });
    try {
      await Purchases.purchasePackage(pkg);
      await useEconomyStore.getState().syncEntitlement();
      return true;
    } catch (e: any) {
      if (!e?.userCancelled) {
        set({ error: e?.message || 'Purchase failed.' });
      }
      return false;
    } finally {
      set({ isPurchasing: false });
    }
  },

  restorePurchases: async () => {
    set({ isLoading: true, error: null });
    try {
      await Purchases.restorePurchases();
      await useEconomyStore.getState().syncEntitlement();
      return true;
    } catch (e: any) {
      set({ error: e?.message || 'Restore failed.' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),

  getSubscriptionPackages: () =>
    get().packages.filter(
      (p) =>
        p.packageType === 'ANNUAL' ||
        p.packageType === 'MONTHLY' ||
        p.packageType === 'WEEKLY'
    ),

  getLifetimePackage: () => get().packages.find((p) => p.packageType === 'LIFETIME'),

  getStarPackages: () =>
    get().packages.filter(
      (p) => p.packageType === 'CUSTOM' && /stars?_/i.test(p.identifier)
    ),

  getDonationPackages: () =>
    get().packages.filter(
      (p) => p.packageType === 'CUSTOM' && p.identifier.includes('donation')
    ),
}));
