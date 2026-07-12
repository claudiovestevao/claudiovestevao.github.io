create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  start_date date,
  end_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date,
  category text,
  title text not null,
  done boolean not null default false,
  sort_order integer not null default 0,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_envelopes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  planned_amount numeric(12, 2) not null default 0,
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  envelope_id uuid references public.budget_envelopes(id) on delete set null,
  description text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'BRL' check (currency in ('BRL', 'USD')),
  brl_rate numeric(12, 4),
  payment_method text check (payment_method in ('cash', 'card', 'portobank', 'pix', 'other')),
  paid_by uuid references auth.users(id) on delete set null,
  expense_date date not null default current_date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  type text not null default 'restaurant' check (type in ('flight', 'hotel', 'car', 'restaurant', 'park', 'insurance', 'other')),
  name text not null,
  confirmation_code text,
  status text not null default 'to_book' check (status in ('to_book', 'booked', 'cancelled', 'done')),
  scheduled_at timestamptz,
  location text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trip_members_user_id_idx on public.trip_members(user_id);
create index if not exists trip_invites_trip_id_idx on public.trip_invites(trip_id);
create index if not exists checklist_items_trip_id_idx on public.checklist_items(trip_id);
create index if not exists budget_envelopes_trip_id_idx on public.budget_envelopes(trip_id);
create index if not exists budget_expenses_trip_id_idx on public.budget_expenses(trip_id);
create index if not exists reservations_trip_id_idx on public.reservations(trip_id);

create or replace function public.orlando_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orlando_profiles_updated_at on public.profiles;
create trigger orlando_profiles_updated_at
before update on public.profiles
for each row execute function public.orlando_set_updated_at();

drop trigger if exists orlando_trips_updated_at on public.trips;
create trigger orlando_trips_updated_at
before update on public.trips
for each row execute function public.orlando_set_updated_at();

drop trigger if exists orlando_checklist_items_updated_at on public.checklist_items;
create trigger orlando_checklist_items_updated_at
before update on public.checklist_items
for each row execute function public.orlando_set_updated_at();

drop trigger if exists orlando_budget_envelopes_updated_at on public.budget_envelopes;
create trigger orlando_budget_envelopes_updated_at
before update on public.budget_envelopes
for each row execute function public.orlando_set_updated_at();

drop trigger if exists orlando_budget_expenses_updated_at on public.budget_expenses;
create trigger orlando_budget_expenses_updated_at
before update on public.budget_expenses
for each row execute function public.orlando_set_updated_at();

drop trigger if exists orlando_reservations_updated_at on public.reservations;
create trigger orlando_reservations_updated_at
before update on public.reservations
for each row execute function public.orlando_set_updated_at();

create or replace function public.is_trip_member(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = target_trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
  );
$$;

create or replace function public.can_edit_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = target_trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role in ('owner', 'editor')
  );
$$;

create or replace function public.can_admin_trip(target_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trip_members tm
    where tm.trip_id = target_trip_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and tm.role = 'owner'
  );
$$;

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invites enable row level security;
alter table public.checklist_items enable row level security;
alter table public.budget_envelopes enable row level security;
alter table public.budget_expenses enable row level security;
alter table public.reservations enable row level security;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select"
on public.profiles for select
using (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "trips_members_select" on public.trips;
create policy "trips_members_select"
on public.trips for select
using (public.is_trip_member(id));

drop policy if exists "trips_owner_insert" on public.trips;
create policy "trips_owner_insert"
on public.trips for insert
with check (owner_id = auth.uid() and coalesce(created_by, auth.uid()) = auth.uid());

drop policy if exists "trips_edit_update" on public.trips;
create policy "trips_edit_update"
on public.trips for update
using (public.can_edit_trip(id))
with check (public.can_edit_trip(id));

drop policy if exists "trips_owner_delete" on public.trips;
create policy "trips_owner_delete"
on public.trips for delete
using (public.can_admin_trip(id));

drop policy if exists "trip_members_select" on public.trip_members;
create policy "trip_members_select"
on public.trip_members for select
using (public.is_trip_member(trip_id));

drop policy if exists "trip_members_insert" on public.trip_members;
create policy "trip_members_insert"
on public.trip_members for insert
with check (
  public.can_admin_trip(trip_id)
  or (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = auth.uid()
    )
  )
);

drop policy if exists "trip_members_admin_update" on public.trip_members;
create policy "trip_members_admin_update"
on public.trip_members for update
using (public.can_admin_trip(trip_id))
with check (public.can_admin_trip(trip_id));

drop policy if exists "trip_members_admin_delete" on public.trip_members;
create policy "trip_members_admin_delete"
on public.trip_members for delete
using (public.can_admin_trip(trip_id));

drop policy if exists "trip_invites_admin_all" on public.trip_invites;
create policy "trip_invites_admin_all"
on public.trip_invites for all
using (public.can_admin_trip(trip_id))
with check (public.can_admin_trip(trip_id));

drop policy if exists "checklist_items_members_select" on public.checklist_items;
create policy "checklist_items_members_select"
on public.checklist_items for select
using (public.is_trip_member(trip_id));

drop policy if exists "checklist_items_edit_all" on public.checklist_items;
create policy "checklist_items_edit_all"
on public.checklist_items for all
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "budget_envelopes_members_select" on public.budget_envelopes;
create policy "budget_envelopes_members_select"
on public.budget_envelopes for select
using (public.is_trip_member(trip_id));

drop policy if exists "budget_envelopes_edit_all" on public.budget_envelopes;
create policy "budget_envelopes_edit_all"
on public.budget_envelopes for all
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "budget_expenses_members_select" on public.budget_expenses;
create policy "budget_expenses_members_select"
on public.budget_expenses for select
using (public.is_trip_member(trip_id));

drop policy if exists "budget_expenses_edit_all" on public.budget_expenses;
create policy "budget_expenses_edit_all"
on public.budget_expenses for all
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));

drop policy if exists "reservations_members_select" on public.reservations;
create policy "reservations_members_select"
on public.reservations for select
using (public.is_trip_member(trip_id));

drop policy if exists "reservations_edit_all" on public.reservations;
create policy "reservations_edit_all"
on public.reservations for all
using (public.can_edit_trip(trip_id))
with check (public.can_edit_trip(trip_id));
