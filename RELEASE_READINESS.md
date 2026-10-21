# Release and advertising readiness

## AdMob follow-up — 2026-10-21

- Both existing Android and iOS records still show **Requires review / Limited
  ad serving / Add store to lift limit**, with no associated store/package ID.
  Each retains its one active banner. Renamed both records from PartyBot to
  8Playo; application IDs remain `~6209477204` (Android) and `~1614877640` (iOS)
  under publisher `pub-9376144248169220`, matching the existing native config.
- Policy Center reports **No current issues**. This does not override the
  separate app-readiness/store-link requirement or certify real impressions.
- Published the existing European message as **8Playo advertising privacy**,
  confirmed Published / 2 apps / October 21. Both selected apps have privacy URL
  `https://8playo.com/privacy`. Consent, Manage options and Do not consent remain
  On; Close remains Off. No new purposes/vendors or unrelated app changes.
- Public `https://8playo.com/app-ads.txt` returned HTTP 200 with the correct
  DIRECT seller entry. Public availability is not Google crawl verification.
  AdMob's app-ads.txt tab shows **No ad requests with app-ads.txt yet / No data
  to display**, so no crawler or real-impression success is confirmed.
- Google Play account still shows **Create your first app**. After the owner
  signed in, App Store Connect / DIGIGET LTD shows **No Apps**, an updated Apple
  Developer Program License Agreement requiring Account Holder acceptance,
  and a trader-status requirement for EU distribution. Neither store currently
  provides an app page to link in AdMob. No app-level review submission or
  store approval is claimed; publishing/listing and correct store association
  must precede the next AdMob readiness review step.
- Android preview and TestFlight profiles intentionally use Google test units;
  only the production variant selects the existing real banner IDs. Expo Go
  cannot load native ads. UMP, Expo Go, runtime and production purchase guards
  remain intact. Current production signing/store/RevenueCat and physical-device
  acceptance blockers remain separate. This follow-up changes console metadata
  and documentation only; no new web/native build or OTA is needed or claimed.

## Current advertising follow-up — 2026-10-21

Latest located AdSense email is October 5, "Action needed: Your AdSense
application". Initial console inspection reported "Your account wasn't approved"
and "Meet AdSense program policies" without a specific violation. After the
owner's explicit policy-attestation approval, resubmitted the account, added
8playo.com, verified site ownership and requested review. Google now confirms
"Getting ready / Review requested". This is not approval or proof of the prior
rejection's specific cause. The retained legacy site was not resubmitted.

The owner confirmed no Whitney music license and authorized removing the mode
from Android/web too. Current source excludes the original recording on every
platform, retains Metronome and upgrades old session settings safely. Source
also removes the checked-in legacy Hosting audio and downloader. An artifact
check rejects the original recording even if renamed. Publication, resubmission
and Android binary receipts are confirmed in RELEASE_LOG.md. Music-free web and
Expo Go are published; replacement Android preview APK is FINISHED and its 28
audio entries contain no retired recording. Old installed binaries must update.
Public 8playo.com ads.txt/app-ads.txt and privacy/terms returned HTTP 200 with the
expected seller ID or current brand/contact. These are readiness corrections,
not a guarantee of AdSense approval. Historical store/signing/consent limitations
below still apply unless superseded by newer release evidence. The existing
European consent message is now Published for both domains under the 8Playo
name, with the current privacy URL and Do not consent retained. Google's ads.txt
crawler status was initially Not found for the new site despite the live file
being present; do not claim that crawl or an ad impression is already verified.

## Current follow-up — 2026-10-07

This section supersedes the historical September 29 statuses below.

- Backend security lockfile update from 6b5a1de was published successfully to
  all 12 named existing functions in us-central1 after 78 authorization/unit
  regressions passed in GitHub CI 37582147482. No database/rules deploy.

- Release pipeline: source 46a7ad3 passed 324 app tests but newly reported
  dependency advisories stopped CI/Hosting. Compatible backend patches remove
  the critical proxy-addr finding; compatible Expo tooling patches remove three
  root findings. Unpatched braces/node-forge advisories still block the app audit.
  No audit bypass or production publication is claimed.
- New Android preview build `13cf32fb-802a-4d1e-9549-0fccd22fefd6` was accepted
  by EAS from 46a7ad3, version 1.2.0. IN_PROGRESS at the initial inspection;
  it is a test-ad APK profile, not a Play Store AAB.

- AdSense console still says **Your account wasn't approved / Meet AdSense
  program policies**. No specific rejection reason is supplied. A resubmission
  has not been made or represented as approved.
