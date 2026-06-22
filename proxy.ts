import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next 16 renamed `middleware` -> `proxy`. Refreshes the Supabase session and
// gates routes by auth state. This is a UX gate only — the real security
// boundary is RLS in Postgres (docs/architecture.md §0).
//
// IMPORTANT: any redirect we return MUST carry over the auth cookies that
// updateSession refreshed onto `response`; otherwise the refreshed session is
// dropped and the app can ping-pong between "/" and "/login" (ERR_TOO_MANY_
// REDIRECTS). We also deliberately do NOT bounce a signed-in user off /login
// here — the login page navigates after sign-in, and bouncing based on "has an
// auth user" while pages gate on "has a profile" can loop.
function redirectTo(
  pathname: string,
  request: NextRequest,
  source: NextResponse,
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  source.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");

  // Not signed in and not on an auth route → go to /login.
  if (!user && !isAuthRoute) {
    return redirectTo("/login", request, response);
  }

  return response;
}

export const config = {
  // Run on everything except the Next internals, the offline shell, and any
  // static file (by extension). Excluding by extension means icon version bumps
  // (e.g. apple-touch-icon-v2.png) never get caught by the auth gate.
  matcher: [
    "/((?!_next/static|_next/image|offline|.*\\.(?:svg|png|ico|js|json|webmanifest|txt)$).*)",
  ],
};
