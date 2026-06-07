# Live Integrations Status - 2026-06-07

## Google Places / Photos / Routes

Status: aplicado em produção de dados e integrado ao app Next.js.

- `destination_google_places`: 218 linhas.
- Destinos ativos com Google Place primário: 170/170.
- `destination_primary_rating`: 170 linhas.
- `destination_stay_summary`: 170 linhas.
- `destination_sp_route`: 170 linhas.
- Rotas de carro com status Google `OK`: 129.
- Rotas não aplicáveis/sem rota de carro real desde São Paulo: 41.
- Hotéis enriquecidos adicionalmente via Google Places: 48 novos registros em `destination_google_places`.

Observação: fotos Google são servidas em tempo real pelo endpoint server-side `/api/google/destination`, porque o schema real do Supabase ainda não possui tabela `photos` aplicada.

## Supabase DDL

Status: bloqueado por falta de credencial SQL/plataforma.

- `destination_events` segue vazia.
- A migration `0033_drop_empty_destination_events.sql` está versionada.
- A service role REST não executa DDL.
- A API Supabase Platform retornou 401 com a service role.

Para aplicar, é necessário `SUPABASE_ACCESS_TOKEN` da plataforma ou senha Postgres.

## Reviews reais

Status: aplicado com fonte Google.

- Reviews textuais são retornados pelo Google Place Details em tempo real no app.
- O enriquecimento persistiu `latest_reviews`, `family_reviews_summary` e `family_review_count` em `destination_google_places` quando disponíveis.
- Nenhum depoimento foi inventado.

## Resend

Status: rota implementada, variável pendente.

- Endpoint criado: `/api/email/recommendation`.
- Exige consentimento (`consentContact=true`).
- Usa `RESEND_API_KEY` e `TRANSACTIONAL_EMAIL_FROM`.
- A Vercel ainda não tem `RESEND_API_KEY` configurada neste projeto.
