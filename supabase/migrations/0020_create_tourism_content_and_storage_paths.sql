begin;

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tourism-images',
  'tourism-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) and not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public read tourism images'
  ) then
    execute 'create policy "public read tourism images" on storage.objects for select using (bucket_id = ''tourism-images'')';
  end if;
end $$;

create table if not exists public.tourism_destinations (
  id uuid primary key default gen_random_uuid(),
  destination_slug text not null unique,
  destination_name text not null,
  city text not null,
  state text,
  country text not null,
  concierge_destination_slug text,
  image_folder text not null,
  source_system text not null default 'concierge_family_playbook',
  curation_status text not null default 'generated_needs_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tourism_destinations_slug_folder_check
    check (image_folder = destination_slug),
  constraint tourism_destinations_status_check
    check (curation_status in ('verified', 'generated_needs_review', 'needs_schedule_verification', 'rejected'))
);

create table if not exists public.tourism_spots (
  id uuid primary key default gen_random_uuid(),
  destination_slug text not null references public.tourism_destinations(destination_slug) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  image_path text not null,
  highlight_type text not null default 'attraction',
  family_accessibility_note text,
  sort_order int not null default 0,
  curation_status text not null default 'generated_needs_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tourism_spots_unique unique (destination_slug, slug),
  constraint tourism_spots_description_length_check
    check (char_length(description) <= 150),
  constraint tourism_spots_image_path_check
    check (image_path = destination_slug || '/' || slug || '.jpg'),
  constraint tourism_spots_type_check
    check (highlight_type in ('family_accessible', 'nature', 'culture', 'beach', 'theme_park', 'city_walk', 'resort_anchor')),
  constraint tourism_spots_status_check
    check (curation_status in ('verified', 'generated_needs_review', 'needs_image_upload', 'rejected'))
);

create table if not exists public.tourism_events (
  id uuid primary key default gen_random_uuid(),
  destination_slug text not null references public.tourism_destinations(destination_slug) on delete cascade,
  slug text not null,
  name text not null,
  description text not null,
  image_path text not null,
  event_type text not null default 'festival',
  start_date date not null,
  is_recurring boolean not null default true,
  schedule_precision text not null default 'month',
  curation_status text not null default 'needs_schedule_verification',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tourism_events_unique unique (destination_slug, slug),
  constraint tourism_events_description_length_check
    check (char_length(description) <= 150),
  constraint tourism_events_image_path_check
    check (image_path = destination_slug || '/' || slug || '.jpg'),
  constraint tourism_events_precision_check
    check (schedule_precision in ('exact_date', 'month', 'season', 'needs_verification')),
  constraint tourism_events_status_check
    check (curation_status in ('verified', 'needs_schedule_verification', 'generated_needs_review', 'rejected'))
);

create index if not exists idx_tourism_destinations_concierge_slug
  on public.tourism_destinations(concierge_destination_slug);

create index if not exists idx_tourism_spots_destination_order
  on public.tourism_spots(destination_slug, sort_order);

create index if not exists idx_tourism_spots_family_accessible
  on public.tourism_spots(destination_slug)
  where highlight_type = 'family_accessible';

create index if not exists idx_tourism_events_destination_start
  on public.tourism_events(destination_slug, start_date);

create or replace function public.set_tourism_content_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_tourism_destinations_updated_at on public.tourism_destinations;
create trigger set_tourism_destinations_updated_at
before update on public.tourism_destinations
for each row
execute function public.set_tourism_content_updated_at();

drop trigger if exists set_tourism_spots_updated_at on public.tourism_spots;
create trigger set_tourism_spots_updated_at
before update on public.tourism_spots
for each row
execute function public.set_tourism_content_updated_at();

drop trigger if exists set_tourism_events_updated_at on public.tourism_events;
create trigger set_tourism_events_updated_at
before update on public.tourism_events
for each row
execute function public.set_tourism_content_updated_at();

alter table public.tourism_destinations enable row level security;
alter table public.tourism_spots enable row level security;
alter table public.tourism_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tourism_destinations' and policyname = 'public read tourism destinations'
  ) then
    create policy "public read tourism destinations"
      on public.tourism_destinations
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tourism_spots' and policyname = 'public read tourism spots'
  ) then
    create policy "public read tourism spots"
      on public.tourism_spots
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tourism_events' and policyname = 'public read tourism events'
  ) then
    create policy "public read tourism events"
      on public.tourism_events
      for select
      using (true);
  end if;
end $$;

grant select on public.tourism_destinations to anon, authenticated;
grant select on public.tourism_spots to anon, authenticated;
grant select on public.tourism_events to anon, authenticated;

