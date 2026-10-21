# 8Playo store publication

## Confirmed preparation — October 21, 2026

- Stable native package/bundle ID: `com.partybot`; public name: 8Playo.
- Apple team DIGIGET LTD, `9R9TPVS9UL`. Account confirms the October 14 Program
  License Agreement was accepted October 21. Stale Connect warning cleared on
  reload. This release task did not accept that agreement.
- Registered the previously absent explicit App ID, description 8Playo, with
  Associated Domains and Sign in with Apple matching existing entitlements.
- Created App Store Connect app **6825284815**, SKU `8playo-ios`, iOS, English
  (U.S.). Version 1.3.0 is **Prepare for Submission**, manual release selected.
  Saved promotional text, description, keywords, copyright, website URLs,
  subtitle "Party Games with Friends", Games / Casual category and privacy URL.
  https://appstoreconnect.apple.com/apps/6825284815/distribution
- Google Play form prepared: 8Playo, `com.partybot` (available), Game, Free,
  English (U.S.). Owner approval requested for Developer Program Policies,
  Play App Signing Terms of Service and US export compliance before Create.
- RevenueCat `da5545b5` has no real provider. iOS form prepared; Save rejects
  missing In-App Purchase P8 / key ID / issuer. No provider creation claimed.
- EAS: Android preview APK `09edb25b-c6aa-4872-b579-6cccdf7ec618` FINISHED,
  1.3.0 / 2. Latest finished iOS `a8fb65ac-1aa5-4750-8243-038b7e31306e` is
  simulator-only, 1.1.1 / 3. Neither is a current store release artifact.
- `credentials:configure-build --platform ios --profile testflight` reached the
  Apple password prompt. Owner enters credentials/2FA directly; browser login
  is separate. No signing completion or new build is claimed.

## Public listing values

| Field | Value |
| --- | --- |
| App name | 8Playo |
| Subtitle | Party Games with Friends |
| Google short description | Party games, quick challenges, and tools for your next get-together. |
| Developer website | https://8playo.com |
| Support | https://8playo.com/support/ |
| Privacy | https://8playo.com/privacy |
| External account deletion | https://8playo.com/delete-account/ |
| Support email | info@digiget.com |
| Category / language | Games / Casual; English (U.S.) |

Support/deletion pages are prepared in this batch. Replace the iOS homepage
support URL with the dedicated support URL only after verifying live publication.
Keep the developer website on 8playo.com for AdMob app-ads.txt discovery.

## Remaining sequence

1. Create Play record after owner declarations; inspect actual testing and
   production-access requirements. Do not assume a personal-account exemption.
2. Complete accurate audience/content ratings, content rights, Data Safety / App
   Privacy, review access/contact details and EU trader status. Existing in-app
   deletion remains; the external instructions do not promise automatic deletion
   or bypass ownership verification. Review SDK disclosures against real builds.
3. Configure real store purchase credentials/providers, products, entitlements
   and sandbox purchase/restore verification. Production RevenueCat guard stays
   enabled. Do not invent prices or use test keys to satisfy the guard.
4. Complete iOS distribution signing; build a current TestFlight IPA and Play
   AAB with appropriate profiles. Keep preview/TestFlight ads in test mode.
5. Capture screenshots from actual signed versions; verify audio, login/deletion,
   small-screen controls, consent/ads and purchases on iPhone/Android devices.
6. Upload, satisfy testing requirements, submit and confirm store availability.
   Then connect verified supported store URLs to the existing AdMob IDs and
   verify app-ads.txt/app readiness. A draft Apple ID is not a published listing.

## References

- https://developer.apple.com/help/app-store-connect/create-an-app-record/add-a-new-app/
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/admob/answer/10564477
