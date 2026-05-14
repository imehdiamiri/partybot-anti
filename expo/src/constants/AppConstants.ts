export const AppConstants = {
  // Firebase config is read directly from EXPO_PUBLIC_FIREBASE_* in src/lib/firebase.ts.
  // Do not duplicate or fall back here — see firebase.ts for the source of truth.
  URLs: {
    privacyPolicy: 'https://www.partybot.games/privacy.html',
    termsOfService: 'https://www.partybot.games/terms.html',
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
  // NOTE: The Gemini API key is intentionally NOT bundled into the client.
  // All AI requests proxy through the `generateCard` Cloud Function which
  // owns the secret. Do not add EXPO_PUBLIC_GEMINI_API_KEY back here.
  Economy: {
    dailyReward: 5,
    inviteReward: 10,
    aiCardCostFree: 5,
    aiCardCostPremium: 1,
    freeAIGenerationsPerDay: 5,
  },
  Game: {
    minPlayersForMultiplayer: 2,
    maxPlayersPerRoom: 12,
    roomCodeLength: 6,
    sessionTimeoutMs: 30 * 60 * 1000, // 30 minutes
  },
};
