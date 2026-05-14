# PartyBot Admin Panel

Next.js 15 admin dashboard for PartyBot, backed by **Firebase** (Auth + RTDB) via the Firebase Admin SDK.

## Features
- Dashboard with KPIs (DAU/WAU/MAU, subs, stars, AI)
- User list + search + detail page
- Grant / deduct stars, unlock / lock games, ban / unban, grant / revoke premium
- Invite tracking
- AI usage logs (`aiUsage/$uid/$day`)
- Analytics with 30-day signup chart
- Remote **App Config** (`appConfig/*`) and **UI Config** (`uiConfig/*`)
- Announcements (`announcements/*`)
- Full **audit log** (`adminAuditLog/*`) of every admin action
- Auth gated by Firebase custom claim `admin: true`

## 1. Bootstrap an admin

Grant the `admin` custom claim once from any environment with the service account:

```js
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(require("./service-account.json")) });
admin.auth().setCustomUserClaims("<UID>", { admin: true }).then(() => console.log("ok"));
```

## 2. Configure environment

Copy `.env.example` → `.env.local` and fill in:

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_DATABASE_URL=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
FIREBASE_DATABASE_URL=https://<project>-default-rtdb.firebaseio.com
ADMIN_SESSION_SECRET=<32+ char random string>
```

## 3. Run locally

```bash
cd website
bun install
bun run dev
# open http://localhost:3001/admin
```

## 4. Auth flow

The login page signs in with Firebase Web SDK (email/password), then `POST /api/admin/session` exchanges the ID token for a `__pb_admin_session` HttpOnly session cookie via Admin SDK. `requireAdmin()` verifies the cookie + the `admin` custom claim on every server render.

## 5. Data model (RTDB)

| Path | Purpose |
| --- | --- |
| `users/$uid` | Profile, wallet, isPremium, banned, unlocks, transactions |
| `aiUsage/$uid/$YYYY-MM-DD` | Daily AI call counter (written by Cloud Functions) |
| `appConfig/$key` | `{ value, description, updatedAt }` |
| `uiConfig/$key` | `{ value, description, updatedAt }` |
| `announcements/$id` | `{ title, body, audience, sendPush, active, createdAt }` |
| `adminAuditLog/$id` | `{ adminUid, adminEmail, action, targetType, targetId, payload, createdAt }` |
