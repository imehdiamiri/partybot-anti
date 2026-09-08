import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, isAdminUid } from "@/lib/firebase-admin";
import { SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "missing_id_token" }, { status: 400 });
  }

  const decoded = await adminAuth().verifyIdToken(idToken, true).catch(() => null);
  if (!decoded) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  const authAge = Date.now() / 1000 - decoded.auth_time;
  if (!Number.isFinite(authAge) || authAge < 0 || authAge > 300) {
    return NextResponse.json({ error: 'recent_sign_in_required' }, { status: 401 });
  }

  const ok = await isAdminUid(decoded.uid).catch(() => false);
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

export async function DELETE(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 403 });
  }
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    try {
      const decoded = await adminAuth().verifySessionCookie(session, false).catch(() => null);
      if (decoded?.uid) {
        await adminAuth().revokeRefreshTokens(decoded.uid).catch(() => {});
      }
    } catch {}
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
