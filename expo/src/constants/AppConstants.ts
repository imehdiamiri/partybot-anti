export const AppConstants = {
  brandName: '8Playo',
  // Firebase config is read directly from EXPO_PUBLIC_FIREBASE_* in src/lib/firebase.ts.
  // Do not duplicate or fall back here — see firebase.ts for the source of truth.
  URLs: {
    privacyPolicy: 'https://8playo.com/privacy',
    termsOfService: 'https://8playo.com/terms',
    marketingSite: 'https://8playo.com',
  },
  Invite: {
    // Accept previously shared links while all new links use the new domain.
    allowedHosts: ['8playo.com', 'www.8playo.com', 'partybot.games', 'www.partybot.games'],
    inviteScheme: 'invite',
  },
  RevenueCat: {
    apiKeyIOS: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '',
    apiKeyAndroid: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '',
  },
  Economy: {
    dailyReward: 5,
    inviteReward: 10,
  },
  Game: {
    minPlayersForMultiplayer: 2,
    maxPlayersPerRoom: 12,
    roomCodeLength: 6,
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  },
};