with destination_rows as (
  select *
  from jsonb_to_recordset($destinations$
  [
    {"destination_slug":"campinas-sp","destination_name":"Campinas, SP","city":"Campinas","state":"São Paulo","country":"Brasil","concierge_destination_slug":"resort-interior-sp","image_folder":"campinas-sp"},
    {"destination_slug":"dourado-sp","destination_name":"Dourado, SP","city":"Dourado","state":"São Paulo","country":"Brasil","concierge_destination_slug":"hotel-fazenda-sp","image_folder":"dourado-sp"},
    {"destination_slug":"campos-do-jordao-sp","destination_name":"Campos do Jordão, SP","city":"Campos do Jordão","state":"São Paulo","country":"Brasil","concierge_destination_slug":"campos-do-jordao","image_folder":"campos-do-jordao-sp"},
    {"destination_slug":"sao-roque-sp","destination_name":"São Roque, SP","city":"São Roque","state":"São Paulo","country":"Brasil","concierge_destination_slug":"sao-roque","image_folder":"sao-roque-sp"},
    {"destination_slug":"atibaia-sp","destination_name":"Atibaia, SP","city":"Atibaia","state":"São Paulo","country":"Brasil","concierge_destination_slug":"atibaia","image_folder":"atibaia-sp"},
    {"destination_slug":"olimpia-sp","destination_name":"Olímpia, SP","city":"Olímpia","state":"São Paulo","country":"Brasil","concierge_destination_slug":"olimpia","image_folder":"olimpia-sp"},
    {"destination_slug":"guaruja-sp","destination_name":"Guarujá, SP","city":"Guarujá","state":"São Paulo","country":"Brasil","concierge_destination_slug":"litoral-norte-sp","image_folder":"guaruja-sp"},
    {"destination_slug":"praia-do-forte-ba","destination_name":"Praia do Forte, BA","city":"Mata de São João","state":"Bahia","country":"Brasil","concierge_destination_slug":"praia-do-forte","image_folder":"praia-do-forte-ba"},
    {"destination_slug":"porto-de-galinhas-pe","destination_name":"Porto de Galinhas, PE","city":"Ipojuca","state":"Pernambuco","country":"Brasil","concierge_destination_slug":"porto-de-galinhas","image_folder":"porto-de-galinhas-pe"},
    {"destination_slug":"maragogi-al","destination_name":"Maragogi, AL","city":"Maragogi","state":"Alagoas","country":"Brasil","concierge_destination_slug":"maceio-maragogi","image_folder":"maragogi-al"},
    {"destination_slug":"foz-do-iguacu-pr","destination_name":"Foz do Iguaçu, PR","city":"Foz do Iguaçu","state":"Paraná","country":"Brasil","concierge_destination_slug":"foz-do-iguacu","image_folder":"foz-do-iguacu-pr"},
    {"destination_slug":"gramado-rs","destination_name":"Gramado, RS","city":"Gramado","state":"Rio Grande do Sul","country":"Brasil","concierge_destination_slug":"gramado","image_folder":"gramado-rs"},
    {"destination_slug":"penha-sc","destination_name":"Penha, SC","city":"Penha","state":"Santa Catarina","country":"Brasil","concierge_destination_slug":"beto-carrero-penha","image_folder":"penha-sc"},
    {"destination_slug":"buenos-aires-argentina","destination_name":"Buenos Aires, Argentina","city":"Buenos Aires","state":"Buenos Aires","country":"Argentina","concierge_destination_slug":"buenos-aires","image_folder":"buenos-aires-argentina"},
    {"destination_slug":"orlando-fl","destination_name":"Orlando, FL","city":"Orlando","state":"Florida","country":"Estados Unidos","concierge_destination_slug":"orlando","image_folder":"orlando-fl"}
  ]
  $destinations$::jsonb) as x(destination_slug text, destination_name text, city text, state text, country text, concierge_destination_slug text, image_folder text)
)
insert into public.tourism_destinations (
  destination_slug,
  destination_name,
  city,
  state,
  country,
  concierge_destination_slug,
  image_folder,
  curation_status
)
select
  destination_slug,
  destination_name,
  city,
  state,
  country,
  concierge_destination_slug,
  image_folder,
  'generated_needs_review'
from destination_rows
on conflict (destination_slug) do update set
  destination_name = excluded.destination_name,
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
  concierge_destination_slug = excluded.concierge_destination_slug,
  image_folder = excluded.image_folder,
  curation_status = excluded.curation_status,
  updated_at = now();

