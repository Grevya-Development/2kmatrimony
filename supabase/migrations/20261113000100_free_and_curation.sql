-- =============================================================================
-- FREE PLATFORM + CURATION
--  * Everyone gets every feature: the Free plan carries the most generous
--    entitlements (anti-abuse daily caps remain); paid plans are retired and
--    the `payments` flag is off. Billing tables/code stay for a possible future.
--  * Human screening: completed profiles wait in 'in_review' until a team member
--    approves them (platform setting curation.profile_screening).
--  * Hand-picked introductions: recommendations.source = 'matchmaker' rows
--    created by the team, with a personal note.
-- =============================================================================

-- Free plan = everything ---------------------------------------------------------
insert into public.plan_entitlements (plan_id, key, value)
select p.id, e.key, e.value::jsonb from public.plans p
cross join (values
  ('interests_per_day', '50'), ('daily_recommendations', '30'), ('advanced_filters', 'true'),
  ('ai_insights', '"full"'), ('ai_matchmaker_messages_per_day', '200'), ('smart_search_per_day', '300'),
  ('see_who_viewed', 'true'), ('gap_analysis', 'true'), ('before_you_meet', 'true'),
  ('curated_introductions', 'true'), ('human_matchmaker', 'true'), ('priority_support', 'true')
) as e(key, value)
where p.code = 'free'
on conflict (plan_id, key) do update set value = excluded.value;

update public.plans set is_public = false, is_active = false where code in ('plus', 'premium', 'elite');
update public.plans set name = 'Free', tagline = 'Everything included', description = 'Every feature is free for every member.' where code = 'free';
update public.feature_flags set enabled = false where key = 'payments';

-- Screening ------------------------------------------------------------------------
alter table public.profiles drop constraint profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('draft', 'in_review', 'active', 'hidden', 'suspended', 'deleted'));

alter table public.profiles
  add column if not exists review_submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users (id) on delete set null,
  add column if not exists review_note text check (char_length(review_note) <= 1000);

create index if not exists profiles_review_queue_idx on public.profiles (review_submitted_at) where status = 'in_review';

insert into public.platform_settings (key, value, description, is_public) values
  ('curation', '{"profile_screening": true, "screening_sla_hours": 24}', 'Human screening of new profiles before they go live', true)
on conflict (key) do nothing;

-- Notification templates --------------------------------------------------------------
insert into public.notification_templates (key, channel, subject, body) values
  ('profile_approved', 'in_app', null, 'Welcome — your profile has been approved and is now live.'),
  ('profile_approved', 'push', 'Your profile is live', 'Our team has reviewed and approved your profile.'),
  ('profile_approved', 'email', 'Your 2K Matrimony profile is live', E'Hello {{name}},\n\nOur team has reviewed your profile and it is now live. You will start receiving introductions shortly.\n\n{{link}}'),
  ('profile_changes_requested', 'in_app', null, 'Our team reviewed your profile and asked for a few changes: {{note}}'),
  ('profile_changes_requested', 'email', 'A few changes to your profile', E'Hello {{name}},\n\nThank you for joining. Before your profile goes live, our team has asked for a few changes:\n\n{{note}}\n\nUpdate your profile here: {{link}}'),
  ('introduction_received', 'in_app', null, 'Your matchmaker has a new introduction for you.'),
  ('introduction_received', 'push', 'A new introduction', 'Your matchmaker has hand-picked someone for you.'),
  ('introduction_received', 'email', 'Your matchmaker has a new introduction for you', E'Hello {{name}},\n\nYour matchmaker has hand-picked someone we think you should meet, with a note on why.\n\n{{link}}')
on conflict (key, channel, locale) do nothing;
