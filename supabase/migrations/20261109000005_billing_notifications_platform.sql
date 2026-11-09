-- =============================================================================
-- 0005 BILLING, NOTIFICATIONS, PLATFORM CONFIGURATION, SUPPORT, PRIVACY OPS
-- Money is stored in paise (integer) to avoid floating point errors.
-- =============================================================================

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tagline text,
  description text,
  sort_order smallint not null default 0,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

create table public.plan_prices (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  interval text not null check (interval in ('month', 'quarter', 'half_year', 'year')),
  amount_paise int not null check (amount_paise >= 0), -- GST-inclusive list price
  currency text not null default 'INR',
  razorpay_plan_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (plan_id, interval)
);

-- Entitlement values: bool / int / text, interpreted by packages/shared entitlements.
create table public.plan_entitlements (
  plan_id uuid not null references public.plans (id) on delete cascade,
  key text not null,
  value jsonb not null,
  primary key (plan_id, key)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  price_id uuid references public.plan_prices (id),
  status text not null default 'created' check (status in ('created', 'active', 'past_due', 'cancelled', 'expired', 'halted')),
  razorpay_subscription_id text unique,
  razorpay_order_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  auto_renew boolean not null default false,
  granted_by_admin uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, status, current_period_end desc);
create trigger subscriptions_updated before update on public.subscriptions
  for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code extensions.citext not null unique,
  description text,
  discount_type text not null check (discount_type in ('percent', 'flat')),
  discount_value int not null check (discount_value > 0), -- percent (1-100) or paise
  max_redemptions int,
  per_user_limit int not null default 1,
  redeemed_count int not null default 0,
  plan_codes text[] not null default '{}', -- empty = all plans
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete restrict,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  plan_id uuid references public.plans (id),
  price_id uuid references public.plan_prices (id),
  coupon_id uuid references public.coupons (id),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  list_amount_paise int not null,
  discount_paise int not null default 0,
  amount_paise int not null,            -- charged, GST-inclusive
  taxable_paise int not null,
  gst_paise int not null,
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')),
  method text,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create index payments_status_idx on public.payments (status, created_at desc);
create trigger payments_updated before update on public.payments
  for each row execute function public.set_updated_at();

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  payment_id uuid references public.payments (id) on delete set null,
  created_at timestamptz not null default now()
);
create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- GST invoices: sequential numbering per financial year.
create table public.invoice_counters (
  financial_year text primary key, -- e.g. '2026-27'
  last_number int not null default 0
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  payment_id uuid not null unique references public.payments (id) on delete restrict,
  user_id uuid not null references public.app_users (id) on delete restrict,
  billing_name text not null,
  billing_email text,
  billing_phone text,
  billing_state text,             -- place of supply
  customer_gstin text,
  seller_gstin text,
  seller_state text,
  hsn_sac text not null default '998439',
  taxable_paise int not null,
  cgst_paise int not null default 0,
  sgst_paise int not null default 0,
  igst_paise int not null default 0,
  total_paise int not null,
  line_items jsonb not null,
  issued_at timestamptz not null default now()
);
create index invoices_user_idx on public.invoices (user_id, issued_at desc);

