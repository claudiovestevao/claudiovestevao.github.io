begin;

create extension if not exists pgcrypto;

create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  place_id text not null unique,
  provider text not null default 'google_places',
  name text not null,
  formatted_address text,
  rating numeric(2,1),
  user_rating_count int,
  categories text[] not null default '{}'::text[],
  latitude numeric,
  longitude numeric,
  website_uri text,
  phone_number text,
  raw_api_data jsonb not null default '{}'::jsonb,
  curated_data jsonb not null default '{}'::jsonb,
  ai_calculated_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  state text,
  country text not null default 'BR',
  latitude numeric,
  longitude numeric,
  source text not null default 'curated',
  api_data jsonb not null default '{}'::jsonb,
  curated_data jsonb not null default '{}'::jsonb,
  ai_calculated_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.destinations add column if not exists place_id text;
alter table public.destinations add column if not exists source text not null default 'curated';
alter table public.destinations add column if not exists api_data jsonb not null default '{}'::jsonb;
alter table public.destinations add column if not exists curated_data jsonb not null default '{}'::jsonb;
alter table public.destinations add column if not exists ai_calculated_data jsonb not null default '{}'::jsonb;

create unique index if not exists idx_destinations_place_id_unique
  on public.destinations(place_id)
  where place_id is not null;

alter table public.accommodations add column if not exists place_id text;
alter table public.accommodations add column if not exists google_rating numeric(2,1);
alter table public.accommodations add column if not exists google_ratings_total int;
alter table public.accommodations add column if not exists google_categories text[] not null default '{}'::text[];
alter table public.accommodations add column if not exists google_website text;
alter table public.accommodations add column if not exists google_phone text;
alter table public.accommodations add column if not exists minimum_family_requirements_passed boolean not null default false;
alter table public.accommodations add column if not exists api_data jsonb not null default '{}'::jsonb;
alter table public.accommodations add column if not exists curated_data jsonb not null default '{}'::jsonb;
alter table public.accommodations add column if not exists ai_calculated_data jsonb not null default '{}'::jsonb;

create unique index if not exists idx_accommodations_place_id_unique
  on public.accommodations(place_id)
  where place_id is not null;

create table if not exists public.attractions (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid references public.destinations(id) on delete set null,
  place_id text unique,
  name text not null,
  item_type text not null default 'attraction',
  formatted_address text,
  rating numeric(2,1),
  user_rating_count int,
  categories text[] not null default '{}'::text[],
  latitude numeric,
  longitude numeric,
  website_uri text,
  phone_number text,
  family_notes text,
  has_kids_space boolean,
  api_data jsonb not null default '{}'::jsonb,
  curated_data jsonb not null default '{}'::jsonb,
  ai_calculated_data jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attractions_item_type_check
    check (item_type in ('attraction', 'restaurant', 'point_of_interest'))
);

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null,
  owner_id uuid,
  place_id text,
  source text not null,
  google_photo_name text,
  google_photo_uri text,
  pexels_id text,
  photographer text,
  photographer_url text,
  photo_url text,
  src_original text,
  src_large text,
  attribution_text text,
  width int,
  height int,
  is_editorial boolean not null default false,
  is_establishment_specific boolean not null default false,
  search_query text,
  api_data jsonb not null default '{}'::jsonb,
  cached_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photos_owner_type_check
    check (owner_type in ('destination', 'accommodation', 'attraction', 'restaurant', 'place')),
  constraint photos_source_check
    check (source in ('google_place_photo', 'pexels', 'manual'))
);

create unique index if not exists idx_photos_google_photo_unique
  on public.photos(google_photo_name)
  where google_photo_name is not null;

create unique index if not exists idx_photos_pexels_owner_unique
  on public.photos(owner_type, coalesce(owner_id::text, ''), pexels_id)
  where pexels_id is not null;

create unique index if not exists idx_photos_pexels_id_unique
  on public.photos(pexels_id)
  where pexels_id is not null;

