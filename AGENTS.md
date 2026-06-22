# This is NOT the Next.js you know

This version (Next.js 16) has breaking changes — APIs, conventions, and file
structure may all differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# ChoreTracker — house rules

- **Source of truth for design:** `docs/architecture.md` and `docs/build-order.md`.
  Build in the sequence in build-order.md; don't skip ahead.
- **RLS is the security boundary, not the UI.** Never trust the client to decide
  who sees what. Every isolation rule lives in a Postgres policy.
- **The UI calls repositories** (`lib/db/repositories/*`), never the Supabase
  client directly. Validate every row crossing that boundary with the Zod
  schemas in `lib/domain/schemas.ts`.
- **Never** prefix the service-role key `NEXT_PUBLIC_`, and never import
  `lib/supabase/admin.ts` from a Client Component. It bypasses RLS over a
  database of children's data.
- **"Today" is computed in the family's timezone** (`todayInZone`), never bare
  `new Date()`. The daily reset depends on it.
