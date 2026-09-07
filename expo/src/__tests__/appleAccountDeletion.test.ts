const mockUser = { uid: 'owner', providerData: [{ providerId: 'apple.com' }], getIdToken: jest.fn(async () => 'firebase-token') };
const mockAuth = { currentUser: mockUser, app: { options: { apiKey: 'public-key' } }, tenantId: null };
jest.mock('../lib/firebase', () => ({ auth: mockAuth }));
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-crypto', () => ({ getRandomBytesAsync: async () => new Uint8Array(32), digestStringAsync: async () => 'hash', CryptoDigestAlgorithm: { SHA256: 'sha256' } }));
jest.mock('expo-apple-authentication', () => ({ signInAsync: jest.fn(async () => ({ identityToken: 'identity', authorizationCode: 'code' })) }));
jest.mock('firebase/auth', () => ({ OAuthProvider: class { credential(value: unknown) { return value; } }, reauthenticateWithCredential: jest.fn(async () => ({})) }));
import { revokeAppleBeforeDeletion } from '../services/AppleAccountDeletion';
import { reauthenticateWithCredential } from 'firebase/auth';
import { signInAsync } from 'expo-apple-authentication';

beforeEach(() => {
  jest.clearAllMocks();
  mockUser.providerData = [{ providerId: 'apple.com' }];
  global.fetch = jest.fn(async () => ({ ok: true })) as any;
});
test('native authorization code is sent only after same-account reauthentication', async () => {
  await revokeAppleBeforeDeletion();
  expect(reauthenticateWithCredential).toHaveBeenCalledWith(mockUser, { idToken: 'identity', rawNonce: '00'.repeat(32) });
  const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
  expect(body).toMatchObject({ tokenType: 'CODE', providerId: 'apple.com', token: 'code', idToken: 'firebase-token' });
});
test('wrong account stops before token revocation', async () => {
  (reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce(new Error('user-mismatch'));
  await expect(revokeAppleBeforeDeletion()).rejects.toThrow('user-mismatch');
  expect(fetch).not.toHaveBeenCalled();
});
test('revocation error blocks subsequent deletion', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
  await expect(revokeAppleBeforeDeletion()).rejects.toThrow('has not been deleted');
});
test('non-Apple account needs no Apple prompt', async () => {
  mockUser.providerData = [{ providerId: 'password' }];
  await revokeAppleBeforeDeletion();
  expect(signInAsync).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
