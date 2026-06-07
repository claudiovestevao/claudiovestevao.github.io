# Supabase Data Quality Audit - Concierge da Familia

Data da auditoria: 2026-06-07

## Resultado executivo

- Todas as tabelas/views listadas pelo usuario foram lidas via API Supabase.
- A base agora tem 170 destinos ativos.
- A planilha `base_destinos_familia_sp_mvp.xlsx` tem 92 linhas na aba `Destinos`.
- Cobertura final da planilha no Supabase/site: 92/92 linhas cobertas.
- Duplicatas criticas em `destinations`: 0 por slug e 0 por nome/estado/pais.
- Orfaos em tabelas filhas com `destination_id`: 0.
- Views do site:
  - `vw_destinations_for_sp_families`: 170 linhas.
  - `vw_destination_cards_for_concierge`: 170 linhas.

## Saneamentos aplicados

- Inseridos/atualizados 18 destinos que estavam na planilha, mas nao estavam cobertos no Supabase:
  - Campinas / Vinhedo
  - Sorocaba
  - Aparecida
  - Ouro Preto
  - Florenca / Toscana
  - Curacao
  - Toquio
  - Osaka / Kyoto
  - Dubai
  - Abu Dhabi
  - Doha
  - Singapura
  - Sydney
  - Cape Town
  - Maldivas
  - Honolulu / Oahu
  - Vancouver
  - Toronto / Niagara
- Para esses destinos, foram adicionados dados derivados da planilha:
  - `destinations`
  - `destination_tags`
  - `destination_seasonality`
  - `destination_origin_access`
  - `destination_risk_factors`
- Reexecutado enriquecimento de tipos de hospedagem:
  - `destination_recommended_property_types`: 397 linhas.
  - `destination_tags` de hospedagem: chale, cabana, casa de temporada etc.
- Recalculados scores e fits:
  - `destination_scores`: 1.870 linhas.
  - `destination_family_fit`: 1.870 linhas.

## Contagem por tabela/view

| Tabela/View | Linhas |
|---|---:|
| br_public_holidays | 30 |
| destination_climate_normals | 648 |
| destination_event_demand | 67 |
| destination_events | 0 |
| destination_family_fit | 1870 |
| destination_google_places | 6 |
| destination_hotel_cards | 56 |
| destination_hotels | 56 |
| destination_map_points | 168 |
| destination_origin_access | 181 |
| destination_primary_rating | 6 |
| destination_recommended_property_types | 397 |
| destination_risk_factors | 171 |
| destination_scores | 1870 |
| destination_seasonality | 474 |
| destination_sp_route | 67 |
| destination_stay_summary | 6 |
| destination_tags | 1108 |
| destinations | 170 |
| family_profiles | 11 |
| origin_transport_hubs | 6 |
| travel_origins | 1 |
| vw_destination_cards_for_concierge | 170 |
| vw_destinations_for_sp_families | 170 |

## Tabela vazia

`destination_events` esta vazia e nao e usada pelo app Next.js nem pelo motor de score atual. O resumo de demanda/eventos usado hoje esta em `destination_event_demand`.

Foi versionada a migration `supabase/migrations/0033_drop_empty_destination_events.sql` para remover essa tabela quando houver execucao SQL/migration contra o projeto Supabase. Ela nao foi aplicada via REST porque drop de tabela exige conexao SQL/Postgres ou pipeline de migrations.

## Scripts adicionados

- `scripts/audit-supabase-data-quality.mjs`: auditoria recorrente de tabelas, duplicatas, orfaos e cobertura da planilha.
- `scripts/ingest-excel-mvp-destinations.mjs`: ingestao idempotente dos destinos faltantes do Excel.
- `scripts/broaden-family-property-types.mjs`: ampliacao de tipos de hospedagem familiares.
- `scripts/recalculate-family-scores.mjs`: recalculo de scores e fits.

## Observacoes de qualidade

- `destination_google_places`, `destination_primary_rating` e `destination_stay_summary` ainda tem baixa cobertura, com 6 linhas cada. Elas estao corretas para os dados reais ja enriquecidos, mas devem crescer via fila/cron de Google Places.
- `destination_sp_route` e `destination_event_demand` cobrem 67 destinos. Os novos destinos vindos do Excel receberam estimativas iniciais em `destination_origin_access`, mas rotas reais Google/Mapbox ainda devem ser enriquecidas em lote.
- Destinos vindos do Excel foram marcados como `is_placeholder = true` por ainda serem curadoria inicial e precisarem validacao por APIs externas.
