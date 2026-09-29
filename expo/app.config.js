// Prevent confidential/legacy unverified credentials from entering client bundles.
// Only modern platform-specific public SDK keys are accepted for store builds.
module.exports = ({ config }) => {
  const invalid = [];
  for (const [name, prefix] of [
    ['EXPO_PUBLIC_REVENUECAT_API_KEY_IOS', 'appl_'],
    ['EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID', 'goog_'],
  ]) {
    const value = process.env[name] || '';
    if (!value.startsWith(prefix)) {
      process.env[name] = '';
      invalid.push(name);
    }
  }
  if (process.env.APP_VARIANT === 'production' && invalid.length) {
    throw new Error(`Production requires verified public RevenueCat SDK keys: ${invalid.join(', ')}. Secret keys must never be embedded in the app.`);
  }
  const configured = { ...config, extra: { ...config.extra,
    adsTestMode: process.env.APP_VARIANT !== 'production',
  } };
  return process.env.APP_VARIANT === 'expo-go'
    ? { ...configured, runtimeVersion: { policy: 'sdkVersion' } }
    : configured;
};
