-- Templates were inserted with standard SQL strings, so '\n' was stored as a
-- literal backslash-n. Convert to real newlines (idempotent).
update public.notification_templates
   set body = replace(body, '\n', E'\n'),
       subject = replace(subject, '\n', E'\n')
 where body like '%\n%' or subject like '%\n%';
