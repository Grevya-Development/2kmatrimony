-- Product analytics (PostHog) is non-essential processing under the DPDP Act:
-- it runs only after explicit, revocable opt-in recorded as 'product_analytics'.
alter table public.consent_records drop constraint consent_records_consent_type_check;
alter table public.consent_records add constraint consent_records_consent_type_check check (consent_type in (
  'terms', 'privacy', 'ai_processing', 'ai_message_analysis', 'family_access',
  'marketing_email', 'marketing_sms', 'whatsapp', 'identity_verification', 'data_sharing_partner',
  'product_analytics'
));

update public.platform_settings
   set value = value || '{"product_analytics":"2026-11-12"}'::jsonb
 where key = 'policy_versions';

-- PostHog feature switch (kill switch independent of the env key).
insert into public.feature_flags (key, description, enabled)
values ('product_analytics', 'PostHog product analytics (only for members/visitors who opted in)', true)
on conflict (key) do nothing;
