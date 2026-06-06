begin;

create extension if not exists pgcrypto;

create table if not exists public.family_region_itineraries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  region text not null,
  primary_destination_slug text not null,
  nearby_destination_slugs text[] not null default '{}'::text[],
  min_nights int not null default 3,
  ideal_nights text,
  base_strategy text not null,
  best_for text,
  avoid_when text,
  route_facts jsonb not null default '[]'::jsonb,
  stops jsonb not null default '[]'::jsonb,
  day_plans jsonb not null default '[]'::jsonb,
  source_urls text[] not null default '{}'::text[],
  curated_data jsonb not null default '{}'::jsonb,
  ai_calculated_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_region_itineraries_min_nights_check check (min_nights >= 1 and min_nights <= 14)
);

alter table public.family_region_itineraries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'family_region_itineraries'
      and policyname = 'public read family region itineraries'
  ) then
    create policy "public read family region itineraries"
      on public.family_region_itineraries
      for select
      using (true);
  end if;
end $$;

grant select on public.family_region_itineraries to anon, authenticated;

insert into public.destinations (
  slug,
  name,
  state,
  country,
  latitude,
  longitude,
  place_id,
  source,
  api_data,
  curated_data,
  ai_calculated_data
)
values (
  'aguas-de-lindoia',
  'Águas de Lindóia',
  'SP',
  'Brasil',
  -22.4803601,
  -46.633882,
  'ChIJ0wvIzKwRyZQRsLPA3ANSDs8',
  'google_places+curated',
  jsonb_build_object(
    'provider', 'google_places',
    'place_id', 'ChIJ0wvIzKwRyZQRsLPA3ANSDs8',
    'resource_name', 'places/ChIJ0wvIzKwRyZQRsLPA3ANSDs8',
    'formatted_address', 'Águas de Lindóia, SP, 13940-000',
    'types', jsonb_build_array('locality', 'political'),
    'synced_at', '2026-06-06T00:00:00Z'
  ),
  jsonb_build_object(
    'family_positioning', 'base de resort no Circuito das Águas com extensão segura para Socorro em viagens de 3+ noites',
    'best_for', jsonb_build_array('resort no interior', 'pensão completa', 'roteiro regional leve'),
    'attention_points', jsonb_build_array('não combinar Socorro em roteiro curto demais', 'confirmar pensão e recreação diretamente')
  ),
  jsonb_build_object(
    'family_score_hint', 8.2,
    'multi_destination_fit', 'strong_when_3_plus_nights'
  )
)
on conflict (slug) do update
set
  name = excluded.name,
  state = excluded.state,
  country = excluded.country,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  place_id = excluded.place_id,
  source = excluded.source,
  api_data = public.destinations.api_data || excluded.api_data,
  curated_data = public.destinations.curated_data || excluded.curated_data,
  ai_calculated_data = public.destinations.ai_calculated_data || excluded.ai_calculated_data,
  updated_at = now();

insert into public.places (
  place_id,
  provider,
  name,
  formatted_address,
  rating,
  user_rating_count,
  categories,
  latitude,
  longitude,
  website_uri,
  phone_number,
  raw_api_data,
  curated_data,
  ai_calculated_data,
  last_synced_at
)
values (
  'ChIJKVe4vusRyZQReZog9WvvuFs',
  'google_places',
  'Bendito Cacao Family Resort',
  'Av. das Nações Unidas, 1374 - Moreiras, Águas de Lindóia - SP, 13940-000',
  4.6,
  2880,
  array['resort_hotel', 'hotel', 'lodging', 'point_of_interest', 'establishment'],
  -22.4824545,
  -46.6385764,
  'https://benditocacaoresort.com.br/bendito-lindoia',
  '(19) 3460-0777',
  jsonb_build_object(
    'source', 'Google Places Text Search',
    'synced_at', '2026-06-06T00:00:00Z',
    'photo_refs_count', 3
  ),
  jsonb_build_object(
    'family_evidence', jsonb_build_array('pensão completa citada em fontes editoriais', 'piscinas', 'brinquedoteca', 'playground indoor', 'copas baby'),
    'do_not_claim', jsonb_build_array('preço atual', 'disponibilidade atual')
  ),
  jsonb_build_object(
    'minimum_family_requirements_passed', true,
    'recommended_badge', 'Prata - Muito bom para Famílias'
  ),
  now()
)
on conflict (place_id) do update
set
  name = excluded.name,
  formatted_address = excluded.formatted_address,
  rating = excluded.rating,
  user_rating_count = excluded.user_rating_count,
  categories = excluded.categories,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  website_uri = excluded.website_uri,
  phone_number = excluded.phone_number,
  raw_api_data = public.places.raw_api_data || excluded.raw_api_data,
  curated_data = public.places.curated_data || excluded.curated_data,
  ai_calculated_data = public.places.ai_calculated_data || excluded.ai_calculated_data,
  last_synced_at = now(),
  updated_at = now();

