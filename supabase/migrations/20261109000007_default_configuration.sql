-- =============================================================================
-- 0007 DEFAULT CONFIGURATION (ships to every environment)
-- Configuration only: roles, permissions, plans, onboarding questions, flags,
-- templates, AI model routing, matching weights. No user or sample data.
-- Everything here is editable from the Super Admin panel.
-- =============================================================================

-- Permissions -----------------------------------------------------------------
insert into public.admin_permissions (key, description, category) values
  ('users.read', 'View user accounts', 'users'),
  ('users.manage', 'Suspend, reactivate and delete accounts', 'users'),
  ('profiles.read', 'View member profiles', 'profiles'),
  ('profiles.moderate', 'Moderate photos, videos and profile text', 'profiles'),
  ('sensitive_data.read', 'View identity documents and contact details', 'profiles'),
  ('verification.review', 'Review verification submissions', 'trust'),
  ('reports.manage', 'Triage and resolve reports', 'trust'),
  ('moderation.act', 'Take enforcement actions', 'trust'),
  ('risk.review', 'Review automated risk signals', 'trust'),
  ('matching.read', 'View matchmaking intelligence', 'matching'),
  ('matching.configure', 'Change scoring weights and thresholds', 'matching'),
  ('matchmaker.curate', 'Create curated introductions (Elite)', 'matching'),
  ('ai.read', 'View AI operations dashboards', 'ai'),
  ('ai.configure', 'Change AI models, prompts and limits', 'ai'),
  ('subscriptions.read', 'View subscriptions', 'billing'),
  ('subscriptions.manage', 'Grant, extend or cancel subscriptions', 'billing'),
  ('payments.read', 'View payments and invoices', 'billing'),
  ('refunds.manage', 'Approve and process refunds', 'billing'),
  ('coupons.manage', 'Create and edit coupons', 'billing'),
  ('plans.manage', 'Edit plans, pricing and entitlements', 'billing'),
  ('support.read', 'View support tickets', 'support'),
  ('support.respond', 'Respond to support tickets', 'support'),
  ('cms.manage', 'Edit website content', 'content'),
  ('notifications.manage', 'Edit notification templates and send broadcasts', 'content'),
  ('analytics.read', 'View analytics', 'analytics'),
  ('analytics.export', 'Export analytics as CSV', 'analytics'),
  ('audit.read', 'View audit logs', 'platform'),
  ('settings.manage', 'Edit platform settings', 'platform'),
  ('feature_flags.manage', 'Toggle feature flags', 'platform'),
  ('onboarding.manage', 'Edit onboarding questions and registration fields', 'platform'),
  ('regions.manage', 'Edit regional availability and languages', 'platform'),
  ('admins.manage', 'Create and deactivate admin accounts', 'platform'),
  ('roles.manage', 'Edit roles and permissions', 'platform');

-- Roles -----------------------------------------------------------------------
insert into public.admin_roles (key, name, description, is_system) values
  ('super_admin', 'Super Admin', 'Full platform control. Implicitly holds every permission.', true),
  ('admin', 'Administrator', 'Day-to-day platform operations.', true),
  ('verification_admin', 'Verification Admin', 'Reviews identity, photo and employment verification.', true),
  ('moderator', 'Trust & Safety Moderator', 'Handles reports, moderation queues and risk signals.', true),
  ('support', 'Customer Support', 'Responds to members and reviews accounts.', true),
  ('finance', 'Finance Admin', 'Payments, invoices, refunds and coupons.', true),
  ('matchmaker', 'Matchmaker', 'Curates introductions for Elite members.', true),
  ('analyst', 'Analyst', 'Read-only analytics access.', true);

insert into public.admin_role_permissions (role_id, permission_key)
select r.id, p.key from public.admin_roles r
join (values
  ('admin', array['users.read','users.manage','profiles.read','profiles.moderate','verification.review','reports.manage','moderation.act','risk.review','matching.read','matching.configure','ai.read','subscriptions.read','subscriptions.manage','payments.read','support.read','support.respond','cms.manage','notifications.manage','analytics.read','analytics.export','audit.read','feature_flags.manage']),
  ('verification_admin', array['users.read','profiles.read','sensitive_data.read','verification.review']),
  ('moderator', array['users.read','profiles.read','profiles.moderate','reports.manage','moderation.act','risk.review']),
  ('support', array['users.read','profiles.read','support.read','support.respond','subscriptions.read','payments.read']),
  ('finance', array['users.read','subscriptions.read','subscriptions.manage','payments.read','refunds.manage','coupons.manage','analytics.read','analytics.export']),
  ('matchmaker', array['profiles.read','matching.read','matchmaker.curate']),
  ('analyst', array['analytics.read','analytics.export','matching.read','ai.read'])
) as m(role_key, perms) on m.role_key = r.key
cross join lateral unnest(m.perms) as p(key);

