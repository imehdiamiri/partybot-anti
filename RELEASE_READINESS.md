# Release and advertising readiness — 2026-09-29

## Decision

Not ready for App Store or Google Play production submission. The web app is
already live and the Expo Go preview is separate from a signed store binary.
This audit checked the live account consoles, EAS build history, production
environment variable names, repository configuration, TypeScript and Jest.
It is not a physical-device acceptance test or a store approval.

## Verified account state

| Area | Evidence on 2026-09-29 | Remaining work |
| --- | --- | --- |
| App Store Connect / DIGIGET LTD | Apps shows **No Apps**; New App Bundle ID dropdown has no available identifiers | Register/verify `com.partybot` in the correct team, create the app record, configure signing, upload a current TestFlight binary |
| Apple Business | Free Apps Agreement **Active**, Sep 7 2026–Sep 7 2027; Paid Apps Agreement **New**; legal entity update requested | Owner must supply accurate legal/business information and accept paid agreement if retaining IAP; complete banking/tax requirements shown by Apple |
| EU distribution | Apple requests trader status | Owner must determine and complete DSA trader declaration and any supporting verification |
| Google Play | Personal developer account; **Create your first app**; no app record | Create listing and signed AAB, complete app content/privacy/data safety, testing and production access |
| Android developer verification | No registered package names shown; console warns about September 30 2026 requirements | Register package/signing keys according to the console workflow; do not claim registration completed |
| RevenueCat / 8partyplay | Apps page only offers Test Store and new store configuration | Connect both real stores; configure products, offerings, entitlement, store credentials, public SDK keys and sandbox purchase/restore verification |
| EAS production | Firebase/Google public settings present; neither platform RevenueCat public key present | Current production config correctly refuses to build without `appl_` / `goog_` public keys; do not bypass this guard |
| AdMob account | **Your account is approved**; payment profile complete | App-level readiness approval is still separate |
| AdMob apps | Created PartyBot Android and iOS, each with one active banner unit; both **Requires review / Limited ad serving / Add store to lift limit** | Store association, app-ads.txt crawl/verification, SDK and consent integration, test-device verification |
| AdSense | Account open, **Active products: AdMob** only; no Sites product shown | Web monetization is not activated; activate/approve the appropriate web product before adding live ad tags |

The Google Play 12-testers/14-consecutive-days rule applies to personal accounts
created after November 13, 2023. The account is personal, but its creation date
and the app-specific production-access requirement are not yet verified. Do not
promise an immediate production launch or treat internal testing as satisfying
closed testing.

## EAS evidence

`eas build:list --limit 12 --json --non-interactive` returned:

- Latest finished iOS: `a8fb65ac-1aa5-4750-8243-038b7e31306e`,
  `ios-simulator`, version 1.1.1 / build 3, September 8. This cannot be submitted
  to App Store Connect or installed on a physical iPhone.
- Latest finished Android: `d5f6f57b-a73a-4ec2-861e-04911080adb3`,
  `preview`, version 1.1.0 / build 2, September 7. The profile produces an APK,
  not the required production AAB; it is not a current store-ready release.
- The latest listed Android production attempt
  `3830c7f9-cd51-4dd7-9cb5-5574b46876c6` was canceled.
- Older physical iOS preview builds exist for 1.0.0. They do not validate current
  1.1.1 behavior or establish App Store distribution signing.
- Current source runtime is appVersion 1.1.1. Expo Go uses
  `exposdk:57.0.0` on `expo-go-sdk57` / preview. No OTA or native build was
  published by this audit.

## Advertising setup completed

Public configuration identifiers (not authentication secrets):

| Platform | AdMob App ID | Results Banner ad unit ID |
| --- | --- | --- |
| Android | `ca-app-pub-9376144248169220~6209477204` | `ca-app-pub-9376144248169220/8982231772` |
| iOS | `ca-app-pub-9376144248169220~1614877640` | `ca-app-pub-9376144248169220/3746216966` |

The units are reserved for a potential results-screen placement, away from
active game controls. Creating them does **not** implement or enable ads in the
app. There is currently no Mobile Ads SDK, ad component or web ad tag in the
source. No interstitial/rewarded inventory or currency rewards were introduced.

The exact publisher-provided seller declaration is in `expo/public/app-ads.txt`
and `website/public/app-ads.txt`, and the web sync script preserves it:

```text
google.com, pub-9376144248169220, DIRECT, f08c47fec0942fa0
```

Hosting destination: https://partybot.games/app-ads.txt (also the Firebase
default domain). Use `https://partybot.games` as the developer/marketing website
in both store listings. Publishing this file is not AdMob verification:
association with supported store listings and Google's crawl still remain.

## Required implementation before live ads

1. Integrate a compatible Google Mobile Ads native SDK/config plugin. Keep web
   and Expo Go guards. A native dependency requires a new compatible binary and
   runtime; never send this as an OTA to the existing 1.1.1 binaries.
2. Implement consent before initialization/ad requests, required privacy-options
   reopening, cancellation/error/no-fill handling and suitable audience flags.
   AdMob Privacy & messaging currently has no configured European/US message.
   Use a certified consent flow where required; determine tracking behavior and
   ATT applicability before finalizing iOS permissions and store disclosures.
3. Update privacy disclosures together with actual behavior. The current policy
   expressly says no third-party advertising and no cross-app tracking. Do not
   enable a new advertising data flow while retaining contradictory statements.
4. Test with Google test ad units/test devices, including consent accept/reject,
   offline/no-fill, rotation, safe areas, audio/recording and game transitions.
   Never click live ads as a developer. Only then activate the actual unit IDs.
5. Web ads use a separate approved web product such as AdSense/H5 Games Ads;
   these native ad unit IDs cannot simply be pasted into the React web UI.
6. Do not promise an impression for every user: consent, regional restrictions,
   no-fill, connectivity, account/app approval and browser blocking can prevent
   ads. Gameplay should remain usable when an ad cannot be served.

## Other release gates

- Current device acceptance is outstanding: iPhone and Android production-like
  builds, microphone/record/reverse/slow playback, navigation, small-screen
  controls, Apple/Google/email login, account deletion and IAP purchase/restore.
- Complete screenshots, listing text, age/content ratings, data safety/app
  privacy, review access and support/deletion URLs. Verify that the published
  policy still accurately describes onboarding, guest access and actual SDKs.
- `expo/assets/sounds/whitney_raw.wav` is the restored Whitney recording.
  Tool foley has a CC0 source ledger; no distribution license evidence for the
  Whitney recording was found in the audited source ledger/release notes.
  Owner must confirm rights or provide a licensed replacement before store
  submission. This audit did not remove the requested recording or certify rights.
- Existing Firebase Hosting already exists. The emailed provisioning change for
  newly created projects does not require recreating `partyplay-8` or migrating
  this site's hosting. No backend deployment or Git remote push was performed.

## Checks and references

- TypeScript: PASS. Jest: 44 suites / 315 tests PASS (existing renderer warnings).
- Production guard: PASS, missing RevenueCat public keys rejected.
- Web export, sync, script syntax and seller declaration equality: PASS.
- No native device, sandbox purchase or ad impression test performed.

Official references reviewed:

- https://support.google.com/admob/answer/14538460?hl=en
- https://support.google.com/admob/answer/9363762?hl=en
- https://support.google.com/admob/answer/13554116?hl=en-GB
- https://developers.google.com/ad-placement/docs/signup
- https://developers.google.com/ad-placement/docs/example
- https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- https://developer.apple.com/app-store/review/guidelines/
- https://github.com/invertase/react-native-google-mobile-ads/blob/main/docs/index.mdx
