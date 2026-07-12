create extension if not exists pgcrypto;

create table if not exists public.diario_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) on delete set null,
  autor_phone text,
  autor_nome text,
  tipo text not null check (tipo in ('texto', 'audio', 'foto', 'video')),
  texto_original text,
  resumo_ia text,
  foto_url text,
  data_local date not null,
  wa_message_id text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists diario_entries_trip_day_idx on public.diario_entries(trip_id, data_local desc, created_at desc);
create index if not exists diario_entries_created_at_idx on public.diario_entries(created_at desc);

alter table public.diario_entries enable row level security;

drop policy if exists "diario_entries_members_select" on public.diario_entries;
create policy "diario_entries_members_select"
on public.diario_entries for select
using (trip_id is not null and public.is_trip_member(trip_id));

drop policy if exists "diario_entries_edit_all" on public.diario_entries;
create policy "diario_entries_edit_all"
on public.diario_entries for all
using (trip_id is not null and public.can_edit_trip(trip_id))
with check (trip_id is not null and public.can_edit_trip(trip_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diario',
  'diario',
  false,
  52428800,
  array[
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'video/mp4',
    'video/webm'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
