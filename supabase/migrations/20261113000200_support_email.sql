-- Member-facing support contact (footer, FAQ, support pages).
update public.platform_settings
   set value = value || '{"support_email":"2kmatrimonysupport@gmail.com","tagline":"Hand-picked matches. A meaningful beginning."}'::jsonb
 where key = 'brand';
