# PartyBot CI/CD

## Workflows

- **PartyBot CI** runs on relevant pushes to `main`, pull requests, and manual
  dispatch. Documentation-only and historical benchmark changes do not trigger it.
  It checks tracked source for targeted credential patterns, runs TypeScript and
  app tests, audits production dependency trees at high/critical severity, exports
  the web app, and tests backend authorization on temporary Firebase emulators.
- No 100/1,000-user benchmark, load test, scheduled load job or AI/API agent is
  included. Historical benchmark files are retained only as an audit record.
- **Web deployment** consumes the exact web artifact produced by the successful
  app job, requires both app and backend jobs, runs only on current `main`, and
  publishes Firebase **Hosting only** to `partyplay-8`. It checks the live release
  receipt and entry bundle reference. Artifacts expire after seven days.
- **Mobile update** is manual, main-only, and requires successful CI for the exact
  commit. Choose `expo-go-sdk57` or `native-preview`; the default only inspects
  compatibility. Set `publish=true` to send the update. Expo Go is SDK 57; custom
  native binaries use appVersion. Native OTA requires a finished matching preview
  build for both platforms and unchanged native configuration/dependencies since
  those builds. Missing/rewritten build Git history fails closed; create a new
  compatible binary rather than bypassing the guard. Store submission and native
  signing are intentionally separate from OTA.

Open https://github.com/imehdiamiri/partybot-anti/actions for results and manual runs.
There is no model call inside these workflows. Reading and repairing failed runs
with an AI agent still uses tokens. GitHub/EAS/Firebase usage is separate billing.

## Configuration

Repository variables:

- `EXPO_PUBLIC_CONFIG`: JSON allowlist of the public Firebase web configuration and
  Google web client ID from the existing project. Private keys and RevenueCat keys
  are excluded. Public Firebase client configuration is not an authorization secret;
  backend rules still enforce access.
- `WEB_DEPLOY_ENABLED`: `true` enables the tested main deployment; `false` runs CI
  without cloud mutation. Enabled after the owner's explicit IAM approval.
- `FIREBASE_WIF_PROVIDER`, `FIREBASE_DEPLOY_SERVICE_ACCOUNT`: approved Google
  Workload Identity provider and Hosting deployment service account identifiers.

Environments `web-production` and `mobile-preview` are restricted to `main`.
`mobile-preview` needs an **EXPO_TOKEN** secret. Create a dedicated, revocable token
in Expo and save it directly in GitHub environment secrets, never source/chat.
The workflow uses EAS environment `preview`; native store configuration/signing
and production RevenueCat requirements remain unchanged.

Web uses short-lived GitHub OIDC credentials, not a downloaded private key. Proposed
trust is restricted to repository ID 1239119509, owner ID 43704086, main, and the
exact `.github/workflows/ci.yml` workflow. Hosting service account roles are
`roles/firebasehosting.admin` and `roles/serviceusage.serviceUsageConsumer` on
`partyplay-8`. The owner explicitly approved this IAM setup on 2026-09-30. It does not
authorize backend/rules deployment. Existing Hosting site is reused; this workflow
does not provision new Firebase projects or new Hosting sites.

Web export preserves the current preview variant behavior; it does not silently
switch ads/purchase configuration to production. Environment credentials are never
included in uploaded web artifacts. Actions are pinned to reviewed commit IDs.

## Routine development and recovery

1. Push reviewed code. Check the Actions result for its exact commit.
2. If it passed and source has not changed, reuse that evidence instead of running
   the same full checks again locally. Use targeted local tests while editing.
3. Inspect only the failed job/step when a run fails. Fix the cause and push; do
   not repeatedly ask an AI agent to reinstall dependencies or poll unchanged logs.
4. Web pushes to main deploy only when enabled and both checks succeed. PRs never
   receive deployment credentials. Older queued commits cannot replace newer main.
5. Native changes require a compatible EAS binary; this workflow will not force an
   OTA onto an incompatible installed app. Use the existing EAS profiles for builds.
6. Roll back via a reviewed revert and a new successful deployment. A Git revert
   alone does not undo Firebase or EAS cloud releases.

App/backend jobs use npm caches. PR test runs cancel when superseded; main releases
are serialized so a publish is not interrupted mid-deployment. No permanent server
is started. Dependency installation and emulator startup execute in disposable
GitHub runners. CI success is not a real-device UI/audio/purchase certification.
