# Release log

## 2026-09-06 — Eye Sight feedback / all-game start guides

- Source: `5a5b89a42145642a470208dee587ec706ab5b0f0`.
- Pre-change recovery: `checkpoint/before-eyesight-intros-2026-09-06`.
- Eye Sight numbers now use readable medium-weight monospace without glow.
  Feedback includes attempts, correct/wrong counts, original number, positional
  red/green answer digits with crosses/checks, and round history. First-round
  failures are no longer incorrectly classified as skipped.
- All 16 games have three short action steps and a vector icon. The former
  once-ever asynchronous overlay is no longer used. Game mounting is gated;
  Eye Sight, Pass & Guess and Guess the Seconds defer guides until their internal
  settings have been selected. Shared scoreboard replay callbacks are gated too.
- `npm run typecheck`: passed. `npm test -- --runInBand`: 147 tests / 17 suites
  passed. One-off web export: 91 routes. No persistent development server.
- Firebase Hosting deployment to `partyplay-8`: succeeded; https://partybot.games
  returned HTTP 200 referencing `entry-3cd2e74c25de8e1e9a0b10aad52cef54.js`.
  Generated web output replaced from the export; tracked previous versions remain
  recoverable in Git. Handwritten assets/legal pages preserved.
- Live browser: 390x844 Eye Sight difficulty -> guide -> ready -> countdown ->
  input -> feedback verified. Actual target 523 / answer 123 marked only digit 1
  red and 2/3 green. Feedback and guide fit mobile. Desktop numeric content stayed
  bounded (468px inner text at 1440px viewport). Memory Grid, Guess the Seconds,
  and Pass & Guess guide sequencing verified on production; no console errors.
- Expo Go SDK57 publication succeeded, branch `expo-go-sdk57`, environment preview,
  runtime `exposdk:57.0.0`, group `3fd8d0c6-1811-409b-885d-4b2da1188f68`.
  Android `01a0767e-f1a3-7074-b73c-0aa342f674d2`;
  iOS `01a0767e-f1a3-78a3-a575-d7810737f5c0`.
- No physical-device receipt or two-device room gameplay certification. Existing
  test-renderer deprecation and optional dynamic-import build warnings persist.
  No native dependencies/config, backend targets or account settings changed.
- Final recovery tag: `checkpoint/eyesight-guides-2026-09-06`; full Git bundle:
  `playbot-eyesight-guides-2026-09-06.bundle` in the Codex audit workspace.
  Remote Git push remains pending destination confirmation.

## 2026-09-06 — Reverse Singing large controls / independent playback

- Recovery: `checkpoint/before-reverse-playback-fix` at `ce24ca4`.
- Restored all original record/play/reverse/result/share controls to 100px height,
  with 100px circular secondary controls, larger icons and 15px button labels.
  Compact inline player headings remain. Retry is a separate adjacent button in
  the source recording row; it remains usable when source Record is locked.
  Source status now says Saved, not a misleading whole-card Locked.
- Only source Record remains persistently locked after capture. Existing audio
  remains playable during reversal of the mimic. Playback is briefly blocked
  while the microphone is live or a capture/reset operation is starting.
- Web playback now retains each take's decoded PCM buffer and plays it through
  Web Audio, resuming from the Play gesture. Starting the mimic cannot replace
  the source buffer. Repeated playback replaces its source node; Retry/unmount
  cancels pending resume/decode and clears cached buffers and recording URLs.
  Removed silent HTMLAudioElement failure handling; errors now appear inline.
- Native playback uses a ref-owned player with generation guards instead of a
  state-owned cleanup effect. Explicit speaker routing is restored on playback.
  Removed an unnecessary 400ms delay after the WAV writer has already completed.
- Verification: TypeScript passed; 143 tests / 16 suites passed, including actual
  component button flows with synthetic/mocked audio: record → reverse/slow play
  → mimic → Result → replay → Retry → new source; native WAV reversal byte order;
  pending playback cancellation; visible errors; source playback during processing.
  These do not certify physical microphone/speaker behavior on a user's device.
- Added react-test-renderer 19.2.3 as a development-only dependency for interaction
  regressions; no native/runtime dependency changed. Its deprecation warning is
  expected in the test runner and is not a production app error.
