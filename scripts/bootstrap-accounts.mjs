// One-time bootstrap: create the family's auth accounts + profiles.
// Solves the chicken/egg of the first admin (no admin exists yet to use the
// in-app create-kid route). After this, Mom can manage everything in-app.
//
// Run:  node --env-file=.env.local scripts/bootstrap-accounts.mjs
//
// Idempotent: re-running skips accounts that already exist. Emails here are
// PLACEHOLDERS for testing the auth + role flow — swap to the kids' real emails
// (and let Mom set real passwords) before go-live, or recreate via the in-app
// admin route once it exists.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FAMILY_ID = "11111111-1111-1111-1111-111111111111"; // matches supabase/seed.sql

if (!URL || !SERVICE_KEY) {
  console.error(
    "Missing env. Run with: node --env-file=.env.local scripts/bootstrap-accounts.mjs",
  );
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// display_name MUST match supabase/seed.sql so the chores block finds each kid.
const ACCOUNTS = [
  { display_name: "Mom",    email: "mom@chore.test",    role: "admin", password: "Chores!2026" },
  { display_name: "Zane",   email: "zane@chore.test",   role: "child", password: "Chores!2026" },
  { display_name: "Alaina", email: "alaina@chore.test", role: "child", password: "Chores!2026" },
  { display_name: "Conner", email: "conner@chore.test", role: "child", password: "Chores!2026" },
];

async function findUserByEmail(email) {
  // Paginate through users (small family, one page is plenty).
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

async function ensureFamily() {
  const { data } = await admin.from("families").select("id").eq("id", FAMILY_ID).maybeSingle();
  if (!data) {
    const { error } = await admin.from("families").insert({
      id: FAMILY_ID,
      name: "Sandberg household",
      timezone: "America/New_York",
      auto_approve: false,
    });
    if (error) throw error;
    console.log("Created family (seed had not run yet).");
  }
}

async function run() {
  await ensureFamily();

  for (const acct of ACCOUNTS) {
    let user = await findUserByEmail(acct.email);

    if (!user) {
      const { data, error } = await admin.auth.admin.createUser({
        email: acct.email,
        password: acct.password,
        email_confirm: true, // skip the verification email for these accounts
      });
      if (error) {
        console.error(`  ✗ ${acct.display_name}: ${error.message}`);
        continue;
      }
      user = data.user;
      console.log(`  ✓ created auth user ${acct.email}`);
    } else {
      console.log(`  • auth user ${acct.email} already exists`);
    }

    // Upsert the profile row (id == auth user id).
    const { error: pErr } = await admin.from("profiles").upsert(
      {
        id: user.id,
        family_id: FAMILY_ID,
        role: acct.role,
        display_name: acct.display_name,
        email: acct.email,
      },
      { onConflict: "id" },
    );
    if (pErr) console.error(`  ✗ profile ${acct.display_name}: ${pErr.message}`);
    else console.log(`  ✓ profile ${acct.display_name} (${acct.role})`);
  }

  console.log("\nDone. Test logins (all password: Chores!2026):");
  ACCOUNTS.forEach((a) => console.log(`  ${a.role.padEnd(5)}  ${a.email}`));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
