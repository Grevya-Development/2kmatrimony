-- =============================================================================
-- 0400 ADMIN ANALYTICS FUNCTIONS (Workstream D) — service-role only.
-- Aggregations run in SQL so admin dashboards stay fast.
-- =============================================================================

-- Headline metrics for a period [p_from, p_to).
create or replace function public.admin_overview_metrics(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with
  paid_users as (
    select count(distinct s.user_id) as n from subscriptions s
    where s.status = 'active' and s.current_period_end > p_to - interval '1 second'
      and s.current_period_start < p_to
  ),
  active7 as (select count(*) n from app_users where status = 'active' and last_active_at >= p_to - interval '7 days' and last_active_at < p_to),
  active30 as (select count(*) n from app_users where status = 'active' and last_active_at >= p_to - interval '30 days' and last_active_at < p_to),
  gross as (
    select coalesce(sum(amount_paise), 0) as paise from payments
    where status in ('captured', 'refunded', 'partially_refunded') and paid_at >= p_from and paid_at < p_to
  ),
  refunded as (
    select coalesce(sum(amount_paise), 0) as paise from refunds
    where status = 'processed' and updated_at >= p_from and updated_at < p_to
  ),
  subs_start as (
    select count(*) n from subscriptions
    where current_period_start < p_from and (current_period_end is null or current_period_end >= p_from)
      and status in ('active', 'cancelled', 'expired', 'past_due', 'halted')
  ),
  churned as (
    select count(*) n from subscriptions
    where (status in ('expired', 'cancelled', 'halted'))
      and coalesce(cancelled_at, current_period_end) >= p_from and coalesce(cancelled_at, current_period_end) < p_to
  ),
  cohort as (
    select count(*) as total,
           count(*) filter (where last_active_at >= p_to - interval '7 days') as retained
    from app_users
    where created_at >= p_to - interval '37 days' and created_at < p_to - interval '30 days'
  )
  select jsonb_build_object(
    'totalUsers', (select count(*) from app_users where status <> 'deleted' and created_at < p_to),
    'activeUsers7d', (select n from active7),
    'activeUsers30d', (select n from active30),
    'newRegistrations', (select count(*) from app_users where created_at >= p_from and created_at < p_to),
    'activeProfiles', (select count(*) from profiles where status = 'active'),
    'verifiedProfiles', (select count(*) from profiles where is_identity_verified),
    'pendingVerifications', (select count(*) from verifications where status in ('pending', 'in_review')),
    'recommendations', (select count(*) from recommendations where created_at >= p_from and created_at < p_to),
    'mutualInterests', (select count(*) from interests where status = 'accepted' and responded_at >= p_from and responded_at < p_to),
    'interestsSent', (select count(*) from interests where created_at >= p_from and created_at < p_to),
    'connections', (select count(*) from connections where created_at >= p_from and created_at < p_to),
    'revenuePaise', (select paise from gross) - (select paise from refunded),
    'grossRevenuePaise', (select paise from gross),
    'refundedPaise', (select paise from refunded),
    'paidUsers', (select n from paid_users),
    'conversionRate', case when (select n from active30) = 0 then 0
                           else round((select n from paid_users)::numeric / (select n from active30), 4) end,
    'retention30d', case when (select total from cohort) = 0 then null
                         else round((select retained from cohort)::numeric / (select total from cohort), 4) end,
    'churnRate', case when (select n from subs_start) = 0 then 0
                      else round((select n from churned)::numeric / (select n from subs_start), 4) end,
    'openReports', (select count(*) from reports where status in ('open', 'in_review')),
    'openTickets', (select count(*) from support_tickets where status in ('open', 'pending_user'))
  );
$$;

-- Daily time series for a named metric.
create or replace function public.admin_timeseries(p_metric text, p_from timestamptz, p_to timestamptz)
returns table (day date, value numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  return query
  with days as (
    select generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day')::date as d
  ),
  vals as (
    select date_trunc('day', ts)::date as d, sum(v)::numeric as v from (
      select created_at as ts, 1 as v from app_users where p_metric = 'signups' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from profiles where p_metric = 'profiles' and created_at >= p_from and created_at < p_to
      union all select activated_at, 1 from profiles where p_metric = 'activations' and activated_at >= p_from and activated_at < p_to
      union all select paid_at, amount_paise from payments where p_metric = 'revenue' and status in ('captured','refunded','partially_refunded') and paid_at >= p_from and paid_at < p_to
      union all select created_at, 1 from interests where p_metric = 'interests' and created_at >= p_from and created_at < p_to
      union all select responded_at, 1 from interests where p_metric = 'accepted_interests' and status = 'accepted' and responded_at >= p_from and responded_at < p_to
      union all select created_at, 1 from connections where p_metric = 'connections' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from messages where p_metric = 'messages' and kind <> 'system' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from recommendations where p_metric = 'recommendations' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from ai_usage_logs where p_metric = 'ai_requests' and created_at >= p_from and created_at < p_to
      union all select created_at, cost_usd_micros from ai_usage_logs where p_metric = 'ai_cost' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from reports where p_metric = 'reports' and created_at >= p_from and created_at < p_to
      union all select created_at, 1 from analytics_events where p_metric = 'searches' and event in ('search', 'smart_search') and created_at >= p_from and created_at < p_to
    ) x group by 1
  )
  select days.d, coalesce(vals.v, 0) from days left join vals on vals.d = days.d order by days.d;
end $$;

-- Daily active users from distinct message senders / analytics events (best available signal).
create or replace function public.admin_engagement(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  with acts as (
    select sender_user_id as uid, created_at from messages where created_at >= p_from and created_at < p_to and sender_user_id is not null
    union all select user_id, created_at from analytics_events where created_at >= p_from and created_at < p_to and user_id is not null
    union all select user_id, created_at from ai_usage_logs where created_at >= p_from and created_at < p_to and user_id is not null
  ), daily as (
    select date_trunc('day', created_at)::date d, count(distinct uid) n from acts group by 1
  )
  select jsonb_build_object(
    'avgDau', coalesce((select round(avg(n), 1) from daily), 0),
    'wau', (select count(distinct uid) from acts where created_at >= p_to - interval '7 days'),
    'mau', (select count(distinct uid) from acts where created_at >= p_to - interval '30 days'),
    'messagesPerDay', coalesce((select round(count(*)::numeric / greatest(1, extract(day from (p_to - p_from))), 1) from messages where created_at >= p_from and created_at < p_to and kind <> 'system'), 0),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d, 'value', n) order by d) from daily), '[]'::jsonb)
  );
