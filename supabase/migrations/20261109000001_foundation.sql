-- =============================================================================
-- 0001 FOUNDATION: extensions, shared helpers, identity, admin RBAC, consent.
-- Conventions:
--   * UUID primary keys, timestamptz audit columns, check constraints instead of
--     PG enums (easier to evolve). Allowed values are mirrored in
--     packages/shared/src/constants.ts — keep both in sync.
--   * Every table has RLS enabled (policies live in the RLS migration).
--   * Server-side business logic runs with the service role through the API
--     layer; direct client access is limited to the user's own rows.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists citext with schema extensions;

-- Generic updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Application users (1:1 with auth.users). Holds account-level state only.
-- -----------------------------------------------------------------------------
create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email extensions.citext,
  full_name text,
  preferred_locale text not null default 'en'
    check (preferred_locale in ('en', 'ta', 'kn', 'te', 'ml', 'hi')),
  status text not null default 'active'
    check (status in ('active', 'suspended', 'pending_deletion', 'deleted')),
  suspended_reason text,
  suspended_until timestamptz,
  onboarding_completed_at timestamptz,
  last_active_at timestamptz,
  deletion_requested_at timestamptz,
  deleted_at timestamptz,
  signup_ip inet,
  signup_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index app_users_status_idx on public.app_users (status);
create index app_users_created_idx on public.app_users (created_at desc);
create index app_users_phone_idx on public.app_users (phone);
create index app_users_email_idx on public.app_users (email);
create trigger app_users_updated before update on public.app_users
  for each row execute function public.set_updated_at();

-- Registered devices (device management + push tokens) -------------------------
create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  platform text not null check (platform in ('web', 'ios', 'android')),
  device_name text,
  push_token text,
  push_provider text check (push_provider in ('expo', 'fcm', 'apns', 'webpush')),
  app_version text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, push_token)
);
create index user_devices_user_idx on public.user_devices (user_id) where revoked_at is null;

-- -----------------------------------------------------------------------------
-- Admin RBAC. Admins are regular auth users with an admin_users row.
-- -----------------------------------------------------------------------------
create table public.admin_roles (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.admin_permissions (
  key text primary key,
  description text not null,
  category text not null
);

create table public.admin_role_permissions (
  role_id uuid not null references public.admin_roles (id) on delete cascade,
  permission_key text not null references public.admin_permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role_id uuid not null references public.admin_roles (id),
  display_name text not null,
  is_active boolean not null default true,
  mfa_required boolean not null default true,
  created_by uuid references auth.users (id),
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger admin_users_updated before update on public.admin_users
  for each row execute function public.set_updated_at();

-- Helper: is the caller an active admin?
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admin_users au
    where au.user_id = auth.uid() and au.is_active
  );
$$;

-- Helper: does the caller hold a given admin permission? super_admin holds all.
create or replace function public.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.admin_users au
    join public.admin_roles r on r.id = au.role_id
    left join public.admin_role_permissions rp on rp.role_id = r.id
    where au.user_id = auth.uid()
      and au.is_active
      and (r.key = 'super_admin' or rp.permission_key = p_permission)
  );
$$;

-- -----------------------------------------------------------------------------
-- Consent records (DPDP Act): append-style; latest row per type is effective.
-- -----------------------------------------------------------------------------
create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  consent_type text not null check (consent_type in (
    'terms', 'privacy', 'ai_processing', 'ai_message_analysis', 'family_access',
    'marketing_email', 'marketing_sms', 'whatsapp', 'identity_verification', 'data_sharing_partner'
  )),
  policy_version text not null,
  granted boolean not null,
  source text not null default 'web' check (source in ('web', 'ios', 'android', 'admin', 'system')),
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index consent_records_user_type_idx on public.consent_records (user_id, consent_type, created_at desc);

create or replace view public.current_consents with (security_invoker = true) as
  select distinct on (user_id, consent_type)
    user_id, consent_type, policy_version, granted, created_at
  from public.consent_records
  order by user_id, consent_type, created_at desc;

-- -----------------------------------------------------------------------------
-- Audit log: append-only record of sensitive and administrative actions.
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'admin', 'system', 'family')),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- Block updates/deletes on audit rows, including for the service role.
create or replace function public.audit_logs_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- -----------------------------------------------------------------------------
-- New auth user -> app_users row.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.app_users (id, phone, email, full_name)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Keep phone/email in sync when verified on the auth side.
create or replace function public.handle_auth_user_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.app_users
     set phone = new.phone, email = new.email
   where id = new.id
     and (phone is distinct from new.phone or email is distinct from new.email);
  return new;
end $$;

create trigger on_auth_user_updated
  after update of phone, email on auth.users
  for each row execute function public.handle_auth_user_updated();
