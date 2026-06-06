begin;

create extension if not exists pgcrypto;

create table if not exists public.destination_visit_guides (
  id uuid primary key default gen_random_uuid(),
  destination_key text not null unique,
  destination_name text not null,
  why_visit text not null,
  restaurants jsonb not null default '[]'::jsonb,
  attractions jsonb not null default '[]'::jsonb,
  curation_status text not null default 'seeded_needs_google_rating_verification',
  last_verified_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_visit_guides_status_check
    check (curation_status in ('verified', 'seeded_needs_google_rating_verification', 'needs_review', 'rejected'))
);

create table if not exists public.destination_local_highlights (
  id uuid primary key default gen_random_uuid(),
  destination_key text not null,
  destination_name text not null,
  item_type text not null,
  name text not null,
  category text,
  family_note text,
  has_kids_space boolean,
  google_rating numeric(2,1),
  google_place_id text,
  rating_source text,
  source_url text,
  required_min_google_rating numeric(2,1) not null default 4.0,
  curation_status text not null default 'needs_google_places_verification',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint destination_local_highlights_type_check
    check (item_type in ('restaurant', 'attraction')),
  constraint destination_local_highlights_google_rating_check
    check (google_rating is null or google_rating >= required_min_google_rating),
  constraint destination_local_highlights_status_check
    check (curation_status in ('verified', 'needs_google_places_verification', 'needs_review', 'rejected')),
  constraint destination_local_highlights_unique
    unique (destination_key, item_type, name)
);

create index if not exists idx_destination_local_highlights_destination
  on public.destination_local_highlights(destination_key, item_type, sort_order);

alter table public.destination_visit_guides enable row level security;
alter table public.destination_local_highlights enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'destination_visit_guides' and policyname = 'public read destination visit guides'
  ) then
    create policy "public read destination visit guides"
      on public.destination_visit_guides
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'destination_local_highlights' and policyname = 'public read destination local highlights'
  ) then
    create policy "public read destination local highlights"
      on public.destination_local_highlights
      for select
      using (true);
  end if;
end $$;

grant select on public.destination_visit_guides to anon, authenticated;
grant select on public.destination_local_highlights to anon, authenticated;

