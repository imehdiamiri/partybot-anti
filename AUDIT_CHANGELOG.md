# PlayBot Audit Changelog

## Batch ID — 2026-08-18-14
- Objective: Align Expo SDK 54 patch dependencies to resolve `expo-doctor` version check (18/18 PASS), configure iOS Associated Domains and Android App Links intent filters for `partybot.games/invite`, support pre-filled invite code routing in `invite.tsx`, and document `/.well-known/` hosting requirements.
- Files changed: `expo/package.json`, `expo/package-lock.json`, `expo/app.json`, `expo/app/invite.tsx`
- Tests/checks: `npx expo-doctor` (18/18 PASS), `npx expo config --type public`, `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-18-13
- Objective: Audit Expo and EAS release configuration for Android and iOS, verify permissions/usage descriptions against codebase usage, validate native plugins and runtime OTA policy, and produce an iOS and Android release checklist.
- Files changed: None (configuration verified clean with zero repository-level release blockers).
- Tests/checks: `npx expo config --type public`, `npx expo-doctor`, `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-18-12
- Objective: Serialize native RevenueCat identity transitions (`Purchases.configure`, `Purchases.logIn`, `Purchases.logOut`) using a module-level promise queue, ensuring that an asynchronous logout cannot overtake or erase a subsequent login identity, and protecting all state writes behind the active generation token.
- Files changed: `expo/src/store/usePaywallStore.ts`
- Tests/checks: `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-11
- Objective: Close the in-flight configure logout race in `usePaywallStore.ts` by ensuring `Purchases.logOut()` is always called whenever `isSdkConfigured` is true (even when `currentConfiguredUid` is still null during the initial async configure window), and establish an explicit failure policy for `logOut()`.
- Files changed: `expo/src/store/usePaywallStore.ts`
- Tests/checks: `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-10
- Objective: Correct mobile RevenueCat identity transition via `Purchases.logIn`, add monotonic token guard against asynchronous configure/logout race conditions, and enable standalone iOS Apple Sign-In capability and plugin configuration in `app.json`.
- Files changed: `expo/src/store/usePaywallStore.ts`, `expo/app.json`
- Tests/checks: `npx expo config --type public`, `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-09
- Objective: Audit mobile authentication (Google, Apple, Email, Anonymous) and RevenueCat purchase/entitlement lifecycle across iOS and Android. Confirm server-as-source-of-truth, remove developer entitlement bypasses, and ensure clean session teardown on logout.
- Files changed: `expo/src/store/useEconomyStore.ts`, `expo/src/store/usePaywallStore.ts`, `expo/app/_layout.tsx`, `DEVLOG.md`
- Tests/checks: `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-08
- Objective: Audit and harden Next.js admin authentication, session lifecycle, CSRF security, and server-side data-access boundary.
- Files changed: `website/lib/actions.ts`, `website/app/api/admin/session/route.ts`
- Tests/checks: `npx tsc --noEmit` (website), `npm run typecheck` (expo), `npm test` (expo), `node --check index.js` (functions), `npm test` (functions with 20 tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-07
- Objective: Make AI quota reservation and rollback correct under failures and concurrent requests. Fix double-rollback bug in `generateCard` and protect against cross-request quota loss.
- Files changed: `functions/index.js`, `functions/index.test.js`
- Tests/checks: `npm run typecheck`, `npm test` (expo), `node --check index.js`, `npm test` (functions with 20 emulator-backed tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-06
- Objective: Audit and harden AI card-generation pipeline and stale multiplayer-room cleanup, resolve quota/moderation edge cases, protect active/initializing rooms, and expand backend test coverage.
- Files changed: `functions/index.js`, `functions/index.test.js`
- Tests/checks: `npm run typecheck`, `npm test` (expo), `node --check index.js`, `npm test` (functions with 16 emulator-backed tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-17-05
- Objective: Fix test runner fresh-emulator launch on Windows and verify both Mode (a) (fresh launch) and Mode (b) (live reuse).
- Files changed: `functions/package.json`, `functions/run-jest.js`, `functions/test-runner.js`
- Tests/checks: `npm run typecheck`, `npm test` (expo), `node --check index.js`, `npm test` (functions in both mode a and mode b)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-16-04
- Objective: Prevent unmigrated legacy invite-code collisions, make account-deletion cleanup ownership-safe, remove `--forceExit` by resolving open RTDB handles, and expand test suite to 10 tests.
- Files changed: `functions/index.js`, `functions/test-runner.js`, `functions/index.test.js`
- Tests/checks: `npm run typecheck`, `npm test` (expo), `node --check index.js`, `npm test` (functions with 10 emulator-backed tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-16-03
- Objective: Correct remaining invite-registry races, prevent orphaned reservations, make backend tests reliably executable with test-runner, and add comprehensive deterministic unit tests.
- Files changed: `functions/index.js`, `functions/package.json`, `functions/test-runner.js`, `functions/index.test.js`
- Tests/checks: `npm run typecheck`, `npm test` (expo), `node --check index.js`, `npm test` (functions with 8 emulator-backed tests)
- Result: PASS
- Remaining risks: None.
- Handoff file: `AUDIT_HANDOFF.md`, `CODEX_ANTIGRAVITY_BRIDGE.md`

## Batch ID — 2026-08-14-01
- Objective: Resolve PlayBot Review Batch 01 (TypeScript fixes, Jest config, dependency pinning, backend race conditions, quota logic, and account deletion completeness).
- Files changed: `expo/src/components/games/GuessTheSecondsSession.tsx`, `expo/package.json`, `functions/index.js`
- Tests/checks: `npm run typecheck`, `npm test`, `tsc --noEmit`, `node --check index.js`
- Result: PASS
- Remaining risks: Global uniqueness of invite codes (though statistically negligible); exact data retention policy for deleted users' moderation logs.
- Handoff file: `AUDIT_HANDOFF.md`
