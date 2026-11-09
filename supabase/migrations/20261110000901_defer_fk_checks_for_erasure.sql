-- Account erasure fix: when an account is deleted, cascades remove rows (e.g.
-- conversations -> messages) while ON DELETE SET NULL actions update other
-- columns of the same rows (e.g. messages.sender_user_id). The SET NULL update
-- re-checks the row's *other* foreign keys mid-cascade and fails because the
-- parent is already gone ("Database error deleting user").
-- Making those other FKs DEFERRABLE INITIALLY DEFERRED moves the check to
-- commit, by which time the cascaded rows no longer exist. Data integrity is
-- unchanged: every constraint is still enforced at transaction end.
do $$
declare r record;
begin
  for r in
    select distinct c.conrelid::regclass as tbl, c.conname
    from pg_constraint c
    where c.contype = 'f'
      and c.connamespace = 'public'::regnamespace
      and c.confdeltype <> 'n'
      and not c.condeferrable
      and exists (
        select 1 from pg_constraint s
        where s.conrelid = c.conrelid and s.contype = 'f' and s.confdeltype = 'n'
      )
  loop
    execute format('alter table %s alter constraint %I deferrable initially deferred', r.tbl, r.conname);
  end loop;
end $$;