create or replace function public.next_invoice_number(p_fy text)
returns text language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.invoice_counters (financial_year, last_number) values (p_fy, 1)
  on conflict (financial_year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v;
  return 'INV/' || p_fy || '/' || lpad(v::text, 6, '0');
end $$;
revoke all on function public.next_invoice_number(text) from public, anon, authenticated;

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),
  reason text not null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'rejected', 'processing', 'processed', 'failed')),
  razorpay_refund_id text unique,
  requested_by uuid references auth.users (id),
  approved_by uuid references auth.users (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger refunds_updated before update on public.refunds
  for each row execute function public.set_updated_at();

create table public.payment_webhook_events (
  id text primary key,          -- provider event id (idempotency)
  provider text not null default 'razorpay',
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

-- Usage counters for entitlement limits (interests/day, AI calls/day, ...) ----
create table public.usage_counters (
  user_id uuid not null references public.app_users (id) on delete cascade,
  key text not null,
  period_start date not null,
  count int not null default 0,
  primary key (user_id, key, period_start)
);

create or replace function public.increment_usage(p_user uuid, p_key text, p_period date, p_limit int)
returns int language plpgsql security definer set search_path = '' as $$
declare v int;
begin
  insert into public.usage_counters (user_id, key, period_start, count) values (p_user, p_key, p_period, 1)
  on conflict (user_id, key, period_start) do update set count = public.usage_counters.count + 1
  where p_limit is null or public.usage_counters.count < p_limit
  returning count into v;
  return v; -- null when the limit was already reached
end $$;
revoke all on function public.increment_usage(uuid, text, date, int) from public, anon, authenticated;

-- Notifications ---------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table public.notification_preferences (
  user_id uuid not null references public.app_users (id) on delete cascade,
  category text not null check (category in ('interests', 'connections', 'messages', 'recommendations', 'verification', 'billing', 'family', 'product_updates', 'security')),
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push', 'whatsapp')),
  enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, category, channel)
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push', 'whatsapp')),
  locale text not null default 'en',
  subject text,
  body text not null,
  provider_template_id text, -- e.g. DLT template id (SMS), WhatsApp approved template name
  is_active boolean not null default true,
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  unique (key, channel, locale)
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete cascade,
  user_id uuid not null references public.app_users (id) on delete cascade,
  channel text not null,
  template_key text,
  status text not null check (status in ('queued', 'sent', 'failed', 'skipped_preference', 'skipped_unconfigured')),
  provider text,
  provider_message_id text,
  error text,
  created_at timestamptz not null default now()
);
create index notification_deliveries_idx on public.notification_deliveries (created_at desc);

-- Platform configuration -----------------------------------------------------
create table public.feature_flags (
  key text primary key,
  description text not null,
  enabled boolean not null default false,
  rollout_percent smallint not null default 100 check (rollout_percent between 0 and 100),
  audience jsonb not null default '{}'::jsonb, -- e.g. {"plans":["premium"],"regions":["IN-KA"]}
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.platform_settings (
  key text primary key,
  value jsonb not null,
  description text,
  is_public boolean not null default false, -- exposed to clients via /api/v1/config
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create table public.regions (
  code text primary key,           -- ISO 3166-2 style, e.g. IN-KA, or country code
  name text not null,
  country_code text not null,
  is_enabled boolean not null default true,
  matching_config_region text not null default 'default'
);

create table public.languages (
  code text primary key,
  name text not null,
  native_name text not null,
  is_enabled boolean not null default false,
  ai_supported boolean not null default false,
  sort_order smallint not null default 0
);

-- Configurable onboarding questions (super admin manages) --------------------
create table public.onboarding_questions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  section text not null check (section in ('basics', 'education', 'career', 'family', 'lifestyle', 'values', 'dna', 'preferences')),
  prompt text not null,
  help_text text,
  input_type text not null check (input_type in ('single_select', 'multi_select', 'text', 'long_text', 'number', 'scale', 'date', 'tags')),
  options jsonb not null default '[]'::jsonb,
  maps_to text,          -- e.g. 'profile_values.communication_style' or 'dna:communication'
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  translations jsonb not null default '{}'::jsonb, -- {"ta": {"prompt": "...", "options": {...}}}
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);
create index onboarding_questions_section_idx on public.onboarding_questions (section, sort_order) where is_active;

-- CMS (landing FAQs, success stories with consent, legal pages) --------------
create table public.cms_entries (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('faq', 'success_story', 'legal', 'announcement', 'help_article')),
  slug text not null,
  locale text not null default 'en',
  title text not null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  is_published boolean not null default false,
  sort_order int not null default 0,
  consent_reference text, -- success stories must reference recorded consent
  updated_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  unique (kind, slug, locale)
);

-- Support ---------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users (id) on delete set null,
  contact_email text,
  category text not null check (category in ('account', 'billing', 'verification', 'safety', 'technical', 'feedback', 'other')),
  subject text not null check (char_length(subject) <= 200),
  status text not null default 'open' check (status in ('open', 'pending_user', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index support_tickets_queue_idx on public.support_tickets (status, priority, created_at);
create trigger support_tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  is_staff boolean not null default false,
  is_internal_note boolean not null default false,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index support_messages_ticket_idx on public.support_messages (ticket_id, created_at);

-- Privacy operations (DPDP) ---------------------------------------------------
create table public.data_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users (id) on delete cascade,
  kind text not null check (kind in ('export', 'deletion', 'correction')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'cancelled', 'failed')),
  scheduled_for timestamptz,   -- deletion grace period end
  result_path text,            -- export archive in storage
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create index data_requests_idx on public.data_requests (status, kind, scheduled_for);

-- Product analytics events (first-party, minimal PII) ------------------------
create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid references public.app_users (id) on delete set null,
  event text not null,
  properties jsonb not null default '{}'::jsonb,
  platform text check (platform in ('web', 'ios', 'android', 'server')),
  created_at timestamptz not null default now()
);
create index analytics_events_event_idx on public.analytics_events (event, created_at desc);
create index analytics_events_created_idx on public.analytics_events (created_at desc);
