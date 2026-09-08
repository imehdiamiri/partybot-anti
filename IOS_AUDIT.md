# iOS source audit — September 8, 2026

Scope: tracked mobile routes, components/services, dependencies, backend account
deletion, store-facing legal pages and distribution configuration. This is not an
App Review approval or a complete physical-device playthrough.

Follow-up security hardening is documented in SECURITY_AUDIT.md. Commit 52a5488
protects profile merges, private data and social authorization. Firebase confirmed
the security rollout and Node 22 migration; compatible runtime 1.1.1 preview OTA
updates were published. Signed-device and StoreKit verification remain required.

## Corrected

- Removed the retired generation/editor configuration, obsolete coordination
  archives (owner confirmed), unused source helpers and broken maintenance scripts.
  No runtime content-generation endpoint or SDK remains in the app.
  Application-owned legacy tool references are removed. RevenueCat's bundled
  third-party SDK still includes its own sandbox-detection identifiers; these
  are dependency implementation details, not an app feature or visible branding.
- Removed unused native Picker and WebView dependencies. Runtime/version 1.1.1
  deliberately requires a new binary; do not publish to runtime 1.1.0.
- Separated platform components to remove conditional Hook ordering in paywall,
  lobby and web container routes without starting mobile network effects on web.
- Guarded purchase/restore calls when the SDK is unavailable. Profile restore now
  reports its outcome; account deletion explains that store subscriptions persist.
- Firestore account deletion now recursively removes the user subtree and fails
  before deleting authentication if the data deletion fails. This supports retry
  and removes the old single-batch history limit and false-success behavior.
- Native link routing preserves recognized custom/universal links instead of
  redirecting every link to home. Added the Apple domain association for the
  confirmed team/bundle and the Firebase Hosting JSON route/header.
- Privacy/terms descriptions now match Firebase, anonymous mobile authentication,
  diagnostic account identifiers, local audio cache and the actual deletion UI.
  Removed obsolete generation, notification and Supabase claims and unverified
  assertions that the app already has a store age rating.
- Replaced the unverified commercial Drum Challenge recording with a deterministic
  original synthesized cue. Kept the 9700ms scoring target and legacy saved mode
  identifier. The audio generation script documents its source.
- Compatible dependency updates removed all critical/high npm audit findings.
- Fixed the cloud CocoaPods failure with targeted module maps for GoogleUtilities
  and RecaptchaInterop via the SDK-compatible Expo build-properties plugin.

## Verification

- TypeScript: PASS.
- App Jest: 36 suites / 263 tests PASS, including native deep links, unavailable
  purchases and music/scoring alignment.
- Firebase database-emulator tests: 26 PASS, including deletion retry on Firestore
  failure; emulator stopped after completion.
- Expo Doctor: 21/21 PASS.
- Expo Doctor also passed 21/21 after the native build-properties addition.
- Live domain association: the exact standard HTTPS endpoint returns HTTP 200,
  application/json and 9R9TPVS9UL.com.partybot. Apple's device-side association
  fetch and caching still require a signed device test.
- Expo exports: iOS, Android and web PASS. These verify bundles, not native Xcode
  compilation, signing or real StoreKit purchases.
- EAS native iOS simulator compilation: FINISHED for runtime 1.1.1, source
  a969b1d, build a8fb65ac-1aa5-4750-8243-038b7e31306e. This confirms native
  compilation after the CocoaPods fix; it is not a signed device build or an
  executed simulator playthrough (this workstation is Windows).
- ESLint source scan: 101 errors / 256 warnings remain. Conditional Hook ordering
  and missing Jest globals were repaired; most remaining errors concern React
  Compiler refs/immutability/effect patterns. A native AudioStream namespace check
  is inconsistent with the installed SDK type. Lint is not certified clean.
- npm audit: 17 moderate findings remain, principally transitive tooling. Suggested
  forced fixes include downgrading Expo and were not applied. No audit-clean claim.

## Remaining release gates

1. Owner acceptance of App Store Connect first-use terms and direct Apple login
   for EAS signing; confirm the store app record and numeric ID before submission.
2. Complete RevenueCat/App Store product and in-app purchase credentials; validate
   localized prices, sandbox purchases/restores and server entitlement sync.
3. Signed iPhone/iPad tests for login/deletion, audio permission/recording, lifecycle,
   every game mode, multiplayer/report/block, UI safe areas and universal links.
   Domain association must be fetched successfully by Apple after deployment.
4. Accurate App Privacy disclosures (identifiers/contact info, gameplay/purchase
   data, diagnostics), current regional age-rating questionnaire, review access,
   screenshots and verified support contact. Remaining art/audio rights must be
   confirmed by the owner; source checks cannot establish third-party licenses.
5. Review remaining lint findings and retained operational/moderation data policies.
   Deployment and native build outcomes are recorded separately in RELEASE_LOG.md.

Reference: https://developer.apple.com/app-store/review/guidelines/
Relevant areas: completeness (2.1), purchases (3.1), login (4.8), privacy/account
deletion (5.1), user content moderation (1.2), and intellectual property (5.2).
Meeting individual checks does not guarantee Apple's approval.