with destination_row as (
  select id from public.destinations where slug = 'aguas-de-lindoia'
)
insert into public.accommodations (
  destination_id,
  slug,
  name,
  property_type,
  price_tier,
  official_site_url,
  booking_url,
  address,
  latitude,
  longitude,
  origin_focus,
  departure_mode,
  drive_time_from_sao_paulo_minutes,
  direct_flight_from_sao_paulo,
  has_family_rooms,
  has_crib,
  has_kids_club,
  has_kids_pool,
  has_heated_pool,
  has_pool,
  has_copa_baby,
  all_inclusive,
  recreation_available,
  works_on_rainy_day,
  ideal_age,
  family_score,
  family_notes,
  main_strength,
  attention_point,
  source_urls,
  source_highlights,
  confidence_level,
  is_placeholder,
  last_verified_at,
  place_id,
  google_rating,
  google_ratings_total,
  google_categories,
  google_website,
  google_phone,
  minimum_family_requirements_passed,
  api_data,
  curated_data,
  ai_calculated_data
)
select
  destination_row.id,
  'bendito-cacao-family-resort',
  'Bendito Cacao Family Resort',
  'resort',
  'upscale',
  'https://www.benditocacaoresort.com.br/bendito-lindoia',
  'https://www.booking.com/searchresults.html?ss=Bendito%20Cacao%20Family%20Resort%20%C3%81guas%20de%20Lind%C3%B3ia',
  'Av. das Nações Unidas, 1374 - Moreiras, Águas de Lindóia - SP, 13940-000',
  -22.4824545,
  -46.6385764,
  'Capital de São Paulo',
  'carro',
  149,
  false,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  false,
  true,
  true,
  '2+ anos, famílias que querem resort temático e pensão completa no interior',
  8.6,
  'Base forte para Circuito das Águas: resort temático, estrutura infantil e deslocamento administrável a partir de São Paulo.',
  'Google Places retornou 4,6 com 2.880 avaliações em 06/06/2026; fontes editoriais citam pensão completa, piscinas, brinquedoteca, playground indoor e copas baby.',
  'Não prometer preço/disponibilidade. Validar pensão, recreação, copa baby e cancelamento no site oficial ou Booking.',
  array[
    'https://www.benditocacaoresort.com.br/bendito-lindoia',
    'https://paisefilhos.com.br/familia/bendito-cacao-family-resort-conheca-o-hotel-da-cacau-show-em-aguas-de-lindoia/',
    'https://www.jornalomunicipio.com.br/bendito-cacao-family-resort-abre-as-portas-para-o-publico-em-aguas-de-lindoia/'
  ],
  array[
    'Unidade oficial em Águas de Lindóia confirmada pelo site Bendito Cacao.',
    'Fontes editoriais citam pensão completa, piscinas, brinquedoteca, playground indoor e copas baby.',
    'Águas de Lindóia -> Socorro: cerca de 26,9 km e 37 min por Google Distance Matrix em 06/06/2026.'
  ],
  'verified',
  false,
  current_date,
  'ChIJKVe4vusRyZQReZog9WvvuFs',
  4.6,
  2880,
  array['resort_hotel', 'hotel', 'lodging', 'point_of_interest', 'establishment'],
  'https://benditocacaoresort.com.br/bendito-lindoia',
  '(19) 3460-0777',
  true,
  jsonb_build_object(
    'provider', 'google_places',
    'place_id', 'ChIJKVe4vusRyZQReZog9WvvuFs',
    'synced_at', '2026-06-06T00:00:00Z'
  ),
  jsonb_build_object(
    'meal_plan', 'full_board',
    'regional_combo', 'Circuito das Águas: Águas de Lindóia + Socorro',
    'do_not_claim', jsonb_build_array('preço atual', 'disponibilidade atual')
  ),
  jsonb_build_object(
    'minimum_family_requirements_passed', true,
    'multi_destination_role', 'base_hotel',
    'route_from_sp_minutes', 149
  )
from destination_row
on conflict (slug) do update
set
  destination_id = excluded.destination_id,
  name = excluded.name,
  property_type = excluded.property_type,
  price_tier = excluded.price_tier,
  official_site_url = excluded.official_site_url,
  booking_url = excluded.booking_url,
  address = excluded.address,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  drive_time_from_sao_paulo_minutes = excluded.drive_time_from_sao_paulo_minutes,
  has_family_rooms = excluded.has_family_rooms,
  has_crib = excluded.has_crib,
  has_kids_club = excluded.has_kids_club,
  has_kids_pool = excluded.has_kids_pool,
  has_heated_pool = excluded.has_heated_pool,
  has_pool = excluded.has_pool,
  has_copa_baby = excluded.has_copa_baby,
  recreation_available = excluded.recreation_available,
  works_on_rainy_day = excluded.works_on_rainy_day,
  family_score = excluded.family_score,
  family_notes = excluded.family_notes,
  main_strength = excluded.main_strength,
  attention_point = excluded.attention_point,
  source_urls = excluded.source_urls,
  source_highlights = excluded.source_highlights,
  confidence_level = excluded.confidence_level,
  is_placeholder = excluded.is_placeholder,
  last_verified_at = excluded.last_verified_at,
  place_id = excluded.place_id,
  google_rating = excluded.google_rating,
  google_ratings_total = excluded.google_ratings_total,
  google_categories = excluded.google_categories,
  google_website = excluded.google_website,
  google_phone = excluded.google_phone,
  minimum_family_requirements_passed = excluded.minimum_family_requirements_passed,
  api_data = public.accommodations.api_data || excluded.api_data,
  curated_data = public.accommodations.curated_data || excluded.curated_data,
  ai_calculated_data = public.accommodations.ai_calculated_data || excluded.ai_calculated_data,
  updated_at = now();