with spot_rows as (
  select *
  from jsonb_to_recordset($spots$
  [
    {"destination_slug":"campinas-sp","slug":"lagoa-do-taquaral","name":"Lagoa do Taquaral","description":"Parque com lago, pedalinhos e áreas planas. Bom para carrinho, piquenique e pausa sem roteiro pesado.","image_path":"campinas-sp/lagoa-do-taquaral.jpg","highlight_type":"family_accessible","family_accessibility_note":"Áreas planas e boa estrutura urbana.","sort_order":1},
    {"destination_slug":"campinas-sp","slug":"bosque-dos-jequitibas","name":"Bosque dos Jequitibás","description":"Área verde central com sombra, trilhas curtas e clima de respiro urbano para famílias que querem passeio leve.","image_path":"campinas-sp/bosque-dos-jequitibas.jpg","highlight_type":"nature","family_accessibility_note":"Melhor para passeio curto e horários frescos.","sort_order":2},
    {"destination_slug":"campinas-sp","slug":"maria-fumaca-campinas","name":"Maria Fumaça Campinas","description":"Passeio de trem histórico entre Campinas e Jaguariúna, bom para crianças maiores e pais que gostam de roteiro nostálgico.","image_path":"campinas-sp/maria-fumaca-campinas.jpg","highlight_type":"culture","family_accessibility_note":"Checar duração e assentos antes de ir com bebê.","sort_order":3},

    {"destination_slug":"dourado-sp","slug":"praca-da-matriz","name":"Praça da Matriz","description":"Centro simples para caminhada curta, sorvete e pausa entre atividades do hotel fazenda.","image_path":"dourado-sp/praca-da-matriz.jpg","highlight_type":"family_accessible","family_accessibility_note":"Passeio leve e curto no centro.","sort_order":1},
    {"destination_slug":"dourado-sp","slug":"museu-historico-de-dourado","name":"Museu Histórico de Dourado","description":"Parada cultural compacta para entender a cidade sem cansar crianças pequenas.","image_path":"dourado-sp/museu-historico-de-dourado.jpg","highlight_type":"culture","family_accessibility_note":"Validar horário de abertura antes de sair.","sort_order":2},
    {"destination_slug":"dourado-sp","slug":"roteiro-rural-de-dourado","name":"Roteiro rural de Dourado","description":"Estradas rurais e fazendas ajudam a criar uma viagem de natureza, comida caseira e ritmo calmo.","image_path":"dourado-sp/roteiro-rural-de-dourado.jpg","highlight_type":"nature","family_accessibility_note":"Melhor com carro e pausas planejadas.","sort_order":3},

    {"destination_slug":"campos-do-jordao-sp","slug":"vila-capivari","name":"Vila Capivari","description":"Centrinho turístico com lojas, chocolate e restaurantes. Funciona para passeio curto com carrinho fora dos horários cheios.","image_path":"campos-do-jordao-sp/vila-capivari.jpg","highlight_type":"family_accessible","family_accessibility_note":"Evitar horários de pico e alta temporada.","sort_order":1},
    {"destination_slug":"campos-do-jordao-sp","slug":"amantikir","name":"Amantikir","description":"Jardins bem cuidados, fotos e caminhada ao ar livre. Melhor com criança que aguenta passeio em terreno variado.","image_path":"campos-do-jordao-sp/amantikir.jpg","highlight_type":"nature","family_accessibility_note":"Validar acessibilidade de carrinho por área.","sort_order":2},
    {"destination_slug":"campos-do-jordao-sp","slug":"parque-estadual-campos-do-jordao","name":"Parque Estadual Campos do Jordão","description":"Natureza, araucárias e trilhas leves. Bom para família que quer ar livre sem transformar o dia em maratona.","image_path":"campos-do-jordao-sp/parque-estadual-campos-do-jordao.jpg","highlight_type":"nature","family_accessibility_note":"Escolher trilhas curtas e checar clima.","sort_order":3},

    {"destination_slug":"sao-roque-sp","slug":"roteiro-do-vinho","name":"Roteiro do Vinho","description":"Estrada com restaurantes, empórios e áreas abertas. Boa para família quando o foco é almoço sem pressa.","image_path":"sao-roque-sp/roteiro-do-vinho.jpg","highlight_type":"family_accessible","family_accessibility_note":"Priorizar locais com fraldário e espaço externo.","sort_order":1},
    {"destination_slug":"sao-roque-sp","slug":"ski-mountain-park","name":"Ski Mountain Park","description":"Parque com atividades e vista, mais indicado para crianças maiores e famílias que querem gastar energia.","image_path":"sao-roque-sp/ski-mountain-park.jpg","highlight_type":"theme_park","family_accessibility_note":"Checar altura mínima e filas.","sort_order":2},
    {"destination_slug":"sao-roque-sp","slug":"morro-do-cruzeiro","name":"Morro do Cruzeiro","description":"Mirante rápido para ver a cidade e fazer uma pausa visual antes de voltar para a estrada.","image_path":"sao-roque-sp/morro-do-cruzeiro.jpg","highlight_type":"nature","family_accessibility_note":"Ir de carro e evitar sol forte.","sort_order":3},

    {"destination_slug":"atibaia-sp","slug":"parque-edmundo-zanoni","name":"Parque Edmundo Zanoni","description":"Parque com lago, gramado e passeio curto. Boa escolha para criança pequena e família que quer algo simples.","image_path":"atibaia-sp/parque-edmundo-zanoni.jpg","highlight_type":"family_accessible","family_accessibility_note":"Boa opção para carrinho e pausa tranquila.","sort_order":1},
    {"destination_slug":"atibaia-sp","slug":"pedra-grande","name":"Pedra Grande","description":"Mirante símbolo da cidade, com visual de serra. Vale para famílias que aceitam estrada de acesso e vento.","image_path":"atibaia-sp/pedra-grande.jpg","highlight_type":"nature","family_accessibility_note":"Melhor para crianças maiores; segurar bem os pequenos.","sort_order":2},
    {"destination_slug":"atibaia-sp","slug":"teleferico-de-atibaia","name":"Teleférico de Atibaia","description":"Passeio curto e visual, interessante para crianças maiores quando o clima ajuda e a fila está controlada.","image_path":"atibaia-sp/teleferico-de-atibaia.jpg","highlight_type":"city_walk","family_accessibility_note":"Validar operação e fila antes de ir.","sort_order":3},

    {"destination_slug":"olimpia-sp","slug":"hot-beach-olimpia","name":"Hot Beach Olímpia","description":"Parque com estrutura de resort, útil para família que quer lazer concentrado e menos deslocamento.","image_path":"olimpia-sp/hot-beach-olimpia.jpg","highlight_type":"family_accessible","family_accessibility_note":"Planejar sombra, hidratação e pausas.","sort_order":1},
    {"destination_slug":"olimpia-sp","slug":"thermas-dos-laranjais","name":"Thermas dos Laranjais","description":"Parque aquático grande e intenso. Brilha para crianças maiores, mas exige estratégia de descanso.","image_path":"olimpia-sp/thermas-dos-laranjais.jpg","highlight_type":"theme_park","family_accessibility_note":"Evitar pico, calor extremo e filas longas.","sort_order":2},
    {"destination_slug":"olimpia-sp","slug":"vale-dos-dinossauros","name":"Vale dos Dinossauros Olímpia","description":"Passeio temático curto para alternar piscina com algo lúdico fora da água.","image_path":"olimpia-sp/vale-dos-dinossauros.jpg","highlight_type":"theme_park","family_accessibility_note":"Bom como programa complementar.","sort_order":3},

    {"destination_slug":"guaruja-sp","slug":"praia-da-enseada","name":"Praia da Enseada","description":"Orla ampla e com serviços, boa para família que precisa de estrutura perto da areia.","image_path":"guaruja-sp/praia-da-enseada.jpg","highlight_type":"family_accessible","family_accessibility_note":"Escolher trecho calmo e checar mar.","sort_order":1},
    {"destination_slug":"guaruja-sp","slug":"acqua-mundo","name":"Acqua Mundo","description":"Aquário útil como plano B de chuva ou pausa do sol, com visita curta e previsível.","image_path":"guaruja-sp/acqua-mundo.jpg","highlight_type":"culture","family_accessibility_note":"Boa alternativa indoor para crianças.","sort_order":2},
    {"destination_slug":"guaruja-sp","slug":"mirante-do-morro-da-campina","name":"Mirante do Morro da Campina","description":"Vista rápida da praia e da cidade, interessante para fotos sem alongar o roteiro.","image_path":"guaruja-sp/mirante-do-morro-da-campina.jpg","highlight_type":"nature","family_accessibility_note":"Ir de carro e evitar horário de calor.","sort_order":3},

    {"destination_slug":"praia-do-forte-ba","slug":"vila-de-praia-do-forte","name":"Vila de Praia do Forte","description":"Centrinho caminhável com lojas, sorvete e restaurantes. Ajuda a família a sair do resort sem complicar.","image_path":"praia-do-forte-ba/vila-de-praia-do-forte.jpg","highlight_type":"family_accessible","family_accessibility_note":"Melhor no fim de tarde e noite cedo.","sort_order":1},
    {"destination_slug":"praia-do-forte-ba","slug":"projeto-tamar-praia-do-forte","name":"Projeto Tamar Praia do Forte","description":"Passeio educativo, visual e curto, forte para crianças que gostam de animais marinhos.","image_path":"praia-do-forte-ba/projeto-tamar-praia-do-forte.jpg","highlight_type":"culture","family_accessibility_note":"Checar horários de alimentação e lotação.","sort_order":2},
    {"destination_slug":"praia-do-forte-ba","slug":"castelo-garcia-davila","name":"Castelo Garcia D'Ávila","description":"Ruínas históricas com vista e espaço aberto. Melhor para crianças maiores e famílias que aceitam sol.","image_path":"praia-do-forte-ba/castelo-garcia-davila.jpg","highlight_type":"culture","family_accessibility_note":"Levar água, boné e evitar calor forte.","sort_order":3},

    {"destination_slug":"porto-de-galinhas-pe","slug":"praia-de-muro-alto","name":"Praia de Muro Alto","description":"Piscina natural protegida por arrecifes, boa para família quando a maré e o trecho escolhido ajudam.","image_path":"porto-de-galinhas-pe/praia-de-muro-alto.jpg","highlight_type":"family_accessible","family_accessibility_note":"Checar maré e acesso antes de sair.","sort_order":1},
    {"destination_slug":"porto-de-galinhas-pe","slug":"piscinas-naturais-de-porto-de-galinhas","name":"Piscinas Naturais de Porto de Galinhas","description":"Passeio símbolo do destino, bonito e dependente de maré. Exige horário certo e pouca improvisação.","image_path":"porto-de-galinhas-pe/piscinas-naturais-de-porto-de-galinhas.jpg","highlight_type":"beach","family_accessibility_note":"Melhor com criança maior e colete adequado.","sort_order":2},
    {"destination_slug":"porto-de-galinhas-pe","slug":"vila-de-porto-de-galinhas","name":"Vila de Porto de Galinhas","description":"Centrinho turístico para jantar, comprar lembrança e resolver a noite sem grandes deslocamentos.","image_path":"porto-de-galinhas-pe/vila-de-porto-de-galinhas.jpg","highlight_type":"city_walk","family_accessibility_note":"Evitar horários lotados com carrinho.","sort_order":3},

    {"destination_slug":"maragogi-al","slug":"praia-de-antunes","name":"Praia de Antunes","description":"Mar claro e visual forte, bom para família quando a maré está baixa e a logística foi combinada antes.","image_path":"maragogi-al/praia-de-antunes.jpg","highlight_type":"family_accessible","family_accessibility_note":"Checar maré, sombra e estrutura.","sort_order":1},
    {"destination_slug":"maragogi-al","slug":"piscinas-naturais-de-maragogi","name":"Piscinas Naturais de Maragogi","description":"Passeio de maré que rende memória, mas precisa de operador confiável e ritmo calmo com crianças.","image_path":"maragogi-al/piscinas-naturais-de-maragogi.jpg","highlight_type":"beach","family_accessibility_note":"Evitar com bebê em dia de mar mexido.","sort_order":2},
    {"destination_slug":"maragogi-al","slug":"praia-de-barra-grande","name":"Praia de Barra Grande","description":"Praia conhecida pelo caminho de areia na maré baixa, melhor para família que planeja horário e retorno.","image_path":"maragogi-al/praia-de-barra-grande.jpg","highlight_type":"beach","family_accessibility_note":"Depende de maré e caminhada.","sort_order":3},

    {"destination_slug":"foz-do-iguacu-pr","slug":"parque-das-aves","name":"Parque das Aves","description":"Passeio estruturado, visual e educativo, com trilha clara e bom ritmo para famílias.","image_path":"foz-do-iguacu-pr/parque-das-aves.jpg","highlight_type":"family_accessible","family_accessibility_note":"Boa opção com carrinho em muitos trechos.","sort_order":1},
    {"destination_slug":"foz-do-iguacu-pr","slug":"cataratas-do-iguacu","name":"Cataratas do Iguaçu","description":"Experiência de natureza marcante, mas pede cuidado com calor, capas, carrinho e tempo de caminhada.","image_path":"foz-do-iguacu-pr/cataratas-do-iguacu.jpg","highlight_type":"nature","family_accessibility_note":"Planejar pausas e proteção contra água.","sort_order":2},
    {"destination_slug":"foz-do-iguacu-pr","slug":"marco-das-tres-fronteiras","name":"Marco das Três Fronteiras","description":"Programa de fim de tarde com vista, fotos e estrutura para jantar sem apressar a família.","image_path":"foz-do-iguacu-pr/marco-das-tres-fronteiras.jpg","highlight_type":"culture","family_accessibility_note":"Bom com reserva e horário sem pico.","sort_order":3},

    {"destination_slug":"gramado-rs","slug":"lago-negro","name":"Lago Negro","description":"Passeio clássico, bonito e relativamente simples, com caminhada leve e pedalinho para crianças maiores.","image_path":"gramado-rs/lago-negro.jpg","highlight_type":"family_accessible","family_accessibility_note":"Bom para carrinho em ritmo leve.","sort_order":1},
    {"destination_slug":"gramado-rs","slug":"mini-mundo","name":"Mini Mundo","description":"Atração lúdica e compacta, boa para alternar restaurantes e frio com algo visual para crianças.","image_path":"gramado-rs/mini-mundo.jpg","highlight_type":"theme_park","family_accessibility_note":"Checar lotação em férias e feriados.","sort_order":2},
    {"destination_slug":"gramado-rs","slug":"snowland","name":"Snowland","description":"Parque indoor de neve, forte para crianças maiores e útil quando a família quer fugir de chuva.","image_path":"gramado-rs/snowland.jpg","highlight_type":"theme_park","family_accessibility_note":"Confirmar idade, roupa e tempo de permanência.","sort_order":3},

    {"destination_slug":"penha-sc","slug":"praia-alegre","name":"Praia Alegre","description":"Praia de mar mais calmo para uma pausa entre dias de parque, boa quando a família quer roteiro leve.","image_path":"penha-sc/praia-alegre.jpg","highlight_type":"family_accessible","family_accessibility_note":"Checar balneabilidade e estrutura no dia.","sort_order":1},
    {"destination_slug":"penha-sc","slug":"beto-carrero-world","name":"Beto Carrero World","description":"Parque grande e memorável, melhor quando a criança já aproveita shows, áreas temáticas e pausas.","image_path":"penha-sc/beto-carrero-world.jpg","highlight_type":"theme_park","family_accessibility_note":"Planejar filas, altura mínima e descanso.","sort_order":2},
    {"destination_slug":"penha-sc","slug":"praia-de-armacao","name":"Praia de Armação","description":"Praia urbana próxima ao parque, útil para almoço, caminhada e um roteiro menos intenso.","image_path":"penha-sc/praia-de-armacao.jpg","highlight_type":"beach","family_accessibility_note":"Evitar mar agitado e sol forte.","sort_order":3},

    {"destination_slug":"buenos-aires-argentina","slug":"jardin-japones","name":"Jardín Japonés","description":"Parque bonito, plano e com pausa para lanche. Ótimo para desacelerar a cidade com crianças.","image_path":"buenos-aires-argentina/jardin-japones.jpg","highlight_type":"family_accessible","family_accessibility_note":"Boa opção urbana com carrinho.","sort_order":1},
    {"destination_slug":"buenos-aires-argentina","slug":"museo-de-los-ninos-abasto","name":"Museo de los Niños Abasto","description":"Museu interativo em shopping, bom para chuva, frio e crianças que precisam brincar de verdade.","image_path":"buenos-aires-argentina/museo-de-los-ninos-abasto.jpg","highlight_type":"culture","family_accessibility_note":"Checar idade indicada e horários.","sort_order":2},
    {"destination_slug":"buenos-aires-argentina","slug":"caminito-la-boca","name":"Caminito La Boca","description":"Rua colorida e turística para visita curta. Funciona melhor de dia, com rota definida e sem improviso.","image_path":"buenos-aires-argentina/caminito-la-boca.jpg","highlight_type":"city_walk","family_accessibility_note":"Ir de dia e controlar tempo de exposição.","sort_order":3},

    {"destination_slug":"orlando-fl","slug":"disney-springs","name":"Disney Springs","description":"Área aberta com lojas, restaurantes e clima Disney sem ingresso de parque. Boa para chegada ou dia leve.","image_path":"orlando-fl/disney-springs.jpg","highlight_type":"family_accessible","family_accessibility_note":"Boa para carrinho, refeições e descanso.","sort_order":1},
    {"destination_slug":"orlando-fl","slug":"magic-kingdom","name":"Magic Kingdom","description":"Parque mais simbólico da Disney, mas exige estratégia de filas, descanso, alimentação e expectativa real.","image_path":"orlando-fl/magic-kingdom.jpg","highlight_type":"theme_park","family_accessibility_note":"Planejar pausas e altura mínima.","sort_order":2},
    {"destination_slug":"orlando-fl","slug":"animal-kingdom","name":"Animal Kingdom","description":"Parque com animais, shows e áreas verdes, bom para equilibrar encanto e ritmo menos urbano.","image_path":"orlando-fl/animal-kingdom.jpg","highlight_type":"theme_park","family_accessibility_note":"Checar calor, distâncias e pausas.","sort_order":3}
  ]
  $spots$::jsonb) as x(destination_slug text, slug text, name text, description text, image_path text, highlight_type text, family_accessibility_note text, sort_order int)
)
insert into public.tourism_spots (
  destination_slug,
  slug,
  name,
  description,
  image_path,
  highlight_type,
  family_accessibility_note,
  sort_order,
  curation_status
)
select
  destination_slug,
  slug,
  name,
  description,
  image_path,
  highlight_type,
  family_accessibility_note,
  sort_order,
  'generated_needs_review'
