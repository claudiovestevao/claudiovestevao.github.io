-- Economics: CFO familiar, patrimônio, metas e configuração de proteção.
create table if not exists public.economics_assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  name text not null,
  owner text not null default 'Familia' check (owner in ('Vitor', 'Nathalie', 'Luiza', 'Arthur', 'Familia')),
  type text not null check (type in ('cash', 'investment', 'pension', 'stock_compensation', 'property', 'vehicle', 'consortium_right', 'other')),
  current_value numeric(16,2) not null default 0 check (current_value >= 0),
  as_of_date date not null default current_date,
  liquidity_bucket text not null default 'unknown' check (liquidity_bucket in ('d0_d1', 'up_to_30_days', '31_to_365_days', 'over_1_year', 'illiquid', 'unknown')),
  risk_level text not null default 'unknown' check (risk_level in ('low', 'medium', 'high', 'unknown')),
  employer_concentration boolean not null default false,
  visibility_scope text not null default 'household' check (visibility_scope in ('household', 'aggregate_only', 'owner_only')),
  source_type text not null default 'manual',
  confidence numeric(4,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name, owner)
);

create table if not exists public.economics_liabilities (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  name text not null,
  owner text not null default 'Familia' check (owner in ('Vitor', 'Nathalie', 'Luiza', 'Arthur', 'Familia')),
  type text not null check (type in ('mortgage', 'loan', 'credit_card', 'consortium_commitment', 'tax', 'other')),
  outstanding_balance numeric(16,2),
  monthly_payment numeric(14,2),
  maturity_date date,
  visibility_scope text not null default 'household' check (visibility_scope in ('household', 'aggregate_only', 'owner_only')),
  source_type text not null default 'manual',
  confidence numeric(4,3),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name, owner)
);

create table if not exists public.economics_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.economics_households(id) on delete cascade,
  name text not null,
  goal_type text not null check (goal_type in ('emergency', 'health', 'retirement', 'education', 'travel', 'beach_house', 'debt_payoff', 'experience', 'other')),
  target_value_today numeric(16,2) not null default 0,
  current_value numeric(16,2) not null default 0,
  target_date date,
  priority integer not null default 50,
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table if not exists public.economics_scenario_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.economics_households(id) on delete cascade,
  current_age integer not null default 35,
  target_age integer not null default 55,
  retirement_age integer not null default 60,
  target_monthly_income_today numeric(14,2) not null default 20000,
  monthly_contribution numeric(14,2) not null default 0,
  real_return_rate numeric(7,5) not null default 0.04,
  withdrawal_rate numeric(7,5) not null default 0.035,
  essential_monthly_expense numeric(14,2) not null default 0,
  emergency_target_months integer not null default 12,
  updated_at timestamptz not null default now()
);

create index if not exists economics_assets_household_idx on public.economics_assets (household_id, type);
create index if not exists economics_liabilities_household_idx on public.economics_liabilities (household_id, type);
create index if not exists economics_goals_household_idx on public.economics_goals (household_id, status, priority);

