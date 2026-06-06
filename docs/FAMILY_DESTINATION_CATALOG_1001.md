# Family Destination Catalog 1001

Base ampla de 1001 destinos candidatos para famílias, criada para expandir o funil do Concierge da Família sem misturar catálogo amplo com recomendação final.

## O que foi criado

- Fonte estática: `agentes/concierge-da-familia/src/data/familyDestinationCatalog1001.js`
- Gerador: `agentes/concierge-da-familia/scripts/generateFamilyDestinationCatalog1001.mjs`
- Migration Supabase: `supabase/migrations/0030_seed_family_destination_catalog_1001.sql`
- Testes: `agentes/concierge-da-familia/tests/family_destination_catalog_1001.test.mjs`

## Contrato

- Exatamente 1001 destinos.
- Slugs únicos.
- Cobertura das 27 UFs.
- Coordenadas e código IBGE para cada destino.
- Separação explícita entre:
  - `known_family_destination`: destinos já conhecidos pela curadoria editorial.
  - `family_destination_candidate`: candidatos que ainda precisam de validação de hotéis, atrações, fotos e dados vivos.

## Regra de produto

Esta base não deve virar ranking final automaticamente.

Um destino só deve aparecer como recomendação forte quando houver validação mínima de:

- hospedagem familiar;
- logística real a partir da origem;
- atrações/restaurantes adequados;
- fotos reais;
- sinais públicos de avaliação;
- riscos de sazonalidade e lotação.

Por isso, todos os itens da base 1001 entram com `minimumFamilyRequirementsPassed = false`.

## Fontes

- Registro/identificação municipal: IBGE Localidades.
- Coordenadas municipais: dataset público `kelvins/Municipios-Brasileiros`, arquivo `csv/municipios.csv`, com código IBGE, município, UF, latitude e longitude.

## Supabase

A migration `0030_seed_family_destination_catalog_1001.sql` é idempotente e:

- cria `public.family_destination_catalog_1001`;
- faz upsert dos 1001 destinos nessa tabela;
- faz upsert dos mesmos slugs em `public.destinations`;
- preserva dados calculados em `ai_calculated_data`;
- preserva curadoria em `curated_data`;
- habilita RLS e leitura pública da tabela de catálogo.

Aplicação no banco oficial exige acesso admin/Supabase CLI logada ou `service_role`.
