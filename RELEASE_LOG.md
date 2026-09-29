# Release log

## 2026-09-30 — Bounded concurrency and security benchmark

- Baseline/checkpoint: `1699b17e6c69277fb41f0431cdd843c980f5a2e9`,
  `checkpoint/2026-09-30-before-benchmark`. Batch tag:
  `audit/2026-09-30-concurrency-benchmark`.
- Added repeatable emulator-only 100/1,000-client workloads, adversarial payload
  probes, and a finite 22-request read-only Hosting probe. Report and reviewed JSON:
  `docs/benchmarks/2026-09-30.md`, `docs/benchmarks/2026-09-30-results.json`.
- Final 30-second scenarios: 1,050 / 10,500 operation groups, zero workload errors,
  100/100 and 1,000/1,000 final state recipients. Guest action p95 45 / 166 ms;
  three-action host drain p95 108 / 559 ms. Local emulators, not production or
  physical-device capacity certification. Initial emulator INTERNAL_ERROR is
  disclosed; an earlier batched-drain run is not substituted for final metrics.
- Checks: `firebase-tools emulators:exec --only database,firestore --config
  firebase.security.json --project demo-partybot-benchmark "node
  functions/benchmark-suite.cjs"` completed both final load scenarios and probes;
  initial Jest config discovery failed. Fixed runner and ran `--checks-only`
  against those isolated emulators: 75 backend/rules tests PASS. Expo `npm test`:
  45 suites / 323 tests PASS. Script syntax and diff checks PASS.
- `node scripts/benchmark-live.cjs`: 22/22 HTTP 200; homepage warm median 91.5 ms,
  p95 246.1 ms; first fetch 1,630 ms. Main JS 10.57 MB decoded / 1.48 MB Brotli.
  Read-only Google API checks confirmed billing enabled and 12 ACTIVE functions,
  each max 20 instances, concurrency 80, min 0. No cloud settings changed.
- `npm audit --omit=dev`: zero high/critical; backend 15 moderate, Expo 49 moderate.
  Confirmed local payload limit bypasses, missing reviewed App Check enforcement,
  broad room listeners/scans and absent browser hardening headers are documented
  follow-ups. Previous legacy key revocation remains unverified. No claim that
  all security issues are fixed or that 1,000 production users are certified.
- All test-created Java emulator processes were identified and stopped after
  checks. No permanent server, live test users, billable load campaign, app changes
  or cloud deployments. Existing live URL https://partybot.games unchanged;
  mobile build/update IDs unchanged, native runtime 1.2.0 / Expo Go SDK 57 unchanged.
- Commit/tag are pushed normally to the existing origin after review; no history
  rewriting or private raw logs/credentials are included in this batch.

## 2026-09-29 — GitHub synchronization verified

- User approved one-time atomic force-with-lease history repair. GitHub accepted
  all guarded ref updates (exit 0). Main reached
  d8a965b774201fdd7e2f06ea7e4f63b2c44acb02; all 112 local tags matched remote
  object IDs with zero mismatches. A fresh shallow clone directly from GitHub
  returned identical HEAD. Public repository:
  https://github.com/imehdiamiri/partybot-anti
- Source audit/repair tag: release/2026-09-29-github-sync. Final receipt tag:
  release/2026-09-29-github-sync-verified. Earlier published cloud build/update
  receipts are unchanged; this batch did not redeploy Firebase or EAS.
- Current source tree was preserved byte-for-byte through sanitization. Ignored
  credentials and private original-history bundle remain local. Empty env
  templates and MAC_SETUP.md cover fresh Mac/Windows continuation.
- The historical upload incident remains documented above. Rewriting refs does
  not revoke exposed credentials or guarantee removal from caches/clones.
  Revoke/rotate the two legacy RevenueCat private keys; request GitHub sensitive
  data/cache cleanup if required. Original unsafe history must not be re-pushed.
- Future completed batches are authorized to push normally to this origin;
  use checked command outcomes, fetch before editing on another machine, and
  never repeat a forced history change without explicit owner approval.
- Verification: diff check PASS, 3,364 outgoing text blobs scanned clean for
  targeted secret patterns before push, remote ref comparison PASS, fresh clone
  PASS. No application code changes in this batch, so prior 323-test result was
  not unnecessarily rerun. No credentials or token values are in these receipts.

## 2026-09-29 — GitHub history sanitization incident / repair pending

- Sanitization in an isolated clone completed: 108 outgoing commits processed,
  111 recovery tags retained, final source tree exactly identical. Re-scan of
  3,364 outgoing text blobs and filenames found no targeted private-key patterns,
  credential files or files above GitHub's 100 MiB limit. Complete original
  history is preserved in ignored .backups/pre-github-sanitize-2026-09-29.bundle.
- Execution incident: Python text-mode stdin emitted CRLF to git update-ref,
  causing the ref transaction to fail. The surrounding PowerShell invocation
  did not stop on that native-command failure and ran its following push.
  Remote main was observed at unsanitized b6b303e; the original tags were also
  pushed. Treat the two legacy RevenueCat keys as exposed and revoke/rotate
  them in the provider. No secret values are recorded in this document.
- Stopped further publication, disclosed the incident to the owner and asked
  for a specific one-time exception to AGENTS.md's no-force-push rule. Repair
  requires atomic force-with-lease on affected refs, preserving concurrent-work
  protection. No approval is inferred from elapsed time.
- Owner explicitly approved the one-time force-with-lease replacement of main
  and affected tags on 2026-09-29. Repair receipt follows verification.
- Corrected local ref transaction to binary LF input; local main now uses the
  verified sanitized history. Future dependent commands must use checked return
  codes or separate invocations, never fall through into a push after failure.
- Original checkpoint b6b303e became 0a0ac8b after sanitization; old commit hashes
  in prior release notes refer to the private pre-sanitization backup. Named
  release tags remain available in the cleaned history. No cloud app redeploy
  or runtime change is part of this Git-only operation.

## 2026-09-29 — GitHub synchronization and cross-computer setup

- Owner explicitly authorized synchronizing the existing origin
  https://github.com/imehdiamiri/partybot-anti and keeping completed work current
  for Mac/Windows continuation. Repository metadata confirms it is public.
- Initial state: clean main at 3d05f5a, remote main 1bba36a; 107 local commits
  ahead, zero behind after fetch. Recovery checkpoint:
  checkpoint/2026-09-29-before-github-sync.
- Added MAC_SETUP.md and empty environment templates; strengthened ignored
  credential/signing patterns. Updated AGENTS.md with the owner's push authority
  and native runtime 1.2.0. No app behavior or cloud release changed.
- Pre-push scan of 3,357 outgoing text blobs found two private-key-shaped
  RevenueCat values in 27 historical generated web bundles. Current source is
  clean. Do not push the original unsanitized history/tags. Preserve a private
  local Git bundle and sanitize outgoing history in a separate local clone.
  Rotation/revocation of those legacy keys remains an account-owner action.
- Historical commit IDs referenced by older release entries may change during
  sanitization; release/checkpoint tag names remain the recovery interface.
  Remote synchronization confirmation is recorded in a follow-up receipt.

## 2026-09-29 — remove unused Spicy catalog records

- Owner requested removing Spicy. Checkpoint:
  `checkpoint/2026-09-29-before-spicy-removal` at `a0f0475`.
  Final source/receipt tag: `release/2026-09-29-remove-spicy`.
- Traced the actual catalog export and corrected the preceding source-only
  audit: Spicy records were already excluded by the ORIGINAL_CARDS filter,
  so they were not playable or present in built-in Favorites lookup. Removed
  all 422 unused records and the MLTSpicy enum/title from source, rather than
  merely renaming/hiding a title. The active 2,888-card catalog is unchanged.
  CONTENT_RIGHTS_REVIEW.md now records this distinction explicitly.
- TypeScript PASS; all 45 Jest suites / 323 tests PASS, including catalog count,
  translation coverage, favorite navigation, native consent and audio tests.
  Web export/sync PASS. Live bundle verified free of `mlt-spicy-26` and its
  removed strip-card prompt. No new dependency or native-runtime change.
- Firebase Hosting-only deployment confirmed complete for partyplay-8.
  https://partybot.games/ returns 200 and loads
  `entry-1e8a65da0c97d47426d1006743f93638.js` (also verified 200).
- Expo Go update confirmed on branch expo-go-sdk57, runtime exposdk:57.0.0:
  group `3e26450d-5038-4796-997d-1c94c9c51410`, Android
  `01a0edbb-ac28-719a-bf53-1743b5b4860e`, iOS
  `01a0edbb-ac28-7720-b5e1-cdc75b4e5600`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/3e26450d-5038-4796-997d-1c94c9c51410
- Native preview update confirmed on branch preview, runtime 1.2.0 only:
  group `74ffe2e9-cc7c-4b2f-a240-bf20bdd30502`, Android
  `01a0edbc-1388-777a-a8fa-7150cf616110`, iOS
  `01a0edbc-1388-7d45-a2ee-5270bc046286`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/74ffe2e9-cc7c-4b2f-a240-bf20bdd30502
  Verified preview channel maps to preview branch. Old native 1.1.x runtimes
  do not receive this incompatible SDK/runtime. Android build
  `33cbf3ca-8f9f-409f-b427-aa438a86cf20` remains IN_QUEUE at last check;
  apply the 1.2.0 preview update when testing that binary. iOS signing and store
  setup/production credentials remain outstanding as in RELEASE_READINESS.md.
- No Git remote push, backend deployment, live-ad interaction, persistent
  server or store submission. Credentials and local service logs remain ignored.

## 2026-09-29 — advertising integration and iOS music removal

- Recovery checkpoint: `checkpoint/2026-09-29-before-ads-integration` at
  `70e3dfe`. Batch source/receipt tag: `release/2026-09-29-ads-ios-music`.
- Added Google Mobile Ads 17.2.0, Android/iOS app IDs and config plugin; native
  appVersion/runtime bumped to 1.2.0. Kept Expo Go native-module guards and SDK57
  runtime separate. Production RevenueCat key guard remains intact.
- Consent-gated native banners below Games, Tools and results; UMP gather,
  cached-consent/error handling, privacy reopening/revocation, no-fill handling.
  Native NPA requests, PG maximum content rating; preview/dev use test units.
  No interstitial/rewarded ads, no ads during active gameplay/auth/onboarding.
- Activated AdSense web product in the existing approved publisher account;
  created display unit `1116184196`. Published native/web Google European
  consent messages with a first-screen Do not consent option. Web auto ads off;
  explicit banner requests wait for Google's settled TCF decision. Profile has
  revocation access. Updated privacy disclosures and added `/ads.txt`.
- AdSense service confirmed site ownership and `Getting ready / Review
  requested` for partybot.games. This is not final approval or an impression.
  AdMob apps still require store association/review. No live ads clicked.
- iOS excludes Whitney mode via a platform module with no recording import;
  old saved mode values fall back to Metronome. Setup, hints and catalog match.
  iOS Expo export succeeded; assetmap contains no `whitney_raw`. Android/web
  remain unchanged for that recording pending the owner's scope decision.
  Content/license/age-rating findings recorded in CONTENT_RIGHTS_REVIEW.md.
- Checks: TypeScript PASS; Jest 45 suites / 322 tests PASS; follow-up consent
  regression suite 8/8 PASS after privacy-start race protection; diff check PASS.
  Web export/sync and iOS export PASS. Installed-device ads are not yet tested.
- Firebase Hosting only: `npx firebase-tools deploy --only hosting --project
  partyplay-8 --non-interactive` confirmed release complete. Live
  https://partybot.games and https://partyplay-8.web.app. HTTP checks confirmed
  home/ads.txt 200, exact seller declaration, updated policy and AdSense meta.
  Published web entry: `entry-7cfcec88e137b7ad84de92ca049b801f.js`.
  Browser loaded logged-out onboarding without an ad/crash; authenticated ad
  impression not tested. No persistent local server or backend deployment.
- Expo Go: `APP_VARIANT=expo-go eas update --branch expo-go-sdk57 --environment
  preview` confirmed published runtime `exposdk:57.0.0`, group
  `9cf898f2-4c16-4692-b1c9-ecb5b628788b`; iOS update
  `01a0edb3-4d6d-7cd7-81c3-3c2fb2567c4f`, Android update
  `01a0edb3-4d6d-7730-bc84-dbfa26f3c37d`. Native ads unavailable in Expo Go.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/9cf898f2-4c16-4692-b1c9-ecb5b628788b
- Android preview build accepted by EAS with existing remote keystore, version
  1.2.0: `33cbf3ca-8f9f-409f-b427-aa438a86cf20`, latest checked `IN_QUEUE`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/builds/33cbf3ca-8f9f-409f-b427-aa438a86cf20
  No completed APK, production build or store submission claimed. New iOS
  signing/app-record setup and production RevenueCat/store credentials remain
  blocked on genuine account input. AdSense approval and real-device checks
  remain outstanding; details in RELEASE_READINESS.md.
- Evidence screenshots in ignored `.security/ads-integration/`; CLI logs in
  ignored `expo/.expo/`. No credentials added, no remote Git push. Releases used
  the reviewed dirty working tree based on 70e3dfe, finalized by this batch tag.

## 2026-09-29 — store readiness audit and AdMob account preparation

- Recovery checkpoint: `checkpoint/2026-09-29-release-admob-audit` at `0db35b2`.
  Batch source/receipt tag: `release/2026-09-29-admob-readiness`.
- Audited EAS latest 12 builds and production environment names, AdMob,
  AdSense, Google Play, RevenueCat and App Store Connect after owner login.
  Detailed evidence and remaining work are in `RELEASE_READINESS.md`.
- NOT store-ready: no app records in either store; Apple Bundle ID picker empty;
  Paid Apps Agreement New/legal entity update and EU trader status outstanding;
  RevenueCat has no real store provider and production public SDK keys absent.
  Latest iOS build is a simulator binary, latest Android build an old preview
  APK. No new build, TestFlight upload, store submission or mobile OTA performed.
- Existing AdMob account is approved and payment profile complete. Created
  PartyBot Android (`~6209477204`) and iOS (`~1614877640`) under public publisher
  `9376144248169220`, plus Results Banner units Android `/8982231772` and
  iOS `/3746216966`. Service explicitly confirmed both creations. Both apps
  require review/store association; no real ad serving claimed.
- There is still no ads SDK, placement or web tag in the app. Consent messages,
  policy/disclosure changes, native integration and device tests remain work.
  AdSense active product is AdMob only; web monetization is not enabled.
