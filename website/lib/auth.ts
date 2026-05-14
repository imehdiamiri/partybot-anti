import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth, isAdminUid } from "./firebase-admin";

export const SESSION_COOKIE = "__pb_admin_session";
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5; // 5 days

export type AdminUser = {
  uid: string;
  email: string;
};

/**
 * Verifies the session cookie set by /api/admin/session and ensures the
 * underlying user has the `admin` custom claim. Redirects to /admin/login
 * on any failure.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) redirect("/admin/login");

  try {
    const decoded = await adminAuth().verifySessionCookie(session, true);
    const ok = decoded.admin === true || (await isAdminUid(decoded.uid));
    if (!ok) redirect("/admin/login?error=not_admin");
    return { uid: decoded.uid, email: decoded.email ?? "" };
  } catch {
    redirect("/admin/login");
  }
}
