-- =============================================================================
-- Workstream A: make account erasure possible (DPDP right to erasure).
-- 1. audit_logs stays append-only, but the FK's ON DELETE SET NULL (which only
--    nulls actor_user_id when an account is erased) is allowed through.
-- 2. FKs to auth.users declared without an ON DELETE action blocked deleting a
--    user who had acted (e.g. submitted a verification). Nullable ones become
--    ON DELETE SET NULL; NOT NULL admin-only columns are left unchanged.
-- =============================================================================

create or replace function public.audit_logs_immutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_user_id is not null and new.actor_user_id is null
     and (to_jsonb(new) - 'actor_user_id') = (to_jsonb(old) - 'actor_user_id') then
    return new; -- FK ON DELETE SET NULL during account erasure
  end if;
  raise exception 'audit_logs is append-only';
end $$;

do $$
declare
  r record;
begin
  for r in
    select con.conname, cls.relname as tbl, att.attname as col
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and ns.nspname = 'public'
      and con.confrelid = 'auth.users'::regclass
      and con.confdeltype = 'a'          -- NO ACTION
      and array_length(con.conkey, 1) = 1
      and not att.attnotnull
  loop
    execute format('alter table public.%I drop constraint %I', r.tbl, r.conname);
    execute format('alter table public.%I add constraint %I foreign key (%I) references auth.users (id) on delete set null', r.tbl, r.conname, r.col);
  end loop;
end $$;
