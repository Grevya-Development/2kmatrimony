-- =============================================================================
-- 0003 MATCHING, INTERESTS, CONNECTIONS, MESSAGING
-- Pairs that are order-independent (scores, connections) are stored with
-- profile_a < profile_b to guarantee one row per pair.
-- =============================================================================

-- Configurable scoring (versioned; exactly one active per region) ------------
create table public.matching_configs (
  id uuid primary key default gen_random_uuid(),
  version int not null,
  region text not null default 'default',
  weights jsonb not null,
  thresholds jsonb not null,
  notes text,
  is_active boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (region, version)
);
create unique index matching_configs_one_active on public.matching_configs (region) where is_active;

-- Cached mutual compatibility per pair --------------------------------------
create table public.match_scores (
  profile_a uuid not null references public.profiles (id) on delete cascade,
  profile_b uuid not null references public.profiles (id) on delete cascade,
  a_to_b smallint not null check (a_to_b between 0 and 100), -- B fits A's preferences
  b_to_a smallint not null check (b_to_a between 0 and 100), -- A fits B's preferences
  mutual smallint not null check (mutual between 0 and 100),
  confidence smallint not null check (confidence between 0 and 100),
  dimensions jsonb not null,          -- per-dimension directional breakdown
  dealbreakers jsonb not null default '[]'::jsonb,
  config_version int not null,
  computed_at timestamptz not null default now(),
  primary key (profile_a, profile_b),
  check (profile_a < profile_b)
);
create index match_scores_b_idx on public.match_scores (profile_b, mutual desc);
create index match_scores_a_idx on public.match_scores (profile_a, mutual desc);

-- AI/engine explanations shown to a specific viewer ----------------------------
create table public.match_explanations (
  id uuid primary key default gen_random_uuid(),
  viewer_profile_id uuid not null references public.profiles (id) on delete cascade,
  candidate_profile_id uuid not null references public.profiles (id) on delete cascade,
  content jsonb not null,
  generator text not null check (generator in ('engine', 'ai')),
  model text,
  prompt_version text,
  score_computed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (viewer_profile_id, candidate_profile_id)
);

-- Recommendations feed --------------------------------------------------------
create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  candidate_profile_id uuid not null references public.profiles (id) on delete cascade,
  score smallint not null,
  source text not null default 'engine' check (source in ('engine', 'ai_curated', 'matchmaker', 'family')),
  reason text,
  status text not null default 'new' check (status in ('new', 'viewed', 'shortlisted', 'passed', 'interested')),
  batch_date date not null default current_date,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, candidate_profile_id, batch_date),
  check (profile_id <> candidate_profile_id)
);
create index recommendations_feed_idx on public.recommendations (profile_id, batch_date desc, score desc);
create trigger recommendations_updated before update on public.recommendations
  for each row execute function public.set_updated_at();

-- Feedback used to evaluate weights ------------------------------------------
create table public.match_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  candidate_profile_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between -1 and 1),
  reason text check (reason in ('not_my_preferences', 'great_fit', 'explanation_wrong', 'location', 'values', 'lifestyle', 'other')),
  comment text check (char_length(comment) <= 500),
  mutual_score_at_time smallint,
  config_version int,
  created_at timestamptz not null default now(),
  unique (profile_id, candidate_profile_id)
);

-- Profile views (for "who viewed me" + analytics) ----------------------------
create table public.profile_views (
  id bigint generated always as identity primary key,
  viewer_profile_id uuid not null references public.profiles (id) on delete cascade,
  viewed_profile_id uuid not null references public.profiles (id) on delete cascade,
  source text,
  created_at timestamptz not null default now()
);
create index profile_views_viewed_idx on public.profile_views (viewed_profile_id, created_at desc);

-- Shortlists / passes / blocks -----------------------------------------------
create table public.shortlists (
  owner_profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  note text check (char_length(note) <= 500),
  added_by_user_id uuid references auth.users (id),  -- family member or owner
  created_at timestamptz not null default now(),
  primary key (owner_profile_id, target_profile_id),
  check (owner_profile_id <> target_profile_id)
);

