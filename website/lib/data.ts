import "server-only";
import { rtdb, adminAuth } from "./firebase-admin";

const dayMs = 24 * 60 * 60 * 1000;

export type UserRow = {
  id: string;
  username: string;
  email?: string;
  avatarURL?: string;
  starsBalance: number;
  isPremium: boolean;
  isLifetime: boolean;
  isBanned: boolean;
  createdAt: number;
  lastSeenAt?: number;
  inviteCode?: string;
};

function flattenUser(id: string, raw: any): UserRow {
  const v = raw || {};
  return {
    id,
    username: String(v.username ?? v.displayName ?? ""),
    email: v.email,
    avatarURL: v.avatarURL,
    starsBalance: Number(v.wallet?.balance ?? 0),
    isPremium: !!v.isPremium,
    isLifetime: !!v.isLifetime,
    isBanned: !!v.banned,
    createdAt: Number(v.createdAt ?? 0),
    lastSeenAt: Number(v.lastSeenAt ?? 0) || undefined,
    inviteCode: v.inviteCode,
  };
}

export async function listUsers(query = "", limit = 100): Promise<UserRow[]> {
  const snap = await rtdb().ref("users").limitToFirst(1000).once("value");
  const all: UserRow[] = [];
  snap.forEach((c) => {
    all.push(flattenUser(c.key as string, c.val()));
    return false;
  });
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.email ?? "").toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      )
    : all;
  return filtered
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export type AnalyticsSummary = {
  totalUsers: number;
  newUsers24h: number;
  newUsers7d: number;
  newUsers30d: number;
  dau: number;
  wau: number;
  mau: number;
  activeSubscriptions: number;
  totalStarsCirculating: number;
  aiCalls24h: number;
  invitesCompleted: number;
  bannedUsers: number;
};

export async function analyticsSummary(): Promise<AnalyticsSummary> {
  const now = Date.now();
  const usersSnap = await rtdb().ref("users").once("value");
  let totalUsers = 0;
  let newUsers24h = 0;
  let newUsers7d = 0;
  let newUsers30d = 0;
  let dau = 0;
  let wau = 0;
  let mau = 0;
  let activeSubscriptions = 0;
  let totalStarsCirculating = 0;
  let invitesCompleted = 0;
  let bannedUsers = 0;

  usersSnap.forEach((c) => {
    const u = flattenUser(c.key as string, c.val());
    totalUsers++;
    if (now - u.createdAt < dayMs) newUsers24h++;
    if (now - u.createdAt < 7 * dayMs) newUsers7d++;
    if (now - u.createdAt < 30 * dayMs) newUsers30d++;
    if (u.lastSeenAt) {
      if (now - u.lastSeenAt < dayMs) dau++;
      if (now - u.lastSeenAt < 7 * dayMs) wau++;
      if (now - u.lastSeenAt < 30 * dayMs) mau++;
    }
    if (u.isPremium) activeSubscriptions++;
    if (u.isBanned) bannedUsers++;
    totalStarsCirculating += u.starsBalance;
    const raw = c.val() || {};
    if (raw.invitedBy) invitesCompleted++;
    return false;
  });

  // AI calls in the last 24h: aiUsage/$uid/$YYYY-MM-DD
  const today = new Date().toISOString().split("T")[0];
  const aiSnap = await rtdb().ref("aiUsage").once("value");
  let aiCalls24h = 0;
  aiSnap.forEach((c) => {
    aiCalls24h += Number(c.child(today).val() ?? 0);
    return false;
  });

  return {
    totalUsers,
    newUsers24h,
    newUsers7d,
    newUsers30d,
    dau,
    wau,
    mau,
    activeSubscriptions,
    totalStarsCirculating,
    aiCalls24h,
    invitesCompleted,
    bannedUsers,
  };
}

export async function signupTimeseries(days = 30): Promise<{ day: string; count: number }[]> {
  const now = Date.now();
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * dayMs).toISOString().split("T")[0];
    buckets.set(d, 0);
  }
  const snap = await rtdb().ref("users").once("value");
  snap.forEach((c) => {
    const created = Number(c.child("createdAt").val() ?? 0);
    if (!created) return false;
    const d = new Date(created).toISOString().split("T")[0];
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + 1);
    return false;
  });
  return [...buckets.entries()].map(([day, count]) => ({ day, count }));
}

export type UserDetail = {
  profile: UserRow;
  unlocks: string[];
  recentTransactions: { id: string; amount: number; type: string; reason: string; createdAt: number }[];
  recentAi: { day: string; count: number }[];
  inviteStats: { inviteCode?: string; invitedCount: number };
  ban: { reason?: string; at?: number } | null;
};

