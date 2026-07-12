create extension if not exists pgcrypto;

create table if not exists public.economics_households (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  label text not null default 'Privado',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economics_household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member', 'viewer')),
  can_view_all boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, email)
);

create table if not exists public.economics_documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  owner_email text not null,
  original_name text not null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null default 0,
  category text not null default 'triagem' check (category in ('triagem', 'fatura', 'boleto', 'investimento', 'previdencia', 'consorcio', 'contrato', 'comprovante', 'outro')),
  status text not null default 'uploaded' check (status in ('uploaded', 'reviewing', 'extracted', 'posted', 'ignored')),
  extraction jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economics_audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.economics_households(id) on delete set null,
  actor_email text,
  event_type text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists economics_household_members_email_idx on public.economics_household_members (lower(email));
create index if not exists economics_documents_household_created_idx on public.economics_documents (household_id, created_at desc);
create index if not exists economics_audit_household_created_idx on public.economics_audit_events (household_id, created_at desc);

create or replace function public.economics_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists economics_households_set_updated_at on public.economics_households;
create trigger economics_households_set_updated_at
before update on public.economics_households
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_household_members_set_updated_at on public.economics_household_members;
create trigger economics_household_members_set_updated_at
before update on public.economics_household_members
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_documents_set_updated_at on public.economics_documents;
create trigger economics_documents_set_updated_at
before update on public.economics_documents
for each row execute function public.economics_set_updated_at();

create or replace function public.economics_current_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_economics_member(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.economics_household_members member
    where member.household_id = target_household_id
      and lower(member.email) = public.economics_current_email()
  );
$$;

create or replace function public.can_edit_economics(target_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.economics_household_members member
    where member.household_id = target_household_id
      and lower(member.email) = public.economics_current_email()
      and member.role in ('owner', 'admin', 'member')
  );
$$;

alter table public.economics_households enable row level security;
alter table public.economics_household_members enable row level security;
alter table public.economics_documents enable row level security;
alter table public.economics_audit_events enable row level security;

drop policy if exists "economics_households_member_select" on public.economics_households;
create policy "economics_households_member_select"
on public.economics_households for select
using (public.is_economics_member(id));

drop policy if exists "economics_members_member_select" on public.economics_household_members;
create policy "economics_members_member_select"
on public.economics_household_members for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_documents_member_select" on public.economics_documents;
create policy "economics_documents_member_select"
on public.economics_documents for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_documents_member_write" on public.economics_documents;
create policy "economics_documents_member_write"
on public.economics_documents for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists "economics_audit_member_select" on public.economics_audit_events;
create policy "economics_audit_member_select"
on public.economics_audit_events for select
using (household_id is not null and public.is_economics_member(household_id));

insert into public.economics_households (slug, name, label)
values ('familia-estevao-bonomi', 'Familia Estevao Bonomi', 'Privado')
on conflict (slug) do update
set name = excluded.name,
    label = excluded.label;

insert into public.economics_household_members (household_id, email, display_name, role, can_view_all)
select household.id, member.email, member.display_name, 'owner', true
from public.economics_households household
cross join (
  values
    ('cvitorestevao@gmail.com', 'Vitor'),
    ('nathalierbonomi@gmail.com', 'Nathalie')
) as member(email, display_name)
where household.slug = 'familia-estevao-bonomi'
on conflict (household_id, email) do update
set display_name = excluded.display_name,
    role = excluded.role,
    can_view_all = excluded.can_view_all;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'economics-documents',
  'economics-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/json'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