create table public.passes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, target_profile_id)
);

create table public.blocks (
  blocker_profile_id uuid not null references public.profiles (id) on delete cascade,
  blocked_profile_id uuid not null references public.profiles (id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  primary key (blocker_profile_id, blocked_profile_id),
  check (blocker_profile_id <> blocked_profile_id)
);
create index blocks_blocked_idx on public.blocks (blocked_profile_id);

create or replace function public.is_blocked_between(p1 uuid, p2 uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_profile_id = p1 and b.blocked_profile_id = p2)
       or (b.blocker_profile_id = p2 and b.blocked_profile_id = p1)
  );
$$;

-- Interests -------------------------------------------------------------------
create table public.interests (
  id uuid primary key default gen_random_uuid(),
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  receiver_profile_id uuid not null references public.profiles (id) on delete cascade,
  message text check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  sent_by_user_id uuid references auth.users (id),
  responded_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_profile_id <> receiver_profile_id)
);
create unique index interests_one_open_per_pair on public.interests (sender_profile_id, receiver_profile_id) where status = 'pending';
create index interests_receiver_idx on public.interests (receiver_profile_id, status, created_at desc);
create index interests_sender_idx on public.interests (sender_profile_id, status, created_at desc);
create trigger interests_updated before update on public.interests
  for each row execute function public.set_updated_at();

-- Connections (created on mutual interest) -----------------------------------
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  profile_a uuid not null references public.profiles (id) on delete cascade,
  profile_b uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'closed')),
  origin_interest_id uuid references public.interests (id) on delete set null,
  closed_by_profile_id uuid references public.profiles (id),
  closed_reason text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (profile_a < profile_b)
);
create unique index connections_pair_idx on public.connections (profile_a, profile_b);
create index connections_b_idx on public.connections (profile_b);

create or replace function public.is_connection_member(p_connection_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.connections c
    join public.profiles p on p.id in (c.profile_a, c.profile_b)
    where c.id = p_connection_id and p.owner_user_id = auth.uid()
  );
$$;

-- Messaging ------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null unique references public.connections (id) on delete cascade,
  is_locked boolean not null default false, -- set when connection closes or a block happens
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  last_read_at timestamptz,
  muted boolean not null default false,
  archived boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.user_id = auth.uid()
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_profile_id uuid references public.profiles (id) on delete set null,
  sender_user_id uuid references public.app_users (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'image', 'system')),
  body text check (char_length(body) <= 4000),
  media_path text,
  client_id text, -- idempotency key from the client
  flagged boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'text' or (body is not null and char_length(btrim(body)) > 0)),
  check (kind <> 'image' or media_path is not null)
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create unique index messages_client_id_idx on public.messages (conversation_id, client_id) where client_id is not null;

-- Keep conversation summary fresh.
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = case when new.kind = 'image' then '📷 Photo' else left(coalesce(new.body, ''), 140) end
   where id = new.conversation_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- Guard direct inserts: sender must be a participant and the conversation open.
create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_locked boolean;
  v_profile uuid;
begin
  if auth.uid() is null then
    return new; -- service role / system messages
  end if;
  select c.is_locked into v_locked from public.conversations c where c.id = new.conversation_id;
  if v_locked then
    raise exception 'conversation is locked' using errcode = 'P0001';
  end if;
  select cp.profile_id into v_profile from public.conversation_participants cp
   where cp.conversation_id = new.conversation_id and cp.user_id = auth.uid();
  if v_profile is null then
    raise exception 'not a participant' using errcode = '42501';
  end if;
  if new.kind = 'system' then
    raise exception 'system messages are server-only' using errcode = '42501';
  end if;
  new.sender_profile_id := v_profile;
  new.sender_user_id := auth.uid();
  new.created_at := now();
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();
