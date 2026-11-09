-- Workstream C: notification templates for family collaboration (config only).
insert into public.notification_templates (key, channel, subject, body) values
  ('family_suggestion', 'in_app', null, '{{memberName}} suggested a profile for you to consider.'),
  ('family_suggestion', 'push', 'A family suggestion', '{{memberName}} suggested a profile for you to consider.'),
  ('family_invite_accepted', 'in_app', null, '{{memberName}} joined your family circle.'),
  ('family_invite_accepted', 'push', 'Family invitation accepted', '{{memberName}} joined your family circle.')
on conflict (key, channel, locale) do nothing;