$$;

-- Onboarding funnel for users who signed up in the range.
create or replace function public.admin_onboarding_funnel(p_from timestamptz, p_to timestamptz)
returns table (step text, step_order int, users bigint)
language sql stable security definer set search_path = public as $$
  with cohort as (select id from app_users where created_at >= p_from and created_at < p_to),
  p as (select pr.* from profiles pr join cohort c on c.id = pr.owner_user_id)
  select * from (values
    ('Signed up', 1, (select count(*) from cohort)),
    ('Profile started', 2, (select count(*) from p)),
    ('Basics completed', 3, (select count(*) from p where first_name is not null and date_of_birth is not null and gender is not null)),
    ('Values answered', 4, (select count(*) from p where exists (select 1 from profile_values v where v.profile_id = p.id and v.children_preference is not null))),
    ('Relationship DNA', 5, (select count(*) from p where (select count(*) from relationship_dna d where d.profile_id = p.id) >= 7)),
    ('Preferences set', 6, (select count(*) from p where exists (select 1 from partner_preferences pp where pp.profile_id = p.id and array_length(pp.seeking_genders, 1) > 0))),
    ('Photo added', 7, (select count(*) from p where exists (select 1 from profile_photos ph where ph.profile_id = p.id))),
    ('Active', 8, (select count(*) from p where status = 'active'))
  ) as t(step, step_order, users);
$$;

create or replace function public.admin_completion_distribution()
returns table (bucket int, profiles bigint)
language sql stable security definer set search_path = public as $$
  select b * 10 as bucket, count(p.id)
  from generate_series(0, 10) b
  left join profiles p on least(p.completion_pct / 10, 10) = b and p.status <> 'deleted'
  group by b order by b;
$$;

