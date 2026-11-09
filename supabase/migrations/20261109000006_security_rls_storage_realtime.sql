-- =============================================================================
-- 0006 SECURITY: row level security, privileges, storage buckets, realtime.
--
-- Access model
--   * ALL writes go through the API layer (Next.js route handlers) using the
--     service role, where business rules, entitlements, rate limits and audit
--     logging live once for web and mobile. Clients get no INSERT/UPDATE/DELETE.
--   * Clients may SELECT only their own rows (used for realtime subscriptions
--     and fast own-data reads). Other members' profiles are only ever served via
--     the API privacy projection.
--   * Storage buckets are private. Uploads use short-lived signed upload URLs
--     and reads use signed URLs issued by the API after a privacy check.
--   * Tables without policies are service-role only (admin data, logs, counters).
-- NOTE: future migrations that add tables must enable RLS and repeat the
-- privilege revocation below.
-- =============================================================================

-- Enable RLS everywhere --------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- Defense in depth: clients never write directly.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke select on all tables in schema public from anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
alter default privileges in schema public revoke select on tables from anon;

-- Helper functions used inside policies must be executable by authenticated.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.has_permission(text) from public, anon;
revoke all on function public.owns_profile(uuid) from public, anon;
revoke all on function public.my_profile_id() from public, anon;
revoke all on function public.family_can(uuid, text) from public, anon;
revoke all on function public.is_connection_member(uuid) from public, anon;
revoke all on function public.is_conversation_participant(uuid) from public, anon;
revoke all on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_admin(), public.has_permission(text), public.owns_profile(uuid),
  public.my_profile_id(), public.family_can(uuid, text), public.is_connection_member(uuid),
  public.is_conversation_participant(uuid), public.is_blocked_between(uuid, uuid) to authenticated;

-- Account ---------------------------------------------------------------------
create policy "own account" on public.app_users for select to authenticated using (id = auth.uid());
create policy "own devices" on public.user_devices for select to authenticated using (user_id = auth.uid());
create policy "own consents" on public.consent_records for select to authenticated using (user_id = auth.uid());
create policy "own admin record" on public.admin_users for select to authenticated using (user_id = auth.uid());

-- Profile and sections: owner, or active family member with view permission ----
create policy "profile owner or family" on public.profiles for select to authenticated
  using (owner_user_id = auth.uid() or public.family_can(id, 'view_profiles'));

do $$
declare t text;
begin
  foreach t in array array['profile_education', 'profile_career', 'profile_family', 'profile_lifestyle',
                           'profile_values', 'relationship_dna', 'question_responses', 'partner_preferences',
                           'profile_photos', 'profile_videos', 'readiness_notes', 'verifications'] loop
    execute format(
      'create policy "owner reads" on public.%I for select to authenticated using (public.owns_profile(profile_id))', t);
  end loop;
end $$;

-- Matching feed ---------------------------------------------------------------
create policy "own recommendations" on public.recommendations for select to authenticated
  using (public.owns_profile(profile_id) or public.family_can(profile_id, 'view_profiles'));
create policy "own shortlist" on public.shortlists for select to authenticated
  using (public.owns_profile(owner_profile_id) or public.family_can(owner_profile_id, 'shortlist'));
create policy "own passes" on public.passes for select to authenticated using (public.owns_profile(profile_id));
create policy "own blocks" on public.blocks for select to authenticated using (public.owns_profile(blocker_profile_id));
create policy "own match feedback" on public.match_feedback for select to authenticated using (public.owns_profile(profile_id));

-- Interests & connections -------------------------------------------------------
create policy "interest parties" on public.interests for select to authenticated
  using (public.owns_profile(sender_profile_id) or public.owns_profile(receiver_profile_id));
create policy "connection members" on public.connections for select to authenticated
  using (public.owns_profile(profile_a) or public.owns_profile(profile_b));

-- Messaging (select only; sending goes through the API) -------------------------
create policy "participant conversations" on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));
create policy "participant rows" on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy "participant messages" on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) and deleted_at is null);

-- AI & connection features -----------------------------------------------------
create policy "own ai threads" on public.ai_threads for select to authenticated using (user_id = auth.uid());
create policy "own ai thread messages" on public.ai_thread_messages for select to authenticated
  using (exists (select 1 from public.ai_threads t where t.id = thread_id and t.user_id = auth.uid()));
