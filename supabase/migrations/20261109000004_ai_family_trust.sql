-- =============================================================================
-- 0004 AI FEATURES, FAMILY COLLABORATION, VERIFICATION, TRUST & SAFETY
-- =============================================================================

-- AI configuration -----------------------------------------------------------
create table public.ai_feature_configs (
  feature text primary key check (feature in (
    'matchmaker_chat', 'smart_search', 'match_explanation', 'gap_analysis', 'before_you_meet',
    'readiness_assistant', 'vision_board_themes', 'dna_interpretation', 'conversation_starters',
    'moderation', 'embeddings'
  )),
  provider text not null default 'anthropic' check (provider in ('anthropic', 'voyage', 'disabled')),
  model text not null,
  effort text check (effort in ('low', 'medium', 'high', 'xhigh', 'max')),
  max_tokens int not null default 4000,
  prompt_key text,
  enabled boolean not null default true,
  daily_user_limit int,          -- null = unlimited (entitlements may still apply)
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
create trigger ai_feature_configs_updated before update on public.ai_feature_configs
  for each row execute function public.set_updated_at();

create table public.ai_prompts (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  version int not null,
  system_prompt text not null,
  notes text,
  is_active boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (key, version)
);
create unique index ai_prompts_one_active on public.ai_prompts (key) where is_active;

create table public.ai_usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.app_users (id) on delete set null,
  feature text not null,
  provider text not null,
  model text not null,
  prompt_key text,
  prompt_version int,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_read_tokens int not null default 0,
  cache_write_tokens int not null default 0,
  cost_usd_micros bigint not null default 0,
  latency_ms int,
  status text not null check (status in ('success', 'error', 'refused', 'rate_limited', 'disabled')),
  error_code text,
  created_at timestamptz not null default now()
);
create index ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);
create index ai_usage_logs_feature_idx on public.ai_usage_logs (feature, created_at desc);
create index ai_usage_logs_user_idx on public.ai_usage_logs (user_id, feature, created_at desc);

create table public.ai_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  feature text not null,
  reference_id text,
  rating smallint not null check (rating in (-1, 1)),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index ai_feedback_feature_idx on public.ai_feedback (feature, created_at desc);

-- Personal AI matchmaker conversations (private to the user) ------------------
create table public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'matchmaker' check (kind in ('matchmaker', 'readiness')),
  topic text, -- for readiness threads
  title text,
  last_filters jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_threads_user_idx on public.ai_threads (user_id, kind, updated_at desc);
create trigger ai_threads_updated before update on public.ai_threads
  for each row execute function public.set_updated_at();

create table public.ai_thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  structured jsonb, -- e.g. extracted filters, clarifying questions, result ids
  created_at timestamptz not null default now()
);
create index ai_thread_messages_thread_idx on public.ai_thread_messages (thread_id, created_at);

-- Connection-level insights ---------------------------------------------------
create table public.connection_insights (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  kind text not null check (kind in ('gap_analysis', 'before_you_meet', 'vision_themes')),
  requested_by_profile_id uuid references public.profiles (id) on delete set null,
  content jsonb not null,
  generator text not null check (generator in ('engine', 'ai')),
  model text,
  prompt_version int,
  created_at timestamptz not null default now()
);
create index connection_insights_idx on public.connection_insights (connection_id, kind, created_at desc);

-- Couple vision board (voluntary sharing) ------------------------------------
create table public.vision_board_items (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('travel', 'lifestyle', 'career', 'location', 'financial', 'family', 'personal_growth')),
  content text not null check (char_length(content) between 1 and 500),
  is_shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vision_board_items_conn_idx on public.vision_board_items (connection_id, category);
create trigger vision_board_items_updated before update on public.vision_board_items
  for each row execute function public.set_updated_at();

-- Compatibility evolution journal (private to the author) --------------------
create table public.connection_journal (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  author_profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('topic_discussed', 'expectation_clarified', 'interest_discovered', 'question_remaining', 'preference_updated', 'note')),
  content text not null check (char_length(content) between 1 and 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index connection_journal_idx on public.connection_journal (connection_id, author_profile_id, created_at desc);
create trigger connection_journal_updated before update on public.connection_journal
  for each row execute function public.set_updated_at();

-- Marriage readiness topics (private notes) ----------------------------------
create table public.readiness_notes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null check (topic in (
    'finances', 'career', 'children', 'family_involvement', 'household', 'living_arrangements',
    'relocation', 'lifestyle', 'independence', 'future_ambitions', 'conflict_resolution'
  )),
  my_view text check (char_length(my_view) <= 2000),
  questions_to_ask text[] not null default '{}',
  explored_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, topic)
);
create trigger readiness_notes_updated before update on public.readiness_notes
  for each row execute function public.set_updated_at();

