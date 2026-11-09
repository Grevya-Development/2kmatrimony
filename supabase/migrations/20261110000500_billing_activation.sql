-- =============================================================================
-- 0500 BILLING ACTIVATION (Workstream E)
-- * Tax/billing columns on payments captured at checkout (copied to invoices).
-- * billing_activate_payment(): atomic, idempotent capture -> subscription ->
--   coupon redemption -> GST invoice. Safe against verify/webhook races because
--   the payment row is locked FOR UPDATE and re-checked.
-- * Notification templates for subscription expiry reminders.
-- =============================================================================

alter table public.payments
  add column if not exists interval text check (interval in ('month', 'quarter', 'half_year', 'year')),
  add column if not exists billing_name text,
  add column if not exists billing_email text,
  add column if not exists billing_phone text,
  add column if not exists billing_state text,
  add column if not exists customer_gstin text,
  add column if not exists cgst_paise int not null default 0,
  add column if not exists sgst_paise int not null default 0,
  add column if not exists igst_paise int not null default 0,
  add column if not exists refunded_paise int not null default 0;

alter table public.subscriptions
  add column if not exists reminder_7d_sent_at timestamptz,
  add column if not exists reminder_1d_sent_at timestamptz;

create index if not exists subscriptions_expiry_idx on public.subscriptions (status, current_period_end);

create or replace function public.billing_activate_payment(
  p_payment_id uuid,
  p_razorpay_payment_id text,
  p_method text,
  p_paid_at timestamptz default now()
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_pay public.payments%rowtype;
  v_plan public.plans%rowtype;
  v_months int;
  v_active public.subscriptions%rowtype;
  v_active_plan public.plans%rowtype;
  v_sub_id uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_invoice_id uuid;
  v_invoice_number text;
  v_now_ist timestamp := (now() at time zone 'Asia/Kolkata');
  v_fy text;
  v_settings jsonb;
begin
  select * into v_pay from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  -- Idempotent: already activated.
  if v_pay.status in ('captured', 'refunded', 'partially_refunded') and v_pay.subscription_id is not null then
    select id into v_invoice_id from public.invoices where payment_id = v_pay.id;
    return jsonb_build_object('already', true, 'subscription_id', v_pay.subscription_id, 'invoice_id', v_invoice_id);
  end if;

  select * into v_plan from public.plans where id = v_pay.plan_id;
  v_months := case v_pay.interval when 'month' then 1 when 'quarter' then 3 when 'half_year' then 6 when 'year' then 12 else null end;
  if v_plan.id is null or v_months is null then
    raise exception 'payment has no plan/interval' using errcode = 'P0001';
  end if;

  -- Current active subscription (if any).
  select s.* into v_active from public.subscriptions s
   where s.user_id = v_pay.user_id and s.status = 'active' and s.current_period_end > now()
   order by s.current_period_end desc limit 1 for update;

  if v_active.id is not null then
    select * into v_active_plan from public.plans where id = v_active.plan_id;
  end if;

  if v_active.id is not null and v_active.plan_id = v_plan.id then
    -- Same plan: extend from the current end.
    v_start := v_active.current_period_start;
    v_end := v_active.current_period_end + make_interval(months => v_months);
    update public.subscriptions
       set current_period_end = v_end, price_id = v_pay.price_id, cancel_at_period_end = false,
           reminder_7d_sent_at = null, reminder_1d_sent_at = null
     where id = v_active.id;
    v_sub_id := v_active.id;
  else
    -- New plan (upgrade or first purchase) starts now. An upgrade supersedes the old plan.
    if v_active.id is not null then
      update public.subscriptions set status = 'cancelled', cancelled_at = now() where id = v_active.id;
    end if;
    v_start := now();
    v_end := now() + make_interval(months => v_months);
    insert into public.subscriptions (user_id, plan_id, price_id, status, razorpay_order_id, current_period_start, current_period_end)
    values (v_pay.user_id, v_plan.id, v_pay.price_id, 'active', v_pay.razorpay_order_id, v_start, v_end)
    returning id into v_sub_id;
  end if;

  update public.payments
     set status = 'captured', razorpay_payment_id = coalesce(p_razorpay_payment_id, razorpay_payment_id),
         method = coalesce(p_method, method), paid_at = coalesce(p_paid_at, now()), subscription_id = v_sub_id,
         failure_reason = null
   where id = v_pay.id;

  if v_pay.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, payment_id) values (v_pay.coupon_id, v_pay.user_id, v_pay.id);
    update public.coupons set redeemed_count = redeemed_count + 1 where id = v_pay.coupon_id;
  end if;

  -- GST invoice (financial year April–March, India time).
  v_fy := case when extract(month from v_now_ist) >= 4
               then extract(year from v_now_ist)::int::text || '-' || lpad(((extract(year from v_now_ist)::int + 1) % 100)::text, 2, '0')
               else (extract(year from v_now_ist)::int - 1)::text || '-' || lpad((extract(year from v_now_ist)::int % 100)::text, 2, '0') end;
  v_invoice_number := public.next_invoice_number(v_fy);
  select value into v_settings from public.platform_settings where key = 'gst';

  insert into public.invoices (
    invoice_number, payment_id, user_id, billing_name, billing_email, billing_phone, billing_state, customer_gstin,
    seller_gstin, seller_state, hsn_sac, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise, line_items
  ) values (
    v_invoice_number, v_pay.id, v_pay.user_id, coalesce(nullif(v_pay.billing_name, ''), 'Member'), v_pay.billing_email,
    v_pay.billing_phone, v_pay.billing_state, v_pay.customer_gstin,
    v_settings ->> 'seller_gstin', coalesce(v_settings ->> 'seller_state', 'KA'), coalesce(v_settings ->> 'sac', '998439'),
    v_pay.taxable_paise, v_pay.cgst_paise, v_pay.sgst_paise, v_pay.igst_paise, v_pay.amount_paise,
    jsonb_build_array(jsonb_build_object(
      'description', v_plan.name || ' plan — ' || v_months || ' month' || case when v_months > 1 then 's' else '' end,
      'period_start', v_start, 'period_end', v_end,
      'list_paise', v_pay.list_amount_paise, 'discount_paise', v_pay.discount_paise,
      'taxable_paise', v_pay.taxable_paise, 'gst_paise', v_pay.gst_paise, 'total_paise', v_pay.amount_paise
    ))
  ) returning id into v_invoice_id;

  return jsonb_build_object('already', false, 'subscription_id', v_sub_id, 'invoice_id', v_invoice_id,
                            'invoice_number', v_invoice_number, 'period_end', v_end, 'plan_name', v_plan.name);
