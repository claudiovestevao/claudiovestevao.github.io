# Supabase Data Quality Audit

Auditoria executada em 2026-06-07 para o Concierge da Familia.

## Resultado executivo

- Fonte ativa do site: `vw_destinations_for_sp_families`.
- Destinos ativos: 152.
- View curada: 152 linhas.
- Duplicidade critica: 0 slugs duplicados, 0 pares nome/estado duplicados.
- Orfaos: 0 em hoteis, Google Places e rotas.
- Mojibake detectado no banco vivo: 0 linhas nos campos auditados.
- Score familiar na view: 100% coberto.
- Tags na view: 100% cobertas.
- Pontos de atencao na view: 100% cobertos.

## Saneamentos aplicados

- Enriquecidas 78 coordenadas via Google Geocoding API.
- Enriquecidas mais 5 coordenadas por cidade-base segura.
- Mantidos sem coordenada apenas 2 destinos genericos:
  - `resort-interior-sp`
  - `hotel-fazenda-sp`
- Corrigido `state` de `buenos-aires`.
- Inseridas 545 linhas em `destination_scores` para os perfis:
  - `primeira_viagem_com_bebe`
  - `toddler_1_3y`
  - `crianca_3_5y`
  - `familia_quer_resort`
- Inseridas 705 tags derivadas em `destination_tags`.
- Normalizadas 131 labels tecnicas de escopo para labels editoriais.
- Inseridos 3 riscos editoriais em `destination_risk_factors`.
- Atualizados 5 registros de `destination_origin_access` com pontos de atencao.

## Estado final

| Dimensao | Resultado |
| --- | ---: |
| `destinations` | 152 |
| `destination_google_places` | 6 |
| `destination_hotels` | 56 |
| `destination_sp_route` | 67 |
| `destination_scores` | 629 |
| `destination_tags` | 818 |
| `destination_risk_factors` | 125 |
| `vw_destinations_for_sp_families` | 152 |
| `destination_stay_summary` | 6 |
| `destination_map_points` | 150 |

## Pendencias

- A tabela `family_destination_catalog_1001` ainda nao existe no Supabase vivo; o site usa a view curada de 152 destinos e mantem fallback estatico de 1001 candidatos no codigo.
- A tabela `destination_enrichment_jobs` ainda nao existe no Supabase vivo; o cron de enriquecimento precisa dessa migration para operar.
- 17 rotas em `destination_sp_route` estao com `ZERO_RESULTS`, em geral por destinos internacionais ou regioes em que rota de carro desde Sao Paulo nao se aplica.
- Apenas 6 destinos tem camada completa de Google Places, hoteis e resumo de estadia. Essa deve ser a proxima frente de enriquecimento.

## Proxima estrategia de enriquecimento

1. Aplicar migration da fila `destination_enrichment_jobs`.
2. Rodar enriquecimento incremental por prioridade:
   - Top destinos SP/familia.
   - Destinos com score alto e sem Google Places.
   - Destinos com score alto e sem hoteis.
3. Persistir sempre a linhagem:
   - API externa.
   - Curadoria editorial.
   - Score calculado.
4. Bloquear recomendacao de hotel sem foto real, rating e requisitos familiares minimos.
