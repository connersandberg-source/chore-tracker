-- ChoreTracker — migration 0006: enable Realtime on the broadcast tables
--
-- Mom's dashboard and the kids' views update live off Postgres changes to these
-- tables (architecture §5). RLS applies to Realtime too, so a subscriber only
-- receives changes for rows they're allowed to see; we additionally filter by
-- family_id client-side.
--
-- REPLICA IDENTITY FULL makes UPDATE/DELETE events include the full old row, so
-- a kid undoing a check-off (a DELETE) still carries family_id for filtering.

alter table chore_completions replica identity full;
alter table redemptions       replica identity full;
alter table point_adjustments replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'chore_completions'
  ) then
    alter publication supabase_realtime add table chore_completions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'redemptions'
  ) then
    alter publication supabase_realtime add table redemptions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
      and tablename = 'point_adjustments'
  ) then
    alter publication supabase_realtime add table point_adjustments;
  end if;
end $$;