-- Matching weights (from product spec; tuned later against feedback) ----------
insert into public.matching_configs (version, region, weights, thresholds, notes, is_active) values (
  1, 'default',
  '{"values":20,"emotional":15,"personality":15,"future":15,"lifestyle":10,"family":10,"career":5,"location":5,"interests":5}',
  '{"min_recommend_mutual":55,"min_direction":45,"max_asymmetry":30,"daily_batch_size":12,"candidate_pool":400,"min_confidence":30}',
  'Initial weights from product specification.', true
);

-- Plans -------------------------------------------------------------------------
insert into public.plans (code, name, tagline, description, sort_order) values
  ('free', 'Free', 'Begin thoughtfully', 'Create your profile, explore matches and send a few interests.', 0),
  ('plus', 'Plus', 'Search with intent', 'Advanced filters, more interests and basic AI insights.', 1),
  ('premium', 'Premium', 'Matchmaking, elevated', 'Full AI matchmaking, compatibility briefings and expanded discovery.', 2),
  ('elite', 'Elite', 'Personally curated', 'Curated introductions and a dedicated human matchmaker.', 3);

insert into public.plan_prices (plan_id, interval, amount_paise)
select p.id, v.interval, v.amount from public.plans p
join (values
  ('plus', 'month', 99900), ('plus', 'quarter', 249900),
  ('premium', 'month', 199900), ('premium', 'quarter', 499900), ('premium', 'year', 1499900),
  ('elite', 'quarter', 999900), ('elite', 'half_year', 1799900)
) as v(code, interval, amount) on v.code = p.code;

insert into public.plan_entitlements (plan_id, key, value)
select p.id, e.key, e.value::jsonb from public.plans p
join (values
  ('free', 'interests_per_day', '3'), ('free', 'daily_recommendations', '5'), ('free', 'advanced_filters', 'false'),
  ('free', 'ai_insights', '"none"'), ('free', 'ai_matchmaker_messages_per_day', '3'), ('free', 'smart_search_per_day', '3'),
  ('free', 'see_who_viewed', 'false'), ('free', 'gap_analysis', 'false'), ('free', 'before_you_meet', 'false'),
  ('free', 'curated_introductions', 'false'), ('free', 'human_matchmaker', 'false'), ('free', 'priority_support', 'false'),
  ('plus', 'interests_per_day', '10'), ('plus', 'daily_recommendations', '10'), ('plus', 'advanced_filters', 'true'),
  ('plus', 'ai_insights', '"basic"'), ('plus', 'ai_matchmaker_messages_per_day', '15'), ('plus', 'smart_search_per_day', '20'),
  ('plus', 'see_who_viewed', 'true'), ('plus', 'gap_analysis', 'true'), ('plus', 'before_you_meet', 'false'),
  ('plus', 'curated_introductions', 'false'), ('plus', 'human_matchmaker', 'false'), ('plus', 'priority_support', 'false'),
  ('premium', 'interests_per_day', '30'), ('premium', 'daily_recommendations', '20'), ('premium', 'advanced_filters', 'true'),
  ('premium', 'ai_insights', '"full"'), ('premium', 'ai_matchmaker_messages_per_day', '60'), ('premium', 'smart_search_per_day', '100'),
  ('premium', 'see_who_viewed', 'true'), ('premium', 'gap_analysis', 'true'), ('premium', 'before_you_meet', 'true'),
  ('premium', 'curated_introductions', 'false'), ('premium', 'human_matchmaker', 'false'), ('premium', 'priority_support', 'true'),
  ('elite', 'interests_per_day', '50'), ('elite', 'daily_recommendations', '30'), ('elite', 'advanced_filters', 'true'),
  ('elite', 'ai_insights', '"full"'), ('elite', 'ai_matchmaker_messages_per_day', '200'), ('elite', 'smart_search_per_day', '300'),
  ('elite', 'see_who_viewed', 'true'), ('elite', 'gap_analysis', 'true'), ('elite', 'before_you_meet', 'true'),
  ('elite', 'curated_introductions', 'true'), ('elite', 'human_matchmaker', 'true'), ('elite', 'priority_support', 'true')
) as e(code, key, value) on e.code = p.code;

