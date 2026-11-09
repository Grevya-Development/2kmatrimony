-- Rebrand: the product name is "2K Marriage" (was "2K Matrimony").
update public.platform_settings
   set value = value || '{"name":"2K Marriage"}'::jsonb
 where key = 'brand';

update public.notification_templates
   set subject = replace(subject, '2K Matrimony', '2K Marriage'),
       body    = replace(body, '2K Matrimony', '2K Marriage')
 where subject like '%2K Matrimony%' or body like '%2K Matrimony%';