with guide_rows as (
  select *
  from jsonb_to_recordset($json$
  [
    {"destination_key":"campinas-sp","destination_name":"Campinas, SP","why_visit":"Campinas funciona quando a família quer resort perto de São Paulo, mas ainda ter cidade grande por perto: parques, shoppings, restaurantes e hospitalidade urbana.","restaurants":["Seo Rosa Cambuí","Giovannetti Cambuí","Kaizen Japanese Food"],"attractions":["Lagoa do Taquaral","Bosque dos Jequitibás","Maria Fumaça Campinas"]},
    {"destination_key":"atibaia-sp","destination_name":"Atibaia, SP","why_visit":"Atibaia é uma das melhores primeiras viagens saindo de São Paulo: montanha, morango, restaurantes com área aberta e resorts sem a fricção de aeroporto.","restaurants":["Restaurante Costelão Atibaia","Fazenda Paraíso Atibaia","Restaurante 2 Lagos"],"attractions":["Pedra Grande","Parque Edmundo Zanoni","Teleférico de Atibaia"]},
    {"destination_key":"mogi-das-cruzes-sp","destination_name":"Mogi das Cruzes, SP","why_visit":"Mogi combina resort próximo, clima de interior e programas leves como parques, cultura japonesa e natureza, sem exigir uma viagem longa.","restaurants":["Bife Esquema Mogi","Santa Helena Restaurante","Mogi Shopping restaurantes"],"attractions":["Parque Centenário da Imigração Japonesa","Pico do Urubu","Parque Leon Feffer"]},
    {"destination_key":"cesario-lange-sp","destination_name":"Cesário Lange, SP","why_visit":"Cesário Lange entra pela hospedagem-resort: é menos sobre cidade turística e mais sobre ficar bem instalado, com lazer concentrado e pouca decisão fora do hotel.","restaurants":["Mavsa Resort restaurantes","Restaurante do Lago Cesário Lange","Churrascaria Cesário Lange"],"attractions":["Mavsa Resort lazer","Praça Central de Cesário Lange","Roteiro rural regional"]},
    {"destination_key":"praia-do-forte-ba","destination_name":"Praia do Forte, BA","why_visit":"Praia do Forte mistura praia bonita, vila charmosa, Projeto Tamar, bons restaurantes e resorts com estrutura, um equilíbrio raro para família com criança pequena.","restaurants":["Restaurante Sabor da Vila","Tango Café","7 Pizzas Praia do Forte"],"attractions":["Projeto Tamar Praia do Forte","Vila de Praia do Forte","Castelo Garcia D'Ávila"]},
    {"destination_key":"porto-de-galinhas-pe","destination_name":"Porto de Galinhas, PE","why_visit":"Porto de Galinhas tem apelo visual imediato: piscinas naturais, resorts, jangadas e uma vila turística fácil de entender, desde que o mar e os horários ajudem.","restaurants":["Beijupirá Porto de Galinhas","Barcaxeira","Munganga Bistrô"],"attractions":["Piscinas Naturais de Porto de Galinhas","Praia de Muro Alto","Vila de Porto de Galinhas"]},
    {"destination_key":"maragogi-al","destination_name":"Maragogi, AL","why_visit":"Maragogi é para quem quer cor de mar e foto de cartão-postal, mas com criança eu trataria maré, traslado e passeios como pontos críticos da decisão.","restaurants":["Restaurante Tuyn","Maragaço Maragogi","Russo Gastrobar"],"attractions":["Piscinas Naturais de Maragogi","Praia de Antunes","Praia de Barra Grande"]},
    {"destination_key":"foz-do-iguacu-pr","destination_name":"Foz do Iguaçu, PR","why_visit":"Foz entrega natureza grandiosa com cidade estruturada, voo curto e passeios marcantes. Para família, o segredo é não tentar fazer tudo no mesmo dia.","restaurants":["Rafain Churrascaria Show","Noite Italiana Bella Italia","Castelo Libanês"],"attractions":["Cataratas do Iguaçu","Parque das Aves","Marco das Três Fronteiras"]},
    {"destination_key":"gramado-rs","destination_name":"Gramado, RS","why_visit":"Gramado vende encantamento: chocolate, parques fechados, Natal, restaurantes temáticos e hotelaria forte. Funciona melhor quando a família aceita frio e agenda.","restaurants":["Casa da Velha Bruxa","Cantina Pastasciutta","Galeto Itália Gramado"],"attractions":["Lago Negro","Mini Mundo","Snowland"]},
    {"destination_key":"dourado-sp","destination_name":"Dourado, SP","why_visit":"Dourado é uma decisão de hotel-fazenda: natureza, comida, rotina calma e lazer dentro da hospedagem. É menos passeio urbano e mais descanso assistido.","restaurants":["Clara Dourado Resort restaurantes","Santa Clara Eco Resort restaurante","Restaurante rural Dourado SP"],"attractions":["Clara Dourado Resort lazer","Santa Clara Eco Resort lazer","Museu Histórico de Dourado"]},
    {"destination_key":"campos-do-jordao-sp","destination_name":"Campos do Jordão, SP","why_visit":"Campos do Jordão tem serra, chocolate, Capivari, parques e hotelaria charmosa. É persuasiva para família que quer clima diferente sem avião.","restaurants":["Restaurante Libertango","Villa Gourmet Campos do Jordão","Pastelão do Maluf"],"attractions":["Vila Capivari","Amantikir","Parque Estadual Campos do Jordão"]},
    {"destination_key":"sao-roque-sp","destination_name":"São Roque, SP","why_visit":"São Roque é bate-volta esperto: vinho para os pais, restaurantes grandes, fazendinhas, empórios e lazer perto da capital.","restaurants":["Vila Don Patto","Quinta do Olivardo","Restaurante Vale do Vinho"],"attractions":["Roteiro do Vinho","Ski Mountain Park","Fazendinha e centros de entretenimento do roteiro"]},
    {"destination_key":"guaruja-sp","destination_name":"Guarujá, SP","why_visit":"Guarujá é praia com infraestrutura urbana, boa para família que quer litoral sem voo, hotel forte e alternativa de aquário/restaurantes se o tempo virar.","restaurants":["Rufino's Guarujá","Dalmo Bárbaro Guarujá","Avelino's Enseada"],"attractions":["Praia da Enseada","Acqua Mundo","Mirante do Morro da Campina"]},
    {"destination_key":"olimpia-sp","destination_name":"Olímpia, SP","why_visit":"Olímpia é sobre parque aquático e resort. Para criança maior pode ser uma alegria; para bebê, só vale com pausas, sombra e hotel muito bem escolhido.","restaurants":["Dat Badan Olímpia","Villa da Vó Olímpia","Jorge's Bar Olímpia"],"attractions":["Thermas dos Laranjais","Hot Beach Olímpia","Vale dos Dinossauros Olímpia"]},
    {"destination_key":"penha-sc","destination_name":"Penha, SC","why_visit":"Penha é escolhida pelo Beto Carrero, mas a decisão boa considera idade, altura mínima, filas, shows e descanso entre parque e praia.","restaurants":["Petisqueira Alírio","Casa Ibérica Penha","Big Pizzas Penha"],"attractions":["Beto Carrero World","Praia de Armação","Praia Alegre"]},
    {"destination_key":"buenos-aires-argentina","destination_name":"Buenos Aires, Argentina","why_visit":"Buenos Aires é uma primeira internacional confortável: voo curto, parques urbanos, cafés, livrarias, sorvetes e cultura em ritmo mais leve que Orlando.","restaurants":["La Cabrera","Kansas Palermo","Sottovoce Puerto Madero"],"attractions":["Jardín Japonés","Museo de los Niños Abasto","Caminito La Boca"]},
    {"destination_key":"orlando-fl","destination_name":"Orlando, FL","why_visit":"Orlando é memorável quando a criança já aproveita parque. Para família pequena, a curadoria precisa controlar custo, fuso, filas e dias de descanso.","restaurants":["Chef Mickey's Orlando","Rainforest Cafe Disney Springs","The Boathouse Disney Springs"],"attractions":["Magic Kingdom","Disney Springs","Animal Kingdom"]}
  ]
  $json$) as x(destination_key text, destination_name text, why_visit text, restaurants jsonb, attractions jsonb)
)
insert into public.destination_visit_guides (
  destination_key,
  destination_name,
  why_visit,
  restaurants,
  attractions,
  curation_status,
  last_verified_at
)
select
  destination_key,
  destination_name,
  why_visit,
  restaurants,
  attractions,
  'seeded_needs_google_rating_verification',
  current_date
