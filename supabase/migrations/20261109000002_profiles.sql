-- =============================================================================
-- 0002 PROFILES: matrimony profile and its sections, Relationship DNA,
-- partner preferences, media. One profile per account (v1).
-- Visibility of other members' data is enforced in the API layer through a
-- privacy projection (apps/web/src/server/profiles/projection.ts); these tables
-- are only directly readable by the owner, authorised family, and admins.
-- =============================================================================

create sequence public.profile_code_seq start 100001;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references public.app_users (id) on delete cascade,
  profile_code text not null unique default ('TK' || nextval('public.profile_code_seq')::text),
  created_for text not null default 'self'
    check (created_for in ('self', 'son', 'daughter', 'brother', 'sister', 'relative', 'friend', 'other')),
  managed_by_relation text, -- free text when created_for <> 'self' (e.g. "mother")
  -- identity
  first_name text,
  last_name text,
  name_visibility text not null default 'first_name'
    check (name_visibility in ('full', 'first_name', 'initials')),
  date_of_birth date check (date_of_birth is null or date_of_birth <= (current_date - interval '18 years')),
  gender text check (gender in ('female', 'male', 'other')),
  height_cm smallint check (height_cm is null or height_cm between 120 and 230),
  marital_status text check (marital_status in ('never_married', 'divorced', 'widowed', 'awaiting_divorce', 'annulled')),
  has_children boolean,
  mother_tongue text,
  languages text[] not null default '{}',
  nationality text,
  religion text,           -- optional, user-declared only, never inferred
  community text,          -- optional, user-declared only, never inferred
  current_city text,
  current_state text,
  current_country text default 'IN',
  native_place text,
  about text check (char_length(about) <= 2000),
  personality_traits text[] not null default '{}',
  core_values text[] not null default '{}',
  -- state
  status text not null default 'draft'
    check (status in ('draft', 'active', 'hidden', 'suspended', 'deleted')),
  visibility text not null default 'members'
    check (visibility in ('members', 'connections', 'hidden')),
  photo_visibility text not null default 'members'
    check (photo_visibility in ('members', 'connections', 'on_request')),
  sensitive_fields_visibility text not null default 'connections'
    check (sensitive_fields_visibility in ('members', 'connections', 'hidden')),
  messaging_policy text not null default 'connections'
    check (messaging_policy in ('connections', 'connections_verified')),
  completion_pct smallint not null default 0 check (completion_pct between 0 and 100),
  onboarding_step text,
  is_identity_verified boolean not null default false,
  is_photo_verified boolean not null default false,
  -- search
  search_text text,
  search_tsv tsvector generated always as (to_tsvector('simple', coalesce(search_text, ''))) stored,
  embedding extensions.vector(1024),
  embedding_model text,
  embedding_updated_at timestamptz,
  activated_at timestamptz,
  last_active_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_discovery_idx on public.profiles (status, visibility, gender, date_of_birth);
create index profiles_city_idx on public.profiles (current_country, current_city);
create index profiles_search_tsv_idx on public.profiles using gin (search_tsv);
create index profiles_embedding_idx on public.profiles using hnsw (embedding extensions.vector_cosine_ops);
create index profiles_last_active_idx on public.profiles (last_active_at desc);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.owns_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_profile_id and p.owner_user_id = auth.uid());
$$;

create or replace function public.my_profile_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id from public.profiles p where p.owner_user_id = auth.uid();
$$;

-- Education (multiple rows) ----------------------------------------------------
create table public.profile_education (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  level text not null check (level in ('high_school', 'diploma', 'bachelors', 'masters', 'doctorate', 'professional')),
  qualification text not null,
  institution text,
  specialization text,
  graduation_year smallint check (graduation_year is null or graduation_year between 1950 and 2100),
  is_highest boolean not null default false,
  created_at timestamptz not null default now()
);
create index profile_education_profile_idx on public.profile_education (profile_id);
create unique index profile_education_one_highest on public.profile_education (profile_id) where is_highest;

-- Career (1:1) ----------------------------------------------------------------
create table public.profile_career (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  profession text,
  employment_type text check (employment_type in ('employed', 'self_employed', 'business', 'government', 'student', 'not_working')),
  company text,
  designation text,
  income_range text check (income_range in ('none', 'lt_3l', '3_6l', '6_10l', '10_15l', '15_25l', '25_50l', '50l_1cr', 'gt_1cr', 'prefer_not')),
  income_visibility text not null default 'connections' check (income_visibility in ('members', 'connections', 'hidden')),
  work_city text,
  work_country text,
  relocation_willingness text check (relocation_willingness in ('open', 'within_country', 'not_open', 'undecided')),
  updated_at timestamptz not null default now()
);
create trigger profile_career_updated before update on public.profile_career
  for each row execute function public.set_updated_at();

-- Family (1:1) ----------------------------------------------------------------
create table public.profile_family (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  family_structure text check (family_structure in ('nuclear', 'joint', 'extended', 'single_parent', 'other')),
  family_values text check (family_values in ('traditional', 'moderate', 'liberal')),
  family_background text check (char_length(family_background) <= 1000),
  father_occupation text,
  mother_occupation text,
  brothers smallint check (brothers between 0 and 20),
  sisters smallint check (sisters between 0 and 20),
  siblings_details text,
  family_native_place text,
  family_location text,
  updated_at timestamptz not null default now()
);
create trigger profile_family_updated before update on public.profile_family
  for each row execute function public.set_updated_at();