- Source commit: `cf4edcb`. Firebase Hosting deployment succeeded for partyplay-8;
  live setup returns HTTP 200 and bundle `entry-956e714b4b2c91899d3200c015c4dee1.js`.
  Live 390×844 screenshot and DOM measurement: all eight original action controls
  are 100px tall; initial two-player screen fits without vertical scrolling.
  No console errors on the inspected route. Temporary browser viewport was reset.
- Expo Go SDK57 group: `26e20494-cac2-48d8-8708-46dc6c3895aa`;
  Android `01a07453-6e62-7c01-8336-262c2bd66013`,
  iOS `01a07453-6e62-712f-bb95-b29a57ee05a1`.
  Both manifests verified HTTP 200, runtime `exposdk:57.0.0`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/26e20494-cac2-48d8-8708-46dc6c3895aa
- Recovery tag: `checkpoint/reverse-playback-fixed-2026-09-06`; full-history
  backup `playbot-reverse-playback-2026-09-06.bundle` in the Codex audit workspace.
  No remote Git push, backend deployment or persistent local server.

## 2026-09-06 — Owner-requested Firebase / EAS republish

- Clean checkout at `913cd3a`; no source changes pending. Current live web and
  both Expo manifests matched the verified 2026-09-05 content release.
- Republished the unchanged checked-in web output with Firebase Hosting only:
  `firebase-tools deploy --only hosting --project partyplay-8 --non-interactive`.
  Service confirmed release complete. https://partybot.games returns HTTP 200,
  bundle `entry-942f76d7368d7e9aa7369cafee14065e.js`.
- Republished verified EAS group `b8f162c8-86d3-43f8-87a0-adfd6fc7a491` to the
  same `expo-go-sdk57` branch on both platforms, without rebuilding identical code.
  New group: `5ab3d875-f482-4355-aa1c-59ffef6207d7`.
  iOS: `01a0743c-a1a5-7669-a765-720a29e299cd`.
  Android: `01a0743c-a1a5-76a6-8da6-aa905894b60d`.
  Both channel manifests independently verified HTTP 200 and these new IDs,
  runtime `exposdk:57.0.0`. No custom-binary or production channel was changed.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/5ab3d875-f482-4355-aa1c-59ffef6207d7
- Existing source backup `playbot-content-tools-reverse-2026-09-05.bundle` remains
  valid; deployment-record checkpoint `checkpoint/republished-2026-09-06`.
  No app code changed, no repeated test suite, no persistent local server.

## 2026-09-05 — Ready-to-use content expansion / Imposter replay variety

- Recovery: `checkpoint/before-content-expansion` at `7034910`.
- Added 1,200 individually authored offline cards; 2,216 visible cards total.
  Act 109 → 229; Talk 437 → 937; Challenges 92 → 212; Penalty 79 → 169;
  Couple 91 → 211; Most Likely To 208 → 458. Favorites is a saved collection,
  not a generated category. Existing IDs, favorites and custom cards are preserved.
- New content spans creative acting, small adventures, practical creativity,
  friendly discussions, harmless fictional penalties and thoughtful couple play.
  All additions are non-spicy. No remote generation, backend or new dependency.
  Pack IDs and published line order are append-only to keep saved IDs stable.
- Card decks now use Fisher–Yates rather than biased random-sort shuffling.
- Imposter previously defaulted to just 15 words. The default now spans all
  1,350 unique string entries across 11 topics. Added an optional topic picker.
  Topic counts and labels derive from the same source as the session word pool.
- Uniform random selection among least-used words prevents repeats within a
  topic cycle. Global per-word history also respects themed rounds when switching
  to All topics. Counts survive normal app restarts via local AsyncStorage.
  Immediate repetition at a cycle boundary is avoided. Pending draws serialize;
  role reveal waits for initialization. No secret word is shown in setup.
- Corrupt/unavailable storage falls back to session-memory history. History is
  local, not synchronized between devices or independently running browser tabs.
  Clearing app/site data resets it. No changes to multiplayer/backends.
- Checks: TypeScript passed; 136 tests / 13 suites passed; 91 routes exported.
  Tests cover counts, IDs, new-text duplicates, filters, old favorites, whole-bank
  coverage, restarts, concurrent draws, topic changes and blocked/corrupt storage.
  Web bundle: `entry-942f76d7368d7e9aa7369cafee14065e.js`.
