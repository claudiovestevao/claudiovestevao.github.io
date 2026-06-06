begin;

create extension if not exists pgcrypto;

create table if not exists public.concierge_leads (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  stage text not null default 'intake_completed',
  name text,
  whatsapp text,
  email text,
  adults_count int,
  children_count int not null default 0,
  rooms_count int,
  child_ages text[] not null default '{}'::text[],
  pet text,
  travel_timing_mode text,
  travel_date date,
  travel_month text,
  flexible_window text,
  travel_period_label text,
  last_trip text,
  answers jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  raw_intake jsonb not null default '{}'::jsonb,
  page_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_concierge_leads_session
  on public.concierge_leads(session_id, created_at desc);

create index if not exists idx_concierge_leads_email
  on public.concierge_leads(email);

create table if not exists public.concierge_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  event_name text not null,
  payload jsonb not null default '{}'::jsonb,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_concierge_events_session
  on public.concierge_events(session_id, created_at desc);

create index if not exists idx_concierge_events_name
  on public.concierge_events(event_name, created_at desc);

create table if not exists public.concierge_hotel_clicks (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  lead_id uuid references public.concierge_leads(id) on delete set null,
  hotel_id text,
  hotel_name text,
  destination text,
  click_source text,
  href text,
  profile_name text,
  sem_perrengue_score int,
  budget_total text,
  trip_duration text,
  travel_period_label text,
  page_url text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_concierge_hotel_clicks_session
  on public.concierge_hotel_clicks(session_id, created_at desc);

create index if not exists idx_concierge_hotel_clicks_hotel
  on public.concierge_hotel_clicks(hotel_id, click_source, created_at desc);

create index if not exists idx_concierge_hotel_clicks_destination
  on public.concierge_hotel_clicks(destination, created_at desc);

alter table public.concierge_leads enable row level security;
alter table public.concierge_events enable row level security;
alter table public.concierge_hotel_clicks enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_leads' and policyname = 'public insert concierge leads'
  ) then
    create policy "public insert concierge leads"
      on public.concierge_leads
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_events' and policyname = 'public insert concierge events'
  ) then
    create policy "public insert concierge events"
      on public.concierge_events
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_hotel_clicks' and policyname = 'public insert concierge hotel clicks'
  ) then
    create policy "public insert concierge hotel clicks"
      on public.concierge_hotel_clicks
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_leads' and policyname = 'authenticated read concierge leads'
  ) then
    create policy "authenticated read concierge leads"
      on public.concierge_leads
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_events' and policyname = 'authenticated read concierge events'
  ) then
    create policy "authenticated read concierge events"
      on public.concierge_events
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'concierge_hotel_clicks' and policyname = 'authenticated read concierge hotel clicks'
  ) then
    create policy "authenticated read concierge hotel clicks"
      on public.concierge_hotel_clicks
      for select
      to authenticated
      using (true);
  end if;
end $$;

grant insert on public.concierge_leads to anon, authenticated;
grant insert on public.concierge_events to anon, authenticated;
grant insert on public.concierge_hotel_clicks to anon, authenticated;
grant select on public.concierge_leads to authenticated;
grant select on public.concierge_events to authenticated;
grant select on public.concierge_hotel_clicks to authenticated;

commit;
