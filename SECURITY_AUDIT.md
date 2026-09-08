# Security review — September 8, 2026

Scope: app-owned client/server source, Firebase rules, account economy, social
authorization, administrative sessions, production function inventory and npm
dependencies. Tests use local emulators and synthetic users. This is not a full
penetration test, DDoS test, or guarantee against compromise.

## Confirmed and corrected

- **High: destructive account replacement and financial replay precondition.**
  RTDB parent writes allowed deleting wallet, purchase receipts and invite markers
  because validation is not applied to deletion. Profile synchronization also used
  root `set`, removing those server fields during ordinary sign-in. Rules now grant
  writes only to named profile children; client sync uses `update`. Whole-account
  deletion is available only through the authenticated backend deletion flow.
- **High: private profile exposure.** Authenticated strangers could read complete
  RTDB/Firestore profiles, including email and economic data. Reads are now owner
  only; RTDB name/avatar children remain public to authenticated social clients.
  Friends loading reads only those public children; full-user search fallback is
  removed. Firestore changes allow profile merges while preserving server fields.
- **High: social authorization.** Senders could accept their own requests, rewrite
  participants and insert unsolicited friendship edges. Requests now preserve
  identities, require recipient acceptance and check both block lists. Reciprocal
  edges require the accepted request and are written atomically with acceptance.
  Request-list reads require a bounded, caller-scoped query.
- **Medium: event integrity.** Telemetry could overwrite another user's event;
  crash logs could be edited after submission; room guests could replace queued
  actions. Creation/ownership checks now prevent these paths. Diagnostic fields
  and scalar tag values are validated; this does not impose aggregate rate limits.
- **Medium: unvalidated backend path components.** Report/block/unblock reject
  target IDs containing RTDB path separators or invalid characters. RevenueCat
  subscriber IDs are URL encoded, outbound requests time out, and failed responses
  no longer log their full bodies. Search input has a length limit.
- **Admin source hardening.** Session creation/deletion verifies same-origin
  requests, creation requires a recent sign-in, and authorization consults current
  admin claims rather than trusting a stale claim in an existing cookie. The
  admin Next server is not deployed by the static Firebase Hosting workflow.
- **Retired AI endpoint.** Live inventory found `generateCard` still deployed.
  Firebase confirmed its deletion in us-central1. No replacement was deployed.
- **Dependencies/runtime.** Compatible updates and narrowly scoped same-major
  overrides removed critical/high advisories in backend and admin dependencies.
  Backend runtime moved from deprecated Node 20 to supported Node 22.

## Verification

### Server validation follow-up

- Invite redemption accepts only the existing alphanumeric code format and
  validates the registry's UID before using it as a database path component.
- Host migration metrics require a valid six-digit room and the caller to be its
  current host/member. This validates current authority, not proof of a historical
  migration event; malicious hosts and repeated reports still need deduplication.
- RevenueCat schema errors leave saved entitlement state intact. Explicit active
  entitlement data determines access; an absent expiry no longer means permanent
  access, and a historical lifetime product key does not establish ownership.
  Valid future grace periods are respected. Star products use own-property lookup
  so JavaScript inherited names cannot become catalogue entries.
- Seven new regression cases failed before the fixes. Final backend/rules suite:
  **63 PASS** (61 RTDB/backend, 2 Firestore), including 11 unauthenticated callable
  checks and a five-request race that credits the daily reward exactly once.
- Reference: https://www.revenuecat.com/docs/api-v1/customer-info-model
- This follow-up does not certify receipt transfer/refund handling across multiple
  accounts. Invite redemption still has multiple server writes; a transient error
  between marking redemption and crediting both wallets needs a retry-safe ledger
  design before high-volume use. No fault-injection guarantee for that flow.

### Previous client and dependency checks

- Eight newly added security regressions failed against the previous implementation
  while the existing 26 backend tests passed. They pass after hardening.
- RTDB/backend: 37 tests PASS, including positive profile, friendship, diagnostics
  and multiplayer flows. Firestore emulator: 2 additional tests PASS.
- Mobile TypeScript and 36 Jest suites / 263 tests PASS after client changes.
- Admin TypeScript and Next production build PASS with patched Next/PostCSS.
- npm audit: backend production 11 moderate, complete backend tree 14 moderate;
  admin tree 8 moderate. Both have zero high/critical findings. The mobile audit
  from the preceding batch has 17 moderate findings and no high/critical findings.
- Targeted tracked-file scans found no committed private-key/token signatures or
  tracked local signing/service-account files. This is not a full Git-history
  secret scan; Firebase client API identifiers are intentionally public.
- Deployment/update confirmations and exact revisions are recorded in RELEASE_LOG.

Repeat the isolated rules/backend suite from the repository root:
`npx firebase emulators:exec --project demo-partybot-security --config firebase.security.json --only database,firestore "node functions/run-jest.js"`.
The configuration binds both emulators to loopback and uses separate test ports.

## Remaining limits and release gates

1. App Check attestation is not configured/enforced end to end. Enabling it only on
   the server now would reject legitimate clients. Configure supported native
   providers and rollout metrics with compatible signed binaries before enforcing.
2. Authenticated users (including anonymous accounts) can still create many rooms,
   profiles or diagnostic events. Existing callable limits are per UID, not a
   defense against many-account abuse. Add aggregate quotas/alerts and server-side
   admission before a large public launch. Room host authority and join-by-code
   are not protection against cheating by a malicious host or code guessing.
3. Purchase receipt validation comes from RevenueCat. Store sandbox purchases,
   refunds, transfer between accounts and entitlement revocation need real end-to-
   end testing after credentials/product setup. Local premium content can still be
   extracted from a modified client; client code is not a trusted security boundary.
4. Moderate dependency advisories remain. No forced major upgrade was used; further
   dependency migrations require separate compatibility tests. No audit-clean claim.
5. Rules intentionally reject old root-profile writes and old unverified friendship
   writes. Updated clients must use merge/scoped reads and request-linked edges.
   Native runtime remains 1.1.1; never send it to incompatible 1.1.0 binaries. Expo
   Go updates use only the separate exposdk:57.0.0 branch. Physical-device signing,
   StoreKit and App Store metadata gates from IOS_AUDIT.md remain unresolved.
6. Operational IAM, account MFA, budget alerts, historic data exposure and all
   cloud services were not comprehensively audited. No user data was downloaded
   to investigate possible past abuse. Remaining lint findings are still open.

Primary references:
- https://firebase.google.com/docs/database/security/rules-conditions
- https://firebase.google.com/docs/app-check/cloud-functions
- https://firebase.google.com/docs/functions/manage-functions
