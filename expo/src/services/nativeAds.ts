import { Platform } from 'react-native';
import { AdsController } from './AdsController';

type AdsModule = typeof import('react-native-google-mobile-ads');
export let adsSdk: AdsModule | null = null;
let Constants: typeof import('expo-constants').default | null = null;
try { Constants = require('expo-constants').default; } catch {}
// Expo Go has no GMA module. Never evaluate that package there (or on web).
if (Platform.OS !== 'web' && Constants && Constants.appOwnership !== 'expo' &&
    Constants.executionEnvironment !== 'storeClient') {
  try { adsSdk = require('react-native-google-mobile-ads'); } catch {}
}
export const nativeAds = adsSdk ? new AdsController({
  gather: () => adsSdk!.AdsConsent.gatherConsent(),
  info: () => adsSdk!.AdsConsent.getConsentInfo(),
  privacy: () => adsSdk!.AdsConsent.showPrivacyOptionsForm(),
  initialize: async () => {
    await adsSdk!.default().setRequestConfiguration({ maxAdContentRating: adsSdk!.MaxAdContentRating.PG });
    await adsSdk!.default().initialize();
  },
}) : null;

export const bannerUnitId = !adsSdk ? undefined : (typeof __DEV__ !== 'undefined' && __DEV__) || Constants?.expoConfig?.extra?.adsTestMode !== false
  ? adsSdk?.TestIds.BANNER
  : Platform.OS === 'ios'
    ? 'ca-app-pub-9376144248169220/3746216966'
    : 'ca-app-pub-9376144248169220/8982231772';
