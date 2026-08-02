-- Economics: data de nascimento dos membros, usada para calcular idade real
-- e prazo exato até os 40 anos na meta "R$ 1 milhão aos 40".
alter table public.economics_household_members
  add column if not exists birth_date date;

update public.economics_household_members
set birth_date = '1990-10-21'
where email = 'cvitorestevao@gmail.com'
  and birth_date is null;

update public.economics_household_members
set birth_date = '1987-12-07'
where email = 'nathalierbonomi@gmail.com'
  and birth_date is null;