-- Family collaboration --------------------------------------------------------
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  member_user_id uuid references public.app_users (id) on delete cascade,
  invited_contact text not null,                  -- email or phone used for the invite
  relation text not null check (relation in ('mother', 'father', 'brother', 'sister', 'guardian', 'relative', 'friend', 'other')),
  display_name text,
  permissions text[] not null default '{view_profiles}',
  status text not null default 'invited' check (status in ('invited', 'active', 'revoked', 'declined')),
  invite_token_hash text unique,
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (permissions <@ array['view_profiles', 'suggest_matches', 'shortlist', 'discuss', 'coordinate_meetings']::text[])
);
create index family_members_profile_idx on public.family_members (profile_id, status);
create index family_members_user_idx on public.family_members (member_user_id, status);

create or replace function public.family_can(p_profile_id uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.family_members fm
    where fm.profile_id = p_profile_id
      and fm.member_user_id = auth.uid()
      and fm.status = 'active'
      and p_permission = any (fm.permissions)
  );
$$;

create table public.family_suggestions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  family_member_id uuid not null references public.family_members (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'considering', 'dismissed', 'acted')),
  created_at timestamptz not null default now(),
  unique (profile_id, family_member_id, target_profile_id)
);

create table public.family_discussions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  author_user_id uuid not null references public.app_users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index family_discussions_idx on public.family_discussions (profile_id, target_profile_id, created_at);

create table public.meeting_plans (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections (id) on delete cascade,
  proposed_by_user_id uuid not null references public.app_users (id) on delete cascade,
  title text not null,
  proposed_at timestamptz not null,
  location_text text,
  notes text,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'declined', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger meeting_plans_updated before update on public.meeting_plans
  for each row execute function public.set_updated_at();

-- Verification ---------------------------------------------------------------
create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('phone', 'email', 'government_id', 'photo', 'employment', 'education')),
  status text not null default 'pending' check (status in ('pending', 'in_review', 'approved', 'rejected', 'resubmission_required', 'expired')),
  provider text not null default 'manual', -- manual | digilocker | idfy | signzy ...
  provider_reference text,
  document_type text, -- aadhaar_masked, passport, driving_licence, pan, voter_id, offer_letter, payslip, degree
  document_paths text[] not null default '{}',
  submitted_data jsonb not null default '{}'::jsonb, -- never store full ID numbers
  reviewer_id uuid references auth.users (id),
  reviewed_at timestamptz,
  rejection_reason text,
  expires_at timestamptz,
  attempt smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verifications_queue_idx on public.verifications (status, kind, created_at);
create index verifications_profile_idx on public.verifications (profile_id, kind, created_at desc);
create trigger verifications_updated before update on public.verifications
  for each row execute function public.set_updated_at();

create table public.verification_events (
  id bigint generated always as identity primary key,
  verification_id uuid not null references public.verifications (id) on delete cascade,
  actor_user_id uuid references auth.users (id),
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Reports & moderation -------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.app_users (id) on delete set null,
  reporter_profile_id uuid references public.profiles (id) on delete set null,
  target_profile_id uuid references public.profiles (id) on delete cascade,
  target_message_id uuid references public.messages (id) on delete set null,
  target_photo_id uuid references public.profile_photos (id) on delete set null,
  reason text not null check (reason in ('fake_profile', 'harassment', 'inappropriate_content', 'scam_or_fraud', 'spam', 'underage', 'married_or_misrepresentation', 'offensive_language', 'safety_concern', 'other')),
  details text check (char_length(details) <= 2000),
  status text not null default 'open' check (status in ('open', 'in_review', 'actioned', 'dismissed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id),
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reports_queue_idx on public.reports (status, priority, created_at);
create index reports_target_idx on public.reports (target_profile_id);
create trigger reports_updated before update on public.reports
  for each row execute function public.set_updated_at();

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users (id),
  target_user_id uuid references public.app_users (id) on delete set null,
  target_profile_id uuid references public.profiles (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  action text not null check (action in ('warn', 'hide_profile', 'suspend', 'reinstate', 'ban', 'remove_photo', 'remove_video', 'remove_message', 'clear_flag')),
  reason text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_actions_target_idx on public.moderation_actions (target_user_id, created_at desc);

-- Automated risk signals (always reviewed by humans before enforcement) ------
create table public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('duplicate_account', 'suspicious_registration', 'spam_messaging', 'mass_interests', 'fraud_pattern', 'reported_repeatedly', 'content_flag')),
  severity smallint not null check (severity between 1 and 5),
  details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'reviewed_ok', 'actioned', 'dismissed')),
  reviewed_by uuid references auth.users (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index risk_signals_queue_idx on public.risk_signals (status, severity desc, created_at);
create unique index risk_signals_open_dedupe on public.risk_signals (user_id, kind) where status = 'open';

-- Generic fixed-window rate limiter (used by the API) ------------------------
create table public.rate_limit_counters (
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (bucket, window_start)
);

create or replace function public.rate_limit_hit(p_bucket text, p_window_seconds int, p_limit int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limit_counters (bucket, window_start, count)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start) do update set count = public.rate_limit_counters.count + 1
  returning count into v_count;
  return v_count <= p_limit; -- true = allowed
end $$;
revoke all on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;