create table if not exists public.family_scores (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  entity_key text,
  score numeric(4,1) not null,
  medal text not null,
  minimum_requirements_passed boolean not null default false,
  scoring_inputs jsonb not null default '{}'::jsonb,
  ai_explanation jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint family_scores_entity_type_check
    check (entity_type in ('destination', 'accommodation')),
  constraint family_scores_medal_check
    check (medal in ('gold', 'silver', 'bronze', 'not_recommended')),
  constraint family_scores_score_check
    check (score >= 0 and score <= 100)
);

create unique index if not exists idx_family_scores_entity_unique
  on public.family_scores(entity_type, coalesce(entity_id::text, ''), coalesce(entity_key, ''));

create table if not exists public.search_requests (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  lead_id uuid references public.concierge_leads(id) on delete set null,
  request_type text not null,
  origin_text text,
  destination_text text,
  query text,
  preferences jsonb not null default '{}'::jsonb,
  consent_contact boolean not null default false,
  consent_lgpd boolean not null default false,
  status text not null default 'received',
  api_provider text,
  result_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_search_requests_session
  on public.search_requests(session_id, created_at desc);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  lead_id uuid references public.concierge_leads(id) on delete set null,
  origin_text text,
  origin_latitude numeric,
  origin_longitude numeric,
  adults_count int,
  children_count int,
  child_ages text[] not null default '{}'::text[],
  rooms_count int,
  pet text,
  budget_total text,
  travel_timing jsonb not null default '{}'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  consent_contact boolean not null default false,
  consent_lgpd boolean not null default false,
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_preferences_session
  on public.user_preferences(session_id, created_at desc);

create table if not exists public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  entity_key text,
  provider text not null default 'booking',
  url text not null,
  affiliate_id text,
  tracking_code text,
  label text not null default 'Ver disponibilidade na Booking',
  claims_real_availability boolean not null default false,
  api_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint affiliate_links_provider_check
    check (provider in ('booking', 'official_site', 'liteapi', 'manual')),
  constraint affiliate_links_entity_type_check
    check (entity_type in ('destination', 'accommodation', 'attraction', 'place'))
);

create unique index if not exists idx_affiliate_links_unique
  on public.affiliate_links(provider, entity_type, coalesce(entity_id::text, ''), coalesce(entity_key, ''), coalesce(tracking_code, ''));

create table if not exists public.api_cache (
  cache_key text primary key,
  provider text not null,
  action text not null,
  request_hash text not null,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_api_cache_expires
  on public.api_cache(expires_at);

create table if not exists public.api_error_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  action text not null,
  request_id text,
  session_id text,
  status_code int,
  error_message text not null,
  request_payload jsonb not null default '{}'::jsonb,
  fallback_used boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  session_id text,
  ip_hash text,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_api_rate_limits_bucket
  on public.api_rate_limits(bucket, action, created_at desc);

alter table public.places enable row level security;
alter table public.destinations enable row level security;
alter table public.accommodations enable row level security;
alter table public.attractions enable row level security;
alter table public.photos enable row level security;
alter table public.family_scores enable row level security;
alter table public.search_requests enable row level security;
alter table public.user_preferences enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.api_cache enable row level security;
alter table public.api_error_logs enable row level security;
alter table public.api_rate_limits enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['places', 'destinations', 'accommodations', 'attractions', 'photos', 'family_scores', 'affiliate_links']
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = 'public read ' || t
    ) then
      execute format('create policy %I on public.%I for select using (true)', 'public read ' || t, t);
    end if;
  end loop;
end $$;

grant select on public.places to anon, authenticated;
grant select on public.destinations to anon, authenticated;
grant select on public.accommodations to anon, authenticated;
grant select on public.attractions to anon, authenticated;
grant select on public.photos to anon, authenticated;
grant select on public.family_scores to anon, authenticated;
grant select on public.affiliate_links to anon, authenticated;

commit;