- Published the exact account-provided `app-ads.txt` declaration, kept an Expo
  public source and added explicit copy handling to `sync-web-build.js`.
  `APP_VARIANT=expo-go npx expo export --platform web` and web sync PASS.
  Export regenerated bundle references despite no application source changes;
  saved a local generated patch/assets and restored only verified generated
  outputs to the published source. An initial broad restore was rejected by
  automatic review; a file-by-file verified, backed-up restore was approved.
  Preserved exact immutable JS bytes rather than Windows checkout CRLF output.
- Checks: TypeScript PASS; Jest 44 suites / 315 tests PASS; `node --check
  sync-web-build.js` PASS; seller-declaration equality PASS; production config
  guard correctly rejects missing RevenueCat keys. Physical devices, purchases,
  ad impressions and store-specific testing are not verified by these checks.
- Firebase Hosting only: `npx --yes firebase-tools deploy --only hosting
  --project partyplay-8 --non-interactive` confirmed final release complete.
  https://partybot.games/app-ads.txt and
  https://partyplay-8.web.app/app-ads.txt each return 200, text/plain and the exact
  verified declaration. Google's app-ads.txt crawl/approval remains pending and
  requires store association. Main app JS remains byte-identical to the previous
  live release: SHA-256
  `0190355187192734ab478f364800a8705eee5c8648442a84c034e654d711fb2b`.
- Native appVersion runtime 1.1.1 and Expo Go SDK57 runtime unchanged. Adding
  an ads native module later requires a compatible new binary/runtime. No
  backend deploy, persistent server or Git remote push. Browser proof and
  sanitized-audit source logs remain ignored under `.security/` / `.expo/`.
- Remaining owner inputs: accurate Apple legal/trader declarations and paid
  agreement acceptance if using IAP, store credential/signing authorization
  where requested, device testing, and distribution rights evidence for the
  restored Whitney recording. No legal declarations were submitted in this batch.

## 2026-09-28 — touchable onboarding/auth fields and web Google sign-in

- Recovery checkpoint: checkpoint/2026-09-28-before-auth-input-fix at c159c4e.
  Source tag: release/2026-09-28-auth-inputs.
- Reproduced loss of name-input focus using a real emulated touch (previous
  programmatic page.type tests force focus and missed it). Removed page-wide
  keyboard-dismiss press responders from onboarding and authentication.
  Name entry no longer floats/fades or auto-focuses while changing slides;
  decorative glow ignores touches. Explicit positioned input styling keeps
  the white name above the glass background with a distinct dark input surface.
  Auth decorative background ignores touches; inputs have a 48 px minimum and
  scroll containers preserve button/input taps with the keyboard active.
- Web now shows Continue with Google and uses Firebase signInWithPopup.
  Closing/canceling or blocking the popup releases busy state; blocked popups
  show recovery guidance. Native/Expo Go module guards remain unchanged.
  Web auth persistence initializes separately from the popup resolver, which
  is supplied only when Google is selected, avoiding proactive iframe loading.
- Read production Google provider configuration: already enabled with OAuth
  client configured. Added only partybot.games to authorizedDomains via scoped
  Identity Toolkit updateConfig; existing authorized domains preserved and
  service returned HTTP 200. No provider keys, accounts or rules modified.
- Checks: `npm run typecheck` PASS; Jest 44 suites / 315 tests PASS, including
  Google success, cancellation and popup-blocked cleanup. Static web export
  and hosting sync PASS. `verify-auth-touch.cjs` PASS at 320x568 and 390x844:
  touch focus/re-focus, visible name, editable email/password and Google button.
  Existing desktop onboarding/signup/session restoration test PASS with mocked
  Firebase responses. Mobile successful-signup mock fixture timed out; mobile
  touch checks and real-service negative credential checks were used separately.
- Real-service browser verification: nonexistent email login returned normal
  invalid-credential feedback; malformed-email signup returned invalid-email
  without creating an account. Google popup reached accounts.google.com sign-in
  and closing it restored the form. Account consent/completion and physical
  Safari/iOS/Android keyboard behavior not tested; no real test account created.
- Follow-up: web ScrollView does not emit native momentum-end callbacks.
  Settled-page state now also synchronizes from onScroll, so swiping to the
  name slide activates its form/copy instead of leaving it inactive. Direct
  carousel scrolling plus touch/re-focus checks PASS at 320 and 390 widths.
- Initial Hosting release confirmed; initial Expo group
  d929a9da-ab0d-4422-b9d1-d22ab6b04e87 confirmed before the carousel follow-up.
  The following final release supersedes it.
- Existing Expo channel/builds inspected. Target is expo-go-sdk57/preview,
  runtime exposdk:57.0.0 only; no dependency/runtime change or native binary OTA.
  No Git push or persistent server.
- Final source: eaa402656819a0d839c24370552f0aba4fefef2b (base fix f010211).
  Firebase Hosting confirmed release complete; https://partybot.games and
  https://partyplay-8.web.app updated. /, /tools, /onboarding and /auth return 200.
  Live entry-567f13abfef82b4186ad1206051ec9bc.js matches local bytes, SHA-256
  0190355187192734ab478f364800a8705eee5c8648442a84c034e654d711fb2b.
  Live-site touch submission also PASS for invalid login, malformed signup,
  opening Google and restoring the form after popup close; no account created.
- EAS confirmed Published on expo-go-sdk57, exposdk:57.0.0, android+ios:
  group 729eb96f-3d26-4ae6-b4f4-e4f5dcceec40;
  Android 01a0e8e3-33b3-7299-819c-da35739b1bf7;
  iOS 01a0e8e3-33b3-735a-8823-833bb17be15c.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/729eb96f-3d26-4ae6-b4f4-e4f5dcceec40
- Verified local Git backup: .backups/playbot-2026-09-28-194027-716.bundle
  (94,179,523 bytes), including 7554c79 and release tags. SHA-256:
  78a7c5193fef971761d4df4e0670184f3a08f8b0f8bc2f1d6ac5843db0a3183f.
- No unresolved release blockers. Native physical keyboard behavior and real
  Google account consent remain unverified. Expo Go retains email login only;
  web Google does not enable unsupported native Google modules in Expo Go.
  Reverting Git alone does not undo Hosting/EAS or authorized-domain changes.


## 2026-09-28 — Persian content, account onboarding, voice peaks and square tools

- Recovery checkpoint: checkpoint/2026-09-28-before-persian-onboarding at 16005d7.
  Source tag: release/2026-09-28-persian-onboarding-tools.
- AI reviewed all 2,888 built-in Persian cards against their English text:
  rewrote 2,216 standalone cards and reviewed 112 relationship scenarios with
  six question lenses (672 cards), refining five scenarios. 2,230 final card
  strings differ from the prior release. Corrections are persisted by English
  source so regeneration preserves the review. Reviewed 1,350 Imposter words;
  corrected 40 Persian meanings. Structural comparison confirms all other
  language values, card IDs and English content remain unchanged.
- First use now shows onboarding on web and native, then requires Firebase
  registration/sign-in. Protected routes prevent direct-link bypass. Existing
  registered accounts restore; anonymous/local guests cannot unlock features.
  Onboarding adapts to viewport changes and keeps its CTA below the copy.
- Production auth probe exposed PASSWORD_LOGIN_DISABLED. Applied the scoped
  Identity Toolkit projects.updateConfig mask signIn.email.enabled and
  signIn.email.passwordRequired to partyplay-8, both true. Service confirmed;
  a subsequent nonexistent-user login returns normal credential rejection.
  No real test account was created. No Functions/database rules deployed.
- Reverse Singing uses linked-channel offline look-ahead gain limiting with
  0.89 peak ceiling, 5 ms anticipation and 50 ms release instead of sample
  saturation. Quiet speech remains amplified; sustained loud waves retain
  their shape. Browser capture disables automatic gain/noise/echo processing.
- Shared Tools cards show only illustration and title, with aspectRatio:1
  across web/iOS/Android. Removed rendered descriptions and centered content.
- Checks: TypeScript PASS; Jest 44 suites / 312 tests PASS. Audio tests cover
  quiet speech, transients, sustained loud-signal distortion, silence and
  linked stereo. Static Expo web export and sync PASS. Intercepted Chromium
  verification PASS: first-use onboarding and tools at 320/390/768/1280 widths,
  protected deep links, Firebase signup request and restored login. Browser
  signup responses mocked. Actual Firebase credential endpoint probed separately.
- Physical iOS/Android/Safari not tested. Expo Go preview requires SDK 57;
  native custom binaries use a separate runtime and are not targeted by this
  Expo Go release. No native dependency changes, no Git push, no persistent server.