export async function userDetail(uid: string): Promise<UserDetail | null> {
  const snap = await rtdb().ref(`users/${uid}`).once("value");
  if (!snap.exists()) return null;
  const v = snap.val() || {};
  const profile = flattenUser(uid, v);

  const unlocks = Object.keys(v.unlocks ?? {});
  const recentTransactions = Object.entries(v.transactions ?? {})
    .map(([id, t]: any) => ({
      id,
      amount: Number(t.amount ?? 0),
      type: String(t.type ?? "unknown"),
      reason: String(t.reason ?? ""),
      createdAt: Number(t.createdAt ?? 0),
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 25);

  const aiSnap = await rtdb().ref(`aiUsage/${uid}`).once("value");
  const recentAi: { day: string; count: number }[] = [];
  aiSnap.forEach((c) => {
    recentAi.push({ day: c.key as string, count: Number(c.val() ?? 0) });
    return false;
  });
  recentAi.sort((a, b) => (a.day < b.day ? 1 : -1));

  // Count inviteCount via a cheap scan of users.invitedBy === uid.
  const allUsers = await rtdb().ref("users").once("value");
  let invitedCount = 0;
  allUsers.forEach((c) => {
    if (c.child("invitedBy").val() === uid) invitedCount++;
    return false;
  });

  return {
    profile,
    unlocks,
    recentTransactions,
    recentAi: recentAi.slice(0, 25),
    inviteStats: { inviteCode: v.inviteCode, invitedCount },
    ban: v.banned ? { reason: v.banned?.reason, at: v.banned?.at } : null,
  };
}

// ─────────────────────── Mutations ───────────────────────

async function logAudit(
  adminUid: string,
  adminEmail: string,
  action: string,
  targetType: string,
  targetId: string,
  payload: unknown
) {
  const ref = rtdb().ref("adminAuditLog").push();
  await ref.set({
    adminUid,
    adminEmail,
    action,
    targetType,
    targetId,
    payload: payload ?? null,
    createdAt: Date.now(),
  });
}

export async function adjustStars(
  admin: { uid: string; email: string },
  userId: string,
  delta: number,
  reason: string
) {
  const walletRef = rtdb().ref(`users/${userId}/wallet`);
  await walletRef.transaction((current) => {
    const w = current || { balance: 0, updatedAt: 0 };
    w.balance = Math.max(0, Number(w.balance ?? 0) + delta);
    w.updatedAt = Date.now();
    return w;
  });
  const txRef = rtdb().ref(`users/${userId}/transactions`).push();
  await txRef.set({
    amount: delta,
    type: delta >= 0 ? "admin_grant" : "admin_deduct",
    reason,
    createdAt: Date.now(),
    by: admin.uid,
  });
  await logAudit(admin.uid, admin.email, "adjust_stars", "user", userId, { delta, reason });
}

export async function setSubscription(
  admin: { uid: string; email: string },
  userId: string,
  active: boolean
) {
  await rtdb().ref(`users/${userId}`).update({
    isPremium: active,
    entitlementUpdatedAt: Date.now(),
  });
  await logAudit(admin.uid, admin.email, "set_subscription", "user", userId, { active });
}

export async function setBan(
  admin: { uid: string; email: string },
  userId: string,
  banned: boolean,
  reason = ""
) {
  await rtdb()
    .ref(`users/${userId}/banned`)
    .set(banned ? { reason, at: Date.now(), by: admin.uid } : null);
  // Force the user out of any existing sessions.
  if (banned) {
    await adminAuth().revokeRefreshTokens(userId).catch(() => {});
  }
  await logAudit(admin.uid, admin.email, banned ? "ban" : "unban", "user", userId, { reason });
}

export async function toggleUnlock(
  admin: { uid: string; email: string },
  userId: string,
  gameKey: string,
  lock: boolean
) {
  await rtdb()
    .ref(`users/${userId}/unlocks/${gameKey}`)
    .set(lock ? null : { at: Date.now(), by: admin.uid });
  await logAudit(admin.uid, admin.email, lock ? "lock_game" : "unlock_game", "user", userId, {
    gameKey,
  });
}

// ─────────────────────── Config / Announcements / Audit ───────────────────────

export type ConfigRow = { key: string; value: unknown; description?: string; updatedAt?: number };

export async function listConfig(table: "appConfig" | "uiConfig"): Promise<ConfigRow[]> {
  const snap = await rtdb().ref(table).once("value");
  const out: ConfigRow[] = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    out.push({
      key: c.key as string,
      value: v.value ?? null,
      description: v.description ?? "",
      updatedAt: Number(v.updatedAt ?? 0) || undefined,
    });
    return false;
  });
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export async function setConfig(
  admin: { uid: string; email: string },
  table: "appConfig" | "uiConfig",
  key: string,
  value: unknown,
  description?: string
) {
  await rtdb().ref(`${table}/${key}`).set({
    value,
    description: description ?? null,
    updatedAt: Date.now(),
    updatedBy: admin.uid,
  });
  await logAudit(admin.uid, admin.email, `set_${table}`, "config", key, { value, description });
}

export async function deleteConfig(
  admin: { uid: string; email: string },
  table: "appConfig" | "uiConfig",
  key: string
) {
  await rtdb().ref(`${table}/${key}`).remove();
  await logAudit(admin.uid, admin.email, `delete_${table}`, "config", key, null);
}

export type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "free" | "subscribed";
  sendPush: boolean;
  active: boolean;
  createdAt: number;
};

