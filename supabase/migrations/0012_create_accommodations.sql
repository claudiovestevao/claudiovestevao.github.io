begin;

create extension if not exists pgcrypto;

create table if not exists public.accommodations (
  id uuid primary key default gen_random_uuid(),
  destination_id uuid not null references public.destinations(id) on delete cascade,
  slug text not null,
  name text not null,
  property_type text not null,
  price_tier text,
  official_site_url text,
  booking_url text,
  address text,
  neighborhood text,
  latitude numeric,
  longitude numeric,
  origin_focus text,
  departure_mode text,
  drive_time_from_sao_paulo_minutes int,
  recommended_airport text,
  transfer_minutes int,
  direct_flight_from_sao_paulo boolean,
  has_family_rooms boolean,
  has_connecting_rooms boolean,
  has_crib boolean,
  has_kids_club boolean,
  has_kids_pool boolean,
  has_heated_pool boolean,
  has_pool boolean,
  has_kitchenette boolean,
  babysitting_available boolean,
  kids_eat_free boolean,
  baby_meals_available boolean,
  stroller_friendly boolean,
  laundry_available boolean,
  parking_available boolean,
  has_copa_baby boolean,
  has_copa_baby_24h boolean,
  all_inclusive boolean,
  calm_beach boolean,
  recreation_available boolean,
  works_on_rainy_day boolean,
  min_child_age_months int,
  ideal_age text,
  family_score numeric(3,1),
  family_notes text,
  main_strength text,
  attention_point text,
  source_urls text[] not null default '{}'::text[],
  source_highlights text[] not null default '{}'::text[],
  confidence_level text not null default 'medium',
  is_placeholder boolean not null default false,
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accommodations_slug_key unique (slug),
  constraint accommodations_confidence_level_check
    check (confidence_level in ('mock', 'low', 'medium', 'high', 'verified', 'expired')),
  constraint accommodations_family_score_check
    check (family_score is null or (family_score >= 0 and family_score <= 10)),
  constraint accommodations_price_tier_check
    check (price_tier is null or price_tier in ('budget', 'mid', 'upscale', 'luxury'))
);

alter table public.accommodations add column if not exists origin_focus text;
alter table public.accommodations add column if not exists departure_mode text;
alter table public.accommodations add column if not exists drive_time_from_sao_paulo_minutes int;
alter table public.accommodations add column if not exists recommended_airport text;
alter table public.accommodations add column if not exists transfer_minutes int;
alter table public.accommodations add column if not exists direct_flight_from_sao_paulo boolean;
alter table public.accommodations add column if not exists has_copa_baby boolean;
alter table public.accommodations add column if not exists has_copa_baby_24h boolean;
alter table public.accommodations add column if not exists all_inclusive boolean;
alter table public.accommodations add column if not exists calm_beach boolean;
alter table public.accommodations add column if not exists recreation_available boolean;
alter table public.accommodations add column if not exists works_on_rainy_day boolean;
alter table public.accommodations add column if not exists ideal_age text;
alter table public.accommodations add column if not exists main_strength text;
alter table public.accommodations add column if not exists attention_point text;
alter table public.accommodations add column if not exists source_highlights text[] not null default '{}'::text[];
alter table public.accommodations add column if not exists updated_at timestamptz not null default now();

create unique index if not exists idx_accommodations_slug_unique
  on public.accommodations(slug);

create index if not exists idx_accommodations_destination
  on public.accommodations(destination_id);

create index if not exists idx_accommodations_destination_score
  on public.accommodations(destination_id, family_score desc nulls last);

create index if not exists idx_accommodations_property_type
  on public.accommodations(property_type);

create index if not exists idx_accommodations_confidence_level
  on public.accommodations(confidence_level);

create index if not exists idx_accommodations_source_urls
  on public.accommodations using gin(source_urls);

alter table public.accommodations enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'accommodations'
      and policyname = 'public read accommodations'
  ) then
    create policy "public read accommodations"
      on public.accommodations
      for select
      using (true);
  end if;
end $$;

grant select on public.accommodations to anon, authenticated;

create or replace function public.set_accommodations_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_accommodations_updated_at on public.accommodations;

create trigger set_accommodations_updated_at
before update on public.accommodations
for each row
execute function public.set_accommodations_updated_at();

commit;