- Source commit: 9669dba; Hosting auth deep-link follow-up: b71136f.
  Protected auth routes are omitted by static export; explicit /auth and
  /auth/** Hosting rewrites serve app.html so refresh/direct links resolve.
- Firebase Hosting confirmed both deployments complete using
  `npx --yes firebase-tools deploy --only hosting --project partyplay-8 --non-interactive`.
  Live https://partybot.games and https://partyplay-8.web.app updated.
  /, /tools, /onboarding and /auth return HTTP 200; live bundle equals local:
  entry-09f950847e0f7e1a20035ff08d873f21.js SHA-256
  f5b518abb86b6643ec8e90a46e87d6875398f91fc601903e173e235853e6a1a1.
- EAS confirmed Published using APP_VARIANT=expo-go, branch expo-go-sdk57,
  environment preview, platform all; runtime exposdk:57.0.0.
  Group: 4c2116be-a66e-45f3-987a-9051ebfbce3b.
  Android: 01a0e8bb-d258-767d-8159-f565ff446f7b.
  iOS: 01a0e8bb-d258-72af-9084-940362d3f9bd.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/4c2116be-a66e-45f3-987a-9051ebfbce3b
  Existing channels/builds inspected before publishing; no native runtime update.
- Verified local Git bundle: .backups/playbot-2026-09-28-185803-595.bundle
  (92,204,855 bytes), includes cb20704 and release tags. SHA-256:
  1e71cea86a1ae39830c32f3c84b962186b3012199b403760aaaa2fadf5a0609f.
- No unresolved release blockers. Real-device microphone listening and native
  device UI checks remain unverified. Git rollback alone does not roll back
  Hosting/EAS or the separately enabled Firebase email/password provider.


## 2026-09-28 — prevent accidental touch zoom in the web app

- Recovery checkpoint: checkpoint/2026-09-28-before-web-touch at 44216ab.
  Source tag: release/2026-09-28-web-touch.
- Added a static Expo HTML document with one fixed-scale viewport and root
  touch-action pan-x pan-y: single-finger panning remains available, pinch and
  double-tap browser zoom are excluded. Inputs have a 16 px minimum font to
  avoid Safari focus zoom. Existing slider touch-action:none remains intact.
- Web shell installs non-passive cancellation for Safari gesturestart/change,
  multi-touch touchmove, dblclick and Ctrl-wheel trackpad pinch. It does not
  cancel ordinary clicks, one-finger touchmove or ordinary wheel scrolling;
  listeners are removed on unmount. Browser/OS accessibility overrides and
  explicit browser menu zoom are outside page control.
- Guess the Seconds steppers expose accessible names and stable test IDs.
- Validation: TypeScript PASS; Jest 44 suites / 307 tests PASS, including event
  cancellation, normal input preservation and cleanup. Static web export and
  hosting sync PASS. Mobile Chromium emulation at widths 320/393/430: six rapid
  taps each on +/- produced all expected values; two-finger pinch kept scale=1,
  no horizontal overflow, exactly one viewport, synthetic Safari gesture event
  canceled. Tools still scrolls with one finger. Color/Sound Match touch,
  keyboard, submission and no-scroll layout PASS at 320x487, 393x771, 430x851,
  768x943 after the global policy. Physical Safari not tested.
- Web-only release: no native runtime or dependency changes; native shell never
  installs these DOM handlers. No EAS update needed for this browser-only fix.
  No Git remote push or persistent server.
- Source: ddc7b8abf53302c5e06ae36f6cd00918a1675e03.
  Firebase confirmed release complete with `npx --yes firebase-tools deploy
  --only hosting --project partyplay-8 --non-interactive`.
  https://partybot.games and https://partyplay-8.web.app updated. Live Guess the
  Seconds HTML includes viewport/gesture CSS; four routes and bundle bytes match
  local output. entry-77b6645d379a058493eddfa44d2e16a8.js SHA-256:
  7c6b805a0677cfc299334f38d6c826edf2d421bdbee1d6a27c585b42a7933730.
- Verified local backup .backups/playbot-2026-09-28-001115-206.bundle
  (91,825,455 bytes), SHA-256
  c93dd6f8abdf211cce3b550245e5a47df6ef2d1059df02a1dfc266bda8a9eeb6.
  No unresolved release blockers; physical Safari remains unverified.

## 2026-09-28 — first-use guides and direct solo starts

- Recovery checkpoint: checkpoint/2026-09-27-before-start-flow at ae11cea.
  Source tag: release/2026-09-28-start-flow.
- Shared session context auto-advances handoffs exactly once when the session
  contains one player. Multiple players on one device still see handoffs;
  final-result summaries and game-specific rule/target screens are retained.
- Game guides persist acknowledgement per game and account UID in AsyncStorage.
  Guests use local-device/browser history. Subsequent sessions and Play Again
  bypass the guide; Pass & Guess uses the same gate. Storage reads gate mounting
  so clocks cannot start behind a first-use guide. Failed persistence retains
  in-memory acknowledgement and never blocks play. History is local, not synced
  across devices; clearing app/browser storage resets it.
- Web detail page now has a large blue Play Now action for the single-device mode
  (solo or friends). Native mode cards retain choices with 56 px blue play circles
  and 28 px white play icons. Setup Start unlocks web audio synchronously with the
  gesture before solo auto-start; native behavior is unchanged.
- Validation: TypeScript PASS; Jest 43 suites / 306 tests PASS, including stored
  guide reload, account/game isolation, storage failure, replay and solo/final
  handoff behavior. One-off Expo web export and hosting sync PASS.
  Compact match layout/touch/keyboard checks PASS at 320x487, 393x771,
  430x851 and 768x943 with persistent guides.
  Browser verify-start-flow.cjs PASS for prominent Play, first guide, reload
  persistence, solo bypass and multiplayer handoff. Screenshot inspected.
- Existing EAS channel and recent builds inspected. No native/config/dependency
  changes. Expo Go SDK57 remains separate from native binary runtimes. Physical
  iOS/Android visual testing unavailable; no Git push or persistent server.
- Source commit: 38f1abb8fac4bf8fb5ffde6f63986077fbc8ced2.
- Firebase Hosting confirmed release complete using `npx --yes firebase-tools
  deploy --only hosting --project partyplay-8 --non-interactive`.
  https://partybot.games and https://partyplay-8.web.app updated. Four live game
  routes and JavaScript bytes verified against local hosting output:
  entry-b7a0d289125279c20bd38dc5ced30fa7.js, SHA-256
  2fd89a078e0a92dd4c0f2d613d1533eefe3dc7acf279071b12904ad35d84173a.
- EAS confirmed Published with APP_VARIANT=expo-go, branch expo-go-sdk57,
  environment preview, platforms all, runtime exposdk:57.0.0.
  Group 59f177c7-af44-44f3-abd2-1f7eaae39dd5;
  Android 01a0e4ad-d202-7290-a709-29643be1ea67;
  iOS 01a0e4ad-d202-77d9-aa2e-5bff28ab60a6.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/59f177c7-af44-44f3-abd2-1f7eaae39dd5
- Verified .backups/playbot-2026-09-28-000047-098.bundle (91,714,285 bytes),
  SHA-256 b6955ba610143455409b81cbf37f2bf0f467d64c0c2944da6e3da42ef365fa58.
  No unresolved publication blockers; physical device checks and local-only
  guide-history scope remain the limitations noted above.

## 2026-09-27 — shared match game control design

- Recovery checkpoint: checkpoint/2026-09-27-before-game-design at 67aca34.
  Source tag: release/2026-09-27-game-design.
- Rebuilt Color Match and Sound Match matching screens with independent preview,
  controls and primary-action surfaces. Content follows its natural height rather
  than pushing Submit to the screen bottom. Color preview is 88x64 on regular
  phones; compact screens use 52x44. Sound frequency now uses a horizontal slider.
- Shared GameDesign tokens and GameControls components standardize surfaces,
  borders, typography, 44 px slider interaction areas and 48/52 px primary actions.
  Shared activity banner and existing GAME_UI button radius use the same tokens.
  Game-specific board visuals remain intact. Compact rows adapt to available
  height; accessible enlarged text retains the ScrollView escape hatch.
- Stable touch ownership, accessibility values/actions and web keyboard arrows,
  Home/End supported. Sound +/- 1 Hz and preview remain separate controls.
- Validation: npm run typecheck PASS; Jest 43 suites / 302 tests PASS; one-off
  APP_VARIANT=expo-go Expo web export and node sync-web-build.js PASS.
  verify-compact-matches.cjs PASS at 320x487, 393x771, 430x851 and 768x943:
  no scroll needed for Submit, touch drags change values without moving the
  page or exiting, keyboard fine tuning, preview, +/- and submission work.
  Phone screenshots inspected. Physical iOS/Android appearance not directly
  tested; native update uses the shared React Native implementation.
- Existing Expo preview channel/builds inspected. No native dependency/config
  changes. Expo Go SDK57 preview stays separate from installed native runtimes.
  Publication receipts and verified local backup recorded below after completion.
  No Git remote push.
- Initial design publication: Firebase confirmed release complete; live bundle
  entry-5a23a6a47860c3cca1a93435da9fc080.js matches local SHA-256
  86aa754f8a289e25e652f257f68a9c38eaf1d9d08fe03126263270c93c24206a.
  EAS group e39939b2-6bd5-4797-ba06-8029932e5b25 published for SDK57:
  Android 01a0e2c8-2ce8-7e56-aa83-38e153027d43,
  iOS 01a0e2c8-2ce8-7abc-b3f6-4776d03d03c2. EAS marked a298c06 dirty
  because the user's larger-preview follow-up began after native bundle export.
  This initial update is superseded by the clean follow-up below.
- Verified bundle .backups/playbot-2026-09-27-150919-656.bundle (94,856,624 bytes),
  SHA-256 83596afeb8d76ce1c4765194c9397b47935fa6a118115362345e243d99f1f31f.

### Larger color preview follow-up

- User requested a large color area after reviewing the redesign. Replaced the
  small side swatch with a full-width 144 px preview (72 px on compact screens).
  Separate control and action cards retained. Primary blue deepened for 5.29:1
  white-text contrast. Recovery: checkpoint/2026-09-27-before-large-preview;
  source tag: release/2026-09-27-large-color-preview.
- Follow-up validation: TypeScript and web export PASS. Four viewport touch,
  keyboard, preview-size and no-scroll checks rerun PASS; enlarged phone
  screenshot inspected. No behavior/native dependency changes.
- Final source: 32eb2c8eb54c39a2e190992568ad79650e96af08.
  Firebase Hosting confirmed release complete at https://partybot.games and
  https://partyplay-8.web.app. Four live game routes and bundle bytes verified:
  entry-c9ffdd9ded49c3a1f071ebf6acc1e90b.js, SHA-256
  34fcfea051653a999ac5a72a80ca1fbf2f4cd38e259e05cdbc1053c8d7231570.
- EAS confirmed Published with clean source commit, APP_VARIANT=expo-go,
  branch expo-go-sdk57, environment preview, runtime exposdk:57.0.0, both platforms.
  Group c3e19ef2-d417-4af6-bd2e-42a09e3e6f89;
  Android 01a0e2cc-774a-7895-83ad-227ed3b3fe7b;
  iOS 01a0e2cc-774a-7d10-a000-19863834ff30.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/c3e19ef2-d417-4af6-bd2e-42a09e3e6f89
- Verified local bundle .backups/playbot-2026-09-27-151507-138.bundle
  (92,746,965 bytes), SHA-256
  82d92f23f1b0e7fc82a2d557f35a68aa6d7008fd6a1ca92a6d15dd3f2302f5ce.
- The broader browser smoke harness initially read Tools before hydration;
  added an explicit card wait and updated Sound drag direction to horizontal.
  Rerun PASS at 320x568, 393x852, 430x932 and 768x1024 for Tools, Tap in Order,
  Reaction Time, sliders and Exit cancel/confirm. No unresolved release blockers;
  physical-device visual review remains the compatibility caveat above.

## 2026-09-26 — pitch-preserving turtle replay and match control spacing

- Recovery: checkpoint/2026-09-26-before-pitch-spacing at 018a999.
  Source tag: release/2026-09-26-pitch-spacing.
- Replaced sample-clock halving with shared waveform-similarity overlap-add:
  original-rate windows are aligned/crossfaded into exactly twice the frames.
  Native PCM WAV and web AudioBuffer use the same stretcher, then play at 1x.
  Sample rate/pitch remain unchanged. Stereo channels share alignment. Native
  cache filename versioned to avoid replaying older octave-lowered files.
  Web cache invalidates on replacement/Retry. Existing stop/exit guards retained.
- Color Match preview capped at 240x120, slider rows separated by 10 px, with
  at least 20 px before Submit. Sound tuning controls have 24 px before Submit.
  Full-page layout and 44+ px touch targets retained without scrolling.
- Validation: TypeScript PASS; Jest 43 suites / 302 tests PASS. Signal tests at
  110/220/440/880 Hz verify double duration and original pitch rather than its
  lower octave; native WAV sample rate/duration, stereo phase, silence, replay,
  cancellation and Retry covered. Web export PASS.
- Browser: touch controls, measured spacing and visible Submit PASS at 320x487,
  393x771, 430x851, 768x943. Screenshot inspected. Synthetic microphone test:
  original/reverse/slow/natural completion/mimic/result/Stop/Retry PASS. A 60-second
  synthesized clip stretched to 120 seconds in 246 ms on this desktop (not a
  mobile performance claim). No direct physical iOS/Android listening test.
- Existing Expo channel/builds checked; Expo Go SDK57 runtime remains separate
  from installed binaries. No dependency/native config changes; no Git push.
- Source: 70fae23c6c173611d5042ad5fe67e5d902b877d5.
- Firebase Hosting confirmed release complete with `npx --yes firebase-tools
  deploy --only hosting --project partyplay-8 --non-interactive`.
  https://partybot.games and https://partyplay-8.web.app updated; four live game
  routes reference entry-be9d7e8b8aaa54db4f702f7d2577dccd.js. Live/local SHA-256:
  a20e1915805edcf6e3b3424db59a1b75e9ee317bb1eef4d54780a81c15e1186a.
- EAS confirmed Published via APP_VARIANT=expo-go, branch expo-go-sdk57,
  environment preview, platform all, runtime exposdk:57.0.0.
  Group c1fdea73-9cf4-4531-863a-1b04bbfa09cf;
  Android 01a0dafd-d2c1-735b-a754-ac71551e65a6;
  iOS 01a0dafd-d2c1-7cca-ad80-a878d3f7481b.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/c1fdea73-9cf4-4531-863a-1b04bbfa09cf
- Verified complete-history backup:
  .backups/playbot-2026-09-26-025151-466.bundle (94,842,599 bytes), SHA-256
  d8afe156cf7d5685bf0cfda15ac0707b0f612106c840ce56ec7b2e5a704b3bbb.
  Includes source and before/after tags; this later receipt is in local Git.
  Ignored credentials/uncommitted files remain excluded. Git diff whitespace
  and credential/path scans PASS. No publication blockers. Expo Go native Google
  login/purchases remain unavailable; no native binary or backend deployed.


## 2026-09-24 — winding Memory Path, reliable slow replay and compact matching

- Recovery: checkpoint/2026-09-24-before-game-fixes at abe26c3.
  Source tag: release/2026-09-24-game-fixes.
- Memory Path uses bounded randomized backtracking, unique orthogonal cells,
  a maximum two-move straight run and minimum 55% turns (rounded down). Paths
  may touch earlier cells without revisiting them; this removes the old long-
  corridor bias. Full-length fallback handles degenerate/custom grid input.
- Reverse Singing native half-speed replay now writes a cached PCM WAV with
  half the sample clock and unchanged samples/gain. This bypasses native pitch
  correction/time stretching and doubles full-take duration, matching web's
  lower-pitch half-speed behavior. Retry/record/exit cancellation guards cover
  pending preparation. Added an explicit Stop playback control and turtle label.
- Color/Sound Match tuning phase uses available flex layout, no ScrollView.
  Removed lab/studio banners, stepper and redundant explanations. Color swatch
  takes remaining space; sound track measures its actual container. Compact
  round indicator, 44+ px touch targets and visible 48 px Submit remain.
- Validation: TypeScript PASS; Jest 43 suites / 298 tests PASS, including seeded
  winding/length/uniqueness tests through setup maximum lengths, PCM preservation
  and doubled duration, native action flow and Retry during slow preparation.
  Web export PASS. Browser touch checks at 320x487, 393x771, 430x851, 768x943
  (81 px reserved for device chrome): all sliders/Submit fit without scrolling;
  drag, preview, fine tune and submit PASS. Smallest screenshots inspected.
- Existing Expo channel/builds inspected: SDK57 Expo Go branch matches runtime
  exposdk:57.0.0; no native dependency or config change. Native binary runtime is
  separate. Physical iOS/Android playback/appearance not directly tested here.
- Real-browser synthetic microphone test PASS: original, reverse, half-speed
  continues beyond normal duration and ends naturally, mimic, Result, Stop, Retry.
- Source commit: cba2c72251432946dfb82d5590a74543bb8990a5. No remote Git push.
- Firebase Hosting command `npx --yes firebase-tools deploy --only hosting
  --project partyplay-8 --non-interactive` confirmed release complete.
  https://partybot.games and https://partyplay-8.web.app updated. Four live game
  setup routes return current bundle entry-54a66568d2bf70eb64c5c501e5e73323.js;
  live/local SHA-256 matches:
  370ef74e61c27cf43785cb7bc61644093bc115686f3c5c4d4ee8d6cf50a24f4d.
- scripts/backup-local.ps1 created .backups/playbot-2026-09-24-142950-948.bundle
  (94,465,456 bytes); git bundle verify PASS, complete history. SHA-256:
  1857bc03ac04de54df87d1c11fdc794a78ca697823a04a8db6df4e70930e44f8.
  Includes source commit and before/after tags; subsequent release receipt stays
  in local Git. Ignored credentials/uncommitted files are excluded.
- EAS confirmed Published via APP_VARIANT=expo-go, branch expo-go-sdk57,
  environment preview, platform all; runtime exposdk:57.0.0.
  Group: 2ae6d205-41cb-4b8e-9319-1ab6263dd94e.
  Android: 01a0d32f-82ca-78e3-b556-e2be46b111e4.
  iOS: 01a0d32f-82ca-7a76-aebf-97220c4007e2.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/2ae6d205-41cb-4b8e-9319-1ab6263dd94e
  EAS source marker has an asterisk only because this release receipt was being
  written during upload; application source remained unchanged after source commit.
  Expo Go preview retains native-login/purchase limitations; no native build or
  backend deployment. No publication blockers. Credential and whitespace scans PASS.


## 2026-09-22 — restore Whitney Houston challenge and local recovery

- Recovery: checkpoint/2026-09-22-before-whitney-restore at 60862d2.
  Source tag: release/2026-09-22-whitney-restored.
- Restored original 12-second Whitney recording byte-for-byte from 083708f^,
  SHA-256 96d64b877cf3658ef0cbf95db82c2c89d51d26a172ba2e74e5abea6060d6669d.
  Restored Whitney Houston mode labels in setup, tutorial and session. Catalog
  description identifies Whitney Houston Drum Challenge; compact game header
  remains Drum Challenge to fit phones and also serve the Metronome mode.
- Aligned scoring to the original recording's first drum attack at 9.860 seconds
  (previous 9.700-second target preceded it by 160 ms). Asset RMS regression
  verifies the quiet pre-attack and audible attack. Exit cleanup is preserved.
- Added scripts/backup-local.ps1 and LOCAL_RECOVERY.md. Dated Git bundles include
  committed history, branches/tags and SHA-256 checksum; .backups excluded from
  Git and EAS uploads. Ignored credentials and uncommitted work are not included.
- Validation: TypeScript PASS; Jest 41 suites / 290 tests PASS; web export PASS.
  Browser restoration/exit check and publication confirmations recorded below.
  Physical iOS/Android listening not available. No native dependency/config change.
  Existing SDK57 Expo Go channel and latest builds inspected this session; only
  compatible Expo Go preview and Hosting will be published. No remote Git push.
- Source commit: 5838068e6de38bb8836f7d9cbeb14667b4d86d7d.
- Browser PASS: original 12-second recording decodes/plays, confirmed Exit stops
  its active buffer; prior handoff/language/tool checks also pass.
- Firebase Hosting deploy confirmed complete for partyplay-8. Live
  https://partybot.games/game/drum_challenge/setup returns Whitney Houston mode.
  Live original WAV hash matches the restored source. Web bundle SHA-256:
  004eb78244c629ac1a90c5f4c59d2922ba6addbddff7b048ae7efd22967b4c86.
- Offline backup: .backups/playbot-2026-09-22-161713-658.bundle, 92,305,570 bytes;
  git bundle verify confirms complete history, no prerequisites. SHA-256:
  9b7663a2466f5258433229f33455f752c7a02b5720791b9e10e074ac81b2eb3f.
  Includes source commit and both recovery/release tags; this subsequent release
  receipt is in local Git. Backup is local to this disk, not off-machine storage.
- EAS confirmed Published using APP_VARIANT=expo-go, branch expo-go-sdk57,
  environment preview, platform all, runtime exposdk:57.0.0.
  Group d7f06d06-940f-48da-83e9-76ae93a54a7b;
  Android 01a0c945-2c2a-7540-9739-5886e9a0ab50;
  iOS 01a0c945-2c2a-7c06-a18e-34c469498d65.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/d7f06d06-940f-48da-83e9-76ae93a54a7b
  Native installed binaries remain on their separate runtime; Expo Go native
  Google login/purchases remain unavailable. No publication blockers.
- Staged credential/path scan and diff whitespace checks PASS.


## 2026-09-22 — soft tool sounds and one-row Imposter translations

- Recovery: checkpoint/2026-09-22-before-tools-sound-refresh at af461ba.
  Source tag: release/2026-09-22-soft-tools-language-row.
- Replaced all 12 tool WAVs with different CC0 source clips. Soft filtering,
  bounded RMS/peak and lower playback gains reduce harshness. Bottle, dice,
  coin and cards play once per motion; wheel detents are capped at 180 ms and
  fade with progress. No bottle loop or rapid repeated motion samples.
  Sources and reproducible processing are recorded in tools/SOURCES.md.
- Imposter language controls share five equal-width cells without wrapping.
  Measured container width scales gaps, flags and labels; accessible labels and
  minimum 48 px touch height retained. Translation privacy unchanged.
- Validation: TypeScript PASS; Jest 41 suites / 290 tests PASS; web export PASS.
  Browser: all five languages in one row and working translation at 320, 393,
  768 px; full-page handoff regressions and real bottle/dice/wheel WAV playback
  PASS. Small-screen screenshot inspected. No physical iOS/Android listening
  session available; subjective sound quality still needs the owner's phone.
- Existing Expo channel/builds inspected: expo-go-sdk57 points at SDK 57 runtime.
  No native dependency/config changes; publish only Expo Go preview and Hosting.
  Installed native runtime 1.1.1 is separate. Git remote push remains withheld.
- Source commit: 7fcae1183df93624f19c7da7a30950d0016564ae.
- Firebase `npx --yes firebase-tools deploy --only hosting --project partyplay-8
  --non-interactive` confirmed release complete. Live URLs https://partybot.games
  and https://partyplay-8.web.app. Three live routes return HTTP 200 with bundle
  entry-48b2ee909a7b6b2e634027b059951cfd.js; SHA-256
  6144a4894506a1953be1d15aeeb823a1a70db2ea0b033e4d7e90e6142c7dc5f5.
  Live JS and all 12 WAV files match local hashes.
- EAS `APP_VARIANT=expo-go npx eas-cli update --branch expo-go-sdk57
  --environment preview --platform all --non-interactive` confirmed Published;
  runtime exposdk:57.0.0, iOS and Android, 12 new assets uploaded.
  Group: 1b778779-6421-4fcb-b178-7a1915f65ed4.
  Android: 01a0c937-c3f1-79b0-b3e1-f5ad33c61b03.
  iOS: 01a0c937-c3f1-7801-bab8-fc43cc5cebd5.
  Dashboard: https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/1b778779-6421-4fcb-b178-7a1915f65ed4
- Expo Go native login/purchases remain unavailable by design; email login/games
  preview supported. No backend or native binary deployment. Credential scan and
  diff whitespace check PASS. No publication blockers.


## 2026-09-22 — louder singing, recorded tool Foley and full-page handoff

- Recovery: `checkpoint/2026-09-22-before-audio-handoff` at `d4654cf`;
  initial tree clean. Source tag: `release/2026-09-22-audio-handoff`.
- Reverse Singing now measures active 20 ms windows instead of peak-normalizing.
  Robust speech RMS sets fixed linked-channel gain, up to 64x, targeting 0.28 RMS.
  A smooth limiter above 0.75 caps boosted transients below 0.98. A single handling
  bump no longer holds down the entire take. Silence/already-loud audio is retained;
  original and reversed files use the same processing locally. Native playback
  already explicitly leaves recording mode and selects the speaker route.
- All 12 tool cues replaced by edited CC0 recordings: glass bottle on hardwood,
  roulette, dice shake/throw, metal coin, card shuffle/deal for teams, mechanical
  timer tick/bell for hourglass. No musical completion jingle. Sources, licenses,
  input hashes and reproducible edit script are in assets/sounds/tools/SOURCES.md.
  Browser and native now load the identical bundled WAVs. Bottle friction loops
  only during motion, slows/fades with the animation and stops on exit/mute.
  Async web loads cannot play after navigation or cancellation.
- Shared Next Player view fills the available session page, without an inset card;
  large centered player/illustration and a bottom Ready button, scrollable on small
  screens. Imposter removes its handoff side gutter. Header keeps Exit accessible;
  compact Skip text avoids wrapping while its full accessibility label is retained.
- Validation: TypeScript PASS; Jest 41 suites / 286 tests PASS, including quiet
  singing with a loud transient, native/web PCM agreement, recorded WAV checks and
  late-load/loop cleanup. Web export PASS (91 routes). Browser checks: full-width/
  height handoff in Color Match and Imposter at 320x568, 393x852 and 768x1024;
  actual recorded bottle/dice/wheel buffer playback PASS. Screenshots inspected.
  Final `git diff --check` and private-credential scan PASS.
- Source: `506715b062a7101636fd6369b4a6739e71dc26a7`. EAS confirmed Published via
  `APP_VARIANT=expo-go npx eas-cli update --branch expo-go-sdk57 --environment
  preview --platform all --non-interactive` with the release message; runtime
  `exposdk:57.0.0`, Android and iOS. Group `67c9b78a-7c9f-4c8e-a45a-e42873efa9b0`;
  iOS `01a0c914-50ff-76fd-9033-3c66975ad40c`;
  Android `01a0c914-50ff-7b52-8cdb-8d6ca8d9383e`. 12 new assets uploaded.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/67c9b78a-7c9f-4c8e-a45a-e42873efa9b0
- Hosting confirmed Deploy complete after one-off Expo web export,
  `node sync-web-build.js`, and `npx --yes firebase-tools deploy --only hosting
  --project partyplay-8 --non-interactive`. Live https://partybot.games and
  https://partyplay-8.web.app. /tools, /game/reverse_singing/setup and
  /game/imposter/setup return HTTPS 200 with the current entry bundle.
  `entry-3bcc53da0b00d35dfb0467f9a4b60e78.js` live SHA-256 equals local:
  `d81f63cc3ce69b4c36f6ddbd58175a24b96d5292dc52a05d1f2287fa548e7894`.
  All 12 live recorded tool WAVs also match local SHA-256, ruling out stale assets.
  Final tag: `checkpoint/2026-09-22-audio-handoff-published`.
- Existing Expo Go channel inspected: expo-go-sdk57 / exposdk:57.0.0; recent iOS
  build history inspected. Native dependencies/config unchanged. Publish only
  matching Expo Go preview plus Firebase Hosting partyplay-8; no native binary,
  backend deployment, production OTA or Git push.
- Limits: hardware loudness and native screen appearance are not certified by
  browser/mocked tests. Newly captured takes receive the new loudness processing.
  Expo Go native Google sign-in and real purchases remain unavailable. Rollback
  requires republishing the checkpoint separately to Hosting and Expo Go.

## 2026-09-21 — device layout, gesture ownership and recording loudness

- Recovery: `checkpoint/2026-09-21-before-device-fixes` at `83d5b80`;
  initial worktree clean. Source tag: `release/2026-09-21-device-fixes`.
- Disable native swipe-back globally and consume Android Back during games;
  web session removal is guarded. Explicit Exit retains confirmation.
  Color/Sound Match sliders own the touch until release, use stable page deltas,
  and suspend parent scrolling. Match phases reset their scroll position.
- Tap in Order uses explicit rows and integer cell sizes, preserving 6x6 on iOS.
  Tools cards have bounded, font-aware heights instead of unconstrained flex growth.
  Reaction Time instructions are centered/inset. Imposter translations follow the
  secret word within its card; handoff art retains only the between-hands arrow.
- Native audio cleanup pauses before player removal. Drum Challenge disposes late
  preloads and pending attempts on Exit. Sound Match rejects stale tone loads.
- Reverse Singing normalizes captured PCM on native and decoded samples on web
  before creating original/reversed WAVs. Shared peak gain up to 16x (~24 dB),
  0.92 peak target; already loud audio and near silence remain unchanged. Stereo
  balance, sample rate, duration and reverse order are preserved. No new native module.
- Checks: TypeScript PASS; Jest 40 suites / 283 tests PASS; native Drum lifecycle
  tests separately PASS after correcting the test platform to iOS; diff check PASS.
  Web export PASS (91 routes). Static browser checks across 78 route/viewport
  combinations and Memory Grid 6x6 at three sizes PASS. Touch regression checks
  cover Tools, Tap in Order, Reaction Time, Color/Sound sliders and confirmed Exit
  at 320x568, 393x852, 430x932 and 768x1024. No persistent development server.
- EAS channels/builds inspected: Expo Go branch/channel `expo-go-sdk57` uses
  `exposdk:57.0.0`; latest native iOS simulator is 1.1.1, Android binary 1.1.0.
  Publish only Expo Go with APP_VARIANT=expo-go and environment preview, plus
  Firebase Hosting project partyplay-8.
- Source commit: `e26f364e24149dbe6f7aa7a2370d312578ee1995`.
  EAS confirmed Published for both platforms via `APP_VARIANT=expo-go npx eas-cli
  update --branch expo-go-sdk57 --environment preview --platform all --non-interactive`
  with the release message. Update group: `ef23acce-69e2-4f81-a61b-4dd06e723e0a`;
  iOS: `01a0c5c1-fdfe-75ef-8e88-d33b39216afb`;
  Android: `01a0c5c1-fdfe-799e-a63a-b9b34a8c58cf`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/ef23acce-69e2-4f81-a61b-4dd06e723e0a
- Final web export and `node sync-web-build.js` PASS. Firebase confirmed Deploy
  complete via `npx --yes firebase-tools deploy --only hosting --project partyplay-8
  --non-interactive`. Live: https://partybot.games and https://partyplay-8.web.app.
  HTTPS 200 and current bundle verified on /tools, /game/tap_in_order/setup and
  /game/reverse_singing/setup. Live bundle `entry-7e820ce5cb0926711e1c8f9c9e66691b.js`
  matches local SHA-256 `fe101ce9e8a191e349ce29afb46d59c9679cd0ffb44638c06dba16e60bfcaec8`.
  Final record tag: `checkpoint/2026-09-21-device-fixes-published`.
- Limits: browser emulation and mocked native audio tests do not certify real
  iOS/Android hardware appearance, gesture behavior or microphone/speaker loudness.
  Expo Go native Google login and purchases remain unavailable. No native build,
  production OTA, backend deploy or Git push. Rollback needs separate republishing.

## 2026-09-20 — mobile layout and tools refinement

- Recovery: `checkpoint/2026-09-20-before-mobile-layout` at `e7ee756`;
  starting worktree clean. Source tag: `release/2026-09-20-mobile-layout`.
- Floating tabs and game sessions respect Android/iOS bottom and lateral safe
  areas. Session header uses balanced action slots and a two-line title.
- Tools use adaptive two/three-column cards with descriptions and shared glass
  styling. Glass honors iOS Reduce Transparency. Tool headers have no separator;
  dice, coin, hourglass and bottle can scroll on short screens. Compact dice,
  coin and timer art keeps controls reachable. Wheel includes bottom safe area.
- Memory Grid measures its actual arena, preserves the configured column count
  and fits 6x6 boards on narrow phones in both single-device/multiplayer layouts.
  Color Trap targets stay inside the measured arena; its ready screen scrolls.
- Checks: `npm run typecheck` PASS; Jest `--runInBand --silent`: 37 suites,
  273 tests PASS; `git diff --check` PASS. `APP_VARIANT=expo-go npx expo export
  --platform web` PASS (91 routes). Headless request-intercepted static-export
  checks: 78 route/viewport combinations PASS (all 16 game setup screens,
  main screens, six tools; 320x568, 390x844, 768x1024). Memory Grid 6x6 gameplay
  separately PASS at all three sizes; screenshots inspected. No local server.
- Existing EAS channels/builds inspected. Expo Go channel/branch `expo-go-sdk57`
  uses `exposdk:57.0.0`; preview's latest iOS simulator is 1.1.1, Android binary
  is 1.1.0. Publish this batch only to the separate Expo Go branch with preview
  environment. No native dependencies/config changed; native module guards kept.
- Source: `a810dcc52c7983c7cfc40701e9c5f413b9ea8dc9`. EAS confirmed
  `Published!` for branch `expo-go-sdk57`, runtime `exposdk:57.0.0`, iOS and
  Android, using `APP_VARIANT=expo-go npx eas-cli update --branch expo-go-sdk57
  --environment preview --platform all --non-interactive` (with release message).
  Native Hermes exports and asset upload PASS. Group:
  `7fa61780-9a95-4b7e-9499-c68d83e08f7c`; iOS:
  `01a0bea4-c8d8-701f-b16f-207d836d586f`; Android:
  `01a0bea4-c8d8-7a59-abb5-1a5596855b15`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/7fa61780-9a95-4b7e-9499-c68d83e08f7c
  Final tag: `checkpoint/2026-09-20-mobile-layout-published`.
  No Hosting/backend deployment, native binary, production OTA or Git push.
  Rollback requires republishing the recovery source to the same Expo Go branch;
  a Git revert alone does not roll back EAS.
- Limits: browser checks are not physical-device iOS/Android visual QA. Native
  blur, Dynamic Type, keyboard and device gesture bars still need device review.
  Styling follows available Apple materials guidance, not an iOS 28 SDK claim.
  Expo Go does not support the project's native Google login or real purchases.

## 2026-09-08 — recover interrupted invite rewards

- Recovery: `checkpoint/2026-09-08-before-invite-recovery` at `5fe3130`.
- `redeemInvite` uses per-user receipt transactions: invitee credit/reservation,
  inviter credit/statistics/deduplication, then completion. Same-code retries
  resume the saved binding without duplicating either credit. Public code changes
  do not redirect a pending reward. Missing inviters are not recreated.
- Legacy claims without receipt evidence are rejected instead of recredited.
  Retries are caller initiated and retain the five-per-hour limit; deleted-account
  and ambiguous historical payouts require support review. No reconciliation job.
- Four baseline failures reproduced the previous broken retry behavior. Final
  isolated RTDB/backend + Firestore tests: 75/75 PASS, including lost acknowledgement
  before/after both payout stages, concurrent retries, receipt permissions and
  corrupt-record rejection. `git diff --check` PASS.
- Only `redeemInvite` needs deployment. Client change is a comment correction;
  no mobile bundle/native config, rules or Hosting change is needed. No Git push.
- Source: `1e4b038`. Firebase confirmed a successful update of
  `redeemInvite(us-central1)` on Node 22 and overall deployment completion using
  `firebase deploy --project partyplay-8 --only functions:redeemInvite`.
  Verified checkpoint: `checkpoint/2026-09-08-invite-recovery-published`.
  Isolated test emulators were stopped after verification. Rolling back to the
  pre-recovery function would block retries of pending receipts until this
  implementation is republished; Git revert alone does not roll back Firebase.

## 2026-09-08 — server input and purchase validation

- Recovery: `checkpoint/2026-09-08-before-server-validation` at `6b42b6b`.
- Hardened `redeemInvite` code/registry validation, `recordHostMigration` current
  host/member authorization, and `syncRevenueCat` schema/entitlement validation.
  Valid subscription grace periods remain usable; historical product keys and
  incomplete responses do not grant lifetime access. Unknown inherited object
  names are not star products. No client/native configuration change.
- Baseline: seven new regression failures; fixed suite: 63/63 PASS (61 backend
  and RTDB, 2 Firestore), including all callable auth boundaries and concurrent
  daily reward claims. `git diff --check` PASS. Verified isolated test processes
  stopped; no persistent app server started.
- Scope/limits: SECURITY_AUDIT.md. App Check, multi-account abuse, real StoreKit
  testing, cross-account receipt handling and retry-safe multi-user invite credits
  remain open. No Git push, mobile update or App Store submission in this batch.
- Source commit: `8b856fe`. Initial deployment stopped while listing cloud
  functions; a subsequent diagnostic read confirmed successful IAM and Functions
  API responses (HTTP 200). Retried only the same three affected targets.
- Firebase confirmed successful updates for `recordHostMigration(us-central1)`,
  `redeemInvite(us-central1)` and `syncRevenueCat(us-central1)` and overall deploy
  completion. No other functions, rules, Hosting content or native runtime changed.
  Verified checkpoint: `checkpoint/2026-09-08-server-validation-published`.

## 2026-09-08 — security hardening

- Recovery: `checkpoint/2026-09-08-before-security-hardening` at `0a98015`.
- Closed RTDB destructive account/financial-marker deletion, private profile
  reads, forged friendship acceptance, event overwrites and backend target-path
  injection. Profile sync merges only profile fields; friends use scoped reads
  and atomic request-linked acceptance. Firestore preserves server fields.
- Admin source verifies same-origin/recent login and current admin claims.
  Static Hosting does not deploy this Next server; no admin-server deployment claim.
- Compatible dependency updates: backend production 11 moderate / full tree 14
  moderate; admin 8 moderate. Both zero critical/high. Node runtime updated to 22.
- Tests: eight new regressions reproduced old failures; fixed RTDB/backend 37 PASS;
  Firestore 2 PASS; app 36 suites/263 PASS; app/admin TypeScript PASS; Next build
  PASS. Isolated Firestore emulator stopped after testing; the pre-existing RTDB
  test emulator was reused and left under its original owner's control.
- Final reproducible isolated run using `firebase.security.json`: 39/39 tests
  PASS across RTDB/backend and Firestore; CLI confirmed both emulators stopped.
  Web-only Expo export and sync PASS.
- Firebase confirmed deletion of retired `generateCard(us-central1)` to complete
  the authorized AI removal. Deployment and update confirmations follow below.
- Source commit: `52a5488`. Firebase confirmed Hosting, RTDB rules, Firestore rules
  and each of the twelve explicitly selected existing functions deployed. Final
  inventory shows all twelve on nodejs22 and no generateCard endpoint.
  Live site https://partybot.games and its standard Apple association endpoint
  return HTTP 200; unauthenticated RTDB users read and blockUser call return 401.
- Expo confirmed preview update group `d1e0336b-f24a-4a7e-a8ca-8a6842572320`,
  runtime 1.1.1, iOS `01a0802b-6c7b-7561-bf62-302154947ccc` and Android
  `01a0802b-6c7b-766c-866e-90577e90030e`, source `52a5488`:
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/d1e0336b-f24a-4a7e-a8ca-8a6842572320
  No update was sent to incompatible runtime 1.1.0 or the production channel.
- Expo confirmed the separate Expo Go SDK57 update group
  `0e0ffd69-7b7c-4661-84f5-48ab57bd750f`, runtime `exposdk:57.0.0`, iOS
  `01a0802e-0317-7310-8001-4c8aaca180e7`, Android
  `01a0802e-0317-7da7-85d8-c5735f61c91f`:
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/0e0ffd69-7b7c-4661-84f5-48ab57bd750f
  Application source is `52a5488`; only IOS_AUDIT.md and this release record were
  modified while publishing (EAS marked the worktree dirty). Native module guards
  remain intact. Final verification tag: `checkpoint/2026-09-08-security-published`.
- Remaining risks and compatibility: SECURITY_AUDIT.md. No penetration-test,
  DDoS-resilience, App Check enforcement, clean-lint or App Store approval claim.
  No Git push; no signed TestFlight submission.

## 2026-09-08 — iOS source cleanup and release audit

- Recovery: `checkpoint/2026-09-08-before-ios-cleanup`; verified source tag:
  `checkpoint/2026-09-08-ios-cleanup-verified`. Owner explicitly approved deleting
  the six historical coordination documents and correcting legacy tool names in
  workflow instructions after automatic review initially rejected the broad cleanup.
  Existing workflow/publishing safeguards and Git history were preserved.
- Removed obsolete editor/generation metadata, unused source components/helpers,
  broken maintenance scripts, unused native Picker/WebView and stale generated
  build metadata. Updated developer docs to actual SDK57/Firebase architecture.
- Repaired conditional Hook ordering, absent-SDK purchase/restore handling,
  restore feedback, subscription-deletion notice, native link routing and Apple
  domain association. Corrected legal pages' outdated features/data descriptions.
- Scoped backend fix: deleteAccount now recursively removes the Firestore subtree
  and propagates data-deletion failures before removing authentication.
- Replaced unverified commercial audio with a locally generated original Music
  Drop cue, retaining 9700ms timing and existing saved mode IDs.
- Native dependency removal requires runtime/version 1.1.1 and new binaries.
  No incompatible OTA is sent to 1.1.0 or Expo Go. Added an iOS simulator build
  profile for native compilation checks without Apple signing credentials.
- Checks: TypeScript PASS; app Jest 36 suites/263 tests PASS; backend emulator
  tests 26 PASS; Expo Doctor 21/21 PASS; iOS/Android/web exports PASS;
  git diff --check PASS. Web-only export synced to website/public.
- Compatible dependency fixes: critical/high npm findings reduced to zero;
  17 moderate findings remain. Source ESLint: 101 errors/256 warnings remain,
  principally React Compiler patterns; no clean-lint or App Store approval claim.
- Full findings and unresolved signing, purchases, store metadata, rights and
  physical-device checks: IOS_AUDIT.md. Outcomes of deployments/build requests
  are recorded below only after service confirmation. No Git push.
- Source cleanup commit: `083708f`. Firebase confirmed deployment of Hosting and
  only `deleteAccount(us-central1)`; https://partybot.games/privacy returns the
  corrected Firebase description and no retired studio claim.
- First iOS simulator build `0ab4c8ef-405a-4a9d-b86a-92973a10337f` FAILED during
  CocoaPods installation: AppCheckCore requires module maps from GoogleUtilities
  and RecaptchaInterop. Added SDK-compatible expo-build-properties with targeted
  modular_headers for those two pods; introspection verifies apple.extraPods.
  Windows prebuild does not generate iOS projects; cloud compilation is required.
- Live association check found Firebase's automatic empty response took priority
  over the rewrite at /.well-known/apple-app-site-association. Added a static file
  at that exact path and allowed it through Hosting's ignore rules. Root association
  already returned the correct app ID. Final endpoint verification follows below.
- Native configuration/static association fix: `a969b1d`. Firebase confirmed the
  subsequent Hosting-only release at https://partybot.games. The exact standard
  endpoint https://partybot.games/.well-known/apple-app-site-association returned
  HTTP 200, application/json and app ID `9R9TPVS9UL.com.partybot` after deployment.
  Apple device-side association caching is not certified by this HTTP check.
- Post-plugin Expo Doctor: 21/21 PASS. RevenueCat's third-party bundled SDK retains
  internal legacy sandbox identifiers; application-owned references are removed.
- EAS confirmed FINISHED for iOS simulator build
  `a8fb65ac-1aa5-4750-8243-038b7e31306e`, source `a969b1d`, runtime/version 1.1.1:
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/builds/a8fb65ac-1aa5-4750-8243-038b7e31306e
  Native compilation now passes. No signed device build, TestFlight submission,
  OTA update or simulator playthrough was performed. Apple authentication,
  App Store Connect terms, purchase setup and physical-device checks remain open.
- Firebase deployment warned that the existing Node.js 20 functions runtime is
  deprecated and scheduled for decommissioning on October 30, 2026. Runtime
  migration remains a separate backend validation/release requirement.

## 2026-09-08 — iOS TestFlight preparation

- Recovery tag: `checkpoint/2026-09-08-before-ios-setup`; prepared source tag:
  `checkpoint/2026-09-08-ios-testflight-prepared`.
- Verified Apple Developer membership for DIGIGET LTD, team `9R9TPVS9UL`, with
  renewal September 8, 2027. Set that Apple team in Expo config.
- Added a store-distribution `testflight` profile with a physical-device binary,
  auto-increment and preview environment/channel. Production credential guards
  remain intact. The profile intentionally does not certify purchases.
- EAS history: existing iOS builds are old SDK54 simulator artifacts, not a signed
  SDK57 physical-device build. No old artifact was submitted or updated.
- Checks: TypeScript PASS; profile/team assertions PASS; Expo config introspection
  PASS (Apple Sign-In and Google URL scheme present, native appVersion runtime);
  iOS export PASS to ignored `.expo/ios-readiness-export`; targeted Jest PASS,
  3 suites / 8 tests. Firebase plist bundle/project match current app config.
- Signing command `eas credentials:configure-build --platform ios --profile testflight`
  reached the Apple password prompt for the account holder. Canceled without
  entering/storing a password; the owner must authenticate directly in a terminal.
- App Store Connect Apps page is blocked by its first-use Terms of Service.
  Requested explicit owner approval before acceptance; no terms were accepted.
- RevenueCat App Store provider remains incomplete and requests an in-app purchase
  key/issuer. No signing keys, service secrets or local environment files committed.
- Detailed continuation and outstanding device/store checks: `IOS_RELEASE.md`.
  No new iOS build ID, TestFlight submission, OTA, Firebase deployment or Git push.
  Account confirmation is not App Review approval. Existing lint blockers remain.

## 2026-09-07 — Installed Android audit build and final display fixes

- Resource collision fix: `7b7461a`. UI recovery tag:
  `checkpoint/2026-09-07-before-android-ui-fix`. Final UI source is recorded by
  tag `checkpoint/2026-09-07-android-ui-verified`.
- Set light status-bar icons consistently on dark screens, verified on the
  installed Hourglass screen. Removed the single-line constraint that clipped
  onboarding subtitles. These are compatible JavaScript changes for runtime 1.1.0.
- Final checks: `npm run typecheck` PASS; `npx jest --runInBand --silent` PASS
  (34 suites, 252 tests); `git diff --check` PASS. Baseline lint failures above remain.
- Native `:app:assembleRelease -PreactNativeArchitectures=x86_64` PASS; final
  incremental build completed in 2m08s, 952 tasks. Cache and temporary files now
  reside at `D:\pb-gradle-20260907`; preserved/recreated generated CMake caches
  after Windows Ninja rejected the earlier long cache path.
- Installed `expo/android/app/build/outputs/apk/release/app-release.apk` with
  `adb install -r`: Success. SHA256:
  `96EE82ED7FC55F871AE1F3C5EE5CA7663A614625EF88256504C7864A11C338FA`.
  Local debug signing, embedded release JS, version 1.1.0/code 1, x86_64 only;
  this APK is for emulator validation, not ARM phone distribution.
- Original Pixel_7 retained. Its data partition lacked install space. Created
  Pixel_7_PlayBot_Audit at `D:\pb-avd-20260907`, Android 17 / 16KB pages,
  12GB data, SwiftShader, 4GB RAM. At 2GB RAM Android lowmemorykiller terminated
  foreground processes including the app; 2GB-device compatibility is unresolved.
  The new emulator remains open with the app; no persistent Metro server.
- Native smoke checks: onboarding and guest catalog; Memory Grid setup, tile
  flips/move counter and confirmed exit; tools grid; bottle/hourglass images;
  30-second countdown; restart to catalog with Wi-Fi/mobile data disabled after
  onboarding. Restored network afterwards. No crash-buffer entries in the 4GB run.
  These checks do not certify every game, first-install offline behavior, real
  Google login, microphone, purchases, multi-phone play or physical ARM hardware.
- Replacement cloud preview build (source `7b7461a`):
  `d5f6f57b-a73a-4ec2-861e-04911080adb3`, last confirmed IN_QUEUE.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/builds/d5f6f57b-a73a-4ec2-861e-04911080adb3
  No cloud build success is claimed. No Firebase deployment or Git push.
- EAS confirmed final Android preview OTA, runtime 1.1.0, source `bc4dbec`:
  group `2a7a66de-0d1e-46ce-88c5-0fd0ee6232ae`, Android update
  `01a07c6d-d1d2-7bba-bd5c-b6fb0837f328`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/2a7a66de-0d1e-46ce-88c5-0fd0ee6232ae
  Neither runtime 1.0.1 nor Expo Go was targeted. Onboarding deep-link attempts
  returned to the catalog, so the final subtitle change lacks a fresh visual
  recheck. Final Android screenshot confirms readable status icons and bottom
  navigation; host-window foreground activation was blocked by Windows access
  denial at the end of the session. The emulator process remains running.

## 2026-09-07 — Android emulator and native audit

- Recovery checkpoint: `50083d4`, tag `checkpoint/2026-09-07-android-audit`.
  Preserved the existing production credential guard and its tests after reviewing
  the diff; no local credentials or generated native files were committed.
- Started Pixel_7 with a cold boot after its saved snapshot failed with WHPX.
  ADB reports boot complete, Android 17, x86_64, 16384-byte pages. The emulator is
  left open at the owner's request. No Metro/Expo development server was started.
- Existing local APK/native project is stale (version 1.0.0); it is not evidence
  of SDK57 compatibility. EAS history confirms the SDK57 production build was
  canceled and the completed preview binary is SDK54/runtime 1.0.1.
- Requested SDK57 Android preview APK with existing EAS signing credentials:
  `13856da0-981b-421f-ae91-4f7eddd6be12`, version/runtime 1.1.0, versionCode 2.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/builds/13856da0-981b-421f-ae91-4f7eddd6be12
  Status at this entry: IN_QUEUE, not installed or certified.
- Corrected Android purchase screens to reference Google Play instead of Apple ID.
  Purchase detail now shows an unavailable offer instead of an indefinite loading
  spinner when no request is running. Moved package selection before the web return
  to preserve unconditional hook ordering.
- Checks: `npm run typecheck` PASS; `npx jest --runInBand --silent` PASS,
  34 suites / 251 tests; `npx expo-doctor` PASS, 21/21; `git diff --check` PASS.
  `expo config --type introspect` confirms native appVersion runtime and removal
  of both external storage permissions. `npm run lint` FAIL: baseline 229 errors,
  258 warnings. Includes React Compiler diagnostics, platform-conditional hooks,
  missing Jest globals and an AudioStream namespace false positive (the installed
  SDK declares the native AudioStream member). Lint is not certified clean.
- Outstanding: install/playthrough of the new binary after EAS completes;
  native login, microphone, background/resume, offline restart and purchases.
  Production remains blocked by unverified public RevenueCat SDK configuration;
  preview safely strips those unverified keys and cannot certify real purchases.
  No Play Store submission, Firebase deployment or remote Git push in this batch.
  Publication and installation outcomes are recorded below only after confirmation.
- Source fix commit: `117c9b62fc4a6880d5dda7d7705a4a06aa1d1490`, tag
  `checkpoint/2026-09-07-android-purchase-fix`. EAS confirmed Android-only update
  on preview/runtime 1.1.0: group `c25639f3-db65-4daa-9ac0-fd7dff4cd8f4`,
  update `01a07c40-2978-737b-bc20-05d67adb5a45`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/c25639f3-db65-4daa-9ac0-fd7dff4cd8f4
  Old runtime 1.0.1 and Expo Go are not targeted.
- Owner's screenshot exposed an AVD display-layout issue: Pixel_7 had an extra
  2160x3840 display configured, pushing the phone down inside the host window.
  Backed up its config.ini, removed display 1 using `adb emu multidisplay del 1`,
  and removed the persisted `hw.display1.*` settings. ADB now lists only the
  1080x2400 built-in display. Windows Computer Use screenshot verifies the entire
  phone fits normally, including its bottom gesture bar, with no extra black area.
- Prepared local native release build for emulator testing using SDK57 prebuild,
  JDK17 and Gradle9.3.1, x86_64 only, with embedded JavaScript and local debug
  signing. Old generated native project preserved in ignored
  `expo/.expo/android-audit-backup-20260907`. This is separate from cloud signing.
- Local build exhausted C: and corrupted Gradle's class-analysis cache. Moved the
  newly created Gradle9.3.1 cache/distribution to ignored
  `expo/.expo/android-audit-gradle` on D:, preserved the corrupt cache as a backup,
  and redirected this build's GRADLE_USER_HOME/TEMP/TMP there. C: recovered about
  6GB free. Existing credentials and unrelated user files were retained.
- Real Android resource merging then failed because bottle.png/bottle.webp and
  hourglass.png/hourglass.webp map to identical drawable resource IDs. Renamed
  gameplay WebP assets to bottle-scene.webp and hourglass-scene.webp and updated
  their imports, preserving their bytes. Added a regression check for collisions
  among tool images actually referenced by application components/routes.
  Existing unused source images are not treated as bundled resources.
- Recovery tag before resource repair:
  `checkpoint/2026-09-07-before-android-resource-fix`. The queued cloud build
  `13856da0-981b-421f-ae91-4f7eddd6be12` was canceled with EAS confirmation because
  its source contains this reproducible native build failure. It is not a release.

## 2026-09-07 — Clearer relationship discussions and Persian copy review

- Before tag: `checkpoint/discussion-copy-before-2026-09-07`.
- Replaced six vague/generated discussion lenses across all 672 relationship cards
  with direct questions tied to the presented situation: concrete compromise,
  fair versus excessive expectations, clear communication before a decision,
  shared boundaries, missing context before judgment, and consequences if the
  conflict remains unchanged. Removed the ambiguous "open a useful conversation"
  wording called out by the owner.
- Re-authored each replacement question in fa/tr/de/fr/ar rather than passing it
  through the local translation model. Preserved the reviewed Persian copy for all
  112 new relationship scenarios. A full-catalog scan and deterministic sample
  review found and corrected additional broken Persian phrases (download/archive
  artifacts, untranslated English, and mistranslated props/actions). The correction
  bank now contains 224 reviewed source units. Other legacy machine-assisted text
  remains marked as translation preview and may still require editorial review.
- Catalog remains exactly 2888 cards; IDs and saved/favorite compatibility remain
  unchanged. TypeScript passed; 32 Jest suites / 244 tests passed. Offline Chromium
  at 320/390/430/1280px confirmed exact language lookup, Next/Previous and drag
  navigation, exhausted-deck return, >=44px controls, and no overflow, page errors,
  or external requests.
- Publication outcomes, source commit, final checkpoint, Firebase bundle and EAS
  update IDs are recorded after service confirmation below.
- Source commit: `d4d9b90c5c1526f0b3fcc9587d7bc39dc07e459b`.
  Firebase Hosting `partyplay-8` confirmed 334-file release. Live
  https://partybot.games uses `entry-2bd52b59854ed9143aad0859bf4560cf.js`;
  post-deploy Chromium repeated exact translation/navigation checks successfully.
- EAS confirmed SDK 57 Expo Go update for Android and iOS on `expo-go-sdk57`,
  runtime `exposdk:57.0.0`: group `b4097a68-9a89-426b-a57a-e3aec0a43d34`,
  Android `01a07bd0-d57d-7587-ab38-192658ec84c8`,
  iOS `01a07bd0-d57d-715e-aa2f-82cacc7c9716`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/b4097a68-9a89-426b-a57a-e3aec0a43d34
  Publication is confirmed; receipt on a physical device was not available.
- Final tag: `checkpoint/discussion-copy-reviewed-2026-09-07`. Full-history
  `playbot-discussion-copy-reviewed-2026-09-07.bundle` verified in the audit
  workspace. No remote Git push. Cloud rollback requires revert plus republish.

## 2026-09-07 — Bidirectional cards and bundled five-language preview

- Before tag: checkpoint/cards-navigation-languages-before-2026-09-07 at 131c8f3.
  Final checkpoint: checkpoint/cards-offline-2026-09-07 (after service confirmation).
- Built-in catalog: exactly 2888 cards; Talk 1609. Added 112 original adult
  relationship/social scenarios with six discussion questions each (672 cards).
  Existing card IDs retained. Random opener avoidance and saved/favorite state
  retained. Swipe left/Next advances; right/Previous returns to the same deck ID,
  including returning from the exhausted deck; first-card Previous is disabled.
- Five bundled translations for each built-in card: fa/tr/de/fr/ar. No runtime
  translation network request, cloud API, new dependency or billable service.
  Private custom prompts are not translated or uploaded. A previously loaded
  app is required; this does not introduce full offline website installation.
- Translation quality: local machine-assisted drafts, not fully proofread.
  All 112 new Persian scenarios and six questions were authored/reviewed, and
  sampled mistranslations corrected (136 source units with corrections). The UI
  explicitly labels translations as preview; remaining idioms may need editing.
  Provenance/reassembly: expo/src/content/CARD_TRANSLATIONS.md. Weights, model
  runtime, temporary caches and Python environment are outside the repository.
- Verification: TypeScript passed; 32 suites/242 tests passed, plus one added
  watermark hit-layer regression test passed (243 total). 91 web routes exported.
  Headless Chromium at 320/390/430/1280px: Next/Previous identity, all five exact
  language lookups through navigation, exhausted-deck return, touch targets >=44px,
  no horizontal overflow or JS errors. Offline test fixture blocked all external
  requests; observed external requests: 0. No physical iOS/Android device test.
  Fixed decorative watermark intercepting French/Arabic touches; added missing
  Previous and unselected-Favorite icon mappings. Long bilingual text scrolls
  inside the card without hiding navigation or language controls.
- Web build synchronized: entry-64dccf316c010df21e2100d5f8e364b9.js.
  Publication results recorded below after confirmation. No backend deployment.
  Expo Go remains isolated on expo-go-sdk57 / exposdk:57.0.0; old SDK54 native
  binaries are not OTA-compatible. No standalone build/signing changes.
- Publication confirmed: source commit 75d594b9fc7a2429d1c913ecae5bda30e69e9a93;
  Firebase Hosting partyplay-8 released 334 files successfully. Live site
  https://partybot.games references entry-64dccf316c010df21e2100d5f8e364b9.js.
  Live Chromium checks repeated all five exact translations and navigation with
  the network switched offline after page load, including left/right drags.
- EAS confirmed Android/iOS Expo Go update on expo-go-sdk57, exposdk:57.0.0:
  group 2b869351-adad-4cc5-8036-65a4b598d46d;
  Android 01a07bb4-56e1-779e-9066-dcade4c3de96;
  iOS 01a07bb4-56e1-71a2-88bc-0d7e7edf86b8.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/2b869351-adad-4cc5-8036-65a4b598d46d
  Publication is confirmed, physical-device receipt is not tested. EAS's separate
  web export was not synchronized over the verified Firebase build.
- Recovery: local final checkpoint and full-history bundle in the audit workspace
  (playbot-cards-offline-2026-09-07.bundle); no remote Git push. Revert and republish
  for cloud rollback, retaining newer local changes.

## 2026-09-07 — Transparent tool pictures and compact 3-by-2 mobile grid

- Source commits: b2897ce (artwork/drum), fe5bf38 (fluid widths), 8838667
  (final requested 3-by-2 grid, no visible subtitles, synced web output).
- Before tag: checkpoint/tool-images-mobile-before-2026-09-07.
  Final tag: checkpoint/tool-images-mobile-2026-09-07.
- Six built-in imagegen picture icons, locally cut out with explicit owner approval;
  true RGBA 256px assets under expo/assets/images/tools. Prompt set in its README.
  No API fallback or new native dependency. PNGs are vector-style, not SVGs.
- Tools: 68px images, 130px minimum card height, fixed three columns/two rows,
  percentage widths and natural height on native/web; removed subtitle text.
  Long titles wrap at narrow widths. Card-category heading can shrink/wrap.
- Catalog Drum Challenge now uses a dedicated monochrome SVG matching other
  game icons. The larger gameplay illustration is intentionally unchanged.
- Checks: TypeScript passed; Jest 30 suites/237 tests passed; 91 web routes exported.
  Live tool screenshots inspected at 320/360/390/430/768/1280px: all six images
  loaded, exactly 3x2 cards, no overlap or horizontal overflow. At 320/360px the
  Team Splitter title wraps and the second row grows to 148px for readability.
  Mobile browser smoke: home, Tools and all 16 game setup routes returned 200,
  no JS page errors or horizontal overflow. This is not a complete playthrough.
- Firebase Hosting partyplay-8 confirmed final deployment at https://partybot.games.
  Final web entry: entry-819c3a85b043b972d8f917d8e1d60fef.js.
- EAS confirmed final Expo Go publish for both platforms, runtime exposdk:57.0.0:
  group 017ec7b0-d770-4714-9ce9-982f428d8fa0;
  Android 01a07b84-8bae-7362-b3d0-ba737fd85f83;
  iOS 01a07b84-8bae-70a8-a3c1-53797da35a39.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/017ec7b0-d770-4714-9ce9-982f428d8fa0
  Earlier in-progress update attempts were interrupted to incorporate the owner's
  subsequent layout requests; the final confirmed group above is authoritative.
- Compatibility: native build history still contains SDK54 builds, not proof of
  SDK57 binary compatibility. Expo Go updates use exposdk:57.0.0 separately.
  No physical iOS/Android device test was available; signing/device input is
  still required for a new standalone iOS binary. Do not claim old installed
  SDK54 apps receive this OTA. Existing audio/native auth limitations still apply.
- Recovery: full-history bundle in the audit workspace, final checkpoint tag;
  use revert then republish (cloud releases do not roll back with Git alone).

## 2026-09-07 — Refined silver tool icons and longer Wheel

- Replaced colorful object illustrations with a consistent silver outline SVG
  family. Retained transparent canvases, large tool tiles and responsive columns.
- Wheel duration/audio lifecycle increased from 11000 to 13000ms with the same
  smooth quartic deceleration and angle-driven ticks. Removed only the center-hub
  rotation glyph; the Spin button remains. Pointer enlarged from 24x23 to 40x36,
  retaining exact center alignment and existing winner selection logic.
- TypeScript passed; 29 Jest suites / 230 tests passed. Web export (91 routes), sync
  and Firebase Hosting partyplay-8 deployment succeeded.
  Bundle: `entry-c3abed2ee141f63b6597d7fbbf01508a.js`.
- Live https://partybot.games/tools verified at 390 and 1280px: six icons, no
  horizontal overflow. Tools and Wheel screenshots visually inspected. Live wheel
  at 390px: pointer centered, no overflow, completed in 13174ms, winner Dare, no
  page errors. Native physical-device experience not tested.
- Before tag: `checkpoint/refined-tools-before-2026-09-07`; final tag:
  `checkpoint/refined-tools-2026-09-07`. Full-history backup in Codex audit workspace:
  `playbot-refined-tools-2026-09-07.bundle`. No remote Git push.
- Source commit: `1113e3071e68284b1f467bfa9f5cb994b0424be7`. Expo confirmed
  expo-go-sdk57 publication, runtime exposdk:57.0.0, group
  `0cc0bb61-d557-4fba-ad3c-aa63b877e01b`, Android
  `01a078ea-d07e-7cbb-97bb-5ef1127c6350`, iOS
  `01a078ea-d07e-7b62-a4bf-85ab2e57673a`.
- Prior card translation/673-card expansion remains outstanding and unchanged.

## 2026-09-07 — Automatically remember new local game friends

- Shared game Setup remembers active typed names only after successful session
  creation and duplicate validation. Blank names, Player N placeholders, the user's
  configured name, and existing local friends are excluded. No online friendship,
  invitation, backend write or contact upload is performed.
- Friends store hydrates before merging and persists through the existing local
  storage. Name comparison normalizes spacing/case/Unicode and Persian keyboard
  variants. Generated IDs remain independent of edits to names.
- Removed the 12-local-friend limit. All saved friends are reachable in the
  horizontally scrolling Quick Add list; already-selected names are excluded.
- Checks: TypeScript passed; full Jest suite 29 suites / 230 tests passed.
  Web export/sync passed and Firebase Hosting partyplay-8 confirmed deployment.
  Web bundle: `entry-a9ba9b6d3a5c1be1bec6b1fc87d33873.js`.
- Isolated headless Chrome on the live Reaction Time setup verified no save before
  Start, save after Start, presence in Friends after page reload, and presence in
  Quick Add after clearing the current player slot. No page errors. Test browser
  storage was isolated from the user's friends. Physical native phone not tested.
- Before checkpoint: `checkpoint/auto-friends-before-2026-09-07`.
  Final tag: `checkpoint/auto-friends-2026-09-07`. Offline full-history backup:
  `playbot-auto-friends-2026-09-07.bundle` in the Codex audit workspace.
- Source commit: `6e09429be0ca907d51f2c7464f19a943a77bfab2`.
  Expo confirmed publication to expo-go-sdk57, runtime exposdk:57.0.0:
  group `5b5f14ac-38fb-4700-8138-67a9109ed490`, Android
  `01a078ba-4186-7d54-8ab8-9b9e73cf1370`, iOS
  `01a078ba-4186-7e44-ae4c-4cb6fe23fdf6`.
- Previous outstanding card translations/673-card expansion unchanged. No Git
  remote push or persistent local server.

## 2026-09-07 — Larger tool tiles and standalone vector objects

- Replaced all six circular tool badges with transparent SVG object illustrations:
  one die, bottle, hourglass, coin, team split, and wheel. Uses existing SVG support;
  no new native dependency, image download, emoji or icon-font dependency.
- Tool illustrations are 84px (previous glyphs 22px). Enlarged tiles with 16px
  titles, two columns on narrow screens, three on wide screens, and a 900px
  maximum Tools page width. Preserved every tool route and behavior.
- Checks: TypeScript passed, 28 suites / 227 tests passed, web export (91 routes)
  and sync passed. Firebase partyplay-8 confirmed Hosting deployment complete.
  Bundle: `entry-767c0779d76e12fefdd9dd7b4b0d45d1.js`.
- Live https://partybot.games/tools checked in headless Chrome at 390 and 1280px:
  six SVGs, no horizontal overflow or page errors, tiles 172x183 and 280x183px.
  Both screenshots visually reviewed. Physical native device not tested.
- Source commit: `641c67033b94e43cefb2bd5d23cfc1d8b4a87470`.
- Expo confirmed Android/iOS publication on expo-go-sdk57, runtime exposdk:57.0.0:
  group `022cba20-d9ea-4408-9280-a73790754672`, Android
  `01a078b3-743e-7aa4-80e2-59cc2221becd`, iOS
  `01a078b3-743e-7495-b8e6-24a501d42932`.
- Before tag: `checkpoint/tools-icons-before-2026-09-07`; final tag:
  `checkpoint/tools-icons-2026-09-07`. Full-history backup in Codex audit workspace:
  `playbot-tools-icons-2026-09-07.bundle`.
- Prior outstanding card translations and 673-card expansion are unchanged.
  No remote Git push or persistent development server.

## 2026-09-07 — Cards motion and randomized opening (partial request)

- Recovery before editing: `checkpoint/cards-before-2026-09-07`.
- Fixed the stack/front coordinate mismatch: all cards share the same centered
  anchor, with stack offsets applied as transforms instead of absolute top.
  Added a 420ms eased transition, reduced-motion support, synchronous double-tap
  guard, cancellation on filter changes/unmount, and commit-time transform reset.
- Opening a category/filter now uses a persisted last-opener exclusion and a
  Fisher-Yates shuffle. Manual shuffle excludes the visible card. Saving a card
  outside Favorites no longer recreates the deck.
- Verification: TypeScript passed; 28 Jest suites / 227 tests passed; 91-route web
  export and sync passed. Firebase Hosting partyplay-8 confirmed release complete.
  Web bundle: `entry-3381b75b5f1aef5ff7594d812a6c5c17.js`.
  Live URL: https://partybot.games/cards/talk . Headless Chrome verified first card
  and Next change without page errors; in-app screenshot inspected during motion.
- Still outstanding: five-language card translations/controls and 673 additional
  cards (mostly Talk). The built-in total remains 2216, NOT 2889. No placeholder
  translations, external translation service, or filler duplicates were added.
- Source commit: `a86de86bcee27d2628c66267a8ed4c967a7755e2`.
- Expo confirmed publication to expo-go-sdk57, runtime exposdk:57.0.0:
  group `43bf5d44-fd0a-4c2c-bdab-305a1aae1961`, Android
  `01a078ac-ccf9-74c6-8b94-eb4e6eb80d11`, iOS
  `01a078ac-ccf9-7680-b216-826fa1e65750`.
- Final recovery tag: `checkpoint/cards-motion-2026-09-07`; full-history offline
  backup: `playbot-cards-motion-2026-09-07.bundle` in the Codex audit workspace.
- No Git remote push and no persistent local server. Device playback/animation
  experience has not been verified on a physical phone.

## 2026-09-07 — Turn summaries, setup difficulty and event sound refresh

- Source commit: `3d436dd6791639bc561dec4c83396ad09f42f721`.
- EAS confirmed Android/iOS publication on expo-go-sdk57, runtime exposdk:57.0.0:
  group `451ec208-9eac-438c-8897-f6e506c3dac2`, Android
  `01a078a1-4608-790e-9953-bff90aef056a`, iOS `01a078a1-4608-701a-916a-d7f14ec7c969`.
  Device receipt remains unverified. No custom-binary channel was changed.
- Final checkpoint: `checkpoint/turn-sound-release-2026-09-07`.
  Offline Git bundle: audit workspace `playbot-turn-sound-2026-09-07.bundle`.

- Recovery baseline: `checkpoint/results-handoff-2026-09-07` (80ad4ec).
- Shared player-complete screen now retains the prior player's named result ABOVE
  the animated next-player handoff. Applied to Memory Grid/Path, Tap in Order,
  Reaction Time, Eyesight, Drum and Color Trap. Games with existing detailed
  comparison/result steps retain those instead of replacing them with generic data.
- Color Trap summary includes score, hits, misses and forbidden taps; final player
  also gets a persistent personal summary before final rankings.
- Eyesight difficulty lives in Setup, persists in gameConfig, defaults safely to
  Medium, and enters the shared instruction gate before ready. Replay keeps level.
- Reaction Time explicitly says to tap the screen when it turns green.
- Truth or Dare display name corrected; bottle reduced and name ring moved outward.
- Wheel lasts 11 seconds with quartic ease-out and synchronized motion ticks.
- Bottle tick is now original synthesized glass-friction Foley, not a ringing beep.
- Rebuilt 14 short game-event WAVs; same PCM synthesis runs on web. Fixed web
  AudioManager no-op, added quiet flip/match/error cues to Memory Grid and event
  feedback to Color Trap, memory/tapping/reaction/social games. Common effects
  respect mute, throttle rapid duplicates, and stop when browser is hidden.
  Core Sound Match tones, reverse recordings and Drum musical timing unchanged.
- Checks: tsc passed; Jest 27 suites / 223 tests passed; 91-route export and sync
  passed. Firebase Hosting-only publish confirmed, https://partybot.games.
  Final bundle: entry-0d721a91c06ae3398a7d46b8cd5b317e.js (zero-score correction).
- Live Eyesight smoke confirms Hard selected in Setup survives instruction gate,
  with no in-session difficulty chooser. Color Trap's completed turn at 390x844
  shows named result with hits/misses/mistakes above next-player handoff; no
  captured console errors. Zero-point completed scores are no longer mislabeled
  as skipped by the common result adapter. Physical-device audio not yet heard.
- No new native dependencies, no Metro/LAN server, no remote Git push.

## 2026-09-07 — Animated handoff, unified results and drum feedback

- Recovery baseline: `checkpoint/before-results-handoff-2026-09-06`.
- Home Drum Challenge cards now render a code-native drum SVG on web/iOS/Android.
- Shared handoff: large green player name, animated phone moving between vector
  hands (reduced-motion safe), header-only Skip this player with current-player
  confirmation. Separate handoff registration avoids parent phase effects clearing it.
- Unified both ranked-results components into a neutral/mint scoreboard with a
  geometric podium, no crown emojis, explicit skipped/empty states and preserved
  caller ordering, metrics, sharing and replay. Reverse Singing's non-ranked audio
  comparison remains distinct. Existing game-specific scoring rules are unchanged.
- Fixed Whitney web taps calling only the native sound reference; accepted web
  taps now play drum feedback. Added immediate duplicate-tap guard and clear hit
  instruction. Metronome feedback retained and covered alongside Whitney.
- Checks: TypeScript passed; Jest 26 suites / 208 tests passed; web export and
  sync succeeded. Firebase Hosting-only deployment to partyplay-8 confirmed.
  Live: https://partybot.games; bundle entry-8bacbe7d43cfa08812a9877a71b48748.js.
- Live 390x844 smoke: Imposter handoff fits, green name/animated hand graphic,
  header skip confirms correct name and advances; Guess the Seconds reaches new
  final scoreboard; home drum SVG present. No captured console errors. Temporary
  tab closed and viewport restored. Physical-device audio not independently heard.
- Expo Go SDK57 published successfully: group `7f312057-a0c0-4ae7-815f-4d08707339ed`,
  Android `01a07891-2837-7603-88a2-57f5e48fa653`, iOS `01a07891-2837-79fe-9505-733cae1114c9`.
  Source commit `b59c1157adcec222030f840f41297b607ce81951`; runtime exposdk:57.0.0.
  Physical receipt not verified. Next requested batch starts from this checkpoint.
- No persistent local server; no remote Git push (destination confirmation pending).

## 2026-09-06 — Handoff redesign, stable player banner and symbol audit

- Replaced the platform-dependent drum emoji with a fixed-viewBox SVG drum. Shared handoffs now use a responsive centered card, phone-transfer SVG, readable instruction, prominent player name and accessible-sized Ready/Skip actions. Existing callbacks and private reveal boundaries preserved.
- Removed the unnecessary shield/question-mark decoration above the Imposter secret word.
- Guess the Seconds registers its ready gameplay phase in the standard active-player banner. No duplicate name beside Round before Start; handoff screens in other games remain banner-free.
- Completed missing Material glyph mappings for symbol literals and configured icons, including Rounds/repeat, miss/cancel, metronome, target, search and checkmark. Legitimate question marks for hidden cards/help remain intentional. Added source coverage checks and retained actual-glyph validation.
- Validation: TypeScript clean; 204 tests pass. Final expanded icon scan passes. Web export and Firebase Hosting succeeded; bundle entry-564da6e86a554ff7e21e43237795306f.js.
- Live mobile-width (390x844) checks: shared handoff fits, Imposter reveal has no extra icon, drum vector retains proportions, miss shows a red cross, Rounds shows repeat, Guess the Seconds banner stays in place before/after Start. No browser errors. Physical iOS/Android devices not tested.
- Pre-change checkpoint: checkpoint/before-handoff-icons-2026-09-06. No remote Git push; no persistent local server.
- Expo Go SDK57 published to expo-go-sdk57 for Android/iOS: group f5248468-ebe6-4ccd-9602-c4fdf62a7162; source deb5477bdd425a6986fd83f0ea01d5a64de578bb.
- Final tag: checkpoint/handoff-icons-release-2026-09-06. Offline full-history bundle: playbot-handoff-icons-2026-09-06.bundle in the Codex audit workspace.


## 2026-09-06 — Setup guide timing and metronome challenge

- Guess the Seconds now uses the shared pre-game guide immediately after Setup. Its timer Start starts the timer directly; the session does not mount beneath the initial guide.
- Active-player banner has a neutral background and muted label; only the player name and pulsing dot remain green.
- Metronome: four audible bars, four silent bars, then one tap on the next downbeat. Listening-phase taps are ignored; synchronous completion prevents double submission. Signed timing errors replace the incorrect average label and old first-silent-bar target. No visual beat countdown during silence.
- Presets: 4/4 (quarter=120), 3/4 (quarter=100), 6/8 (dotted quarter=80, 3+3), 8/8 (eighth=240, 3+3+2). Old unsupported presets fall back to 4/4; trials always use four bars per stage.
- Validation: TypeScript clean; 203 tests passed in 25 suites, including four-meter timing, accents, early/late signs, premature/double taps, and timer cleanup. Web export succeeded.
- Firebase Hosting deployed to partyplay-8, bundle entry-d9c04c9b9a81b49f00377bf16b127d87.js. Live UI verified Setup → guide → idle timer → direct Start; neutral banner; 6/8 guide/handoff/listening/silence/late result and timeout result. No browser errors. Physical-device audio latency and actual speaker output were not certified.
- Rollback baseline: checkpoint/before-metronome-flow-2026-09-06. No remote Git push or persistent development server.
- Expo Go SDK57 published for Android/iOS on expo-go-sdk57: group a2cd075a-2a6b-4b21-9395-5f21d216cc10; source 85efaa92e83d292b10f9d5b8607270ab6591a426.
- Final tag: checkpoint/metronome-flow-release-2026-09-06. Full-history offline backup: playbot-metronome-flow-2026-09-06.bundle in the Codex audit workspace.


## 2026-09-06 — Restore handoff names and offline Imposter meanings

- Restored the large player name on shared handoff screens. The activity banner now stays hidden during ready, countdown, handoff and result phases; active gameplay uses a larger green pulsing name. Guess the Seconds displays the actual name when ready instead of "Your turn". Result cards retain explicit ownership where needed.
- Added five offline word-meaning dictionaries (Persian, Turkish, Spanish, German, French) and SVG flag/language controls for Imposter. Original English remains visible. Translation UI only mounts after a non-imposter's role reveal and resets between players. Cricket is disambiguated by category.
- The plain app background release remains included. No native dependency or runtime changes.
- Validation: 190 existing/UI tests across 23 suites plus four translation tests passed (194 total). Coverage asserts all 1,350 unique words have all five meanings (6,750 translations); includes language switching/reset, RTL, category disambiguation, and hidden translation UI for the imposter. Translations are authored gameplay meanings, not professionally certified terminology or an official localized film-title registry.
- Source `fe28f74`; TypeScript/web export passed. Firebase Hosting succeeded; web entry `entry-dc2bf12d1c984db830966b805149e236.js`. Live Imposter checked at desktop and 390x844: handoff name restored with no top banner, active name green/enlarged, five language controls work, Persian readable, English preserved, translations clear on handoff and are absent for the imposter. Physical native devices not tested.
- Live Drum Challenge ready screen shows the large player name with no banner. Guess the Seconds ready card names Player 1; running phase names them only in the active banner. No browser errors observed. Exhaustive manual playthrough of all 16 games was not repeated.
- Expo Go SDK57 published to `expo-go-sdk57`: group `940dc4d3-bc1b-4c38-bc6b-6c1df7045cf1`, Android `01a07843-7f36-7382-a15a-f3cbba68afb9`, iOS `01a07843-7f36-71ff-8e2c-1f9ba1642e72`.
- Release tag `checkpoint/handoff-translations-release-2026-09-06`; offline bundle `playbot-handoff-translations-2026-09-06.bundle` in the Codex audit workspace. No remote push; no persistent local server.


## 2026-09-06 — Remove decorative app backdrop

- Replaced the shared AppBackgroundView artwork with a plain #08080F surface for both legacy variants. Removed colored circles, sheen, vignette, gradients, and unnecessary viewport subscriptions. All existing screen consumers inherit the change; game artwork and control colors remain unchanged.
- Three regression tests passed (default, explicit default, simple), TypeScript passed, web export passed. Original circle color definitions no longer occur in app source.
- Recovery tag before change: `checkpoint/pre-flat-background-2026-09-06`.
- Published Firebase Hosting (`partyplay-8`), web entry `entry-3439b58d66c520bb044659dd1ce450ac.js`; live setup and home visually confirmed without decorative circles. Expo Go SDK57 group `bffb9938-4553-4cb0-b3a2-59ebf1bd533d`, Android `01a0782e-0f1d-7f86-b676-5bbaf0e2ec64`, iOS `01a0782e-0f1d-7b8a-8589-ed6c1453e5fb`. Physical mobile not tested.


## 2026-09-06 — Single current-player identity

- Removed redundant current-player headings across game sessions and shared ready/handoff views when the activity banner identifies the same player. Preserved roster, voting, and scoreboard identities.
- Current-player banner name uses weight 800 and a gentle opacity pulse; reduced-motion preference is respected. Recording cards retain clear Original/Mimic role labels.
- Validation: 181 tests passed across 22 suites; TypeScript and web export passed. Live Memory Path ready/active/skip-to-player-2 and Memory Grid ready/active showed one current-player label. Computed name weight 800 and changing opacity verified; no browser errors recorded. Physical-device testing and exhaustive manual testing of all game phases were not performed.
- Source commit: `33bb98d`. Firebase Hosting published to `partyplay-8`; web entry `entry-af0baacf42d48d92b325bfd1469dcd14.js`. Pre-change tag: `checkpoint/pre-player-labels-2026-09-06`.
- Expo Go: branch `expo-go-sdk57`, runtime `exposdk:57.0.0`, group `fddfb99c-b545-43e9-9895-e0e70f8c6f4c`; Android `01a07815-5e9d-7339-87b7-7cc292bbc618`, iOS `01a07815-5e9d-7809-ba94-44c2714b0a8d`.
- Release checkpoint: `checkpoint/player-labels-release-2026-09-06`; offline bundle `playbot-player-labels-2026-09-06.bundle` in the Codex audit workspace. No Git remote push or persistent local server.


## 2026-09-06 — Mode-specific guides and shared turn language

- Ten mode-specific guides across Pass & Guess (Classic Q&A / Who Said It),
  Imposter (Discussion / Clue), Memory Path (Time Race / Turn Based),
  Drum Challenge (Music Drop / Metronome), Draw & Rush (Prompt / Free Draw).
  Setup config selects the guide; Pass & Guess passes its in-session selected mode.
  Guides gate the game start, so clocks do not start underneath the guide.
- All 16 game sessions register actual turn ownership in a shared activity context,
  independent of Skip availability. Header shows UP NEXT, NOW PLAYING, VOTING,
  DISCUSSING or TURN RESULT; final standings/configuration hide the indicator.
  Group phases show Everyone, not a misleading individual. No role is exposed.
- Slow green dot pulse only during active phases; reduced-motion preference disables
  pulsing. Names remain static/readable. Header stays width-bounded at 720px.
- Standardized 14 primary action styles to shared 56px minimum height / 16px radius,
  and shared handoff/guide appearance. Game-specific play surfaces retain their
  specialized size/shape (drum pad, reaction area, recording buttons, drawing tools).
- Studio player names use the shared header instead of repeating the same name.
  Color mobile preview balanced to keep controls usable; Sound has a taller tuner,
  explicit Play and three-second deliberate previews.
- Checks: TypeScript and 176 tests / 22 suites pass. Web/live and final update IDs
  recorded below after completion. Not every game phase has been manually exercised
  on physical iOS/Android hardware.
- Source checkpoints: `93209cf` (shared UI/guides), `2aafaf7` (handoff correction).
- Final Firebase Hosting export/deploy succeeded; live bundle:
  `entry-0e3e45795d812f003bdc23813ca52fc6.js`.
- Live checks: both Pass & Guess mode guides show different correct instructions;
  Metronome setup selects its own guide. Active player advances from Player 1 to
  Player 2, and final handoff shows UP NEXT before Ready (not NOW PLAYING).
  Color adjustment and Submit produce a result with the TURN RESULT indicator.
  Sound Match checked at 390x844 and 1440x900: bounded layout, taller tuner,
  visible Play and Submit; no browser error logs during this smoke test.
- Remaining accessibility caveat: React Native Web does not expose the numeric
  slider aria-value fields in the rendered DOM; the named +/- buttons and spoken
  frequency Play label are available. Screen-reader slider gestures are unverified.
- Final backup tag: `checkpoint/shared-game-ui-release-2026-09-06`.
  Offline bundle in audit workspace: `playbot-shared-game-ui-2026-09-06.bundle`.
- Final Expo Go publish confirmed: branch `expo-go-sdk57`, runtime `exposdk:57.0.0`,
  update group `f8fcd618-848d-4ea8-b526-e05d37933833`.
  Android `01a0778e-b3b5-78c5-b0b6-bd599dbea08d`,
  iOS `01a0778e-b3b5-75cd-bac5-a3f10807414b`.

## 2026-09-06 — Expanded Color Lab / Sound Studio controls

- Checkpoint before edits: `checkpoint/pre-sound-layout-2026-09-06`.
- Shared studio is top-aligned, bounded at 720px; no large empty area above play.
- Sound tuner grows with viewport height (220–620px track), wider track and touch
  controls, explicit 56px Play tone button below Hz, larger target Play control.
- Explicit target/guess/result playback now lasts 3 seconds; short slider previews
  remain short. Existing score/turn logic is unchanged.
- Color preview grows with viewport height (160–360px); target preview at least
  260px. Thicker color tracks, larger thumbs and parameter values; white Submit retained.
- TypeScript and web export passed; 156 tests / 20 suites passed.
- Firebase Hosting published; mobile-sized live Sound Match checks passed for
  target Play, +1Hz, new Play tone, Submit and result. Physical audio-device
  listening is not verified by browser UI checks.
- Initial Expo Go update group: `7bd0a599-5b88-4856-bfac-d6ebde5dfb64`, runtime
  `exposdk:57.0.0`; superseded by the combined mode-guide / activity-header release.

## 2026-09-06 — Reliable shared Exit / Skip controls

- Pre-change tag: `checkpoint/pre-session-controls-2026-09-06`.
- Session header for all games uses an in-app confirmation modal instead of
  browser `window.confirm` or native-only alerts. Cancel does not invoke actions;
  async confirmation is guarded against duplicate taps and exposes retry errors.
- Pending Skip is invalidated when the registered turn handler changes, so an
  expiring turn cannot accidentally skip the next player. Exit remains available
  even in games/phases where Skip is intentionally not registered.
- Added missing `forward.fill` -> `fast-forward` Material icon mapping, larger
  44px header touch targets, and restored white Color Match Submit Match button.
- Legacy floating Skip uses the same confirmation component. Tool Back and profile
  Back/Done routes were inspected; they already have navigation fallbacks.
- Checks: 156 tests / 20 suites passed, TypeScript passed, web export passed.
  This is shared-control coverage, not a claim to have exercised every app action,
  destructive account action or all game/timing combinations on real devices.
- Source commit: `754f0c69454ef1963b8ab36cc9318c7692480200`.
- Firebase Hosting deployment succeeded; live partybot.games loads
  `entry-44d1c9e5c0cb30e8562431fc1c3526df.js`.
- Live checks: Color Match Skip cancel preserves Player 1; confirmed Skip advances
  to Player 2; skipping the last player shows both skipped entries with no winner.
  Exit cancel preserves results, confirmed Exit returns home. Memory Grid Skip
  advances to Player 2 and Exit returns home. Profile Done returns home.
  Skip fast-forward icon is visible; no browser error logs in this smoke test.
- Expo Go published for iOS/Android on `expo-go-sdk57`, runtime `exposdk:57.0.0`.
  Update group: `cdb1d544-f7ea-4aee-bb53-61e989b0b330`.
  Android: `01a0776b-960d-722c-81c1-0448da43ea3f`.
  iOS: `01a0776b-960d-75d4-9206-b95e1499fd0e`.
  Physical-device validation remains unperformed.
- Release checkpoint: `checkpoint/session-controls-release-2026-09-06`.
  Offline backup: audit workspace `playbot-session-controls-2026-09-06.bundle`.


## 2026-09-06 — Game-flow repairs / Match Studio / Drum web playback

- Pre-change checkpoint: `checkpoint/pre-flow-fixes-2026-09-06`.
- Color Trap now captures explicit turn identity/color; Imposter includes the last
  vote with one shared outcome calculator (ties explicitly let the imposter escape).
- Drum next-player startup is separated from the old callback; web Whitney mode
  now actually plays its bundled track via Web Audio instead of running silently.
  Playback failure returns a retry message without recording a missed attempt.
- Memory Path pending timers are cancelled on Skip/start/unmount and finishing
  disables Skip. Memory Grid mismatch timers are cancelled and final move count
  is retained. Tap in Order retains its final correct count.
- Finalized names are validated; Guess the Seconds results use player IDs.
  Color/Sound Match retain explicit skipped status; Sound Match transitions guard
  duplicate input during asynchronous sound teardown.
- Color Lab and Sound Studio add bounded, scroll-safe panels, visible three-step
  progress, clearer comparison swatches and readable frequency controls.
- Checks: 153 tests / 19 suites passed; TypeScript passed; 91-route web export
  succeeded. Includes actual component regressions for Color Trap, final Imposter
  vote and six Drum automatic attempts across two players, plus explicit tie tests.
- Source commits: `01316874de28811513548a933eed9975acef5287` and UI polish
  `8fec54e0d6f71652bdf1e74a960deab2433743a5`.
- Firebase Hosting confirmed both deployments to `partyplay-8`; final live web
  entry is `entry-93902bcc36544a300c7ba421c632f6be.js`, site https://partybot.games.
- Live browser at 390x844: Color Match mix/result inspected; Sound Match
  listen/tune/result inspected, 440->441 Hz control and submit exercised. Corrected
  a flex-basis collapse found during this verification and republished. No captured
  console errors (existing web native-driver fallback warning remains).
- Drum live web: Start Listening, successful decoded-playback-dependent tap,
  258ms result and Next Attempt observed. Physical speaker output was not measured.
- Final Expo Go branch `expo-go-sdk57`, runtime `exposdk:57.0.0`, published for both
  platforms. Group `a9e24fc0-e5a2-4b27-a653-17ac153e13df` supersedes the initial
  group `ab681bea-c77b-4e6e-ae4a-f8540ece5de9`.
  Android `01a0774b-7a27-7bc3-915f-8ba73e82ab26`;
  iOS `01a0774b-7a27-7e69-91c5-17656e53d81c`.
  https://expo.dev/accounts/imehdiamiri/projects/expo-app/updates/a9e24fc0-e5a2-4b27-a653-17ac153e13df
- Native custom runtime remains isolated; actual phone receipt/audio and complete
  desktop/device matrices are not certified. No persistent local server was used.
- Final rollback tag: `checkpoint/game-flow-studios-release-2026-09-06`.
  Git bundle backup: Codex audit workspace `playbot-flow-studios-2026-09-06.bundle`.
- Remaining audit follow-up: Truth & Dare visual angle alignment and broader
  physical-device/race testing; these checks do not prove every game permutation.


## 2026-09-06 — Stable home refresh / 16 new game heroes

- Source: `263045fcd6512dd1c93d7c8b9caffed8e71d8647`.
- Pre-change tag: `checkpoint/before-hero-refresh-2026-09-06`.
- Web CSS grid replaces hydration-sensitive measured card widths; icon placeholders
  reserve space. Reproduced 172px -> 279px bug is fixed on production: 279.99px
  before/after navigation at desktop width, 165.73px before/after at 390px mobile.
- All 16 game hero WebPs replaced, 1672x941 each, 748,784 bytes combined, built-in
  image generation. Natural-ratio SSR frames retain rounded, borderless images.
  Exact prompts/paths: `docs/hero-prompts-2026-09-06.json`; gallery and QA report:
  `docs/hero-gallery-2026-09-06.html`, `docs/HERO_REFRESH_2026-09-06.md`.
- Typecheck passed; 149 tests / 18 suites passed; 91 routes exported. Production
  mobile/tablet/desktop checks passed; no console errors in tested flows. All 16
  hero URLs returned HTTP 200 and matching SHA-256 hashes.
- Firebase Hosting deployment succeeded to `partyplay-8`: https://partybot.games
  uses `entry-8ad1933042a76d63df291fba54c2afde.js`. Generated web output/assets were
  replaced; previous versions remain recoverable through Git. No local server.
- Expo Go SDK57 update succeeded, preview environment, branch `expo-go-sdk57`,
  runtime `exposdk:57.0.0`, group `a7175aa9-b997-4eae-8a13-b2c844eb4b55`.
  Android: `01a076a7-6142-78d5-b37b-5035c019542a`;
  iOS: `01a076a7-6142-70bb-8b13-5ad0abfad520`. 16 new assets uploaded.
- Physical-device receipt is not claimed. Existing test-renderer deprecation and
  Expo dynamic-import warning remain; no native dependency/runtime changed.
- Recovery tag: `checkpoint/hero-refresh-2026-09-06`. Local backup bundle:
  `C:/Users/Mehdi/Documents/Codex/2026-08-14/playbot-legacy workspace-ios-android-audit/playbot-hero-refresh-2026-09-06.bundle`.
  Git remote push remains pending explicit destination confirmation; cloud rollback
  requires republishing a recovered version, not just reverting Git.

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
  `C:/Users/Mehdi/Documents/Codex/2026-08-14/playbot-legacy workspace-ios-android-audit/playbot-checkpoint-2026-09-05.bundle`.
- Existing origin: `https://github.com/imehdiamiri/partybot-anti`; push was blocked by
  auto-review pending explicit destination confirmation. Local checkpoint is complete.
- This checkpoint preserves the accumulated previous work; it is not a claim that
  every historical change was tested. Ignored credentials are not in the Git bundle.

### Changes

- Archived the legacy workspace dispatch workflow; Codex now implements and releases.
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