end $$;

revoke all on function public.billing_activate_payment(uuid, text, text, timestamptz) from public, anon, authenticated;

insert into public.notification_templates (key, channel, subject, body) values
  ('subscription_expiring', 'in_app', null, 'Your {{plan}} plan ends on {{until}}. Renew to keep your benefits.'),
  ('subscription_expiring', 'email', 'Your {{plan}} plan ends on {{until}}', 'Hello {{name}},\n\nYour {{plan}} plan ends on {{until}}. Renew any time from Plans & billing to keep your benefits.\n\n{{link}}'),
  ('subscription_expiring', 'push', 'Your plan ends soon', 'Your {{plan}} plan ends on {{until}}.'),
  ('subscription_expired', 'in_app', null, 'Your {{plan}} plan has ended. You are now on the Free plan.'),
  ('subscription_expired', 'email', 'Your {{plan}} plan has ended', 'Hello {{name}},\n\nYour {{plan}} plan has ended and your account is now on the Free plan. Your profile, connections and conversations are unchanged.\n\n{{link}}'),
  ('payment_failed', 'in_app', null, 'Your payment could not be completed. No amount was charged.'),
  ('refund_processed', 'in_app', null, 'Your refund of {{amount}} has been processed.'),
  ('refund_processed', 'email', 'Your refund has been processed', 'Hello {{name}},\n\nYour refund of {{amount}} has been processed. It usually reaches your account in 5–7 working days.')
on conflict (key, channel, locale) do nothing;
