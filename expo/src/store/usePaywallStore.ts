import { create } from 'zustand';
import Purchases, { PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import { useEconomyStore } from './useEconomyStore';

/**
 * usePaywallStore — RevenueCat surface for the storefront UI.
 *
 * Single source of truth for premium/stars lives in useEconomyStore. After
 * any RC event (configure, purchase, restore, customer-info update) we call
 * `syncEntitlement()` which pulls the authoritative subscriber state from
 * RC server-side and mirrors it onto Firebase. The realtime listener in
 * useEconomyStore then propagates the new wallet/entitlement to the UI.
 */

interface PaywallState {
  isLoading: boolean;
  isPurchasing: boolean;
  error: string | null;
  packages: PurchasesPackage[];
  isConfigured: boolean;

  configure: (uid: string) => Promise<void>;
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

let configuredForUid: string | null = null;
let removeListener: (() => void) | null = null;

function hasApiKey(): boolean {
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
    if (configuredForUid === uid) return;

    set({ isLoading: true, error: null });
    try {
      const apiKey = Platform.OS === 'ios' ? API_KEY_IOS : API_KEY_ANDROID;
      try {
        Purchases.configure({ apiKey, appUserID: uid });
      } catch {
        // Already configured — switch user instead.
        try { await Purchases.logIn(uid); } catch {}
      }
      configuredForUid = uid;

      // Mirror any subsequent customer-info updates back to Firebase.
      removeListener?.();
      const handler = (_info: CustomerInfo) => {
        useEconomyStore.getState().syncEntitlement();
      };
      Purchases.addCustomerInfoUpdateListener(handler);
      removeListener = () => {
        try { Purchases.removeCustomerInfoUpdateListener(handler); } catch {}
      };

      // Pull authoritative state once at boot.
      await useEconomyStore.getState().syncEntitlement();
      await get().fetchOfferings();
      set({ isConfigured: true });
    } catch (e: any) {
      set({ error: e?.message || 'Purchases unavailable.' });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchOfferings: async () => {
    if (!hasApiKey()) {
      set({ packages: [] });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const offerings = await Purchases.getOfferings();
      set({
        packages: offerings.current?.availablePackages ?? [],
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load offerings.', isLoading: false });
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
