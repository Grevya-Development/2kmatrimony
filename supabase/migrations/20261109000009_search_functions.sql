-- =============================================================================
-- 0009 SEARCH & CANDIDATE FUNCTIONS (service-role only)
-- Visibility rules enforced here for every result:
--   * candidate profile active and visibility = 'members'
--   * not the viewer, not blocked in either direction
--   * owner account active
-- Filters arrive as JSON matching SearchFilters in packages/shared/src/schemas.ts.
-- =============================================================================

create or replace function public.search_profile_ids(
  p_viewer uuid,
  p_filters jsonb,
  p_text text default null,
  p_embedding extensions.vector default null,
  p_limit int default 50,
  p_offset int default 0,
  p_exclude_passed boolean default false
)
returns table (profile_id uuid, text_rank real, vector_similarity real, last_active_at timestamptz, activated_at timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  f jsonb := coalesce(p_filters, '{}'::jsonb);
  v_age_min int := (f ->> 'ageMin')::int;
  v_age_max int := (f ->> 'ageMax')::int;
  v_h_min int := (f ->> 'heightMinCm')::int;
  v_h_max int := (f ->> 'heightMaxCm')::int;
  v_query tsquery := case when nullif(btrim(coalesce(p_text, '')), '') is null then null
                          else websearch_to_tsquery('simple', p_text) end;
  v_income_min int;
  income_order constant text[] := array['none','lt_3l','3_6l','6_10l','10_15l','15_25l','25_50l','50l_1cr','gt_1cr'];
begin
  if f ? 'minIncomeRange' then
    v_income_min := array_position(income_order, f ->> 'minIncomeRange');
  end if;

  return query
  select p.id,
         case when v_query is null then 0::real else ts_rank(p.search_tsv, v_query) end as text_rank,
         case when p_embedding is null or p.embedding is null then 0::real
              else (1 - (p.embedding <=> p_embedding))::real end as vector_similarity,
         p.last_active_at,
         p.activated_at
  from public.profiles p
  join public.app_users u on u.id = p.owner_user_id and u.status = 'active'
  left join public.profile_career pc on pc.profile_id = p.id
  left join public.profile_lifestyle pl on pl.profile_id = p.id
  left join public.profile_values pv on pv.profile_id = p.id
  left join public.profile_family pf on pf.profile_id = p.id
  where p.status = 'active'
    and p.visibility = 'members'
    and p.id <> p_viewer
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_profile_id = p_viewer and b.blocked_profile_id = p.id)
         or (b.blocker_profile_id = p.id and b.blocked_profile_id = p_viewer)
    )
    and (not p_exclude_passed or not exists (select 1 from public.passes x where x.profile_id = p_viewer and x.target_profile_id = p.id))
    -- demographics
    and (v_age_max is null or p.date_of_birth >= ((current_date - make_interval(years => v_age_max + 1))::date + 1))
    and (v_age_min is null or p.date_of_birth <= (current_date - make_interval(years => v_age_min))::date)
    and (v_h_min is null or p.height_cm >= v_h_min)
    and (v_h_max is null or p.height_cm <= v_h_max)
    and (not f ? 'maritalStatuses' or jsonb_array_length(f -> 'maritalStatuses') = 0
         or p.marital_status in (select jsonb_array_elements_text(f -> 'maritalStatuses')))
    and (not f ? 'cities' or jsonb_array_length(f -> 'cities') = 0
         or lower(p.current_city) in (select lower(x) from jsonb_array_elements_text(f -> 'cities') x)
         or lower(pc.work_city) in (select lower(x) from jsonb_array_elements_text(f -> 'cities') x))
    and (not f ? 'countries' or jsonb_array_length(f -> 'countries') = 0
         or p.current_country in (select jsonb_array_elements_text(f -> 'countries')))
    and (not f ? 'motherTongues' or jsonb_array_length(f -> 'motherTongues') = 0
         or lower(p.mother_tongue) in (select lower(x) from jsonb_array_elements_text(f -> 'motherTongues') x))
    and (not f ? 'religions' or jsonb_array_length(f -> 'religions') = 0
         or lower(p.religion) in (select lower(x) from jsonb_array_elements_text(f -> 'religions') x))
    and (not f ? 'coreValues' or jsonb_array_length(f -> 'coreValues') = 0
         or p.core_values && array(select jsonb_array_elements_text(f -> 'coreValues')))
    -- education (highest level at least the lowest requested)
    and (not f ? 'educationLevels' or jsonb_array_length(f -> 'educationLevels') = 0
         or exists (select 1 from public.profile_education e where e.profile_id = p.id
                    and e.level in (select jsonb_array_elements_text(f -> 'educationLevels'))))
    -- career
    and (not f ? 'professions' or jsonb_array_length(f -> 'professions') = 0
         or exists (select 1 from jsonb_array_elements_text(f -> 'professions') x where pc.profession ilike '%' || x || '%'))
    and (v_income_min is null or array_position(income_order, pc.income_range) >= v_income_min)
    and (not f ? 'relocation' or jsonb_array_length(f -> 'relocation') = 0
         or pc.relocation_willingness in (select jsonb_array_elements_text(f -> 'relocation')))
    -- lifestyle & values
    and (not f ? 'diets' or jsonb_array_length(f -> 'diets') = 0
         or pl.diet in (select jsonb_array_elements_text(f -> 'diets')))
    and (not f ? 'interests' or jsonb_array_length(f -> 'interests') = 0
         or exists (select 1 from unnest(pl.interests || pl.hobbies) i
                    where lower(i) in (select lower(x) from jsonb_array_elements_text(f -> 'interests') x)))
    and (not f ? 'familyValues' or jsonb_array_length(f -> 'familyValues') = 0
         or pf.family_values in (select jsonb_array_elements_text(f -> 'familyValues')))
    and (not f ? 'childrenPreferences' or jsonb_array_length(f -> 'childrenPreferences') = 0
         or pv.children_preference in (select jsonb_array_elements_text(f -> 'childrenPreferences')))
    and (not f ? 'settlePreferences' or jsonb_array_length(f -> 'settlePreferences') = 0
         or pv.settle_preference in (select jsonb_array_elements_text(f -> 'settlePreferences')))
    -- trust
    and (coalesce((f ->> 'verifiedOnly')::boolean, false) = false or p.is_identity_verified)
    and (coalesce((f ->> 'withPhotoOnly')::boolean, false) = false
         or exists (select 1 from public.profile_photos ph where ph.profile_id = p.id and ph.moderation_status = 'approved'))
    -- free text: require a text match unless semantic ranking is available
    and (v_query is null or p_embedding is not null or p.search_tsv @@ v_query
         or p.search_text ilike '%' || p_text || '%')
  order by
    (case when v_query is null then 0 else ts_rank(p.search_tsv, v_query) end)
      + (case when p_embedding is null or p.embedding is null then 0 else (1 - (p.embedding <=> p_embedding)) end) desc,
    p.last_active_at desc nulls last
  limit least(greatest(p_limit, 1), 500)
  offset greatest(p_offset, 0);
