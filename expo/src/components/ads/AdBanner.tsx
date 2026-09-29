import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { adsSdk, nativeAds, bannerUnitId } from '@/src/services/nativeAds';

const empty = { ready: false, privacyRequired: false, revision: 0 };
const emptySnapshot = () => empty;
const noSubscribe = () => () => {};

/** Banners live in document flow; no overlays, timers, rewards or forced breaks. */
export function AdBanner() {
  const state = useSyncExternalStore(nativeAds?.subscribe ?? noSubscribe, nativeAds?.snapshot ?? emptySnapshot, emptySnapshot);
  const [failed, setFailed] = useState(false);
  useEffect(() => { void nativeAds?.start(); }, []);
  useEffect(() => { setFailed(false); }, [state.revision]);
  if (!adsSdk || !bannerUnitId || !state.ready || failed) return null;
  const Banner = adsSdk.BannerAd;
  return <View style={styles.slot} testID="ad-banner">
    <Text style={styles.label}>Advertisement</Text>
    <Banner key={state.revision} unitId={bannerUnitId}
      size={adsSdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={() => setFailed(true)} />
  </View>;
}
const styles = StyleSheet.create({
  slot: { width: '100%', alignItems: 'center', marginVertical: 24, gap: 8, minHeight: 74 },
  label: { color: '#9DA8B8', fontSize: 11 },
});
