const resolveConfig = require('../../app.config.js');
const names = ['APP_VARIANT', 'EXPO_PUBLIC_REVENUECAT_API_KEY_IOS', 'EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID'];
const saved = Object.fromEntries(names.map(name => [name, process.env[name]]));
afterEach(() => { for (const name of names) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; } });
test('production rejects non-public credentials without echoing their values', () => {
  process.env.APP_VARIANT = 'production';
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS = 'confidential-fixture';
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID = 'goog_fixture';
  expect(() => resolveConfig({ config: {} })).toThrow('Production requires verified public');
  expect(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS).toBe('');
});
test('preview strips unverified keys while preserving separate Expo Go runtime', () => {
  process.env.APP_VARIANT = 'expo-go';
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS = 'confidential-fixture';
  expect(resolveConfig({ config: {} }).runtimeVersion.policy).toBe('sdkVersion');
  expect(process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS).toBe('');
});
test('production accepts platform-specific SDK keys and keeps native runtime', () => {
  process.env.APP_VARIANT = 'production';
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS = 'appl_fixture';
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID = 'goog_fixture';
  expect(resolveConfig({ config: { runtimeVersion: { policy: 'appVersion' } } }).runtimeVersion.policy).toBe('appVersion');
});
