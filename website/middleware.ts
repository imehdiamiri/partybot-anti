import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight cookie presence check. Real verification happens server-side in
 * `requireAdmin()` (Firebase Admin SDK can't run in the Edge runtime).
 */
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("__pb_admin_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login|api).*)"],
};
