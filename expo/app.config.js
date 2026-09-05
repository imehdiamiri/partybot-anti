// Expo Go gets a separate SDK-scoped update; native builds keep appVersion isolation.
module.exports = ({ config }) => process.env.APP_VARIANT === 'expo-go'
  ? { ...config, runtimeVersion: { policy: 'sdkVersion' } }
  : config;