-- Matching intelligence ---------------------------------------------------------
create or replace function public.admin_matching_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'histogram', (select coalesce(jsonb_agg(jsonb_build_object('bucket', b * 10, 'count', n) order by b), '[]'::jsonb)
                  from (select g as b, count(ms.mutual) n from generate_series(0, 9) g
                        left join match_scores ms on least(ms.mutual / 10, 9) = g group by g) h),
    'pairsScored', (select count(*) from match_scores),
    'avgMutual', (select round(avg(mutual), 1) from match_scores),
    'avgConfidence', (select round(avg(confidence), 1) from match_scores),
    'recommendations', (select jsonb_build_object(
        'total', count(*),
        'viewed', count(*) filter (where status <> 'new'),
        'interested', count(*) filter (where status = 'interested'),
        'shortlisted', count(*) filter (where status = 'shortlisted'),
        'passed', count(*) filter (where status = 'passed'),
        'avgScore', round(avg(score), 1))
      from recommendations where created_at >= p_from and created_at < p_to),
    'interests', (select jsonb_build_object(
        'sent', count(*),
        'accepted', count(*) filter (where status = 'accepted'),
        'declined', count(*) filter (where status = 'declined'),
        'pending', count(*) filter (where status = 'pending'),
        'expired', count(*) filter (where status = 'expired'))
      from interests where created_at >= p_from and created_at < p_to),
    'feedback', (select coalesce(jsonb_agg(jsonb_build_object('reason', coalesce(reason, 'unspecified'), 'positive', pos, 'negative', neg, 'neutral', neu)), '[]'::jsonb)
                 from (select reason, count(*) filter (where rating = 1) pos, count(*) filter (where rating = -1) neg, count(*) filter (where rating = 0) neu
                       from match_feedback where created_at >= p_from and created_at < p_to group by reason) f),
    'dimensions', (select coalesce(jsonb_object_agg(k, avg_v), '{}'::jsonb) from (
        select k, round(avg((v ->> 'mutual')::numeric), 1) avg_v
        from match_scores, jsonb_each(dimensions) as e(k, v)
        where v ->> 'mutual' is not null group by k) d)
  );
$$;

-- AI operations -----------------------------------------------------------------
create or replace function public.admin_ai_usage(p_from timestamptz, p_to timestamptz)
returns table (feature text, provider text, model text, requests bigint, errors bigint, refusals bigint,
               input_tokens bigint, output_tokens bigint, cache_read_tokens bigint, cache_write_tokens bigint,
               cost_usd_micros bigint, p50_latency_ms int, p95_latency_ms int)
language sql stable security definer set search_path = public as $$
  select feature, provider, model, count(*),
         count(*) filter (where status = 'error'),
         count(*) filter (where status = 'refused'),
         coalesce(sum(input_tokens), 0)::bigint, coalesce(sum(output_tokens), 0)::bigint,
         coalesce(sum(cache_read_tokens), 0)::bigint, coalesce(sum(cache_write_tokens), 0)::bigint,
         coalesce(sum(cost_usd_micros), 0)::bigint,
         (percentile_cont(0.5) within group (order by latency_ms))::int,
         (percentile_cont(0.95) within group (order by latency_ms))::int
  from ai_usage_logs
  where created_at >= p_from and created_at < p_to
  group by feature, provider, model
  order by count(*) desc;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_overview_metrics(timestamptz, timestamptz)',
    'admin_timeseries(text, timestamptz, timestamptz)',
    'admin_engagement(timestamptz, timestamptz)',
    'admin_onboarding_funnel(timestamptz, timestamptz)',
    'admin_completion_distribution()',
    'admin_matching_stats(timestamptz, timestamptz)',
    'admin_ai_usage(timestamptz, timestamptz)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- Support / moderation notification templates ------------------------------------
insert into public.notification_templates (key, channel, subject, body) values
  ('support_reply', 'in_app', null, 'Our support team replied to “{{subject}}”.'),
  ('support_reply', 'email', 'Reply to your support request', 'Hello {{name}},\n\nOur team replied to your request “{{subject}}”. Open Help & support to read and respond.'),
  ('moderation_warning', 'in_app', null, 'A notice from our Trust & Safety team: {{reason}}'),
  ('moderation_media_removed', 'in_app', null, 'One of your {{kind}}s was not approved: {{reason}}'),
  ('admin_broadcast', 'in_app', '{{title}}', '{{body}}')
on conflict (key, channel, locale) do nothing;
