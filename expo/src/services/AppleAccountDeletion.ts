import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { OAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../lib/firebase';

/** Reauthenticate the same account and revoke Apple authorization before deletion.
 * Uses the authorization-code request used by Firebase's native iOS SDK:
 * FirebaseAuth/Sources/Swift/Backend/RPC/RevokeTokenRequest.swift.
 * The JS revokeAccessToken helper accepts access tokens, not native Apple codes.
 */
export async function revokeAppleBeforeDeletion(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in before deleting your account.');
  if (!user.providerData.some(provider => provider.providerId === 'apple.com')) return;
  if (Platform.OS !== 'ios') {
    throw new Error('Please delete this Apple-linked account from the iOS app.');
  }
  const nonce = Array.from(await Crypto.getRandomBytesAsync(32),
    byte => byte.toString(16).padStart(2, '0')).join('');
  const response = await AppleAuthentication.signInAsync({
    nonce: await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce),
    requestedScopes: [],
  });
  if (!response.identityToken || !response.authorizationCode) {
    throw new Error('Apple did not confirm authorization. Please try again.');
  }
  await reauthenticateWithCredential(user, new OAuthProvider('apple.com').credential({
    idToken: response.identityToken, rawNonce: nonce,
  }));
  if (auth.currentUser?.uid !== user.uid) throw new Error('Your account changed. Please try again.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const result = await fetch(
      `https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=${encodeURIComponent(auth.app.options.apiKey || '')}`,
      {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'X-Ios-Bundle-Identifier': 'com.partybot' },
        body: JSON.stringify({
          providerId: 'apple.com', tokenType: 'CODE',
          token: response.authorizationCode, idToken: await user.getIdToken(true),
          ...(auth.tenantId ? { tenantId: auth.tenantId } : {}),
        }),
      },
    );
    if (!result.ok) throw new Error('Apple authorization could not be revoked. Your account has not been deleted. Please try again.');
  } finally {
    clearTimeout(timer);
  }
}