-- AI model routing ----------------------------------------------------------------
insert into public.ai_feature_configs (feature, provider, model, effort, max_tokens, prompt_key) values
  ('matchmaker_chat', 'anthropic', 'claude-opus-5-5', 'medium', 8000, 'matchmaker_chat'),
  ('smart_search', 'anthropic', 'claude-opus-5-5', 'low', 4000, 'smart_search'),
  ('match_explanation', 'anthropic', 'claude-opus-5-5', 'low', 4000, 'match_explanation'),
  ('gap_analysis', 'anthropic', 'claude-opus-5-5', 'medium', 8000, 'gap_analysis'),
  ('before_you_meet', 'anthropic', 'claude-opus-5-5', 'medium', 8000, 'before_you_meet'),
  ('readiness_assistant', 'anthropic', 'claude-opus-5-5', 'medium', 8000, 'readiness_assistant'),
  ('vision_board_themes', 'anthropic', 'claude-opus-5-5', 'low', 4000, 'vision_board_themes'),
  ('dna_interpretation', 'anthropic', 'claude-opus-5-5', 'low', 4000, 'dna_interpretation'),
  ('conversation_starters', 'anthropic', 'claude-opus-5-5', 'low', 3000, 'conversation_starters'),
  ('moderation', 'anthropic', 'claude-opus-5-5', 'low', 2000, 'moderation'),
  ('embeddings', 'voyage', 'voyage-3.5', null, 0, null);

-- Feature flags -------------------------------------------------------------------
insert into public.feature_flags (key, description, enabled) values
  ('ai_matchmaker', 'Conversational AI matchmaker', true),
  ('smart_search', 'Natural-language semantic search', true),
  ('ai_explanations', 'AI-written match explanations (falls back to engine text)', true),
  ('gap_analysis', 'Compatibility Gap Analysis for connections', true),
  ('before_you_meet', 'Before You Meet briefing', true),
  ('readiness_assistant', 'Marriage Readiness Assistant', true),
  ('vision_board', 'Couple Vision Board', true),
  ('compatibility_journal', 'Compatibility Evolution journal', true),
  ('family_mode', 'Family collaboration', true),
  ('video_intros', 'Video introductions', true),
  ('voice_input', 'Voice input for the AI matchmaker', false),
  ('whatsapp_notifications', 'WhatsApp notifications (requires approved templates)', false),
  ('payments', 'Paid subscriptions via Razorpay', true),
  ('require_admin_mfa', 'Require MFA (AAL2) for admin panel access', true),
  ('chat_images', 'Image sharing in messages', true);

-- Platform settings -------------------------------------------------------------
insert into public.platform_settings (key, value, description, is_public) values
  ('brand', '{"name":"2K Matrimony","tagline":"More Than a Match. A Meaningful Beginning.","support_email":"support@example.com"}', 'Brand and support contact', true),
  ('policy_versions', '{"terms":"2026-11-01","privacy":"2026-11-01","ai_processing":"2026-11-01"}', 'Current legal policy versions; bump to re-prompt consent', true),
  ('limits', '{"min_age":18,"max_photos":6,"video_min_seconds":15,"video_max_seconds":60,"about_max_chars":2000}', 'Profile limits', true),
  ('interests', '{"expiry_days":30,"message_max_chars":500}', 'Interest lifecycle', true),
  ('privacy', '{"deletion_grace_days":14,"export_link_hours":24}', 'Privacy operations', true),
  ('gst', '{"rate_bps":1800,"seller_gstin":null,"seller_state":"KA","seller_legal_name":null,"seller_address":null,"sac":"998439"}', 'GST invoicing configuration (fill in before going live)', false),
  ('safety', '{"max_interests_per_hour":20,"max_messages_per_minute":20,"duplicate_device_threshold":3}', 'Trust & safety thresholds', false);

-- Languages & regions ------------------------------------------------------------
insert into public.languages (code, name, native_name, is_enabled, ai_supported, sort_order) values
  ('en', 'English', 'English', true, true, 0),
  ('hi', 'Hindi', 'हिन्दी', false, true, 1),
  ('ta', 'Tamil', 'தமிழ்', false, true, 2),
  ('te', 'Telugu', 'తెలుగు', false, true, 3),
  ('kn', 'Kannada', 'ಕನ್ನಡ', false, true, 4),
  ('ml', 'Malayalam', 'മലയാളം', false, true, 5);

insert into public.regions (code, name, country_code) values
  ('IN', 'India', 'IN'),
  ('IN-KA', 'Karnataka', 'IN'), ('IN-TN', 'Tamil Nadu', 'IN'), ('IN-KL', 'Kerala', 'IN'),
  ('IN-AP', 'Andhra Pradesh', 'IN'), ('IN-TG', 'Telangana', 'IN'), ('IN-MH', 'Maharashtra', 'IN'),
  ('IN-DL', 'Delhi', 'IN'), ('IN-GJ', 'Gujarat', 'IN'), ('IN-WB', 'West Bengal', 'IN'), ('IN-UP', 'Uttar Pradesh', 'IN');

