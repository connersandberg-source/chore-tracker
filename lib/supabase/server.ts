import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server (RSC / Route Handler / Server Action) Supabase client, anon key, bound
// to the request's cookies so the user's session is read and refreshed.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // In a Server Component, setting cookies throws — that's fine, the
          // proxy already refreshed the session. Swallow it.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component; ignore.
          }
        },
      },
    },
  );
}
