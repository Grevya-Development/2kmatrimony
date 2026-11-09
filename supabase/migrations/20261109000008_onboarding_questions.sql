-- =============================================================================
-- 0008 DEFAULT ONBOARDING QUESTION BANK (values, Relationship DNA, future vision)
-- Structured basics (name, DOB, education...) are fixed form steps; these
-- conversational questions are configurable by Super Admins.
-- maps_to:  'dna:<dimension>'            -> relationship_dna row (scale 0-100)
--           '<table>.<column>'           -> direct profile section column
-- Scale options: {"left": "...", "right": "..."}
-- Select options: [{"value": "...", "label": "..."}]
-- =============================================================================

insert into public.onboarding_questions (key, section, prompt, help_text, input_type, options, maps_to, is_required, sort_order) values
-- Relationship DNA ------------------------------------------------------------
('dna_emotional_connection', 'dna', 'How do you most naturally share care and closeness?', 'There is no right answer — this helps us find someone whose emotional rhythm feels natural with yours.', 'scale',
  '{"left":"Quiet support and thoughtful actions","right":"Frequent words, affection and deep conversations"}', 'dna:emotional_connection', true, 10),
('dna_communication', 'dna', 'In a relationship, how often do you like to stay in touch?', null, 'scale',
  '{"left":"Give each other space; talk when it matters","right":"Stay connected throughout the day"}', 'dna:communication', true, 20),
('dna_family_orientation', 'dna', 'How central is extended family to your everyday life?', null, 'scale',
  '{"left":"Our own household comes first","right":"Extended family is part of daily life"}', 'dna:family_orientation', true, 30),
('dna_independence', 'dna', 'How much individual time and independence do you value in a marriage?', null, 'scale',
  '{"left":"Plenty of individual time and pursuits","right":"Doing most things together"}', 'dna:independence', true, 40),
('dna_career_ambition', 'dna', 'Where does career sit among your priorities?', null, 'scale',
  '{"left":"Career supports life; balance comes first","right":"Career is a central, driving priority"}', 'dna:career_ambition', true, 50),
('dna_lifestyle_pace', 'dna', 'What pace of life feels like home to you?', null, 'scale',
  '{"left":"Calm, home-centred routines","right":"Active, social and always exploring"}', 'dna:lifestyle_pace', true, 60),
('dna_financial_philosophy', 'dna', 'How do you think about money day to day?', null, 'scale',
  '{"left":"Security first — save and plan ahead","right":"Enjoy today — invest in experiences"}', 'dna:financial_philosophy', true, 70),
('dna_long_term_aspirations', 'dna', 'How do you picture the next ten years?', null, 'scale',
  '{"left":"Settled, rooted and steady","right":"Ambitious, evolving, open to big moves"}', 'dna:long_term_aspirations', true, 80),
('dna_shared_interests', 'dna', 'How important is it to share hobbies with your partner?', null, 'scale',
  '{"left":"Different interests keep things healthy","right":"I would love many shared hobbies"}', 'dna:shared_interests', true, 90),
('dna_personal_values', 'dna', 'How would you describe your outlook on customs and traditions?', 'This is about your own outlook, in your own terms. It is never inferred from anything else.', 'scale',
  '{"left":"Contemporary and evolving","right":"Rooted in tradition"}', 'dna:personal_values', true, 100),

-- Personal values -------------------------------------------------------------
('values_communication_style', 'values', 'When something matters, how do you prefer to communicate?', null, 'single_select',
  '[{"value":"frequent_checkins","label":"Frequent check-ins"},{"value":"balanced","label":"A natural balance"},{"value":"space_and_depth","label":"Space, then deep conversations"},{"value":"direct","label":"Direct and to the point"},{"value":"gentle","label":"Gentle and considerate"}]',
  'profile_values.communication_style', true, 10),
('values_conflict_style', 'values', 'When you disagree with someone close, what helps most?', null, 'single_select',
  '[{"value":"talk_immediately","label":"Talk it through right away"},{"value":"cool_off_then_talk","label":"Take a pause, then talk"},{"value":"written","label":"Write my thoughts first"},{"value":"mediated","label":"Involve someone we both trust"}]',
  'profile_values.conflict_style', false, 20),
('values_financial_philosophy', 'values', 'Which best describes how you would like to manage finances as a couple?', null, 'single_select',
  '[{"value":"saver","label":"Save first, spend carefully"},{"value":"balanced","label":"Balanced saving and spending"},{"value":"investor","label":"Grow wealth through investing"},{"value":"spender","label":"Enjoy life now"},{"value":"shared_pool","label":"One shared pool"},{"value":"separate_finances","label":"Mostly separate finances"}]',
  'profile_values.financial_philosophy', true, 30),
