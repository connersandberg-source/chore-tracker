# Supabase — ChoreTracker

Database schema, RLS, and seed for ChoreTracker. Design source: `docs/architecture.md` §2–3.

## Files (apply in order)

1. `migrations/0001_enums_and_core_tables.sql` — enums + all tables, FKs, indexes, `unique(chore_id, due_date)`
2. `migrations/0002_balance_view_functions_triggers.sql` — `v_child_balance` view (security_invoker), `auth_family_id()`/`auth_is_admin()`, the approve/reject/fulfill/deny RPCs, the `auto_approve` trigger
3. `migrations/0003_rls_policies.sql` — enables RLS on every table + all policies
4. `seed.sql` — family + reward catalog now; chores after the 3 kids exist (Phase 2). Re-runnable.

## Applying them — pick one path

### Path A — SQL editor (no install needed; recommended given the tooling)
1. Create a free project at https://supabase.com/dashboard (name `chore-tracker`, save the DB password).
2. Open **SQL Editor** → paste the contents of each file **in the order above**, running each.
3. After Phase 2 (kids created), re-run `seed.sql` to insert the chores.

### Path B — Supabase CLI
```sh
npx supabase init           # if not already; keeps this migrations/ folder
npx supabase link --project-ref <your-ref>
npx supabase db push        # applies migrations/
# seed: run seed.sql in the SQL editor, or `supabase db reset` for local dev
```

## Environment variables (after the project exists)
Add to `.env.local` (gitignored — never commit):
```
NEXT_PUBLIC_SUPABASE_URL=...        # Project Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # Project Settings → API → anon public key
SUPABASE_SERVICE_ROLE_KEY=...       # Settings → API → service_role  (SERVER ONLY, never NEXT_PUBLIC_)
```
Set the same three in Vercel (Production + Preview); scope the service-role key server-side only.

## Verifying RLS isolation (Step 1.4 gate)
After migrations apply and at least two child profiles exist, run this in the SQL
editor to prove a child cannot see a sibling's rows or self-approve. Replace the
UUIDs with two real child `profiles.id` values.

```sql
-- Impersonate child A by setting the JWT claims the policies read.
select set_config('request.jwt.claims',
  json_build_object('sub', '<CHILD_A_UUID>', 'role', 'authenticated')::text, true);
select set_config('role', 'authenticated', true);

-- Should return ONLY child A's chores (never child B's):
select id, child_id, title from chores;

-- Should FAIL / affect 0 rows (cannot self-approve — points stay admin-only):
update chore_completions set status = 'approved', points_awarded = 999
where child_id = '<CHILD_A_UUID>';

-- Should return ONLY child A's balance row:
select * from v_child_balance;
```
Expected: child A sees only their own chores/balance; the self-approve update
touches 0 rows. Reset with `select set_config('request.jwt.claims', null, true);`.