- Source release: `4682580`. Firebase Hosting deployment succeeded on partyplay-8;
  https://partybot.games/cards/talk returns HTTP 200 with the expected new bundle.
  Live browser checks: Talk shows 937 cards including new prompts; All topics shows
  1,350 words, Animals shows 140; setup → local round → private word reveal works.
  No console errors in the checked flows. Wheel spin completed with a result.
- Expo Go SDK57 update published successfully on both platforms:
  group `b8f162c8-86d3-43f8-87a0-adfd6fc7a491`,
  Android `01a072d2-99cd-749f-9830-5155574250ef`,
  iOS `01a072d2-99cd-700e-ba36-6227a713c04a`.
  Branch/channel `expo-go-sdk57`, runtime `exposdk:57.0.0`, environment preview.
  This update also includes the preceding tool/audio/Reverse Singing changes.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/b8f162c8-86d3-43f8-87a0-adfd6fc7a491
- Final recovery tag: `checkpoint/content-tools-reverse-published`.
  Full-history bundle: `playbot-content-tools-reverse-2026-09-05.bundle` in the
  Codex audit workspace (outside the app repository). Remote Git push remains
  intentionally pending destination confirmation. No persistent local server.

## 2026-09-05 — Tool effects / Wheel redesign / Reverse Singing handoff

- Recovery: `checkpoint/before-how-it-works` at `34516d9`.
- Fixed invalid `rgba(...)22` instruction badge colors. All game detail steps now
  have valid translucent backgrounds, white numerals and non-shrinking badges.
- Wheel: violet/teal segments, readable rounded labels, compact pointer and hub,
  decorative detents, new title/result treatment and bounded responsive layout.
  Pointer-based winner selection is unchanged. Motion now eases out over 6.2s.
- Added 12 original generated tool effects (six attack/tick + six completion sounds).
  Wheel, bottle and coin ticks follow actual animation angle changes; dice tumbles
  and ticks slow together, team shuffle has paper-like ticks, hourglass has gentle
  final countdown ticks and a bounded three-note alarm. No repeating global loop.
- Web Audio unlocks from the initiating gesture and uses locally synthesized PCM;
  native Expo audio uses equivalent bundled WAVs and a small player pool. No new
  native dependency. Sound toggle, blur/unmount and background stop active voices;
  pending native seeks cannot resurrect sound after mute/disposal. Deferred tool
  callbacks are screen-owned and cleaned up on leaving. No persistent local server.
- Reverse Singing: source recording locks until Retry; player two must wait for
  a successfully reversed source. Record buttons name the responsible player.
  Retry stops playback, revokes web URLs and clears both original/reversed takes
  and durations. Handler guards block overlapping capture and processing.
- Compact player headings put name/instruction on one line; 54px controls replace
  100px controls. Removed the nonfunctional history placeholder, retaining current
  take playback/share. Scroll fallback remains for accessibility and small heights.
- Checks: TypeScript passed; 128 tests in 12 suites passed; 91 web routes exported.
  Firebase Hosting deployment completed successfully for partyplay-8.
  Expo Go SDK57 group: `10602fbb-086c-4b13-967f-3968c2f0c0f3` (both platforms).
  Android: `01a072bd-543e-76b7-b7bb-cb72f245480e`;
  iOS: `01a072bd-543e-7b1f-b51f-3e4d8f270b88`.
  Live 390×844 check: step numerals 1–4 white and visible; Reverse Singing
  original/mimic controls fit without vertical scrolling; player two disabled
  until a source exists. No microphone recording was made during browser QA.
  Real-device microphone/audio-output quality remains a manual verification.
  Reference: https://docs.expo.dev/versions/latest/sdk/audio/.

## 2026-09-05 — Remove Team Mode, restore web icons, refresh bottom navigation

- Recovery: `checkpoint/before-team-nav-icons` at `1108107`.
- Removed Team Mode enum, labels, assignment/start screen and multiplayer branches.
  Old `/team-setup` bookmarks only redirect home. The independent Team Splitter
  randomization tool is retained; individual multi-phone gameplay is unchanged.
