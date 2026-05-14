import { create } from 'zustand';
import {
  User,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { auth, syncUserProfile, setUserOnline } from '../lib/firebase';

WebBrowser.maybeCompleteAuthSession();

export type AuthProvider = 'username' | 'google' | 'apple' | 'guest';

export interface AuthAccount {
  id: string;
  username: string;
  email?: string;
  provider: AuthProvider;
}

interface AuthState {
  currentUser: User | null;
  authAccount: AuthAccount | null;
  isBusy: boolean;
  isInitialized: boolean;
  errorMessage: string | null;

  initialize: () => void;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInAnonymously: () => Promise<void>;
  signOut: () => Promise<void>;
}

const normalizeUsername = (username: string) => {
  const trimmed = username.trim().toLowerCase();
  if (!trimmed) throw new Error('Invalid Username');
  return trimmed;
};

const getEmailForUsername = (username: string) => {
  return `${username}@partygames.app`;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  authAccount: null,
  isBusy: false,
  isInitialized: false,
  errorMessage: null,

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Player';
        const provider: AuthProvider = user.isAnonymous
          ? 'guest'
          : user.providerData[0]?.providerId === 'google.com'
            ? 'google'
            : user.providerData[0]?.providerId === 'apple.com'
              ? 'apple'
              : 'username';

        set({
          currentUser: user,
          authAccount: {
            id: user.uid,
            username: displayName,
            email: user.email ?? undefined,
            provider,
          },
          isInitialized: true,
        });

        // Sync profile to Firebase RTDB + Firestore & set online
        syncUserProfile({
          uid: user.uid,
          username: displayName,
          email: user.email ?? undefined,
          provider,
        });
        setUserOnline(user.uid);
      } else {
        set({
          currentUser: null,
          authAccount: null,
          isInitialized: true,
        });
      }
    });

    // Return unsubscribe for cleanup if needed
    return unsubscribe;
  },

  signUp: async (username: string, password: string) => {
    set({ isBusy: true, errorMessage: null });
    try {
      const normalized = normalizeUsername(username);
      const email = getEmailForUsername(normalized);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      set({
        currentUser: user,
        authAccount: {
          id: user.uid,
          username: normalized,
          email: user.email ?? undefined,
          provider: 'username',
        },
        isBusy: false,
      });
    } catch (err: any) {
      const message = err.code === 'auth/email-already-in-use'
        ? 'This username is already taken.'
        : err.code === 'auth/weak-password'
          ? 'Password must be at least 6 characters.'
          : err.message;
      set({ errorMessage: message, isBusy: false });
    }
  },

  signIn: async (username: string, password: string) => {
    set({ isBusy: true, errorMessage: null });
    try {
      const normalized = normalizeUsername(username);
      const email = getEmailForUsername(normalized);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      set({
        currentUser: user,
        authAccount: {
          id: user.uid,
          username: normalized,
          email: user.email ?? undefined,
          provider: 'username',
        },
        isBusy: false,
      });
    } catch (err: any) {
      const message = err.code === 'auth/invalid-credential'
        ? 'Wrong username or password.'
        : err.code === 'auth/user-not-found'
          ? 'No account found with this username.'
          : err.message;
      set({ errorMessage: message, isBusy: false });
    }
  },

  signInAnonymously: async () => {
    set({ isBusy: true, errorMessage: null });
    try {
      const userCredential = await firebaseSignInAnonymously(auth);
      const user = userCredential.user;

      set({
        currentUser: user,
        authAccount: {
          id: user.uid,
          username: 'Guest',
          provider: 'guest',
        },
        isBusy: false,
      });
    } catch (err: any) {
      set({ errorMessage: err.message, isBusy: false });
    }
  },

  signInWithGoogle: async () => {
    set({ isBusy: true, errorMessage: null });
    try {
      // Detect Expo Go — native Google Sign-In module is NOT available in Expo Go
      // and will crash with TurboModuleRegistry.getEnforcing error
      const Constants = require('expo-constants').default;
      const isExpoGo = Constants.executionEnvironment === 'storeClient';

      if (isExpoGo) {
        set({
          errorMessage:
            'Google Sign-In requires a production build (EAS). Use Email/Password to sign in.',
          isBusy: false,
        });
        return;
      }

      // Safe to import outside Expo Go — native module is available
      const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

      // Configure Google Sign-In (idempotent — safe to call multiple times)
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
      });

      // Check for Play Services on Android
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // Trigger the native Google Sign-In flow
      const signInResult = await GoogleSignin.signIn();
      const idToken =
        signInResult.data?.idToken ?? (signInResult as any).idToken;

      if (!idToken) {
        throw new Error('No ID token returned from Google Sign-In.');
      }

      // Create Firebase credential and sign in
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);
      const user = userCredential.user;

      const displayName =
        user.displayName ?? user.email?.split('@')[0] ?? 'GooglePlayer';

      set({
        currentUser: user,
        authAccount: {
          id: user.uid,
          username: displayName,
          email: user.email ?? undefined,
          provider: 'google',
        },
        isBusy: false,
      });
    } catch (err: any) {
      // Handle known cancellation codes gracefully
      if (
        err.code === 'SIGN_IN_CANCELLED' ||
        err.code === '12501' ||
        err.code === 'ERR_REQUEST_CANCELED'
      ) {
        set({ isBusy: false });
        return;
      }

      // Fallback: if native module is missing (Expo Go), explain clearly
      if (
        err.message?.includes('cannot find') ||
        err.message?.includes('NativeModule') ||
        err.message?.includes('requireNativeModule')
      ) {
        console.warn(
          'Google Sign-In native module not available. Build with EAS for native support.'
        );
        set({
          errorMessage:
            'Google Sign-In requires an EAS build. Use username/password or Apple Sign-In.',
          isBusy: false,
        });
        return;
      }

      set({ errorMessage: err.message, isBusy: false });
      throw err;
    }
  },

  signInWithApple: async () => {
    set({ isBusy: true, errorMessage: null });
    try {
      const nonce = Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (credential.identityToken) {
        const oAuthProvider = new OAuthProvider('apple.com');
        const oAuthCredential = oAuthProvider.credential({
          idToken: credential.identityToken,
          rawNonce: nonce,
        });

        const userCredential = await signInWithCredential(auth, oAuthCredential);
        const user = userCredential.user;
        const fallbackUsername =
          credential.fullName?.givenName ??
          user.email?.split('@')[0] ??
          'ApplePlayer';

        set({
          currentUser: user,
          authAccount: {
            id: user.uid,
            username: fallbackUsername,
            email: user.email ?? undefined,
            provider: 'apple',
          },
          isBusy: false,
        });
      } else {
        throw new Error('No identityToken returned from Apple.');
      }
    } catch (err: any) {
      if (err.code !== 'ERR_REQUEST_CANCELED') {
        set({ errorMessage: err.message, isBusy: false });
        throw err;
      }
      set({ isBusy: false });
    }
  },

  signOut: async () => {
    set({ isBusy: true });
    try {
      await firebaseSignOut(auth);
      set({ authAccount: null, currentUser: null });
    } catch (err: any) {
      set({ errorMessage: err.message });
    } finally {
      set({ isBusy: false });
    }
  },
}));