('values_independence_level', 'values', 'In marriage, you see yourselves as…', null, 'single_select',
  '[{"value":"very_independent","label":"Two independent people, side by side"},{"value":"balanced","label":"A balance of together and apart"},{"value":"very_together","label":"A close team that does most things together"}]',
  'profile_values.independence_level', true, 40),
('values_household_split', 'values', 'How do you imagine sharing household responsibilities?', null, 'single_select',
  '[{"value":"equal","label":"Shared equally"},{"value":"flexible","label":"Flexible, based on schedules"},{"value":"traditional","label":"Traditional roles"},{"value":"outsourced","label":"Mostly with help at home"}]',
  'profile_values.household_split', false, 50),
('values_emotional_expectations', 'values', 'In your own words, what helps you feel understood and cared for?', 'Optional — a sentence or two is perfect.', 'long_text', '[]', 'profile_values.emotional_expectations', false, 60),
('values_relationship_expectations', 'values', 'What does a good marriage look like to you?', 'Optional.', 'long_text', '[]', 'profile_values.relationship_expectations', false, 70),
('values_family_responsibilities', 'values', 'Are there family responsibilities a partner should know about?', 'For example, caring for parents or a family business. Optional.', 'long_text', '[]', 'profile_values.family_responsibilities', false, 80),
('values_career_ambitions', 'values', 'What are you working towards in your career?', 'Optional.', 'long_text', '[]', 'profile_values.career_ambitions', false, 90),
('values_core_values', 'values', 'Choose up to five values that matter most to you.', null, 'multi_select',
  '[{"value":"honesty","label":"Honesty"},{"value":"kindness","label":"Kindness"},{"value":"family","label":"Family"},{"value":"growth","label":"Personal growth"},{"value":"ambition","label":"Ambition"},{"value":"faith","label":"Faith"},{"value":"equality","label":"Equality"},{"value":"tradition","label":"Tradition"},{"value":"adventure","label":"Adventure"},{"value":"stability","label":"Stability"},{"value":"humour","label":"Humour"},{"value":"service","label":"Giving back"},{"value":"independence","label":"Independence"},{"value":"respect","label":"Respect"},{"value":"loyalty","label":"Loyalty"}]',
  'profiles.core_values', true, 100),
('values_personality_traits', 'values', 'Which words describe you best? Pick up to five.', null, 'multi_select',
  '[{"value":"calm","label":"Calm"},{"value":"cheerful","label":"Cheerful"},{"value":"thoughtful","label":"Thoughtful"},{"value":"adventurous","label":"Adventurous"},{"value":"introverted","label":"Introverted"},{"value":"extroverted","label":"Extroverted"},{"value":"organised","label":"Organised"},{"value":"spontaneous","label":"Spontaneous"},{"value":"creative","label":"Creative"},{"value":"practical","label":"Practical"},{"value":"empathetic","label":"Empathetic"},{"value":"driven","label":"Driven"},{"value":"easygoing","label":"Easygoing"},{"value":"curious","label":"Curious"},{"value":"spiritual","label":"Spiritual"}]',
  'profiles.personality_traits', true, 110),

-- Future vision ---------------------------------------------------------------
('future_children', 'values', 'How do you feel about having children?', null, 'single_select',
  '[{"value":"want","label":"I would like children"},{"value":"open","label":"Open to it"},{"value":"dont_want","label":"I prefer not to have children"},{"value":"have_and_want_more","label":"I have children and would like more"},{"value":"have_no_more","label":"I have children and do not want more"}]',
  'profile_values.children_preference', true, 120),
('future_living_arrangement', 'values', 'After marriage, you would prefer to live…', null, 'single_select',
  '[{"value":"independent","label":"In our own home"},{"value":"with_parents","label":"With parents"},{"value":"near_parents","label":"Close to parents"},{"value":"flexible","label":"Flexible"}]',
  'profile_values.living_arrangement', true, 130),
('future_settle_preference', 'values', 'Where would you like to settle in the long run?', null, 'single_select',
  '[{"value":"current_city","label":"Where I live now"},{"value":"india_any","label":"Anywhere in India"},{"value":"abroad","label":"Abroad"},{"value":"flexible","label":"Open to wherever life takes us"}]',
  'profile_values.settle_preference', true, 140),
('future_goals', 'values', 'What are a few things you hope to do in the next five years?', 'Optional — travel, a home, further study, starting something of your own…', 'long_text', '[]', 'profile_values.future_goals', false, 150);