- Live diagnosis: glyphs requested font family `MaterialIcons`, while root font
  loading registered `material`. Replaced the private createIconSet workaround
  with the public MaterialIcons component; native iOS SF Symbols remain unchanged.
  Reference: https://docs.expo.dev/guides/icons/ (font preloading).
- Selected bottom tabs use a short accent line and matching icon/label color,
  without the circular selection background. Preserved touch targets, safe-area
  spacing, keyboard hiding and navigation behavior; added explicit spoken labels.
- TypeScript passed. Existing 107 tests passed; four additional mode/icon regression
  tests passed, including checking every mapped Material glyph exists.
- Web export succeeded: 91 routes, `entry-18b1f252a05920c6463078f616058eae.js`.
  Synced generated Hosting output, preserving legal pages and rewriting asset paths.
  This web release also incorporates the already-committed SDK 57 migration.
- Source release: `86778987827a3d2ceece41c4b744b93ecb065fad`.
- Firebase Hosting deployment succeeded (316 files); no backend targets deployed.
- First live pass confirmed icons and tab selection, but exposed a React hydration
  error: parent font loading could complete before nested boundaries hydrated their
  empty static icon placeholders. Added a stable server/first-hydration snapshot
  with useSyncExternalStore (native/client-only mounts render immediately).
  Reference: https://react.dev/reference/react/useSyncExternalStore#adding-support-for-server-rendering
- Re-exported and redeployed that focused correction. Final web bundle:
  `entry-551e550c0a8adb4aa68584bb90b7927a.js` at https://partybot.games.
  Live DOM confirmed this exact bundle and `material` font family. The corrected
  home load no longer reported the earlier React error. Mobile viewport 390x844
  had document width 390 (no horizontal overflow); desktop icons and Games/Tools/
  Friends selection were visually checked. Memory Grid setup and round start worked.
- Expo Go update succeeded from 8677898 for Android and iOS, branch/channel
  `expo-go-sdk57`, runtime `exposdk:57.0.0`, group
  `0e24a31a-7c57-4116-90ae-d770a063740d`:
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/0e24a31a-7c57-4116-90ae-d770a063740d
  Verified HTTP 200 manifests with IDs iOS `01a0723b-1a34-7082-ae62-9bfda6149304`
  and Android `01a0723b-1a34-7dc1-91ed-c0906c4a1ebc`.
  The subsequent web-only hydration correction is in Hosting; the published native
  preview already has all requested UI/mode changes and does not hydrate HTML.
- No persistent local server. Physical-device receipt/rendering remains unverified.
  Git remote push remains blocked pending explicit destination confirmation.
- Final checks: TypeScript passed; all 112 tests in nine suites passed. Direct
  `/team-setup` navigation was verified to return home; final browser error log
  was empty. A browser-control timeout prevented certifying the Memory Grid Exit
  interaction; navigation recovered afterward. Do not count this as a full game
  completion test. Temporary mobile viewport override was reset.
- Final recovery tag: `checkpoint/team-nav-icons-published`. Full Git history
  backup: `playbot-team-nav-icons-2026-09-05.bundle` in the Codex audit workspace.

## 2026-09-05 — SDK 57 / Expo Go compatibility (1.1.0)

- Recovery tag: `checkpoint/before-sdk57` (f79c466); existing 1.0.1 bundles preserved.
- Upgraded Expo to 57.0.20, React Native to 0.86.3, React to 19.2.3 and aligned SDK
  packages with Expo's bundled dependency map. Reviewed SDK 55/56/57 breaking changes.
- Replaced removed expo-av with expo-audio behind a tested game-audio boundary.
  Preserves playback completion, millisecond scoring, rate/pitch and cleanup.
  Reverse Singing captures actual PCM16 and writes WAV using the device sample rate;
  no compressed recording is mislabeled as WAV. Capture is bounded to 61 seconds.
- Prevented RevenueCat native loading in Expo Go. Existing Google Sign-In guard
  remains: use email/password there; real native purchases and Google login still
  require a custom build. Web behavior remains local-first.
- Migrated removed absoluteFillObject usages, widened symbol-name types, normalized
  unspecified themes, used Expo Router's own theme context, and updated Jest types.
- App/runtime version for future native binaries is 1.1.0; old 1.0.1 binaries must
  not receive these native-incompatible changes.