from guide_rows
on conflict (destination_key) do update set
  destination_name = excluded.destination_name,
  why_visit = excluded.why_visit,
  restaurants = excluded.restaurants,
  attractions = excluded.attractions,
  curation_status = excluded.curation_status,
  last_verified_at = excluded.last_verified_at,
  updated_at = now();

with guide_items as (
  select
    destination_key,
    destination_name,
    'restaurant'::text as item_type,
    jsonb_array_elements_text(restaurants) as name
  from public.destination_visit_guides
  union all
  select
    destination_key,
    destination_name,
    'attraction'::text as item_type,
    jsonb_array_elements_text(attractions) as name
  from public.destination_visit_guides
),
numbered as (
  select
    *,
    row_number() over (partition by destination_key, item_type order by name) as sort_order
  from guide_items
)
insert into public.destination_local_highlights (
  destination_key,
  destination_name,
  item_type,
  name,
  rating_source,
  source_url,
  curation_status,
  sort_order
)
select
  destination_key,
  destination_name,
  item_type,
  name,
  case when item_type = 'restaurant' then 'google_maps_pending' else 'tripadvisor_or_official_pending' end,
  case
    when item_type = 'restaurant' then 'https://www.google.com/maps/search/?api=1&query=' || replace(name || ' ' || destination_name, ' ', '+')
    else 'https://www.tripadvisor.com/Search?q=' || replace(name || ' ' || destination_name, ' ', '+')
  end,
  'needs_google_places_verification',
  sort_order::int
from numbered
on conflict (destination_key, item_type, name) do update set
  destination_name = excluded.destination_name,
  rating_source = excluded.rating_source,
  source_url = excluded.source_url,
  curation_status = excluded.curation_status,
  sort_order = excluded.sort_order,
  updated_at = now();

commit;
