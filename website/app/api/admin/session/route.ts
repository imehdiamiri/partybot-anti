import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, isAdminUid } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) return NextResponse.json({ error: "missing_id_token" }, { status: 400 });

  const decoded = await adminAuth().verifyIdToken(idToken).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

  const ok = decoded.admin === true || (await isAdminUid(decoded.uid).catch(() => false));
  if (!ok) return NextResponse.json({ error: "not_admin" }, { status: 403 });

  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
