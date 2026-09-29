# PartyBot development

For a new Mac or Windows checkout, start with [MAC_SETUP.md](MAC_SETUP.md).

PartyBot uses Expo SDK 57, React Native 0.86, React 19, Reanimated 4 and Expo Router.
The mobile client is in expo/, Firebase Cloud Functions in functions/, and the
admin website and exported public pages in website/.

## Services

- Firebase project partyplay-8: authentication, Realtime Database, Firestore and scoped Cloud Functions.
- RevenueCat: native store purchases. Wallet balances and entitlements are server-authoritative.
- No runtime content-generation service or generation SDK is used. Game and card content ships with the app.

## Local verification

From expo/: npm run typecheck; npm test -- --runInBand; npm run lint.
From functions/: npm test (starts and stops the local database emulator).
The current lint and store-readiness limitations are recorded in IOS_AUDIT.md.

## Releases

Read AGENTS.md, IOS_RELEASE.md and RELEASE_LOG.md before publishing. Native runtime
1.2.0 requires a new binary for Google Mobile Ads; do not send
its updates to older native runtimes. TestFlight uses the preview channel/environment with
store distribution. Production rejects unverified public purchase SDK keys.
Expo Go remains a separate SDK57 channel and cannot validate native purchases.

Web releases use a one-off Expo export, node sync-web-build.js, then Firebase Hosting.
Never replace the checked-in security rules with public read/write rules. Select
individual backend targets for scoped corrections. Do not run a persistent preview
server or commit local credentials. The owner authorized pushes to the existing
origin on 2026-09-29; keep completed batches synchronized there.

## Configuration

Use existing EAS environments and ignored local Firebase client files. Public
EXPO_PUBLIC_FIREBASE_* values configure the client. Google login uses the public
web client ID and iOS client plist. RevenueCat client SDK keys must have the
platform-specific public prefix; private signing/server keys never belong in client
environment variables. Refer to expo/app.config.js for the production guard.
