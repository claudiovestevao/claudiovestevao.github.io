begin;

create extension if not exists pgcrypto;

create table if not exists public.destination_images (
  id uuid primary key default gen_random_uuid(),
  destination_slug text not null,
  destination_name text not null,
  city text,
  state text,
  country text,
  category text,
  context text,
  query_used text,
  image_url text,
  thumbnail_url text,
  source text not null default 'pexels',
  author_name text,
  author_url text,
  original_url text,
  license text,
  attribution_required boolean not null default false,
  attribution_text text,
  width int,
  height int,
  alt text,
  confidence_score int not null default 0,
  status text not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_images_status_check
    check (status in ('auto_approved', 'approved', 'pending_review', 'rejected')),
  constraint destination_images_confidence_check
    check (confidence_score >= 0 and confidence_score <= 100),
  constraint destination_images_slug_source_unique
    unique (destination_slug, source)
);

create index if not exists idx_destination_images_status
  on public.destination_images(status);

create index if not exists idx_destination_images_slug_status
  on public.destination_images(destination_slug, status);

alter table public.destination_images enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'destination_images'
      and policyname = 'public read destination images'
  ) then
    create policy "public read destination images"
      on public.destination_images
      for select
      using (true);
  end if;
end $$;

grant select on public.destination_images to anon, authenticated;

create or replace function public.set_destination_images_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_destination_images_updated_at on public.destination_images;

create trigger set_destination_images_updated_at
before update on public.destination_images
for each row
execute function public.set_destination_images_updated_at();

commit;
