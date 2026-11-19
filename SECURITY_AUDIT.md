# Security review — November 19, 2026

## Findings and disposition

- **High, session privacy.** The legacy RTDB sessions path accepted self-enrollment in existing sessions despite restricting reads to members. Hosts now admit members. Existing members can rename themselves and leave. The active six-digit lobby uses the separate rooms path. Regression checks cover admission, normal member operations and revoked read access.
- **Profile and presence integrity.** Firestore profile writes now validate the types and lengths of changed fields on creation and merge. Nullable email/avatar and timestamp transforms remain supported. Legacy values unrelated to a merge do not prevent that merge. Public and room presence require the online and lastSeen fields and reject extra fields. The room host badge must agree with the authoritative host ID when set to true. Heartbeats, disconnects and host migration were checked.
- **Admin dependencies.** The previous production npm lock reported one critical and seven high entries, including Next.js 15.5.25. The repaired Next.js 15.5.29 lock and updated transitive dependencies report zero critical/high entries. The admin dashboard now uses one npm lock and CI audits it. Firebase Hosting serves static Expo assets. This dashboard has a separate Next.js runtime.
- **Admin actions.** Server-side mutation handlers now validate identifiers as single nonempty RTDB keys before constructing paths, including config deletion. Reviewed admin pages/actions require server-verified sessions and current claims. Verified that the session endpoint checks origin, recent auth and revocation.
- **Browser boundaries.** Added a same-origin framing policy, MIME sniffing protection and an explicit referrer policy on Hosting. The reserved Firebase helper namespace is excluded for sign-in compatibility.
- **Storage and credentials.** The Firebase Rules API listed only the Firestore release. Three Cloud Functions infrastructure buckets were listed, all with uniform access and zero public principals in bucket IAM. Project-wide inherited IAM and historic key rotation were outside this check. The tracked-source credential guard checks selected filenames and patterns.

## Remaining exposure

- Production npm audit counts with the final locks: Expo nine moderate, Functions eight moderate, admin eight moderate. Including development tools, the counts are 32, ten and nine moderate respectively. All three trees report zero high or critical entries in both modes. The Expo production chain concerns minimatch used by build tooling. Firebase Admin's uuid chain needs a compatibility review before a major SDK update. Counts include dependent packages.
- Updated the Puppeteer and Firebase emulator test dependencies. CI includes development packages in its three high-severity audit gates. Function packaging now excludes local audit output, logs and test tools.
- The admin ban action records an RTDB marker and revokes existing refresh tokens. It does not disable future Firebase sign-ins. Account deletion authenticates the caller but does not enforce recent reauthentication in the callable. Existing account moderation and sensitive-operation policies merit further work.
- The Firestore history path permits owner-only append with no application-specific field/size limits. Nested multiplayer snapshots, diagnostics and new events can still generate storage and reads. Callable limits generally operate per UID. No aggregate budget or device-attestation enforcement was verified.
- Public Android App Links verification currently returns an empty statement list at `https://8playo.com/.well-known/assetlinks.json`. Invite URLs can open on the web, but Android cannot verify the association with the Play-distributed app from that response. The Play app-signing SHA-256 certificate fingerprint is required to complete the association. The iOS association file serves an invite-path declaration for `9R9TPVS9UL.com.partybot`; installation on a signed device was not verified.
- This review covered source, dependency locks, emulator tests, published web assets, browser smoke checks and live configuration. Physical devices, real purchase/refund flows, historical incident investigation and load tests were outside the observed coverage. See RELEASE_LOG.md for release receipts.

## September 8, 2026 review

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

### Invite payout recovery follow-up

- New redemptions atomically reserve an opaque receipt with the invitee's wallet
  credit. The inviter's wallet, statistics and deduplication receipt commit in
  one transaction on that user's node. A final status records completion. No
  transaction reads or locks the entire users tree.
- Retrying the same code resumes the saved recipient binding, even after the
  public registry changes. Completed retries return zero new credits. Receipts
  cannot be changed by clients under the deployed profile-field allowlist.
- Receipt IDs are random UUIDs. The inviter's receipt stores amount/time, not the
  invitee UID; the invitee's reservation is removed with its user profile.
- Four new baseline cases failed before the fix. Final suite: **75 PASS**,
  covering failures before payment and after lost commit acknowledgements,
  concurrent retries, multiple invitees, deleted inviter, changed codes, tampered
  receipts, and corrupt wallet data. Invalid transaction data aborts and rejects
  cleanly rather than throwing from an asynchronous SDK retry callback.
- Recovery requires another call with the same code and remains subject to the
  per-user rate limit. No unattended reconciliation worker was introduced.
  Legacy redemptions without receipts are not automatically replayed because
  their historical payment status cannot be inferred safely. A deleted inviter
  is not recreated; interrupted payouts in that case require support review.

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
- This follow-up does not certify purchase receipt transfer/refund handling across
  multiple accounts. Invite recovery is now covered by the later receipt protocol
  and fault-injection tests above; legacy and deleted-account limits still apply.

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
