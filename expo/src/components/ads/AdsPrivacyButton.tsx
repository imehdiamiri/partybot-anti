import React, { useSyncExternalStore } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { nativeAds } from '@/src/services/nativeAds';
const empty = { ready: false, privacyRequired: false, revision: 0 };
const snapshot = () => empty;
const subscribe = () => () => {};
export function AdsPrivacyButton() {
  const state = useSyncExternalStore(nativeAds?.subscribe ?? subscribe, nativeAds?.snapshot ?? snapshot, snapshot);
  if (!state.privacyRequired) return null;
  return <TouchableOpacity accessibilityRole="button" style={{ padding: 16, minHeight: 48 }}
    onPress={() => { void nativeAds?.privacy().catch(() => Alert.alert('Ad privacy', 'Could not open your privacy choices. Please try again.')); }}>
    <Text style={{ color: '#BFD7F5', fontSize: 16 }}>Advertising privacy choices</Text>
  </TouchableOpacity>;
}
