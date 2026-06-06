-- Market-grade search and enrichment support for the family destination catalog.
-- Complements 0030_seed_family_destination_catalog_1001.sql.

create extension if not exists pg_trgm;

create index if not exists idx_family_destination_catalog_1001_name_trgm
  on public.family_destination_catalog_1001
  using gin (name gin_trgm_ops);

create index if not exists idx_family_destination_catalog_1001_state_score
  on public.family_destination_catalog_1001 (state_code, family_score desc, rank asc);

create index if not exists idx_family_destination_catalog_1001_type_score
  on public.family_destination_catalog_1001 (destination_type, family_score desc, rank asc);

create index if not exists idx_family_destination_catalog_1001_tags
  on public.family_destination_catalog_1001
  using gin (tags);

create table if not exists public.destination_enrichment_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  entity_slug text not null,
  priority int not null default 50,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'done', 'failed', 'skipped')),
  attempts int not null default 0,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  locked_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_destination_enrichment_jobs_unique_open
  on public.destination_enrichment_jobs (job_type, entity_slug, status)
  where status in ('queued', 'processing');

create index if not exists idx_destination_enrichment_jobs_queue
  on public.destination_enrichment_jobs (status, priority desc, created_at asc);

alter table public.destination_enrichment_jobs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'destination_enrichment_jobs'
      and policyname = 'destination_enrichment_jobs_no_public_access'
  ) then
    create policy destination_enrichment_jobs_no_public_access
      on public.destination_enrichment_jobs
      for all
      using (false)
      with check (false);
  end if;
end $$;

revoke all on public.destination_enrichment_jobs from anon, authenticated;
