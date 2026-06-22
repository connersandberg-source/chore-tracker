import "server-only";

import { createClient } from "@supabase/supabase-js";

// SERVICE-ROLE client. Bypasses RLS — god-mode over a database of minors' data.
// The `server-only` import makes the build FAIL if this is ever imported into a
// Client Component. Used solely by the admin "create kid account" route, which
// must re-derive family_id from the CALLER's profile, never from request input.
export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for admin operations.",
    );
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
