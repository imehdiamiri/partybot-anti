import { Auth, browserPopupRedirectResolver, getRedirectResult, GoogleAuthProvider, signInWithRedirect } from 'firebase/auth';

const PENDING_KEY = '8playo.google-redirect-pending';
export const GOOGLE_SIGN_IN_TIMEOUT_MS = 25000;

function storage(): Storage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; }
  catch { return undefined; }
}

export function hasPendingGoogleRedirect(): boolean {
  try { return storage()?.getItem(PENDING_KEY) === '1'; }
  catch { return false; }
}

export function clearPendingGoogleRedirect(): void {
  try { storage()?.removeItem(PENDING_KEY); } catch {}
}

// Firebase's helper can remain pending when scripts/storage are blocked. Always
// release the form, and attach handlers to late SDK results to avoid rejections.
function bounded<T>(operation: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject({ code: 'auth/timeout' }), GOOGLE_SIGN_IN_TIMEOUT_MS);
    operation.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export async function startGoogleRedirect(auth: Auth): Promise<void> {
  try {
    const session = storage();
    if (!session) throw { code: 'auth/web-storage-unsupported' };
    try { session.setItem(PENDING_KEY, '1'); }
    catch { throw { code: 'auth/web-storage-unsupported' }; }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    // Same-tab sign-in avoids popup/opener messaging problems on mobile browsers.
    await bounded(signInWithRedirect(auth, provider, browserPopupRedirectResolver));
  } catch (error) {
    clearPendingGoogleRedirect();
    throw error;
  }
}

export async function finishGoogleRedirect(auth: Auth) {
  try { return await bounded(getRedirectResult(auth, browserPopupRedirectResolver)); }
  finally { clearPendingGoogleRedirect(); }
}

export function googleSignInError(error: { code?: string } | null | undefined): string {
  switch (error?.code) {
    case 'auth/account-exists-with-different-credential':
      return 'This email already has an account. Sign in with its existing method first.';
    case 'auth/unauthorized-domain':
      return 'Google sign-in is not configured for this website. Please use your email and contact support.';
    case 'auth/web-storage-unsupported':
      return 'Your browser could not save the sign-in session. Open 8playo.com in Safari or Chrome, or use your email.';
    case 'auth/timeout':
      return 'Google sign-in did not finish. Try again in Safari or Chrome, or sign in with your email.';
    default:
      return 'Google sign-in could not finish. Please try again or use your email and password.';
  }
}
