"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireAdmin, SESSION_COOKIE } from "./auth";
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
  const admin = await requireAdmin();
  await adjustStars(admin, userId, delta, reason);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetSubscription(userId: string, active: boolean) {
  const admin = await requireAdmin();
  await setSubscription(admin, userId, active);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetBan(userId: string, banned: boolean, reason = "") {
  const admin = await requireAdmin();
  await setBan(admin, userId, banned, reason);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionToggleUnlock(userId: string, gameKey: string, lock: boolean) {
  const admin = await requireAdmin();
  await toggleUnlock(admin, userId, gameKey, lock);
  revalidatePath(`/admin/users/${userId}`);
}

export async function actionSetConfig(
  table: "appConfig" | "uiConfig",
  key: string,
  value: unknown,
  description?: string
) {
  const admin = await requireAdmin();
  await setConfig(admin, table, key, value, description);
  revalidatePath(table === "appConfig" ? "/admin/content" : "/admin/ui");
}

export async function actionDeleteConfig(table: "appConfig" | "uiConfig", key: string) {
  const admin = await requireAdmin();
  await deleteConfig(admin, table, key);
  revalidatePath(table === "appConfig" ? "/admin/content" : "/admin/ui");
}

export async function actionCreateAnnouncement(data: {
  title: string;
  body: string;
  audience: "all" | "free" | "subscribed";
  sendPush: boolean;
  active: boolean;
}) {
  const admin = await requireAdmin();
  await createAnnouncement(admin, data);
  revalidatePath("/admin/announcements");
}

export async function actionToggleAnnouncement(id: string, active: boolean) {
  const admin = await requireAdmin();
  await setAnnouncementActive(admin, id, active);
  revalidatePath("/admin/announcements");
}

export async function actionSetReportStatus(
  reportId: string,
  status: "pending" | "reviewed"
) {
  const admin = await requireAdmin();
  await setReportStatus(admin, reportId, status);
  revalidatePath("/admin/reports");
}

export async function actionSignOut() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  redirect("/admin/login");
}