- Failed Android preview 1.2.0 build `33cbf3ca-8f9f-409f-b427-aa438a86cf20`
  failed while evaluating Google Mobile Ads: missing `googleMobileAdsJson`.
  Explicitly selecting `androidSdk: classic` through the official Expo plugin
  generates `RNGMA_ANDROID_BACKEND=classic`, avoiding that absent-property path.
  Plugin introspection verifies the application ID and delayed measurement too.
- Ads now appear below game instructions, rather than Games/Tools navigation
  grids or the final scoreboard. Consent and Expo Go guards remain in place;
  preview uses test units, production requires a new compatible binary.
- Apple login has expired; owner-assisted sign-in is required before checking
  app records, agreements and signing. No store submission is confirmed.
- AdMob account approval is separate from each app's review and store linking.
  October 5 verified both apps still Require review / Limited ad serving, with
  no store association. Google Play had no app record on that date.
- Production remains blocked by store/RevenueCat configuration and installed
  device acceptance. Historical simulator artifacts are not physical iOS builds.
- The Whitney recording still ships on Android/web without license evidence
  in the repository. Resolve those distribution rights or remove the recording
  before attesting that the entire site meets publisher policies. iOS excludes it.
- Moving ad placements is a concrete policy-risk correction, not proof of the
  reason for Google's rejection or a guarantee of approval. Original art provenance
  and accurate account/store declarations still need owner verification.

References: https://support.google.com/publisherpolicies/answer/11112688
and https://support.google.com/adsense/answer/48182?hl=en.

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
| AdMob apps | Created PartyBot Android and iOS, each with one active banner unit; both **Requires review / Limited ad serving / Add store to lift limit** | Store association, app-ads.txt crawl/verification, new native binary and test-device verification; SDK/UMP integration now implemented |
| AdSense | AdSense activated; partybot.games ownership verified; **Getting ready / Review requested** | Wait for Google site approval; published Google CMP and display slot 1116184196 configured |

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

Native Google Mobile Ads 17.2.0 and web AdSense are integrated. Banner placements
are below Games, Tools and results content, in document flow and separated from
controls. No interstitial/rewarded interruptions. Native requests use NPA and PG
maximum content rating; no IDFA permission is requested. Development/preview
builds use Google test units; production uses the real units above. Expo Go
cannot display native ads and remains guarded. Native version/runtime is 1.2.0.

Web slot `1116184196` uses publisher `ca-pub-9376144248169220`. Auto ads are off.
The official AdSense tag loads Google's published CMP; explicit placements wait
for a settled eligible consent response. Unknown/denied consent, no-fill and
blocked scripts do not block gameplay. Profile provides privacy choices.

The exact publisher-provided seller declaration is in `expo/public/app-ads.txt`
and `website/public/app-ads.txt`, and the web sync script preserves it:

```text
google.com, pub-9376144248169220, DIRECT, f08c47fec0942fa0
```

Hosting destination: https://partybot.games/app-ads.txt (also the Firebase
default domain). Use `https://partybot.games` as the developer/marketing website
in both store listings. Publishing this file is not AdMob verification:
association with supported store listings and Google's crawl still remain.

## Advertising launch gates still open

- AdMob European consent message **Published** for both apps. AdSense European
  message **Published** for partybot.games, with Do not consent available.
- Public privacy policy, `/ads.txt`, `/app-ads.txt` and ownership meta tag are
  deployed. Google confirmed ownership and accepted the web review request.
- Android preview 1.2.0 build `33cbf3ca-8f9f-409f-b427-aa438a86cf20` is queued.
  This is an APK with test ads, not a Play release or verified ad impression.
- iOS new signed binary still requires store identifier/team/signing setup.
  Old 1.1.1 binaries must not receive the new native runtime by OTA.
- Production RevenueCat guard remains: valid store SDK keys/providers are
  missing. Production builds/real-ad device testing are not completed.
- Consent/device/no-fill/rotation and recording coexistence need installed
  iPhone/Android acceptance testing. Web logged-out onboarding loaded without
  ads; an authenticated live impression has not been verified.
- Complete accurate audience, App Privacy and Data Safety disclosures. Review
  additional regional privacy obligations before enabling broad store release.
- No guarantee of an ad for every user: Google approval, consent, network,
  geography, inventory and ad blockers affect serving.

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
  The iOS mode and bundled recording are now excluded; Android/web retain it
  pending owner decision. See CONTENT_RIGHTS_REVIEW.md for remaining rights,
  art-provenance and mature-card rating findings.
- Existing Firebase Hosting already exists. The emailed provisioning change for
  newly created projects does not require recreating `partyplay-8` or migrating
  this site's hosting. No backend deployment or Git remote push was performed.

## Checks and references

- TypeScript: PASS. Jest: 45 suites / 323 tests PASS after the Spicy source cleanup
  (existing renderer warnings).
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
