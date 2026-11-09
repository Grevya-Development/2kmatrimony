-- LOCAL PERFORMANCE FIXTURE ONLY (emails end with @perf.test). Never run in production.
do $$
declare i int; uid uuid; pid uuid;
  cities text[] := array['Bengaluru','Chennai','Hyderabad','Mumbai','Pune','Kochi','Delhi','Mysuru'];
  interests text[] := array['Travel','Music','Reading','Hiking','Cooking','Yoga','Cricket','Movies','Photography','Startups'];
  dims text[] := array['emotional_connection','communication','family_orientation','independence','career_ambition','lifestyle_pace','financial_philosophy','long_term_aspirations','shared_interests','personal_values'];
  d text;
begin
  for i in 1..2000 loop
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', 'p' || i || '@perf.test', now(), now(), now(), '{}', '{}');
    insert into public.profiles (owner_user_id, first_name, date_of_birth, gender, height_cm, marital_status, current_city, current_country,
      about, core_values, personality_traits, status, visibility, activated_at, last_active_at, search_text)
    values (uid, 'Perf' || i, (current_date - ((24 + (i % 14)) * 365 + (i % 300)))::date, case when i % 2 = 0 then 'female' else 'male' end,
      150 + (i % 35), 'never_married', cities[1 + (i % 8)], 'IN',
      'Thoughtful, curious and family-oriented. Enjoys travel and good conversations.', array['honesty','family', case when i % 3 = 0 then 'growth' else 'kindness' end],
      array['calm','curious'], 'active', 'members', now(), now() - (i % 30) * interval '1 day',
      'thoughtful curious family travel ' || cities[1 + (i % 8)] || ' engineer')
    returning id into pid;
    insert into public.profile_education (profile_id, level, qualification, is_highest) values (pid, case when i % 3 = 0 then 'masters' else 'bachelors' end, 'B.E.', true);
    insert into public.profile_career (profile_id, profession, income_range, relocation_willingness) values (pid, 'Engineer', '10_15l', case when i % 4 = 0 then 'open' else 'within_country' end);
    insert into public.profile_family (profile_id, family_structure, family_values) values (pid, 'nuclear', case when i % 3 = 0 then 'traditional' else 'moderate' end);
    insert into public.profile_lifestyle (profile_id, diet, smoking, drinking, fitness, travel, interests)
      values (pid, case when i % 2 = 0 then 'vegetarian' else 'non_vegetarian' end, 'never', 'occasionally', 'regularly', 'frequently', array[interests[1 + (i % 10)], interests[1 + ((i + 3) % 10)]]);
    insert into public.profile_values (profile_id, children_preference, living_arrangement, settle_preference, communication_style, financial_philosophy, independence_level)
      values (pid, case when i % 5 = 0 then 'open' else 'want' end, 'independent', 'india_any', 'balanced', 'balanced', 'balanced');
    foreach d in array dims loop
      insert into public.relationship_dna (profile_id, dimension, self_score, importance) values (pid, d, 30 + (i * 7 + length(d)) % 50, 3);
    end loop;
    insert into public.partner_preferences (profile_id, seeking_genders, age_min, age_max)
      values (pid, array[case when i % 2 = 0 then 'male' else 'female' end], 23, 40);
  end loop;
end $$;