-- Lifestyle (1:1) -------------------------------------------------------------
create table public.profile_lifestyle (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  diet text check (diet in ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan', 'jain', 'flexible')),
  smoking text check (smoking in ('never', 'occasionally', 'regularly', 'quitting')),
  drinking text check (drinking in ('never', 'occasionally', 'regularly', 'quitting')),
  fitness text check (fitness in ('rarely', 'sometimes', 'regularly', 'athlete')),
  travel text check (travel in ('rarely', 'occasionally', 'frequently', 'passionate')),
  hobbies text[] not null default '{}',
  interests text[] not null default '{}',
  updated_at timestamptz not null default now()
);
create trigger profile_lifestyle_updated before update on public.profile_lifestyle
  for each row execute function public.set_updated_at();

-- Personal values & future vision (1:1) --------------------------------------
create table public.profile_values (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  emotional_expectations text check (char_length(emotional_expectations) <= 1000),
  communication_style text check (communication_style in ('frequent_checkins', 'balanced', 'space_and_depth', 'direct', 'gentle')),
  conflict_style text check (conflict_style in ('talk_immediately', 'cool_off_then_talk', 'written', 'mediated')),
  family_responsibilities text check (char_length(family_responsibilities) <= 1000),
  career_ambitions text check (char_length(career_ambitions) <= 1000),
  financial_philosophy text check (financial_philosophy in ('saver', 'balanced', 'spender', 'investor', 'shared_pool', 'separate_finances')),
  relationship_expectations text check (char_length(relationship_expectations) <= 1000),
  future_goals text check (char_length(future_goals) <= 1000),
  independence_level text check (independence_level in ('very_independent', 'balanced', 'very_together')),
  children_preference text check (children_preference in ('want', 'dont_want', 'open', 'have_and_want_more', 'have_no_more')),
  living_arrangement text check (living_arrangement in ('independent', 'with_parents', 'near_parents', 'flexible')),
  settle_preference text check (settle_preference in ('current_city', 'india_any', 'abroad', 'flexible')),
  household_split text check (household_split in ('equal', 'flexible', 'traditional', 'outsourced')),
  updated_at timestamptz not null default now()
);
create trigger profile_values_updated before update on public.profile_values
  for each row execute function public.set_updated_at();

-- Relationship DNA: one row per dimension. Self-declared, editable, never a
-- diagnosis. AI may *suggest* values (source = 'ai_suggested') which the user
-- confirms or corrects (source = 'user_corrected').
create table public.relationship_dna (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  dimension text not null check (dimension in (
    'emotional_connection', 'communication', 'family_orientation', 'independence',
    'career_ambition', 'lifestyle_pace', 'financial_philosophy', 'long_term_aspirations',
    'shared_interests', 'personal_values'
  )),
  self_score smallint not null check (self_score between 0 and 100),
  partner_target smallint check (partner_target between 0 and 100), -- null = "similar to me"
  importance smallint not null default 3 check (importance between 1 and 5),
  flexible boolean not null default true,
  statement text check (char_length(statement) <= 500),
  source text not null default 'explicit' check (source in ('explicit', 'ai_suggested', 'user_corrected')),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, dimension)
);
create trigger relationship_dna_updated before update on public.relationship_dna
  for each row execute function public.set_updated_at();

-- Raw onboarding answers (keyed by configurable question key) ----------------
create table public.question_responses (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  answered_at timestamptz not null default now(),
  primary key (profile_id, question_key)
);

-- Partner preferences (1:1) ---------------------------------------------------
create table public.partner_preferences (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  seeking_genders text[] not null default '{}',
  age_min smallint check (age_min between 18 and 99),
  age_max smallint check (age_max between 18 and 99),
  height_min_cm smallint,
  height_max_cm smallint,
  marital_statuses text[] not null default '{}',
  education_levels text[] not null default '{}',
  professions text[] not null default '{}',
  min_income_range text,
  countries text[] not null default '{}',
  cities text[] not null default '{}',
  open_to_relocate_partner boolean,
  diets text[] not null default '{}',
  smoking_ok text[] not null default '{}',
  drinking_ok text[] not null default '{}',
  family_values text[] not null default '{}',
  children_preferences text[] not null default '{}',
  living_arrangements text[] not null default '{}',
  personality_traits text[] not null default '{}',
  core_values text[] not null default '{}',
  mother_tongues text[] not null default '{}',
  religions text[] not null default '{}',
  -- Fields the user marks as non-negotiable (hard filters). Any field above
  -- not listed here is treated as a soft, flexible preference.
  non_negotiables text[] not null default '{}',
  free_text text check (char_length(free_text) <= 1000),
  updated_at timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max)
);
create trigger partner_preferences_updated before update on public.partner_preferences
  for each row execute function public.set_updated_at();

-- Media -----------------------------------------------------------------------
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  is_primary boolean not null default false,
  sort_order smallint not null default 0,
  visibility text not null default 'inherit' check (visibility in ('inherit', 'connections', 'hidden')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_reason text,
  moderated_by uuid references auth.users (id),
  moderated_at timestamptz,
  width int,
  height int,
  created_at timestamptz not null default now()
);
create index profile_photos_profile_idx on public.profile_photos (profile_id, sort_order);
create unique index profile_photos_one_primary on public.profile_photos (profile_id) where is_primary;
create index profile_photos_moderation_idx on public.profile_photos (moderation_status, created_at);

create table public.profile_videos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  duration_seconds smallint check (duration_seconds between 1 and 90),
  visibility text not null default 'members' check (visibility in ('members', 'connections', 'hidden')),
  moderation_status text not null default 'pending' check (moderation_status in ('pending', 'approved', 'rejected')),
  moderation_reason text,
  moderated_by uuid references auth.users (id),
  moderated_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index profile_videos_one_per_profile on public.profile_videos (profile_id);
create index profile_videos_moderation_idx on public.profile_videos (moderation_status, created_at);
