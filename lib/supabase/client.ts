import { createBrowserClient } from "@supabase/ssr";

// Browser (anon/publishable) Supabase client for Client Components.
// RLS is the security boundary, so this key is safe in the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
