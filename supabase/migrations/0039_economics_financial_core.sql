create table if not exists public.economics_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  name text not null,
  kind text not null default 'expense' check (kind in ('income', 'expense', 'transfer', 'asset', 'liability')),
  parent_id uuid references public.economics_categories(id) on delete set null,
  color text not null default '#0f5bd7',
  icon text not null default 'tag',
  sort_order integer not null default 100,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name, kind)
);

create table if not exists public.economics_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  name text not null,
  institution text,
  type text not null default 'checking' check (type in ('checking', 'savings', 'credit_card', 'cash', 'investment', 'pension', 'loan', 'asset', 'liability', 'other')),
  owner text not null default 'Familia' check (owner in ('Vitor', 'Nathalie', 'Luiza', 'Arthur', 'Familia')),
  currency text not null default 'BRL',
  current_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2),
  due_day integer check (due_day between 1 and 31),
  closing_day integer check (closing_day between 1 and 31),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economics_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  account_id uuid references public.economics_accounts(id) on delete set null,
  document_id uuid references public.economics_documents(id) on delete set null,
  category_id uuid references public.economics_categories(id) on delete set null,
  type text not null default 'expense' check (type in ('income', 'expense', 'transfer', 'asset_adjustment', 'liability_adjustment')),
  description text not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'BRL',
  occurred_on date not null default current_date,
  payment_method text not null default 'pix' check (payment_method in ('pix', 'debit', 'credit', 'credit_portobank', 'cash', 'arc_debit', 'bank_transfer', 'other')),
  owner text not null default 'Familia' check (owner in ('Vitor', 'Nathalie', 'Luiza', 'Arthur', 'Familia')),
  status text not null default 'posted' check (status in ('draft', 'posted', 'ignored')),
  notes text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economics_bill_definitions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  category_id uuid references public.economics_categories(id) on delete set null,
  account_id uuid references public.economics_accounts(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  owner text not null default 'Familia' check (owner in ('Vitor', 'Nathalie', 'Luiza', 'Arthur', 'Familia')),
  due_day integer not null check (due_day between 1 and 31),
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'yearly')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.economics_bill_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  bill_definition_id uuid references public.economics_bill_definitions(id) on delete cascade,
  transaction_id uuid references public.economics_transactions(id) on delete set null,
  title text not null,
  amount numeric(14,2) not null default 0 check (amount >= 0),
  due_on date not null,
  status text not null default 'open' check (status in ('open', 'paid', 'skipped')),
  paid_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bill_definition_id, due_on)
);

create index if not exists economics_categories_household_idx on public.economics_categories (household_id, kind, sort_order);
create index if not exists economics_accounts_household_idx on public.economics_accounts (household_id, active, type);
create index if not exists economics_transactions_household_date_idx on public.economics_transactions (household_id, occurred_on desc);
create index if not exists economics_transactions_category_idx on public.economics_transactions (category_id);
create index if not exists economics_bills_household_idx on public.economics_bill_definitions (household_id, active, due_day);
create index if not exists economics_bill_instances_due_idx on public.economics_bill_instances (household_id, status, due_on);

drop trigger if exists economics_categories_set_updated_at on public.economics_categories;
create trigger economics_categories_set_updated_at
before update on public.economics_categories
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_accounts_set_updated_at on public.economics_accounts;
create trigger economics_accounts_set_updated_at
before update on public.economics_accounts
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_transactions_set_updated_at on public.economics_transactions;
create trigger economics_transactions_set_updated_at
before update on public.economics_transactions
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_bill_definitions_set_updated_at on public.economics_bill_definitions;
create trigger economics_bill_definitions_set_updated_at
before update on public.economics_bill_definitions
for each row execute function public.economics_set_updated_at();

drop trigger if exists economics_bill_instances_set_updated_at on public.economics_bill_instances;
create trigger economics_bill_instances_set_updated_at
before update on public.economics_bill_instances
for each row execute function public.economics_set_updated_at();

alter table public.economics_categories enable row level security;
alter table public.economics_accounts enable row level security;
alter table public.economics_transactions enable row level security;
alter table public.economics_bill_definitions enable row level security;
alter table public.economics_bill_instances enable row level security;

drop policy if exists "economics_categories_member_select" on public.economics_categories;
create policy "economics_categories_member_select"
on public.economics_categories for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_categories_member_write" on public.economics_categories;
create policy "economics_categories_member_write"
on public.economics_categories for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists "economics_accounts_member_select" on public.economics_accounts;
create policy "economics_accounts_member_select"
on public.economics_accounts for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_accounts_member_write" on public.economics_accounts;
create policy "economics_accounts_member_write"
on public.economics_accounts for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists "economics_transactions_member_select" on public.economics_transactions;
create policy "economics_transactions_member_select"
on public.economics_transactions for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_transactions_member_write" on public.economics_transactions;
create policy "economics_transactions_member_write"
on public.economics_transactions for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists "economics_bill_definitions_member_select" on public.economics_bill_definitions;
create policy "economics_bill_definitions_member_select"
on public.economics_bill_definitions for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_bill_definitions_member_write" on public.economics_bill_definitions;
create policy "economics_bill_definitions_member_write"
on public.economics_bill_definitions for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists "economics_bill_instances_member_select" on public.economics_bill_instances;
create policy "economics_bill_instances_member_select"
on public.economics_bill_instances for select
using (public.is_economics_member(household_id));

drop policy if exists "economics_bill_instances_member_write" on public.economics_bill_instances;
create policy "economics_bill_instances_member_write"
on public.economics_bill_instances for all
using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

with household as (
  select id from public.economics_households where slug = 'familia-estevao-bonomi'
), seeds(name, kind, color, icon, sort_order) as (
  values
    ('Renda', 'income', '#13834b', 'wallet', 10),
    ('Moradia', 'expense', '#0f5bd7', 'home', 20),
    ('Escola e crianças', 'expense', '#8b5cf6', 'baby', 30),
    ('Mercado', 'expense', '#f59e0b', 'cart', 40),
    ('Restaurantes', 'expense', '#ef4444', 'utensils', 50),
    ('Transporte', 'expense', '#06b6d4', 'car', 60),
    ('Saúde', 'expense', '#10b981', 'heart', 70),
    ('Casa', 'expense', '#64748b', 'house-plus', 80),
    ('Viagem', 'expense', '#2563eb', 'plane', 90),
    ('Assinaturas', 'expense', '#9333ea', 'receipt', 100),
    ('Compras', 'expense', '#ec4899', 'bag', 110),
    ('Impostos e taxas', 'expense', '#a15c07', 'file', 120),
    ('Investimentos', 'asset', '#166534', 'chart', 130),
    ('Previdência', 'asset', '#0f766e', 'shield', 140),
    ('Dívidas e financiamentos', 'liability', '#991b1b', 'alert', 150),
    ('Outros', 'expense', '#475569', 'tag', 999)
)
insert into public.economics_categories (household_id, name, kind, color, icon, sort_order, is_system)
select household.id, seeds.name, seeds.kind, seeds.color, seeds.icon, seeds.sort_order, true
from household cross join seeds
on conflict (household_id, name, kind) do update
set color = excluded.color,
    icon = excluded.icon,
    sort_order = excluded.sort_order,
    is_system = true;
