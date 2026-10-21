# 8Playo iOS release

## October 21, 2026 update

This section supersedes historical notes below. Source version/runtime is 1.3.0.
Registered explicit `com.partybot` under DIGIGET LTD with Associated Domains and
Sign in with Apple. Created App Store Connect app **6825284815**, SKU `8playo-ios`.
Version 1.3.0 is Prepare for Submission; English metadata and privacy URL saved,
manual release selected. Updated Program License Agreement shows Accepted
October 21 in the developer account; the stale Connect warning cleared on reload.

EAS still has no current physical iOS store build. Signing configuration reached
the Apple password prompt; owner must complete login/2FA directly. No signing
completion, TestFlight upload or review submission is claimed. RevenueCat needs
the actual In-App Purchase key/issuer, products and sandbox verification. Keep
the production guard. See STORE_RELEASE.md for current records and next steps.

## Confirmed account and application

- Apple Developer organization: DIGIGET LTD.
- Apple team: `9R9TPVS9UL`; membership renews September 8, 2027.
- Bundle identifier: `com.partybot`; version/runtime: `1.1.1`.
- EAS project: `b7949f49-aef7-4963-9d95-5eb35280136e`, owner `imehdiamiri`.
- Firebase client plist matches `com.partybot` and `partyplay-8`.
- Config introspection includes Apple Sign-In and the Google reversed-client URL scheme.

## TestFlight configuration

`testflight` in `expo/eas.json` uses store distribution, a physical-device binary,
remote auto-increment, and the preview channel/environment. It uses the existing
native appVersion runtime. It does not use Expo Go or ad-hoc device registration.
Unverified RevenueCat keys are stripped; purchase readiness is not claimed.
Public release still uses the separate production profile and its credential guard.

Run from the `expo` directory in an interactive terminal:

```powershell
npx eas-cli credentials:configure-build --platform ios --profile testflight
```

The account holder should enter the Apple password and any Apple verification code
directly into the terminal. Do not send them in chat, put them in files, or commit
signing material. Confirm the selected team is DIGIGET LTD (`9R9TPVS9UL`).

After signing is configured:

```powershell
npx eas-cli build --platform ios --profile testflight --non-interactive --no-wait
```

Record the returned build ID and verify FINISHED before submitting. Never select
an old SDK54 simulator artifact. Submission must target the confirmed 8Playo
App Store Connect app ID `6825284815`.

## Remaining external prerequisites

1. First-use App Store Connect Terms of Service requires the owner's explicit
   acceptance. The terms modal currently blocks the Apps page.
2. EAS signing setup reached the Apple password prompt; no signed iOS build was
   queued. The logged-in browser session does not authenticate the EAS CLI.
3. Inspect existing App Store Connect records before creating PartyBot; verify
   bundle identifier ownership and avoid duplicates. Then record its numeric app ID.
4. RevenueCat's App Store provider setup requires the in-app purchase key and
   issuer configuration. Keep signing/server credentials private; never bundle
   them. Public SDK keys, products, entitlements and sandbox purchase/restore
   flows require verification before public release.
5. Complete accurate store metadata, screenshots, privacy disclosures, age rating,
   review information and applicable business agreements after account access.
6. Test the signed binary on an iPhone/iPad: first launch, Apple/Google/email login,
   deletion, microphone/reverse audio, game play, background/resume, offline launch,
   invite links and purchases. JavaScript export is not an Xcode build or device test.

No TestFlight upload, App Review submission or App Store approval is claimed.