- app.config.js uses SDK-scoped runtime ONLY when APP_VARIANT=expo-go. Publish that
  preview to separate branch `expo-go-sdk57`, never the installed-app preview branch.
- Verification: TypeScript PASS; Expo Doctor 21/21 PASS; 52 tests across five focused
  game/audio/Expo Go/offline suites PASS. One-off iOS/Android/web export succeeded
  (91 web routes). Publishing re-exports after final npm deduplication.
- No persistent local server. Firebase live site has NOT been replaced for this
  mobile SDK upgrade. No SDK 57 custom native build or store submission requested.
- Device playback, microphone capture and opening the published update in Expo Go
  need physical-device verification; successful bundling is not that verification.
- npm reported 26 dependency advisories after dependency alignment; no broad
  `npm audit fix --force` was applied. These need a separate scoped security review.
- The older Android 1.0.1 build completed successfully:
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/builds/248b4e41-f2a2-4301-a368-7e6bee8203d9
  It is NOT the SDK 57 / Expo Go preview.

### SDK 57 publication confirmation

- Source commit: `ebf1cc1fd93795106e8e5522b4422ff107d2125d`.
- EAS Update succeeded for both platforms; group `92298e91-9671-4659-8cb8-eae7ce1af720`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/92298e91-9671-4659-8cb8-eae7ce1af720
- Dedicated channel `expo-go-sdk57` points to branch `expo-go-sdk57`.
  Existing `preview` / `production` channels were not changed.
- Verified remote multipart manifest responses for BOTH platforms: HTTP 200,
  runtime `exposdk:57.0.0`, SDK `57.0.0`, non-empty launch assets and matching IDs:
  iOS `01a0721a-846c-7d00-af04-1eb633756579`,
  Android `01a0721a-846c-72f5-8c88-d4d26effaf80`.
- Expo Go link: `exp://u.expo.dev/b7949f49-aef7-4963-9d95-5eb35280136e?channel-name=expo-go-sdk57`.
  Use this new preview, not the old SDK 54 entry in Recent. Sign into the Expo
  project owner's account if Expo Go requests project access.
- Final export after dependency deduplication also succeeded for both native
  platforms and all 91 web routes. No physical Android device was connected;
  the temporary ADB daemon used to check was stopped afterward.

## 2026-09-05 — Codex takeover / 1.0.1

### Recovery checkpoint

- Before changes: `f636fafc33d9920b24666688a7edcaa2a188d84c`.
- Tag: `checkpoint/2026-09-05-before-codex`.
- Full Git bundle (verified):
  `C:/Users/Mehdi/Documents/Codex/2026-08-14/playbot-antigravity-ios-android-audit/playbot-checkpoint-2026-09-05.bundle`.
- Existing origin: `https://github.com/imehdiamiri/partybot-anti`; push was blocked by
  auto-review pending explicit destination confirmation. Local checkpoint is complete.
- This checkpoint preserves the accumulated previous work; it is not a claim that
  every historical change was tested. Ignored credentials are not in the Git bundle.

### Changes

- Archived the Antigravity dispatch workflow; Codex now implements and releases.
- Removed unused AI toolkit and notifications dependencies. Retained the previously
  transitive `lucide-react-native@1.14.0` as a direct dependency used by Eye Sight.
- Declared Puppeteer as a dev dependency so existing browser checks survive npm install.
- Blocked Android external storage permissions; kept audio/network/haptics.
- Removed the unused iOS push entitlement through notifications package removal.
- Updated centralized privacy/terms links to clean URLs; removed duplicate cleanUrls config.
- Registered Firebase iOS app `1:1003126250476:ios:f23fe8802be78409fa7ec9`
  for `com.partybot`. Downloaded the official service file to the ignored local path
  and referenced it in app.json. Introspection now includes the real Google URL scheme.
- Set app/package/runtime version to 1.0.1 and preview builds to the preview channel.
- Created Expo preview channel pointing to its existing preview branch. Uploaded only
  the ten EXPO_PUBLIC client settings from local .env to the preview EAS environment.
- Added EAS upload ignore files: exclude .env and signing/server secrets, include only
  the required Firebase client service files for native prebuild.

### Verification

- Typecheck PASS; environment guard PASS; 45 game/auth tests PASS.
- Expo doctor PASS (18/18 after cleanup and again after the final dependency changes).
- Native introspection PASS: Google iOS scheme present, no aps-environment entitlement,
  both external-storage permissions marked tools:node=remove for manifest merging.