end $$;

revoke all on function public.search_profile_ids(uuid, jsonb, text, extensions.vector, int, int, boolean) from public, anon, authenticated;

-- Candidate pool for recommendations: coarse SQL prefilter, precise scoring in
-- the matching engine. Excludes existing connections, open interests, passes.
create or replace function public.recommendation_candidates(
  p_viewer uuid,
  p_seeking text[],
  p_age_min int,
  p_age_max int,
  p_limit int default 400
)
returns table (profile_id uuid)
language sql stable security definer set search_path = public, extensions as $$
  select p.id
  from public.profiles p
  join public.app_users u on u.id = p.owner_user_id and u.status = 'active'
  left join public.partner_preferences pp on pp.profile_id = p.id
  where p.status = 'active'
    and p.visibility = 'members'
    and p.id <> p_viewer
    and (coalesce(array_length(p_seeking, 1), 0) = 0 or p.gender = any (p_seeking))
    -- the candidate must also be looking for the viewer's gender (when they said)
    and (pp.seeking_genders is null or coalesce(array_length(pp.seeking_genders, 1), 0) = 0
         or (select v.gender from public.profiles v where v.id = p_viewer) = any (pp.seeking_genders))
    and (p_age_max is null or p.date_of_birth >= ((current_date - make_interval(years => p_age_max + 1))::date + 1))
    and (p_age_min is null or p.date_of_birth <= (current_date - make_interval(years => p_age_min))::date)
    and not exists (select 1 from public.blocks b
                    where (b.blocker_profile_id = p_viewer and b.blocked_profile_id = p.id)
                       or (b.blocker_profile_id = p.id and b.blocked_profile_id = p_viewer))
    and not exists (select 1 from public.passes x where x.profile_id = p_viewer and x.target_profile_id = p.id)
    and not exists (select 1 from public.connections c
                    where c.profile_a = least(p_viewer, p.id) and c.profile_b = greatest(p_viewer, p.id))
    and not exists (select 1 from public.interests i where i.status = 'pending'
                    and ((i.sender_profile_id = p_viewer and i.receiver_profile_id = p.id)
                      or (i.sender_profile_id = p.id and i.receiver_profile_id = p_viewer)))
  order by p.last_active_at desc nulls last, p.activated_at desc nulls last
  limit least(greatest(p_limit, 1), 2000);
$$;

revoke all on function public.recommendation_candidates(uuid, text[], int, int, int) from public, anon, authenticated;