create policy "connection insights" on public.connection_insights for select to authenticated
  using (public.is_connection_member(connection_id));
create policy "vision board visible" on public.vision_board_items for select to authenticated
  using (public.owns_profile(author_profile_id) or (is_shared and public.is_connection_member(connection_id)));
create policy "own journal" on public.connection_journal for select to authenticated
  using (public.owns_profile(author_profile_id));
create policy "meeting plans" on public.meeting_plans for select to authenticated
  using (public.is_connection_member(connection_id));

-- Family -----------------------------------------------------------------------
create policy "family rows" on public.family_members for select to authenticated
  using (public.owns_profile(profile_id) or member_user_id = auth.uid());
create policy "family suggestions" on public.family_suggestions for select to authenticated
  using (public.owns_profile(profile_id) or public.family_can(profile_id, 'suggest_matches'));
create policy "family discussions" on public.family_discussions for select to authenticated
  using (public.owns_profile(profile_id) or public.family_can(profile_id, 'discuss'));

-- Safety -----------------------------------------------------------------------
create policy "own reports" on public.reports for select to authenticated using (reporter_user_id = auth.uid());

-- Billing ----------------------------------------------------------------------
grant select on public.plans, public.plan_prices, public.plan_entitlements to anon;
create policy "public plans" on public.plans for select to anon, authenticated using (is_active and is_public);
create policy "public prices" on public.plan_prices for select to anon, authenticated using (is_active);
create policy "public entitlements" on public.plan_entitlements for select to anon, authenticated using (true);
create policy "own subscriptions" on public.subscriptions for select to authenticated using (user_id = auth.uid());
create policy "own payments" on public.payments for select to authenticated using (user_id = auth.uid());
create policy "own invoices" on public.invoices for select to authenticated using (user_id = auth.uid());

-- Notifications ------------------------------------------------------------------
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "own notification prefs" on public.notification_preferences for select to authenticated using (user_id = auth.uid());

-- Public configuration -----------------------------------------------------------
grant select on public.languages, public.regions, public.cms_entries, public.platform_settings to anon;
create policy "languages readable" on public.languages for select to anon, authenticated using (true);
create policy "regions readable" on public.regions for select to anon, authenticated using (true);
create policy "published cms" on public.cms_entries for select to anon, authenticated using (is_published);
create policy "public settings" on public.platform_settings for select to anon, authenticated using (is_public);
create policy "feature flags readable" on public.feature_flags for select to authenticated using (true);
create policy "active questions" on public.onboarding_questions for select to authenticated using (is_active);

-- Support & privacy ---------------------------------------------------------------
create policy "own tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid());
create policy "own ticket messages" on public.support_messages for select to authenticated
  using (not is_internal_note and exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy "own data requests" on public.data_requests for select to authenticated using (user_id = auth.uid());

-- =============================================================================
-- STORAGE: private buckets only.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('profile-photos', 'profile-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('profile-videos', 'profile-videos', false, 104857600, array['video/mp4', 'video/quicktime', 'video/webm']),
  ('verification-docs', 'verification-docs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('chat-media', 'chat-media', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('data-exports', 'data-exports', false, 104857600, array['application/json', 'application/zip'])
on conflict (id) do nothing;
-- No storage.objects policies for anon/authenticated: all access is via
-- signed URLs minted server-side.

-- =============================================================================
-- REALTIME
-- =============================================================================
alter publication supabase_realtime add table public.messages, public.notifications,
  public.interests, public.conversations, public.conversation_participants;

-- Private broadcast/presence channels "conversation:<uuid>" for typing + online
-- status. Only participants may join.
create policy "conversation channel participants can receive" on realtime.messages
  for select to authenticated
  using (
    realtime.topic() like 'conversation:%'
    and public.is_conversation_participant((split_part(realtime.topic(), ':', 2))::uuid)
  );
create policy "conversation channel participants can send" on realtime.messages
  for insert to authenticated
  with check (
    realtime.topic() like 'conversation:%'
    and public.is_conversation_participant((split_part(realtime.topic(), ':', 2))::uuid)
  );
-- Per-user channel "user:<uuid>" for presence of one's own sessions / pings.
create policy "own user channel" on realtime.messages
  for select to authenticated
  using (realtime.topic() = 'user:' || auth.uid()::text);
