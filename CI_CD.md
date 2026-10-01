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
- Backend/rules-only pushes still run the ordinary app/backend regression gates,
  but skip Expo web export, artifact upload and Hosting deployment. A full Git
  before/after diff includes deleted/renamed paths. Mixed, unknown, CI/config
  changes and manual runs conservatively build web. No new backend IAM permissions
  or automatic backend deployments are introduced.
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
`mobile-preview` has an **EXPO_TOKEN** secret for the owner-approved
`partybot-github-ci` Expo robot, created on 2026-09-30. The robot has Developer
access to the account's projects, not Admin access. Revoke its dedicated token in
Expo if CI access must be removed; never put replacement tokens in source/chat.
The workflow uses EAS environment `preview`; native store configuration/signing
and production RevenueCat requirements remain unchanged.

Web uses short-lived GitHub OIDC credentials, not a downloaded private key. Its
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
4. Web-affecting pushes to main deploy only when enabled and checks succeed. PRs never
   receive deployment credentials. Older queued commits cannot replace newer main.
5. Native changes require a compatible EAS binary; this workflow will not force an
   OTA onto an incompatible installed app. Use the existing EAS profiles for builds.
6. Roll back via a reviewed revert and a new successful deployment. A Git revert
   alone does not undo Firebase or EAS cloud releases.

App/backend jobs use npm caches. PR test runs cancel when superseded; main releases
are serialized so a publish is not interrupted mid-deployment. No permanent server
is started. Dependency installation and emulator startup execute in disposable
GitHub runners. CI success is not a real-device UI/audio/purchase certification.

## Activation evidence (2026-09-30)

- Expo Go publication through GitHub succeeded:
  https://github.com/imehdiamiri/partybot-anti/actions/runs/36700078616.
  Update group `542ceade-24de-4439-bfe5-f2d1ab183409` contains Android and iOS
  updates with runtime `exposdk:57.0.0`; custom native runtimes were untouched.
- CI and real Hosting deployment passed at `d893d88`:
  https://github.com/imehdiamiri/partybot-anti/actions/runs/36699633501.
  323 app tests and 76 backend/authorization tests passed. High/critical production
  dependency gates passed; 17 moderate Expo dependency findings remain, so this is
  not a claim that the dependency tree has zero advisories.
- Native compatibility inspection run 36700109899 correctly refused to publish.
  Latest finished preview builds were Android 1.1.0
  (`d5f6f57b-a73a-4ec2-861e-04911080adb3`) and iOS 1.0.0
  (`c32e47c5-92dc-4a57-8430-7f2fca5fe8f3`), while current appVersion is 1.2.0.
  New compatible preview binaries are required before native OTA; this does not
  block the separate Expo Go SDK 57 track or web deployment.
- Documentation-only commits skip automatic CI. Before publishing mobile from
  such a new commit, manually run PartyBot CI on main; the exact-SHA guard will
  explain this requirement rather than silently reusing a different revision.

## Runtime boundaries and scale review (2026-10-01)

This is a managed Firebase/Expo stack, not a single long-running server. A single
Git repository does not mean one runtime. Preserve these independent boundaries:

| Component | Source/dependencies | Runtime and state | Release boundary |
| --- | --- | --- | --- |
| Web client | expo/package.json + lockfile; sync-web-build.js | Static HTML/JS/assets on Firebase Hosting CDN; code executes in the browser | Hosting only, using the tested CI artifact |
| Android/iOS client | expo/package.json + lockfile | Installed native binary and device storage; EAS Update only within compatible runtime | Separate EAS builds and update tracks |
| Callable API | functions/package.json + lockfile; Node 22 | Firebase v2 functions; persistent rewards/rate limits in RTDB, not instance memory | Explicit functions:NAME targets |
| Scheduled maintenance | sweepStaleRooms export; shared functions dependencies | Separate scheduled function, every 10 minutes; room state in RTDB | Explicit functions:sweepStaleRooms target |
| Identity | expo/src/lib/firebase.ts; Firebase Auth | Firebase identities; client token persistence; callable request.auth verification | Auth configuration, independent of Hosting |
| Realtime game/user data | Firebase RTDB | Managed database shared across function instances and clients | Data stays outside compute; database rules released explicitly |
| User profile documents | Firebase Firestore; expo/src/lib/firebase.ts | Managed database; separate authorization rules | Firestore rules released explicitly |
| Admin source | website/package.json + its lockfile | Separate Next.js source; not started as a server by current Hosting CI | Current pipeline exports Expo into website/public, not a Next.js server |