insert into public.family_region_itineraries (
  slug,
  title,
  region,
  primary_destination_slug,
  nearby_destination_slugs,
  min_nights,
  ideal_nights,
  base_strategy,
  best_for,
  avoid_when,
  route_facts,
  stops,
  day_plans,
  source_urls,
  curated_data,
  ai_calculated_data
)
values (
  'circuito-das-aguas-aguas-socorro',
  'Circuito das Águas sem trocar mala todo dia',
  'Circuito das Águas Paulista',
  'aguas-de-lindoia',
  array['socorro-sp', 'serra-negra-sp'],
  3,
  '3 a 5 noites',
  'Use Águas de Lindóia como base principal e trate Socorro como extensão regional, não como obrigação.',
  'Famílias que querem resort, piscina, passeio leve e um dia de natureza/aventura controlada.',
  'Evitar com 1 ou 2 noites, bebê muito pequeno, chuva forte ou criança que dorme mal fora de casa.',
  jsonb_build_array(
    jsonb_build_object('label', 'SP -> Águas', 'value', '184 km · 2h29', 'source', 'Google Distance Matrix 06/06/2026'),
    jsonb_build_object('label', 'Águas -> Socorro', 'value', '26,9 km · 37 min', 'source', 'Google Distance Matrix 06/06/2026')
  ),
  jsonb_build_array(
    jsonb_build_object('name', 'Águas de Lindóia', 'role', 'base do sono', 'suggested_nights', '2 a 4 noites', 'family_reason', 'hotel com rotina, refeições e descanso previsível'),
    jsonb_build_object('name', 'Socorro', 'role', 'bate-volta leve', 'suggested_nights', 'meio dia ou 1 dia', 'family_reason', 'natureza, compras locais e atividades outdoor para crianças maiores'),
    jsonb_build_object('name', 'Serra Negra', 'role', 'opcional', 'suggested_nights', 'meio dia', 'family_reason', 'centrinho, compras e passeio simples se a família ainda tiver energia')
  ),
  jsonb_build_array(
    jsonb_build_object('nights', '1 a 2 noites', 'recommendation', 'Base única em Águas. Socorro só entra se todo mundo acordar bem e o clima ajudar.', 'intensity', 'leve'),
    jsonb_build_object('nights', '3 a 4 noites', 'recommendation', 'Dois dias de resort e um bate-volta curto para Socorro. É o melhor equilíbrio para família.', 'intensity', 'equilibrado'),
    jsonb_build_object('nights', '5+ noites', 'recommendation', 'Águas como base, Socorro em um dia e Serra Negra opcional. Ainda assim, deixe um dia sem passeio.', 'intensity', 'completo')
  ),
  array[
    'https://www.benditocacaoresort.com.br/bendito-lindoia',
    'https://paisefilhos.com.br/familia/bendito-cacao-family-resort-conheca-o-hotel-da-cacau-show-em-aguas-de-lindoia/',
    'https://www.jornalomunicipio.com.br/bendito-cacao-family-resort-abre-as-portas-para-o-publico-em-aguas-de-lindoia/'
  ],
  jsonb_build_object('curation_level', 'verified_seed', 'target_persona', 'familia com resort e extensao regional leve'),
  jsonb_build_object('score_hint', 8.4, 'risk_if_short_trip', 'medium')
)
on conflict (slug) do update
set
  title = excluded.title,
  region = excluded.region,
  primary_destination_slug = excluded.primary_destination_slug,
  nearby_destination_slugs = excluded.nearby_destination_slugs,
  min_nights = excluded.min_nights,
  ideal_nights = excluded.ideal_nights,
  base_strategy = excluded.base_strategy,
  best_for = excluded.best_for,
  avoid_when = excluded.avoid_when,
  route_facts = excluded.route_facts,
  stops = excluded.stops,
  day_plans = excluded.day_plans,
  source_urls = excluded.source_urls,
  curated_data = public.family_region_itineraries.curated_data || excluded.curated_data,
  ai_calculated_data = public.family_region_itineraries.ai_calculated_data || excluded.ai_calculated_data,
  updated_at = now();

commit;