-- Notification templates (English; translations added via admin) ----------------
insert into public.notification_templates (key, channel, subject, body) values
  ('interest_received', 'in_app', null, '{{senderName}} expressed interest in your profile.'),
  ('interest_received', 'push', 'New interest', '{{senderName}} expressed interest in your profile.'),
  ('interest_received', 'email', 'Someone is interested in getting to know you', 'Hello {{name}},\n\n{{senderName}} expressed interest in your profile. Review their profile and respond when you are ready.\n\n{{link}}'),
  ('interest_accepted', 'in_app', null, '{{receiverName}} accepted your interest. You are now connected.'),
  ('interest_accepted', 'push', 'You have a new connection', '{{receiverName}} accepted your interest.'),
  ('interest_accepted', 'email', 'You have a new connection', 'Hello {{name}},\n\n{{receiverName}} accepted your interest. You can now start a conversation.\n\n{{link}}'),
  ('new_message', 'push', 'New message', '{{senderName}}: {{preview}}'),
  ('new_message', 'in_app', null, 'New message from {{senderName}}'),
  ('new_recommendations', 'in_app', null, 'Your new matches for today are ready.'),
  ('new_recommendations', 'push', 'Your matches are ready', 'We found new people who align with what matters to you.'),
  ('verification_approved', 'in_app', null, 'Your {{kind}} verification was approved.'),
  ('verification_approved', 'email', 'Verification approved', 'Hello {{name}},\n\nYour {{kind}} verification was approved.'),
  ('verification_rejected', 'in_app', null, 'Your {{kind}} verification needs attention: {{reason}}'),
  ('verification_rejected', 'email', 'Verification needs attention', 'Hello {{name}},\n\nWe could not approve your {{kind}} verification: {{reason}}\n\nYou can resubmit from your verification page.'),
  ('subscription_activated', 'in_app', null, 'Your {{plan}} plan is active until {{until}}.'),
  ('subscription_activated', 'email', 'Your {{plan}} plan is active', 'Hello {{name}},\n\nThank you. Your {{plan}} plan is active until {{until}}. Your GST invoice {{invoiceNumber}} is available in Billing.'),
  ('payment_failed', 'email', 'Payment unsuccessful', 'Hello {{name}},\n\nYour payment could not be completed. No amount was charged, or any deducted amount will be refunded by your bank.'),
  ('family_invite', 'email', '{{ownerName}} invited you to help with their matrimony search', 'Hello,\n\n{{ownerName}} invited you to collaborate on their profile as {{relation}}.\n\nAccept the invitation: {{link}}'),
  ('family_invite', 'sms', null, '{{ownerName}} invited you to help with their 2K Matrimony search: {{link}}'),
  ('security_new_device', 'email', 'New sign-in to your account', 'Hello {{name}},\n\nYour account was accessed from a new device ({{device}}). If this was not you, sign out all devices from Settings.'),
  ('account_deletion_scheduled', 'email', 'Account deletion scheduled', 'Hello {{name}},\n\nYour account will be permanently deleted on {{date}}. Sign in before then to cancel.'),
  ('data_export_ready', 'email', 'Your data export is ready', 'Hello {{name}},\n\nYour data export is ready to download for the next {{hours}} hours: {{link}}');

-- FAQs ---------------------------------------------------------------------------
insert into public.cms_entries (kind, slug, title, body, is_published, sort_order) values
  ('faq', 'how-matching-works', 'How does the matchmaking work?', 'We compare what you each told us — values, lifestyle, family expectations, future plans and interests — in both directions. A match is only recommended when you fit each other''s preferences, not just one person''s. Every recommendation explains why it was suggested and where you differ.', true, 1),
  ('faq', 'is-it-scientific', 'Is the compatibility score a prediction?', 'No. Compatibility reflects how well your stated preferences align today. It does not predict relationship success, and it is not a personality diagnosis. You can see and edit everything it is based on.', true, 2),
  ('faq', 'who-sees-my-profile', 'Who can see my profile and photos?', 'Only signed-in members can see profiles, and you choose whether photos, income and other sensitive details are visible to all members, only connections, or nobody. Identity documents are never shown to members.', true, 3),
  ('faq', 'verification', 'What does "Verified" mean?', 'Verified badges confirm specific checks — phone, email, photo, government ID or employment — reviewed by our team or a compliant provider. Other profile details are the member''s own statements and are labelled as such.', true, 4),
  ('faq', 'family', 'Can my parents help?', 'Yes. You can invite family members with specific permissions such as viewing suggested profiles or shortlisting. You always stay in control of interests, connections and conversations.', true, 5),
  ('faq', 'ai-messages', 'Does the AI read my messages?', 'No. AI never reads your private conversations unless you explicitly turn on a specific feature that asks for it, and it never sends messages on your behalf.', true, 6),
  ('faq', 'delete-account', 'Can I delete my data?', 'Yes. You can download a copy of your data or delete your account at any time from Settings. Deletion is completed after a short grace period during which you can change your mind.', true, 7);