from spot_rows
on conflict (destination_slug, slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_path = excluded.image_path,
  highlight_type = excluded.highlight_type,
  family_accessibility_note = excluded.family_accessibility_note,
  sort_order = excluded.sort_order,
  curation_status = excluded.curation_status,
  updated_at = now();

with event_rows as (
  select *
  from jsonb_to_recordset($events$
  [
    {"destination_slug":"campinas-sp","slug":"festival-gastronomico-de-campinas","name":"Festival Gastronômico de Campinas","description":"Bom para famílias que querem comer bem sem sair da cidade, com programação que varia por edição.","image_path":"campinas-sp/festival-gastronomico-de-campinas.jpg","event_type":"gastronomy","start_date":"2026-08-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"campinas-sp","slug":"natal-caminhos-dos-sonhos-campinas","name":"Natal Caminhos dos Sonhos Campinas","description":"Programação de fim de ano com luzes e passeios curtos, útil para crianças pequenas quando há agenda oficial.","image_path":"campinas-sp/natal-caminhos-dos-sonhos-campinas.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"dourado-sp","slug":"aniversario-de-dourado","name":"Aniversário de Dourado","description":"Agenda cívica local com praça, shows e comida simples; vale checar programação antes de sair do hotel.","image_path":"dourado-sp/aniversario-de-dourado.jpg","event_type":"civic","start_date":"2026-05-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"dourado-sp","slug":"festa-do-peao-de-dourado","name":"Festa do Peão de Dourado","description":"Evento regional com grande movimento; só combina com família se logística, som e horários forem adequados.","image_path":"dourado-sp/festa-do-peao-de-dourado.jpg","event_type":"festival","start_date":"2026-09-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"campos-do-jordao-sp","slug":"festival-de-inverno-de-campos-do-jordao","name":"Festival de Inverno de Campos do Jordão","description":"Música e cidade cheia no inverno. Bom para cultura, mas pede reserva, agasalho e plano contra lotação.","image_path":"campos-do-jordao-sp/festival-de-inverno-de-campos-do-jordao.jpg","event_type":"culture","start_date":"2026-07-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"campos-do-jordao-sp","slug":"natal-dos-sonhos-campos-do-jordao","name":"Natal dos Sonhos Campos do Jordão","description":"Luzes e programação de fim de ano em clima de serra, boa para criança que já aproveita caminhada curta.","image_path":"campos-do-jordao-sp/natal-dos-sonhos-campos-do-jordao.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"sao-roque-sp","slug":"expo-sao-roque","name":"Expo São Roque","description":"Evento tradicional de vinho e alcachofra, bom para almoço em família quando há estrutura e horário leve.","image_path":"sao-roque-sp/expo-sao-roque.jpg","event_type":"gastronomy","start_date":"2026-10-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"sao-roque-sp","slug":"vindima-de-sao-roque","name":"Vindima de São Roque","description":"Temporada ligada à uva e ao vinho, útil para pais que querem passeio gastronômico perto da capital.","image_path":"sao-roque-sp/vindima-de-sao-roque.jpg","event_type":"gastronomy","start_date":"2026-01-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"atibaia-sp","slug":"festa-de-flores-e-morangos-de-atibaia","name":"Festa de Flores e Morangos de Atibaia","description":"Evento visual e gastronômico, forte para famílias que querem passeio de dia e estrutura previsível.","image_path":"atibaia-sp/festa-de-flores-e-morangos-de-atibaia.jpg","event_type":"gastronomy","start_date":"2026-09-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"atibaia-sp","slug":"festival-de-inverno-de-atibaia","name":"Festival de Inverno de Atibaia","description":"Programação sazonal para combinar resort, frio leve e passeio curto, desde que horários estejam claros.","image_path":"atibaia-sp/festival-de-inverno-de-atibaia.jpg","event_type":"culture","start_date":"2026-07-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"olimpia-sp","slug":"festival-do-folclore-de-olimpia","name":"Festival do Folclore de Olímpia","description":"Evento cultural tradicional da cidade, bom para criança maior quando a família quer sair do circuito aquático.","image_path":"olimpia-sp/festival-do-folclore-de-olimpia.jpg","event_type":"culture","start_date":"2026-08-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"olimpia-sp","slug":"natal-de-olimpia","name":"Natal de Olímpia","description":"Programação de fim de ano pode complementar hotel e parque, mas precisa de agenda oficial atualizada.","image_path":"olimpia-sp/natal-de-olimpia.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"guaruja-sp","slug":"verao-no-guaruja","name":"Verão no Guarujá","description":"Temporada com mais serviços e movimento; boa para praia estruturada, ruim para quem quer silêncio.","image_path":"guaruja-sp/verao-no-guaruja.jpg","event_type":"seasonal","start_date":"2026-01-01","is_recurring":true,"schedule_precision":"season","sort_order":1},
    {"destination_slug":"guaruja-sp","slug":"natal-luz-guaruja","name":"Natal Luz Guarujá","description":"Agenda de fim de ano com luzes e passeios urbanos, útil como plano leve depois da praia.","image_path":"guaruja-sp/natal-luz-guaruja.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"praia-do-forte-ba","slug":"temporada-da-baleia-jubarte","name":"Temporada da Baleia Jubarte","description":"Observação de baleias pode ser marcante, mas só vale com operador sério, mar adequado e criança preparada.","image_path":"praia-do-forte-ba/temporada-da-baleia-jubarte.jpg","event_type":"nature","start_date":"2026-07-01","is_recurring":true,"schedule_precision":"season","sort_order":1},
    {"destination_slug":"praia-do-forte-ba","slug":"festival-tamar-de-ferias","name":"Festival Tamar de Férias","description":"Programação educativa sazonal do Tamar pode enriquecer a viagem sem exigir deslocamento longo.","image_path":"praia-do-forte-ba/festival-tamar-de-ferias.jpg","event_type":"culture","start_date":"2026-01-01","is_recurring":true,"schedule_precision":"season","sort_order":2},

    {"destination_slug":"porto-de-galinhas-pe","slug":"festival-de-jazz-de-porto-de-galinhas","name":"Festival de Jazz de Porto de Galinhas","description":"Evento musical para noite mais cultural, melhor para famílias com crianças que toleram horário e movimento.","image_path":"porto-de-galinhas-pe/festival-de-jazz-de-porto-de-galinhas.jpg","event_type":"culture","start_date":"2026-09-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"porto-de-galinhas-pe","slug":"sao-joao-de-ipojuca","name":"São João de Ipojuca","description":"Festa junina regional com comida e música; exige cuidado com horário, som e retorno ao hotel.","image_path":"porto-de-galinhas-pe/sao-joao-de-ipojuca.jpg","event_type":"culture","start_date":"2026-06-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"maragogi-al","slug":"sao-joao-de-maragogi","name":"São João de Maragogi","description":"Festa junina local para sentir cultura nordestina, melhor com crianças maiores e retorno combinado.","image_path":"maragogi-al/sao-joao-de-maragogi.jpg","event_type":"culture","start_date":"2026-06-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"maragogi-al","slug":"temporada-das-piscinas-naturais","name":"Temporada das Piscinas Naturais","description":"Não é festa, mas é o grande calendário do destino: maré certa define se a viagem entrega o esperado.","image_path":"maragogi-al/temporada-das-piscinas-naturais.jpg","event_type":"nature","start_date":"2026-09-01","is_recurring":true,"schedule_precision":"season","sort_order":2},

    {"destination_slug":"foz-do-iguacu-pr","slug":"natal-aguas-e-luzes","name":"Natal Águas e Luzes","description":"Programação de fim de ano com luzes e cidade preparada, boa para combinar natureza e noite leve.","image_path":"foz-do-iguacu-pr/natal-aguas-e-luzes.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"foz-do-iguacu-pr","slug":"festival-das-cataratas","name":"Festival das Cataratas","description":"Evento de turismo que movimenta a cidade; útil para prever ocupação, tarifas e agenda local.","image_path":"foz-do-iguacu-pr/festival-das-cataratas.jpg","event_type":"business_tourism","start_date":"2026-06-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"gramado-rs","slug":"natal-luz-de-gramado","name":"Natal Luz de Gramado","description":"Grande evento de fim de ano, encantador e cheio. Só vale com reserva, agasalho e tolerância a fila.","image_path":"gramado-rs/natal-luz-de-gramado.jpg","event_type":"seasonal","start_date":"2026-10-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"gramado-rs","slug":"festival-de-cinema-de-gramado","name":"Festival de Cinema de Gramado","description":"Evento cultural famoso que eleva movimento e tarifas; bom para pais cinéfilos, menos para rotina de bebê.","image_path":"gramado-rs/festival-de-cinema-de-gramado.jpg","event_type":"culture","start_date":"2026-08-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"penha-sc","slug":"natal-do-beto-carrero","name":"Natal do Beto Carrero","description":"Programação sazonal do parque pode encantar, mas pede checagem de datas, filas e horários dos shows.","image_path":"penha-sc/natal-do-beto-carrero.jpg","event_type":"seasonal","start_date":"2026-12-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"penha-sc","slug":"festival-de-frutos-do-mar-de-penha","name":"Festival de Frutos do Mar de Penha","description":"Boa porta para culinária local, desde que a família priorize almoço e evite noite muito cheia.","image_path":"penha-sc/festival-de-frutos-do-mar-de-penha.jpg","event_type":"gastronomy","start_date":"2026-07-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"buenos-aires-argentina","slug":"feria-del-libro-buenos-aires","name":"Feria del Libro Buenos Aires","description":"Evento cultural grande, bom para pais leitores e crianças maiores, com cuidado para lotação e tempo de visita.","image_path":"buenos-aires-argentina/feria-del-libro-buenos-aires.jpg","event_type":"culture","start_date":"2026-04-01","is_recurring":true,"schedule_precision":"month","sort_order":1},
    {"destination_slug":"buenos-aires-argentina","slug":"carnaval-porteno","name":"Carnaval Porteño","description":"Murgas e rua movimentada; pode ser cultural, mas exige horário seguro e criança que tolere som.","image_path":"buenos-aires-argentina/carnaval-porteno.jpg","event_type":"culture","start_date":"2026-02-01","is_recurring":true,"schedule_precision":"month","sort_order":2},

    {"destination_slug":"orlando-fl","slug":"epcot-flower-and-garden-festival","name":"Epcot Flower & Garden Festival","description":"Evento sazonal com jardins, comida e áreas fotogênicas, melhor para famílias que já terão ingresso Disney.","image_path":"orlando-fl/epcot-flower-and-garden-festival.jpg","event_type":"theme_park","start_date":"2026-03-01","is_recurring":true,"schedule_precision":"season","sort_order":1},
    {"destination_slug":"orlando-fl","slug":"mickeys-not-so-scary-halloween-party","name":"Mickey's Not-So-Scary Halloween Party","description":"Evento pago de Halloween no Magic Kingdom; só faz sentido se horário, fantasia e custo couberem.","image_path":"orlando-fl/mickeys-not-so-scary-halloween-party.jpg","event_type":"theme_park","start_date":"2026-08-01","is_recurring":true,"schedule_precision":"season","sort_order":2}
  ]
  $events$::jsonb) as x(destination_slug text, slug text, name text, description text, image_path text, event_type text, start_date date, is_recurring boolean, schedule_precision text, sort_order int)
)
insert into public.tourism_events (
  destination_slug,
  slug,
  name,
  description,
  image_path,
  event_type,
  start_date,
  is_recurring,
  schedule_precision,
  curation_status,
  sort_order
)
select
  destination_slug,
  slug,
  name,
  description,
  image_path,
  event_type,
  start_date,
  is_recurring,
  schedule_precision,
  'needs_schedule_verification',
  sort_order
from event_rows
on conflict (destination_slug, slug) do update set
  name = excluded.name,
  description = excluded.description,
  image_path = excluded.image_path,
  event_type = excluded.event_type,
  start_date = excluded.start_date,
  is_recurring = excluded.is_recurring,
  schedule_precision = excluded.schedule_precision,
  curation_status = excluded.curation_status,
  sort_order = excluded.sort_order,
  updated_at = now();

create or replace view public.destination_tourism_content as
select
  d.destination_slug,
  d.destination_name,
  d.city,
  d.state,
  d.country,
  d.concierge_destination_slug,
  d.image_folder,
  d.curation_status,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', s.slug,
      'name', s.name,
      'description', s.description,
      'image_path', s.image_path,
      'highlight_type', s.highlight_type,
      'family_accessibility_note', s.family_accessibility_note,
      'curation_status', s.curation_status
    ) order by s.sort_order), '[]'::jsonb)
    from public.tourism_spots s
    where s.destination_slug = d.destination_slug
  ) as tourist_spots,
  (
    select coalesce(jsonb_agg(jsonb_build_object(
      'slug', e.slug,
      'name', e.name,
      'description', e.description,
      'image_path', e.image_path,
      'event_type', e.event_type,
      'start_date', e.start_date,
      'is_recurring', e.is_recurring,
      'schedule_precision', e.schedule_precision,
      'curation_status', e.curation_status
    ) order by e.sort_order), '[]'::jsonb)
    from public.tourism_events e
    where e.destination_slug = d.destination_slug
  ) as events
from public.tourism_destinations d;

create or replace view public.tourism_image_manifest as
select
  destination_slug,
  slug as item_slug,
  name,
  image_path,
  'tourist_spot'::text as item_type,
  curation_status
from public.tourism_spots
union all
select
  destination_slug,
  slug as item_slug,
  name,
  image_path,
  'event'::text as item_type,
  curation_status
from public.tourism_events;

grant select on public.destination_tourism_content to anon, authenticated;
grant select on public.tourism_image_manifest to anon, authenticated;

commit;
