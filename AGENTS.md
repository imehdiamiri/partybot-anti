# PlayBot development workflow

The owner transferred all development and publishing to Codex on 2026-09-05.
Work directly in this repository. Development is managed by Codex.
Use RELEASE_LOG.md for release history.
User-facing updates are Persian; code and technical release records are English.

## Checkpoints and releases

- Before a meaningful batch, inspect Git status and preserve existing work with a
  checkpoint commit/tag after checking for secrets and unintended generated files.
- Preserve ignored local credentials; never commit .env, service-account keys,
  signing keys, OAuth tokens, or local Firebase/Google service files.
- Finish each batch with appropriate checks, a commit, and a RELEASE_LOG.md entry
  containing commit/tag, commands/outcomes, deployed URLs, mobile update/build IDs,
  compatibility limits and unresolved blockers. Never claim a publish succeeded
  without service confirmation.
- Git origin is https://github.com/imehdiamiri/partybot-anti. On 2026-09-29 the
  owner authorized syncing this existing repository and keeping it current for
  work across Windows and macOS. Push reviewed commits to this origin after each
  completed batch; never push credentials or force-push. Fetch before work and
  reconcile remote changes without discarding local work. See MAC_SETUP.md.
- CI/CD is documented in CI_CD.md. Reuse successful GitHub Actions checks for the
  exact unchanged commit instead of repeating full local suites. Diagnose only
  failed jobs; do not introduce AI-powered CI steps or automatic polling agents.
- The owner excluded 100/1,000-user benchmarks from automation on 2026-09-30.
  Do not add load tests to CI, deployment, or schedules, or rerun them unless
  explicitly requested. Keep ordinary unit and authorization regression tests.
- Recover using git revert or an isolated worktree at a checkpoint. Do not discard
  current work with reset --hard or force-push. Firebase and Expo releases require
  separate rollback/republish; a Git revert alone does not roll back cloud state.

## User-approved publishing

- The user authorizes Codex to implement, verify and publish relevant changes to
  Firebase project partyplay-8 and existing Expo project
  b7949f49-aef7-4963-9d95-5eb35280136e (owner imehdiamiri).
- Web: one-off Expo export, node sync-web-build.js, then Firebase Hosting only.
  Live site is https://partybot.games. Deploy backend targets only for an actual
  scoped backend correction, explicitly selecting that target.
- Mobile: inspect existing channels/builds first, then publish compatible updates.
  A native dependency/config change needs a compatible new binary/runtime; never
  send an incompatible OTA to existing binaries. Expo Go is not a replacement for
  an installed development/release binary and cannot use arbitrary native modules.
- No persistent Expo/Metro/LAN/localhost server. The user checks deployed releases.
- Expo Go preview is now supported separately on SDK 57: set APP_VARIANT=expo-go
  when running EAS Update, use branch/channel expo-go-sdk57 and environment preview.
  The dynamic config derives exposdk:57.0.0 only for this variant. Native custom
  binaries continue using appVersion (currently 1.2.0); never cross-publish.
  Google native login and real purchases are unavailable in Expo Go; email login
  and games can be previewed there. Keep the native-module guards intact.
- Stop only for genuine missing account/signing/device input or blocked permissions;
  finish independent work and document the exact blocker.
