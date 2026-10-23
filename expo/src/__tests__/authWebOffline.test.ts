// Mock native / expo packages before importing useAuthStore
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'bare' } }));
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
jest.mock('../services/GameAudio', () => ({
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
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithRedirect: jest.fn(),
  getRedirectResult: jest.fn(),
  browserPopupRedirectResolver: 'web-popup-resolver',
  GoogleAuthProvider: Object.assign(jest.fn().mockImplementation(() => ({ setCustomParameters: jest.fn() })), { credential: jest.fn() }),
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
import { GOOGLE_SIGN_IN_TIMEOUT_MS, hasPendingGoogleRedirect } from '../services/webGoogleAuth';

const firebaseAuth = jest.requireMock('firebase/auth');
const registeredUser = { uid: 'registered-user', email: 'newhost@partygames.app', isAnonymous: false, displayName: null, providerData: [{ providerId: 'password' }] };

describe('Web real account authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const values = new Map<string, string>();
    Object.defineProperty(global, 'window', { configurable: true, value: {
      sessionStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    } });
    firebaseAuth.signInWithRedirect.mockReset();
    firebaseAuth.getRedirectResult.mockReset();
    useAuthStore.setState({ currentUser: null, authAccount: null, isBusy: false, isInitialized: false, errorMessage: null });
    firebaseAuth.createUserWithEmailAndPassword.mockResolvedValue({ user: registeredUser });
    firebaseAuth.signInWithEmailAndPassword.mockResolvedValue({ user: registeredUser });
    firebaseAuth.signOut.mockResolvedValue(undefined);
  });

  test('initialization restores Firebase users and returns the listener cleanup', () => {
    const stop = jest.fn();
    firebaseAuth.onAuthStateChanged.mockImplementation((_auth: unknown, callback: Function) => { callback(registeredUser); return stop; });
    expect(useAuthStore.getState().initialize()).toBe(stop);
    expect(useAuthStore.getState().currentUser).toBe(registeredUser);
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  test('signed-out initialization never fabricates an authenticated guest', () => {
    firebaseAuth.onAuthStateChanged.mockImplementation((_auth: unknown, callback: Function) => { callback(null); return jest.fn(); });
    useAuthStore.getState().initialize();
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  test('signup creates a real account with the supplied password', async () => {
    await useAuthStore.getState().signUp('NewHost', 'secret123');
    expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledWith({}, 'newhost@partygames.app', 'secret123');
    expect(useAuthStore.getState().currentUser?.isAnonymous).toBe(false);
    expect(useAuthStore.getState().authAccount?.provider).toBe('username');
  });

  test('email sign-in preserves the email rather than appending the username domain', async () => {
    await useAuthStore.getState().signIn('Player@Example.com', 'secret123');
    expect(firebaseAuth.signInWithEmailAndPassword).toHaveBeenCalledWith({}, 'player@example.com', 'secret123');
    expect(useAuthStore.getState().currentUser).toBe(registeredUser);
  });

  test('incorrect password stays signed out and displays an error', async () => {
    firebaseAuth.signInWithEmailAndPassword.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
    await useAuthStore.getState().signIn('Player', 'wrong');
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().errorMessage).toBe('Wrong username or password.');
    expect(useAuthStore.getState().isBusy).toBe(false);
  });

  test('signout ends the Firebase session and clears the local account', async () => {
    useAuthStore.setState({ currentUser: registeredUser });
    await useAuthStore.getState().signOut();
    expect(firebaseAuth.signOut).toHaveBeenCalledWith({});
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().authAccount).toBeNull();
  });

  afterEach(() => { jest.useRealTimers(); });

  test('Google web sign-in starts a same-tab redirect without fabricating a signed-in user', async () => {
    firebaseAuth.signInWithRedirect.mockResolvedValueOnce(undefined);
    await useAuthStore.getState().signInWithGoogle();
    expect(firebaseAuth.signInWithRedirect).toHaveBeenCalledWith({}, expect.any(Object), 'web-popup-resolver');
    expect(hasPendingGoogleRedirect()).toBe(true);
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(useAuthStore.getState().isBusy).toBe(false);
  });

  test.each(['auth/unauthorized-domain', 'auth/account-exists-with-different-credential'])('Google %s releases the form with an actionable error', async code => {
    firebaseAuth.signInWithRedirect.mockRejectedValueOnce({code});
    await useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().isBusy).toBe(false);
    expect(useAuthStore.getState().currentUser).toBeNull();
    expect(hasPendingGoogleRedirect()).toBe(false);
    expect(useAuthStore.getState().errorMessage).toBeTruthy();
  });

  test('a stalled Google helper times out and permits email sign-in; late failures are handled', async () => {
    jest.useFakeTimers();
    let failHelper!: (reason: unknown) => void;
    firebaseAuth.signInWithRedirect.mockReturnValueOnce(new Promise((_resolve, reject) => { failHelper = reject; }));
    const pending = useAuthStore.getState().signInWithGoogle();
    expect(useAuthStore.getState().isBusy).toBe(true);
    await jest.advanceTimersByTimeAsync(GOOGLE_SIGN_IN_TIMEOUT_MS);
    await pending;
    expect(useAuthStore.getState().isBusy).toBe(false);
    expect(hasPendingGoogleRedirect()).toBe(false);
    expect(useAuthStore.getState().errorMessage).toContain('did not finish');
    await useAuthStore.getState().signIn('Player', 'secret123');
    failHelper({ code: 'auth/network-request-failed' });
    await Promise.resolve();
    expect(useAuthStore.getState().currentUser).toBe(registeredUser);
    expect(useAuthStore.getState().errorMessage).toBeNull();
  });

  test('ordinary initialization does not invoke Google redirect helpers', () => {
    firebaseAuth.onAuthStateChanged.mockImplementation((_auth: unknown, callback: Function) => { callback(null); return jest.fn(); });
    useAuthStore.getState().initialize();
    expect(firebaseAuth.getRedirectResult).not.toHaveBeenCalled();
  });

  test('a returning redirect is consumed and Firebase auth state unlocks the app', async () => {
    firebaseAuth.signInWithRedirect.mockResolvedValueOnce(undefined);
    await useAuthStore.getState().signInWithGoogle();
    const googleUser = { ...registeredUser, providerData: [{ providerId: 'google.com' }] };
    let authCallback!: Function;
    firebaseAuth.onAuthStateChanged.mockImplementation((_auth: unknown, callback: Function) => { authCallback = callback; callback(null); return jest.fn(); });
    firebaseAuth.getRedirectResult.mockImplementationOnce(async () => { authCallback(googleUser); return { user: googleUser }; });
    useAuthStore.getState().initialize();
    await jest.useRealTimers();
    await new Promise(resolve => setImmediate(resolve));
    expect(hasPendingGoogleRedirect()).toBe(false);
    expect(useAuthStore.getState().authAccount?.provider).toBe('google');
    expect(useAuthStore.getState().isBusy).toBe(false);
  });

  test('blocked session storage does not start OAuth or lock the form', async () => {
    window.sessionStorage.setItem = () => { throw new Error('storage blocked'); };
    await useAuthStore.getState().signInWithGoogle();
    expect(firebaseAuth.signInWithRedirect).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isBusy).toBe(false);
    expect(useAuthStore.getState().errorMessage).toContain('save the sign-in session');
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
  test('AudioManager and playSharedSound methods are completely no-op / safe on web without invoking native audio', async () => {
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
