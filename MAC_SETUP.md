# Continue PartyBot on another computer

## Get the current source

```sh
git clone https://github.com/imehdiamiri/partybot-anti.git PartyBot
cd PartyBot
git status
git log -3 --oneline
```

Open this repository root in Codex, not only its `expo` subfolder. Read
AGENTS.md, RELEASE_LOG.md, RELEASE_READINESS.md and CONTENT_RIGHTS_REVIEW.md.
Git transfers source, assets, lockfiles and checked-in release history. It does
not transfer account sessions, Xcode installations or ignored credentials.

## Install dependencies and recover configuration

Install Node.js compatible with the checked-in Expo SDK 57/RN 0.86 dependency
requirements, Git and Xcode with the iOS Simulator on macOS. Accept Xcode's
license and install its requested components in Xcode as the account owner.
Do not copy Windows node_modules onto macOS.

```sh
cd expo
npm ci
npx eas-cli login
npx eas-cli whoami
npx eas-cli env:pull --environment preview --path .env.local
npm run typecheck
npm test -- --runInBand
```

Use the existing Expo project, owner `imehdiamiri`, ID
`b7949f49-aef7-4963-9d95-5eb35280136e`. Do not initialize a replacement project.
If env:pull is unavailable in a CLI version, inspect `eas env:pull --help` and
use the existing project's preview environment. `.env.example` lists variable
names with empty values; it is not working production configuration.

Separately restore `expo/GoogleService-Info.plist` and
`expo/google-services.json` from the existing Firebase project `partyplay-8`
or the owner's secure local copy. They are deliberately ignored by Git.
Private signing keys, service accounts and tokens must never be added to Git.
Use the existing EAS signing credentials or the correct Apple team, not copied
browser sessions. Sign into Firebase only when needed; deploy commands must
explicitly target `--project partyplay-8` because `.firebaserc` is local.

## iOS continuation

Native version/runtime is 1.2.0. Google Mobile Ads needs a new compatible binary;
Expo Go cannot test that SDK. Expo Go remains `expo-go-sdk57`, SDK57 runtime,
with APP_VARIANT=expo-go. Do not mix these release tracks.

Inspect current EAS build/channel state before creating a build. Existing
profiles in expo/eas.json include ios-simulator, preview and testflight. For
the physical iPhone/TestFlight route, verify `com.partybot`, the actual Apple
team membership, App Store Connect record and signing first. The last audit
found these incomplete. Production RevenueCat credentials/providers also
remain a release gate; do not bypass the production config guard.

Use one-off builds/releases, following AGENTS.md. No persistent Metro server is
authorized by this workflow. Whitney audio is excluded from iOS. Spicy records
were removed from source; the ordinary catalog remains 2,888 cards.

## Switching machines safely

Before starting work, check `git status`, fetch, and use `git pull --ff-only`
when the checkout is clean. If it cannot fast-forward, preserve local work and
inspect the divergence; never reset hard or force-push.

After a finished batch: run relevant checks, update RELEASE_LOG.md, review
`git diff --cached`, commit and `git push origin main` (or the agreed working
branch). Push only reviewed recovery/release tags. On the other machine pull
again before editing. Git synchronization does not deploy Firebase or EAS;
their verified publication receipts belong in RELEASE_LOG.md.

Do not upload ignored caches, node_modules, credentials or local security logs.
No background synchronization job is installed: sync is part of each completed
development batch.
