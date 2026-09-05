export const AppConstants = {
  // Firebase config is read directly from EXPO_PUBLIC_FIREBASE_* in src/lib/firebase.ts.
  // Do not duplicate or fall back here — see firebase.ts for the source of truth.
  URLs: {
    privacyPolicy: 'https://www.partybot.games/privacy',
    termsOfService: 'https://www.partybot.games/terms',
    marketingSite: 'https://www.partybot.games',
  },
  Invite: {
    allowedHosts: ['partybot.games', 'www.partybot.games'],
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