- Initial removal changed no retained package versions; one necessary direct dependency
  and one browser dev dependency were then explicitly added.
- Web export PASS: 91 routes, bundle `entry-a77aa41a7ccbf5b7750ac3c8706bb6f3.js`.
- Live `test-task50-release-integrity.js --base-url https://partybot.games` PASS:
  mobile 390x844 and desktop 1440x900, offline Memory Grid interaction, tool headers,
  Bottle image transparency/session, Sound Match/cards/profile primary paths,
  eight direct-entry/hard-refresh routes and browser back/forward. No recorded
  first-party errors, HTTP errors or forbidden dynamic requests. This is targeted
  release verification, not proof that every game and every device is bug-free.

### Published releases

- Prepared source commit: `9cf33e3a420c0c8ab261cc35852780e2af188ed4`.
- Tag: `release/1.0.1-prepublish`.
- Firebase Hosting deployment completed successfully (316 files) using
  `firebase deploy --only hosting --project partyplay-8 --non-interactive`.
- Live URLs: https://partybot.games and https://partyplay-8.web.app.
  Browser verification confirmed the exact exported bundle above. No database rules
  or Cloud Functions were deployed.
- EAS Update published successfully to preview (Android and iOS), runtime `1.0.1`:
  group `0b373b79-4c59-4a35-ad34-f7d4ddc8bcbe`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/0b373b79-4c59-4a35-ad34-f7d4ddc8bcbe
- Android preview build submitted: `248b4e41-f2a2-4301-a368-7e6bee8203d9`,
  version 1.0.1 / versionCode 1. EAS generated a new cloud-managed Android keystore.
  Build status at this entry: IN_PROGRESS; not yet certified as installable.
- iOS preview build did not start: EAS has no suitable physical-device internal
  distribution credentials. Needs owner-assisted Apple Developer authentication,
  signing/provisioning and device registration before retrying. No App Store or
  Play Store submission was performed.

### Final legal-link correction

- Live HTTPS checks exposed a certificate-name mismatch on www.partybot.games.
  Centralized legal/marketing URLs now use the working apex domain. DNS and
  certificates were not modified; www TLS needs separate investigation.
- Source commit: `69f4878ac648edf8e9eb4dd5bcf0ca4e6cdafed6`.
- Re-exported 91 web routes and successfully redeployed Firebase Hosting.
  Final live bundle: `entry-7a2512ae5fe9987e07daebb79b9e2103.js`.
- Verified live /profile references that exact bundle; both corrected legal URLs
  appear in it and return HTTPS 200 with the actual Privacy Policy / Terms titles.
  The earlier full browser smoke preceded this URL-only change.
- Superseding EAS preview update (Android/iOS, same compatible runtime 1.0.1):
  `4304af4d-5702-49f6-a23e-4c432325f40e`, published successfully.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/4304af4d-5702-49f6-a23e-4c432325f40e
- The Android binary was submitted from 9cf33e3; the URL correction is delivered
  through this same-runtime OTA. Real-device installation/OTA receipt is not yet
  verified. Publishing an update does not prove a device has downloaded it.

### Mobile compatibility

The existing EAS build history uses old bundle/package identifiers; iOS builds are
simulator builds. No existing build proves physical-device compatibility with 1.0.1.
The new preview update requires a matching new native build. Do not present an update
URL as proof of Expo Go compatibility or successful installation on a real phone.

### Remaining configuration

- iOS physical-device signing/provisioning for com.partybot is blocked as described
  above. Android credentials were generated by EAS; retain them for future updates.
- Apple Team ID and Play signing SHA-256 fingerprints are still needed before publishing
  correct Universal Links/App Links association files. No placeholders were generated.
- RevenueCat product/entitlement dashboard setup and real-device auth/audio/purchase
  checks are not certified by typecheck, export or native introspection.

### Account hygiene

The Firebase CLI login-list JSON unexpectedly included authentication fields in tool
output. They were not added to project files, commits or releases. Future identity
checks must select only non-sensitive fields before emitting output. The owner should
revoke/re-authenticate that CLI session after this release; this is separate from
application Firebase client API keys, which are public configuration.
