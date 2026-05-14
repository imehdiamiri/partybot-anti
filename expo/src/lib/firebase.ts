/**
 * Firebase — Canonical realtime backend for PartyBot.
 *
 * Services initialized:
 *  - Auth (with AsyncStorage persistence on RN)
 *  - Firestore (user profiles, game history)
 *  - Realtime Database (live sessions, lobbies, presence, economy)
 *  - Storage (avatars, generated content)
 *  - Functions (server-validated mutations, AI proxy)
 *
 * Config is read from EXPO_PUBLIC_FIREBASE_* env vars. There is no hardcoded
 * fallback: shipping a fallback would leak the production project into every
 * forked build. Missing config throws at startup so misconfiguration is loud.
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
// @ts-ignore: getReactNativePersistence is valid at runtime in RN context
import { initializeAuth, getReactNativePersistence, getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDatabase, Database, ref, set as fbSet, onDisconnect } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { getFunctions, Functions } from 'firebase/functions';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Configuration ───

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    // We throw rather than silently shipping a fallback project so that
    // misconfigured forks fail loudly in dev instead of writing to the
    // wrong production database.
    throw new Error(
      `Firebase: missing required env var ${name}. Set it in expo/.env (see .env.example).`
    );
  }
  return value;
}

const firebaseConfig = {
  apiKey: requireEnv('EXPO_PUBLIC_FIREBASE_API_KEY', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
  authDomain: requireEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
  projectId: requireEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
  storageBucket: requireEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: requireEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
  appId: requireEnv('EXPO_PUBLIC_FIREBASE_APP_ID', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  databaseURL: requireEnv('EXPO_PUBLIC_FIREBASE_DATABASE_URL', process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL),
};

// ─── App ───

const app: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

// ─── Auth ───

let auth: Auth;
try {
  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  }
} catch (error: any) {
  if (error.code === 'auth/already-initialized') {
    auth = getAuth(app);
  } else {
    throw error;
  }
}

const db: Firestore = getFirestore(app);
const rtdb: Database = getDatabase(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app);

// ─── User Profile Sync ───

interface UserProfileData {
  uid: string;
  username: string;
  email?: string;
  provider: string;
  avatarURL?: string;
}

async function syncUserProfile(data: UserProfileData): Promise<void> {
  try {
    const now = Date.now();

    const rtdbUserRef = ref(rtdb, `users/${data.uid}`);
    await fbSet(rtdbUserRef, {
      username: data.username,
      usernameLower: data.username.toLowerCase(),
      email: data.email || null,
      provider: data.provider,
      avatarURL: data.avatarURL || null,
      lastSeen: now,
      updatedAt: now,
    });

    await setDoc(doc(db, 'users', data.uid), {
      username: data.username,
      email: data.email || null,
      provider: data.provider,
      avatarURL: data.avatarURL || null,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('Firebase: syncUserProfile failed', e);
  }
}

// ─── Presence System ───

async function setUserOnline(uid: string): Promise<void> {
  try {
    const presenceRef = ref(rtdb, `presence/${uid}`);
    await fbSet(presenceRef, {
      online: true,
      lastSeen: Date.now(),
    });
    // Auto-clear presence on disconnect (server-side timer).
    onDisconnect(presenceRef).set({
      online: false,
      lastSeen: Date.now(),
    });
  } catch (e) {
    console.warn('Firebase: setUserOnline failed', e);
  }
}

async function setUserOffline(uid: string): Promise<void> {
  try {
    const presenceRef = ref(rtdb, `presence/${uid}`);
    await fbSet(presenceRef, {
      online: false,
      lastSeen: Date.now(),
    });
  } catch (e) {
    console.warn('Firebase: setUserOffline failed', e);
  }
}

export {
  app,
  auth,
  db,
  rtdb,
  storage,
  functions,
  firebaseConfig,
  syncUserProfile,
  setUserOnline,
  setUserOffline,
};