The callable API and scheduled maintenance share a source package, but deployed
function entry points run independently. Do not install Expo dependencies in the
backend or move databases into application containers. No Redis or dedicated
queue worker is present in the inspected runtime. Adding either requires a real
workload and an explicit persistence/retry/operational design.

### Deployment and recovery

- A backend-only fix uses `firebase deploy --only functions:FUNCTION_NAME
  --project partyplay-8 --non-interactive` after tests. Select actual changed
  functions; shared helpers may require multiple named targets. CI has Hosting
  permission only, so it intentionally does not perform this backend deployment.
- Static frontend updates do not redeploy callable functions or migrate data.
  Database rules are their own reviewed deployment; the root firebase.json does
  not imply permission to run an unscoped `firebase deploy`.
- Keep callable payloads and room schemas backward-compatible: old mobile
  binaries remain in use after a web/backend release. Use additive schema changes
  and staged migrations before removing old fields or endpoints.
- Roll back each affected release target separately. Git tags preserve source,
  not database data or cloud backups. Backup enablement/restore drills were not
  verified in this source review.

### Replica safety and remaining limits

Firebase v2 provides managed instance scaling and per-function concurrency,
minimum/maximum instance controls. Source currently does not explicitly set these
values globally. This review does not claim the deployed console configuration
or account quotas have been audited. Establish latency/error/cost budgets and
inspect actual traffic before choosing limits; an arbitrary replica count is not
proof of capacity. See https://firebase.google.com/docs/functions/manage-functions.

Auth and server-authoritative reward/rate-limit records are not attached to a
particular function instance. Invite payouts use durable receipts and database
transactions. An instance failure can still interrupt a request: clients must
handle errors and use idempotent retry semantics where provided. This is not a
claim that every endpoint is exactly-once or automatically retried.

Multiplayer snapshots/actions/presence live in RTDB. Game coordination is partly
host-client-authoritative (GameSyncService/MultiplayerService), so scaling API
instances does not by itself make every game independent of the host device.
Existing reconnection and host-migration code is relevant to device failure;
physical-device failover was not re-tested in this batch.

Known growth concern: sweepStaleRoomsLogic reads the entire rooms tree before
its chunked deletes. Chunking writes does not bound read size. Before large room
counts, introduce a durable indexed expiry field and bounded queries, with
transactional revalidation against resumed activity before deleting rooms. The
current read-then-delete design can race with a room becoming active again.
This review documents that separate backend correction; it does not silently
change room deletion behavior as part of a CI routing change.

Connection count, write frequency, listener scope, query/index behavior, database
quotas and external RevenueCat latency can become bottlenecks independently of
function replicas. Track these separately; 100 or 1,000 users cannot be certified
from source inspection. No load benchmark was run or added. Database limits:
https://firebase.google.com/docs/database/usage/limits.

### Containers decision

Keep managed Hosting, Functions and Firebase databases for the present deployment.
Hosting serves static assets through a CDN (https://firebase.google.com/docs/hosting);
there is no frontend server process to orchestrate. Docker Compose would be useful
for a future custom API/Redis/worker stack or an optional local integration harness,
but cannot replace Firebase Auth/RTDB/Firestore semantics just by adding containers.
No Compose stack or persistent local server is introduced. Kubernetes/Swarm is not
required for the current managed runtimes. Revisit it only if custom long-running
services, placement/network requirements or measurable platform limits justify the
migration and its operating cost.
