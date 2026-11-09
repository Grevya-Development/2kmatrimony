-- Notification shown when a verified badge is withdrawn because the verified
-- details changed (audit M4).
insert into public.notification_templates (key, channel, subject, body) values
  ('verification_expired', 'in_app', null, 'Your {{kind}} verification needs renewing: {{reason}}'),
  ('verification_expired', 'email', 'Please re-verify your {{kind}}', E'Hello {{name}},\n\n{{reason}} To keep the verified badge, please verify again from your verification page.')
on conflict (key, channel, locale) do nothing;
