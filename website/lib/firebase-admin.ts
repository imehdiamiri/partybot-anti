import "server-only";
import {
  cert,
  getApps,
  initializeApp,
  type App,
  applicationDefault,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

let app: App | undefined;

function init(): App {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) {
    app = existing;
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    throw new Error("FIREBASE_DATABASE_URL is required");
  }

  if (raw) {
    const credential = cert(JSON.parse(raw));
    app = initializeApp({ credential, databaseURL });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS / metadata server.
    app = initializeApp({ credential: applicationDefault(), databaseURL });
  }
  return app;
}

export function adminAuth() {
  return getAuth(init());
}

export function rtdb() {
  return getDatabase(init());
}

/**
 * Returns true when the given uid has the `admin` custom claim.
 * Bootstrap a first admin manually in the Firebase console:
 *   admin.auth().setCustomUserClaims(uid, { admin: true })
 */
export async function isAdminUid(uid: string): Promise<boolean> {
  const user = await adminAuth().getUser(uid);
  return user.customClaims?.admin === true;
}
