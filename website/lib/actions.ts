"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireAdmin, SESSION_COOKIE } from "./auth";
import { adminAuth } from "./firebase-admin";
import {
  adjustStars,
  setSubscription,
  setBan,
  toggleUnlock,
  setConfig,
  deleteConfig,
  createAnnouncement,
  setAnnouncementActive,
  setReportStatus,
} from "./data";

export async function actionAdjustStars(userId: string, delta: number, reason: string) {
  if (!userId || typeof userId !== "string" || !Number.isFinite(delta)) {
    throw new Error("Invalid arguments for adjustStars");
  }
  const admin = await requireAdmin();
  await adjustStars(admin, userId.trim(), Math.round(delta), String(reason || "").slice(0, 200));
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetSubscription(userId: string, active: boolean) {
  if (!userId || typeof userId !== "string" || typeof active !== "boolean") {
    throw new Error("Invalid arguments for setSubscription");
  }
  const admin = await requireAdmin();
  await setSubscription(admin, userId.trim(), active);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetBan(userId: string, banned: boolean, reason = "") {
  if (!userId || typeof userId !== "string" || typeof banned !== "boolean") {
    throw new Error("Invalid arguments for setBan");
  }
  const admin = await requireAdmin();
  await setBan(admin, userId.trim(), banned, String(reason || "").slice(0, 500));
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionToggleUnlock(userId: string, gameKey: string, lock: boolean) {
  if (!userId || typeof userId !== "string" || !gameKey || typeof gameKey !== "string" || typeof lock !== "boolean") {
    throw new Error("Invalid arguments for toggleUnlock");
  }
  const admin = await requireAdmin();
  await toggleUnlock(admin, userId.trim(), gameKey.trim(), lock);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetConfig(
  table: "appConfig" | "uiConfig",
  key: string,
  value: unknown,
  description?: string
) {
  if (table !== "appConfig" && table !== "uiConfig") {
    throw new Error("Invalid config table");
  }
  if (!key || typeof key !== "string" || key.length > 128) {
    throw new Error("Invalid config key");
  }
  const admin = await requireAdmin();
  await setConfig(admin, table, key.trim(), value, description ? String(description).slice(0, 500) : undefined);
  revalidatePath(table === "appConfig" ? "/admin/content" : "/admin/ui");
}

export async function actionDeleteConfig(table: "appConfig" | "uiConfig", key: string) {
  if (table !== "appConfig" && table !== "uiConfig") {
    throw new Error("Invalid config table");
  }
  if (!key || typeof key !== "string") {
    throw new Error("Invalid config key");
  }
  const admin = await requireAdmin();
  await deleteConfig(admin, table, key.trim());
  revalidatePath(table === "appConfig" ? "/admin/content" : "/admin/ui");
}

export async function actionCreateAnnouncement(data: {
  title: string;
  body: string;
  audience: "all" | "free" | "subscribed";
  sendPush: boolean;
  active: boolean;
}) {
  if (!data?.title?.trim() || !data?.body?.trim()) {
    throw new Error("Title and body required");
  }
  const audience = (["all", "free", "subscribed"].includes(data.audience) ? data.audience : "all") as "all" | "free" | "subscribed";
  const admin = await requireAdmin();
  await createAnnouncement(admin, {
    title: data.title.trim().slice(0, 150),
    body: data.body.trim().slice(0, 1000),
    audience,
    sendPush: Boolean(data.sendPush),
    active: Boolean(data.active),
  });
  revalidatePath("/admin/announcements");
}

export async function actionToggleAnnouncement(id: string, active: boolean) {
  if (!id || typeof id !== "string" || typeof active !== "boolean") {
    throw new Error("Invalid arguments for toggleAnnouncement");
  }
  const admin = await requireAdmin();
  await setAnnouncementActive(admin, id.trim(), active);
  revalidatePath("/admin/announcements");
}

export async function actionSetReportStatus(
  reportId: string,
  status: "pending" | "reviewed"
) {
  if (!reportId || typeof reportId !== "string" || (status !== "pending" && status !== "reviewed")) {
    throw new Error("Invalid arguments for setReportStatus");
  }
  const admin = await requireAdmin();
  await setReportStatus(admin, reportId.trim(), status);
  revalidatePath("/admin/reports");
}

export async function actionSignOut() {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await adminAuth().verifySessionCookie(session, false).catch(() => null);
      if (decoded?.uid) {
        await adminAuth().revokeRefreshTokens(decoded.uid).catch(() => {});
      }
    } catch {}
  }
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  redirect("/admin/login");
}