do $$
declare table_name text;
begin
  foreach table_name in array array['economics_assets','economics_liabilities','economics_goals'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.economics_set_updated_at()', table_name, table_name);
  end loop;
end $$;

drop trigger if exists economics_scenario_settings_set_updated_at on public.economics_scenario_settings;
create trigger economics_scenario_settings_set_updated_at before update on public.economics_scenario_settings
for each row execute function public.economics_set_updated_at();

alter table public.economics_assets enable row level security;
alter table public.economics_liabilities enable row level security;
alter table public.economics_goals enable row level security;
alter table public.economics_scenario_settings enable row level security;

drop policy if exists economics_assets_member_select on public.economics_assets;
create policy economics_assets_member_select on public.economics_assets
for select using (public.is_economics_member(household_id));
drop policy if exists economics_assets_member_write on public.economics_assets;
create policy economics_assets_member_write on public.economics_assets
for all using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists economics_liabilities_member_select on public.economics_liabilities;
create policy economics_liabilities_member_select on public.economics_liabilities
for select using (public.is_economics_member(household_id));
drop policy if exists economics_liabilities_member_write on public.economics_liabilities;
create policy economics_liabilities_member_write on public.economics_liabilities
for all using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists economics_goals_member_select on public.economics_goals;
create policy economics_goals_member_select on public.economics_goals
for select using (public.is_economics_member(household_id));
drop policy if exists economics_goals_member_write on public.economics_goals;
create policy economics_goals_member_write on public.economics_goals
for all using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

drop policy if exists economics_scenario_settings_member_select on public.economics_scenario_settings;
create policy economics_scenario_settings_member_select on public.economics_scenario_settings
for select using (public.is_economics_member(household_id));
drop policy if exists economics_scenario_settings_member_write on public.economics_scenario_settings;
create policy economics_scenario_settings_member_write on public.economics_scenario_settings
for all using (public.can_edit_economics(household_id))
with check (public.can_edit_economics(household_id));

with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_assets (household_id, name, owner, type, current_value, as_of_date, liquidity_bucket, risk_level, employer_concentration, source_type, confidence, notes)
select household.id, seed.name, seed.owner, seed.type, seed.value, seed.as_of_date, seed.liquidity, seed.risk, seed.employer, 'user_spec', 0.900, seed.notes
from household cross join (values
  ('Carteira EQI', 'Vitor', 'investment', 151805.01::numeric, '2026-07-11'::date, 'unknown', 'medium', false, 'Liquidez deve ser detalhada antes de contar como reserva.'),
  ('Previdência Bradesco', 'Vitor', 'pension', 23921.31::numeric, '2026-07-12'::date, 'over_1_year', 'medium', false, 'Longo prazo.'),
  ('Ações e PLR Porto', 'Vitor', 'stock_compensation', 43092.00::numeric, '2026-07-12'::date, 'unknown', 'high', true, 'Concentração no empregador.'),
  ('PortoPrev', 'Vitor', 'pension', 0::numeric, '2026-07-12'::date, 'over_1_year', 'medium', true, 'Saldo pendente de extrato; não recomendar resgate automaticamente.')
) as seed(name, owner, type, value, as_of_date, liquidity, risk, employer, notes)
on conflict (household_id, name, owner) do update set
  current_value = excluded.current_value, as_of_date = excluded.as_of_date, liquidity_bucket = excluded.liquidity_bucket,
  risk_level = excluded.risk_level, employer_concentration = excluded.employer_concentration, notes = excluded.notes;

with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_liabilities (household_id, name, owner, type, outstanding_balance, monthly_payment, maturity_date, source_type, confidence, notes)
select household.id, 'Consórcio imobiliário', 'Familia', 'consortium_commitment', 543560.61, 1393.50, '2042-04-30', 'user_spec', 0.900,
  'Crédito contratado de R$ 500 mil; não somar ao patrimônio. Parcela sujeita a reajuste.'
from household
on conflict (household_id, name, owner) do update set monthly_payment = excluded.monthly_payment, maturity_date = excluded.maturity_date, notes = excluded.notes;

with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_scenario_settings (household_id, current_age, target_age, retirement_age, target_monthly_income_today, real_return_rate, withdrawal_rate, emergency_target_months)
select id, 35, 55, 60, 20000, 0.04, 0.035, 12 from household
on conflict (household_id) do nothing;

with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_goals (household_id, name, goal_type, target_value_today, current_value, priority, notes)
select household.id, seed.name, seed.type, seed.target, 0, seed.priority, seed.notes
from household cross join (values
  ('Reserva de emergência', 'emergency', 0::numeric, 10, 'Meta depende da despesa essencial mensal.'),
  ('Reserva de saúde', 'health', 0::numeric, 20, 'Separada da reserva de emergência.'),
  ('Liberdade aos 55', 'retirement', 6857143::numeric, 30, 'Capital de referência usando retirada real de 3,5% ao ano.'),
  ('Educação dos filhos', 'education', 0::numeric, 40, 'Definir idade final e custos por filho.'),
  ('Experiências em família', 'experience', 0::numeric, 50, 'Viver bem faz parte do plano.')
) as seed(name, type, target, priority, notes)
on conflict (household_id, name) do nothing;

-- Contas conhecidas. Valores desconhecidos ficam para confirmação do casal.
with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi'),
category as (select id from public.economics_categories where name = 'Dívidas e financiamentos' limit 1)
insert into public.economics_bill_definitions (household_id, category_id, title, amount, owner, due_day, frequency, notes)
select household.id, category.id, 'Consórcio imobiliário', 1393.50, 'Familia', 15, 'monthly', 'Valor sujeito a reajuste em 29/08/2026.' from household, category
where not exists (select 1 from public.economics_bill_definitions b where b.household_id = household.id and b.title = 'Consórcio imobiliário');

with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_accounts (household_id, name, institution, type, owner, current_balance, due_day, active, notes)
select household.id, seed.name, seed.institution, seed.type, seed.owner, 0, seed.due_day, true, seed.notes
from household cross join (values
  ('Cartão Itaú', 'Itaú', 'credit_card', 'Vitor', 9, 'Fatura em débito automático.'),
  ('Cartão Santander', 'Santander', 'credit_card', 'Vitor', 16, 'Possui anuidade.'),
  ('Cartão Porto', 'PortoBank', 'credit_card', 'Familia', 25, 'Cartão compartilhado com Nathalie.'),
  ('Investimentos EQI', 'EQI', 'investment', 'Vitor', null::integer, 'Saldo conhecido em 11/07/2026.'),
  ('Previdência Bradesco', 'Bradesco', 'pension', 'Vitor', null::integer, null)
) as seed(name, institution, type, owner, due_day, notes)
where not exists (select 1 from public.economics_accounts a where a.household_id = household.id and a.name = seed.name);

-- Snapshots de faturas informadas para julho/2026. Não são usados como média mensal.
with household as (select id from public.economics_households where slug = 'familia-estevao-bonomi')
insert into public.economics_bill_instances (household_id, title, amount, due_on, status)
select household.id, seed.title, seed.amount, seed.due_on, 'open'
from household cross join (values
  ('Fatura Itaú - jul/2026', 8547.72::numeric, '2026-07-09'::date),
  ('Fatura Santander - jul/2026', 1025.33::numeric, '2026-07-16'::date),
  ('Fatura Porto - jul/2026', 7167.95::numeric, '2026-07-25'::date)
) as seed(title, amount, due_on)
where not exists (select 1 from public.economics_bill_instances i where i.household_id = household.id and i.title = seed.title);

with definition as (
  select id, household_id, title, amount from public.economics_bill_definitions where title = 'Consórcio imobiliário'
), months as (
  select generate_series(date_trunc('month', current_date), date_trunc('month', current_date) + interval '3 months', interval '1 month')::date as month_start
)
insert into public.economics_bill_instances (household_id, bill_definition_id, title, amount, due_on, status)
select definition.household_id, definition.id, definition.title, definition.amount, (months.month_start + interval '14 days')::date, 'open'
from definition cross join months
on conflict (bill_definition_id, due_on) do nothing;
