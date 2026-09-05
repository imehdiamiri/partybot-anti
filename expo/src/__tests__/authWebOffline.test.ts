// Mock native / expo packages before importing useAuthStore
jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));
jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
}));
jest.mock('../components/ToastOverlay', () => ({
  showToast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));
jest.mock('expo-auth-session', () => ({}));
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockImplementation(() => {
      throw new Error('NATIVE_ESCAPE_HATCH: Audio.setAudioModeAsync must not be called on web');
    }),
    Sound: {
      createAsync: jest.fn().mockImplementation(() => {
        throw new Error('NATIVE_ESCAPE_HATCH: Audio.Sound.createAsync must not be called on web');
      }),
    },
  },
}));
jest.mock('../lib/firebase', () => ({
  auth: {},
  syncUserProfile: jest.fn(),
  setUserOnline: jest.fn(),
}));

// Mock firebase/auth functions to throw if ever invoked
jest.mock('firebase/auth', () => ({
  signInAnonymously: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase signInAnonymously must not be called on web');
  }),
  signInWithEmailAndPassword: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase signInWithEmailAndPassword must not be called on web');
  }),
  createUserWithEmailAndPassword: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase createUserWithEmailAndPassword must not be called on web');
  }),
  signOut: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase signOut must not be called on web');
  }),
  onAuthStateChanged: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase onAuthStateChanged must not be called on web');
  }),
  GoogleAuthProvider: {
    credential: jest.fn(),
  },
  OAuthProvider: jest.fn().mockImplementation(() => ({
    credential: jest.fn(),
  })),
  signInWithCredential: jest.fn().mockImplementation(() => {
    throw new Error('NETWORK_ESCAPE_HATCH: firebase signInWithCredential must not be called on web');
  }),
}));

// Mock platform to force isWeb = true
jest.mock('../utils/platform', () => ({
  isWeb: true,
  isWebLocalMode: true,
  isIOS: false,
  isAndroid: false,
}));

import { useAuthStore } from '../store/useAuthStore';

describe('Web Local-First Auth Isolation', () => {
  beforeEach(() => {
    useAuthStore.setState({
      currentUser: null,
      authAccount: null,
      isBusy: false,
      isInitialized: false,
      errorMessage: null,
    });
  });

  test('initialize() configures local guest without invoking Firebase onAuthStateChanged', () => {
    const unsub = useAuthStore.getState().initialize();
    expect(typeof unsub).toBe('function');
    const state = useAuthStore.getState();
    expect(state.isInitialized).toBe(true);
    expect(state.currentUser?.uid).toBe('guest_local');
    expect(state.currentUser?.displayName).toBe('Guest');
    expect(state.currentUser?.isAnonymous).toBe(true);
    expect(state.authAccount?.provider).toBe('guest');
  });

  test('signIn() sets local username offline without calling Firebase signInWithEmailAndPassword', async () => {
    await useAuthStore.getState().signIn('PlayerOne', 'secret123');
    const state = useAuthStore.getState();
    expect(state.isBusy).toBe(false);
    expect(state.errorMessage).toBeNull();
    expect(state.currentUser?.displayName).toBe('playerone');
    expect(state.authAccount?.username).toBe('playerone');
    expect(state.authAccount?.provider).toBe('guest');
  });

  test('signUp() sets local username offline without calling Firebase createUserWithEmailAndPassword', async () => {
    await useAuthStore.getState().signUp('NewHost', 'secret123');
    const state = useAuthStore.getState();
    expect(state.isBusy).toBe(false);
    expect(state.errorMessage).toBeNull();
    expect(state.currentUser?.displayName).toBe('newhost');
    expect(state.authAccount?.username).toBe('newhost');
  });

  test('signInAnonymously() resets to local guest without calling Firebase signInAnonymously', async () => {
    await useAuthStore.getState().signInAnonymously();
    const state = useAuthStore.getState();
    expect(state.currentUser?.uid).toBe('guest_local');
    expect(state.currentUser?.displayName).toBe('Guest');
    expect(state.currentUser?.isAnonymous).toBe(true);
  });

  test('signOut() resets local state without calling Firebase signOut', async () => {
    useAuthStore.setState({
      currentUser: { uid: 'custom_guest', displayName: 'Custom', isAnonymous: true },
      authAccount: { id: 'custom_guest', username: 'Custom', provider: 'guest' },
    });

    await useAuthStore.getState().signOut();
    const state = useAuthStore.getState();
    expect(state.currentUser?.uid).toBe('guest_local');
    expect(state.currentUser?.displayName).toBe('Guest');
    expect(state.isBusy).toBe(false);
  });

  test('signInWithGoogle() sets informational message without calling native Google Sign-In or Firebase', async () => {
    await useAuthStore.getState().signInWithGoogle();
    const state = useAuthStore.getState();
    expect(state.isBusy).toBe(false);
    expect(state.errorMessage).toContain('Google Sign-In is available on the mobile app');
  });

  test('signInWithApple() sets informational message without calling Apple auth or Firebase', async () => {
    await useAuthStore.getState().signInWithApple();
    const state = useAuthStore.getState();
    expect(state.isBusy).toBe(false);
    expect(state.errorMessage).toContain('Apple Sign-In is available on the iOS app');
  });
});

import { AudioManager } from '../services/AudioManager';
import { useEconomyStore } from '../store/useEconomyStore';
import { usePaywallStore } from '../store/usePaywallStore';
import { playSharedSound } from '../utils/sharedSound';

describe('Web Local-First Audio, Economy, and Paywall Isolation', () => {
  test('AudioManager and playSharedSound methods are completely no-op / safe on web without invoking expo-av', async () => {
    await expect(AudioManager.init()).resolves.toBeUndefined();
    await expect(AudioManager.preload('tileFlip', 1 as any)).resolves.toBeUndefined();
    await expect(AudioManager.play('tileFlip')).resolves.toBeUndefined();
    await expect(AudioManager.playOneShot(1 as any)).resolves.toBeUndefined();
    await expect(AudioManager.unloadAll()).resolves.toBeUndefined();

    await expect(playSharedSound('success')).resolves.toBeUndefined();
    await expect(playSharedSound('fail')).resolves.toBeUndefined();
    await expect(playSharedSound('game_over')).resolves.toBeUndefined();
  });

  test('useEconomyStore on web provides local wallet without RTDB or Cloud Function calls', async () => {
    useEconomyStore.getState().attach('guest_local');
    const state = useEconomyStore.getState();
    expect(state.isHydrated).toBe(true);
    expect(state.isPremium).toBe(true);
    expect(state.unlockStatus('any_game', true)).toBe('free');

    // Daily claim locally advances balance without Cloud Functions
    await useEconomyStore.getState().claimDailyReward();
    expect(useEconomyStore.getState().starsBalance).toBeGreaterThanOrEqual(15);

    // syncEntitlement returns null on web without throwing or calling Cloud Functions
    const res = await useEconomyStore.getState().syncEntitlement();
    expect(res).toBeNull();
  });

  test('usePaywallStore on web remains unconfigured and dormant without invoking native RevenueCat', async () => {
    await usePaywallStore.getState().configure('guest_local');
    const state = usePaywallStore.getState();
    expect(state.isConfigured).toBe(false);
    expect(state.packages).toEqual([]);
  });
});

