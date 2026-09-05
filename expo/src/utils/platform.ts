import { Platform } from 'react-native';

/**
 * Shared platform boundaries for PartyBot.
 * Web runs in a deliberate local-first mode without native auth, RevenueCat, or RTDB gates.
 */
export const isWeb = Platform.OS === 'web';
export const isWebLocalMode = Platform.OS === 'web';
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