export async function listAnnouncements(): Promise<Announcement[]> {
  const snap = await rtdb().ref("announcements").once("value");
  const out: Announcement[] = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    out.push({
      id: c.key as string,
      title: String(v.title ?? ""),
      body: String(v.body ?? ""),
      audience: v.audience ?? "all",
      sendPush: !!v.sendPush,
      active: !!v.active,
      createdAt: Number(v.createdAt ?? 0),
    });
    return false;
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function createAnnouncement(
  admin: { uid: string; email: string },
  data: Omit<Announcement, "id" | "createdAt">
) {
  const ref = rtdb().ref("announcements").push();
  await ref.set({ ...data, createdAt: Date.now(), createdBy: admin.uid });
  await logAudit(admin.uid, admin.email, "announcement_create", "announcement", ref.key as string, data);
}

export async function setAnnouncementActive(
  admin: { uid: string; email: string },
  id: string,
  active: boolean
) {
  await rtdb().ref(`announcements/${id}/active`).set(active);
  await logAudit(admin.uid, admin.email, "announcement_toggle", "announcement", id, { active });
}

export type AuditRow = {
  id: string;
  adminEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  payload: unknown;
  createdAt: number;
};

export async function listAuditLog(limit = 300): Promise<AuditRow[]> {
  const snap = await rtdb().ref("adminAuditLog").limitToLast(limit).once("value");
  const out: AuditRow[] = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    out.push({
      id: c.key as string,
      adminEmail: String(v.adminEmail ?? v.adminUid ?? ""),
      action: String(v.action ?? ""),
      targetType: String(v.targetType ?? ""),
      targetId: String(v.targetId ?? ""),
      payload: v.payload ?? null,
      createdAt: Number(v.createdAt ?? 0),
    });
    return false;
  });
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export type AiLogRow = {
  uid: string;
  username?: string;
  day: string;
  count: number;
};

export async function listAiLogs(limit = 200): Promise<AiLogRow[]> {
  const snap = await rtdb().ref("aiUsage").once("value");
  const usersSnap = await rtdb().ref("users").once("value");
  const usernames = new Map<string, string>();
  usersSnap.forEach((c) => {
    usernames.set(c.key as string, String(c.child("username").val() ?? ""));
    return false;
  });
  const out: AiLogRow[] = [];
  snap.forEach((u) => {
    const uid = u.key as string;
    u.forEach((d) => {
      out.push({
        uid,
        username: usernames.get(uid),
        day: d.key as string,
        count: Number(d.val() ?? 0),
      });
      return false;
    });
    return false;
  });
  return out.sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, limit);
}

// ─────────────────────── Reports / moderation queue ───────────────────────

export type ReportRow = {
  id: string;
  reporterUid: string;
  targetUid: string;
  reason: string;
  context: string;
  at: number;
  status: "pending" | "reviewed";
};

export async function listReports(opts: {
  reason?: string;
  status?: string;
  limit?: number;
} = {}): Promise<ReportRow[]> {
  const limit = opts.limit ?? 200;
  const snap = await rtdb().ref("reports").limitToLast(limit).once("value");
  const out: ReportRow[] = [];
  snap.forEach((c) => {
    const v = c.val() || {};
    const status = (v.status === "reviewed" ? "reviewed" : "pending") as ReportRow["status"];
    if (opts.reason && opts.reason !== "all" && v.reason !== opts.reason) return false;
    if (opts.status && opts.status !== "all" && status !== opts.status) return false;
    out.push({
      id: c.key as string,
      reporterUid: String(v.reporterUid ?? ""),
      targetUid: String(v.targetUid ?? ""),
      reason: String(v.reason ?? "other"),
      context: String(v.context ?? ""),
      at: Number(v.at ?? 0),
      status,
    });
    return false;
  });
  return out.sort((a, b) => b.at - a.at);
}

export async function setReportStatus(
  _admin: { uid: string; email?: string | null },
  reportId: string,
  status: "pending" | "reviewed"
): Promise<void> {
  if (!reportId) throw new Error("reportId required");
  await rtdb().ref(`reports/${reportId}/status`).set(status);
  await rtdb().ref("adminAuditLog").push({
    actor: _admin.uid,
    action: "setReportStatus",
    reportId,
    status,
    at: Date.now(),
  });
}

export async function listInvites(limit = 200) {
  const snap = await rtdb().ref("users").once("value");
  const usernames = new Map<string, string>();
  const out: { id: string; username: string; invitedBy: string; createdAt: number }[] = [];
  snap.forEach((c) => {
    usernames.set(c.key as string, String(c.child("username").val() ?? ""));
    return false;
  });
  snap.forEach((c) => {
    const v = c.val() || {};
    if (v.invitedBy) {
      out.push({
        id: c.key as string,
        username: String(v.username ?? ""),
        invitedBy: v.invitedBy,
        createdAt: Number(v.createdAt ?? 0),
      });
    }
    return false;
  });
  return out
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((row) => ({ ...row, inviterName: usernames.get(row.invitedBy) ?? row.invitedBy.slice(0, 8) }));
}
