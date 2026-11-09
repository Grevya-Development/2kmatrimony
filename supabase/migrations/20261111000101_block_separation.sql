-- =============================================================================
-- Security fix (audit L2/L3): blocking fully separates two members.
--  * conversation_not_blocked(): false when either participant blocked the other.
--  * Realtime private channels (typing/presence) and direct RLS reads of
--    messages/conversations require it, so a blocked member can no longer read
--    history, see presence or receive broadcasts.
--  * is_blocked_between() is no longer callable by clients (it allowed probing
--    block relationships between arbitrary third parties).
-- =============================================================================

create or replace function public.conversation_not_blocked(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1
    from public.conversation_participants a
    join public.conversation_participants b
      on b.conversation_id = a.conversation_id and b.profile_id <> a.profile_id
    join public.blocks bl
      on (bl.blocker_profile_id = a.profile_id and bl.blocked_profile_id = b.profile_id)
    where a.conversation_id = p_conversation_id
  );
$$;
revoke all on function public.conversation_not_blocked(uuid) from public, anon;
grant execute on function public.conversation_not_blocked(uuid) to authenticated;

revoke execute on function public.is_blocked_between(uuid, uuid) from authenticated;

-- Direct reads (also gate postgres_changes delivery)
drop policy if exists "participant messages" on public.messages;
create policy "participant messages" on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) and deleted_at is null
         and public.conversation_not_blocked(conversation_id));

drop policy if exists "participant conversations" on public.conversations;
create policy "participant conversations" on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) and public.conversation_not_blocked(id));

-- Realtime private channels "conversation:<uuid>"
drop policy if exists "conversation channel participants can receive" on realtime.messages;
create policy "conversation channel participants can receive" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'conversation:%'
    and public.is_conversation_participant((split_part(realtime.topic(), ':', 2))::uuid)
    and public.conversation_not_blocked((split_part(realtime.topic(), ':', 2))::uuid)
  );
drop policy if exists "conversation channel participants can send" on realtime.messages;
create policy "conversation channel participants can send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'conversation:%'
    and public.is_conversation_participant((split_part(realtime.topic(), ':', 2))::uuid)
    and public.conversation_not_blocked((split_part(realtime.topic(), ':', 2))::uuid)
  );
