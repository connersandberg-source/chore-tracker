import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed `middleware` -> `proxy`. This refreshes the Supabase session
// and gates routes by auth state. Note: this is a UX gate only — the real
// security boundary is RLS in Postgres (see docs/architecture.md §0).
const AUTH_ROUTES = ["/login"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Not signed in and not on an auth route → go to /login.
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed in but on an auth route → send to the app root (role router).
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets, image optimizer, PWA files, and
  // the offline shell (must load without a session).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline|icon.svg|icon-maskable.svg|apple-touch-icon-v1.png).*)",
  ],
};
