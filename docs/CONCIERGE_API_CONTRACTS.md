# Concierge API Contracts

Status: contrato oficial server-side para integrações externas do Concierge da Família.

## Regra Principal

O frontend do GitHub Pages nunca chama Google, Pexels, OpenAI, Booking Demand, e-mail ou WhatsApp diretamente. Ele só pode consumir:

- views/tabelas públicas do Supabase com RLS;
- links já persistidos em `affiliate_links`;
- a Edge Function `supabase/functions/concierge-api`.

Todas as chaves externas ficam em variáveis de ambiente da Edge Function.

## Edge Function

Função: `concierge-api`

Requisição:

```json
{
  "action": "search-places",
  "payload": {}
}
```

Cabeçalho recomendado:

```http
x-concierge-session: <session_id_anonimo>
```

## Actions

| Action | API | Persistência | Observação |
|---|---|---|---|
| `search-places` | Google Places Text Search (New) | `places`, `accommodations`, `attractions` | Deduplica por `place_id`. |
| `place-photo` | Google Place Photos (New) | `photos` | Só para estabelecimento/POI específico. |
| `pexels-search` | Pexels Search Photos | `photos`, `api_cache` | Apenas editorial/inspiracional de destino. |
| `geocode` | Google Geocoding | `search_requests`, cache | Aceita CEP, bairro, cidade ou endereço. |
| `route` | Google Routes API | `search_requests`, cache | Classifica dificuldade familiar. |
| `recommend` | Motor próprio + OpenAI opcional | `family_scores` | IA só explica dados reais recebidos. |
| `booking-link` | MVP afiliado Booking | `affiliate_links` | Não promete preço/disponibilidade real. |
| `estimate-cost` | Motor próprio | cache opcional | Retorna faixas econômico/conforto/premium. |
| `send-email` | Resend | `search_requests`, `api_error_logs` | Exige `consentContact`. |
| `prepare-whatsapp` | Meta WhatsApp futuro | nenhum envio obrigatório | MVP prepara payload, não torna WhatsApp obrigatório. |

## Variáveis de Ambiente

Obrigatórias para a Edge Function operar em produção:

```txt
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_MAPS_API_KEY
PEXELS_API_KEY
OPENAI_API_KEY
BOOKING_AFFILIATE_ID
RESEND_API_KEY
TRANSACTIONAL_EMAIL_FROM
WHATSAPP_API_TOKEN
WHATSAPP_PHONE_NUMBER_ID
CONCIERGE_CACHE_MINUTES
CONCIERGE_RATE_LIMIT_WINDOW_MS
CONCIERGE_RATE_LIMIT_MAX
```

`OPENAI_API_KEY`, `RESEND_API_KEY` e `WHATSAPP_API_TOKEN` podem ficar ausentes no MVP: a função usa fallback controlado e registra erro quando necessário.

Para desenvolvimento local:

```txt
CONCIERGE_API_MOCKS=1
```

## Contratos de Imagem

- Foto de hotel, pousada, resort, restaurante e atração específica: `Google Place Photos`.
- Pexels: somente imagem editorial/inspiracional de destino.
- Se Google não tiver foto de um hotel, o site não deve substituir por foto genérica. Deve mostrar fallback honesto ou foto manual verificada.
- Toda foto Pexels precisa salvar `photographer`, `photographer_url`, `photo_url`, `src_original`, `src_large` e `attribution_text`.

## Cobertura Google Places Publicada

Enquanto a migration `0029_concierge_api_contracts.sql` e a Edge Function não estiverem aplicadas no Supabase vivo, o site usa uma camada estática gerada server-side por `agentes/concierge-da-familia/scripts/syncGooglePlacesCoverage.mjs`.

- Entrada: 15 destinos editoriais, 17 cidades exibidas no quiz e 21 hotéis curados.
- Saída versionada: `agentes/concierge-da-familia/src/data/conciergeGooglePlacesCoverage.js`.
- Chave: `GOOGLE_MAPS_API_KEY` somente em variável de ambiente local/servidor; nunca no frontend.
- Contrato mínimo por destino/hotel: `placeId`, `googleName`, `formattedAddress`, `latitude`, `longitude`, categorias e pelo menos 3 referências de foto.
- Contrato adicional por hotel: `rating`, `userRatingCount`, `websiteUri` e `phoneNumber`.
- Teste: `node --test agentes/concierge-da-familia/tests/*.test.mjs`.

## Contratos de Recomendação

- `recommend` recebe candidatos reais da base/API.
- O motor filtra hotéis que não passam requisitos mínimos familiares.
- Selos:
  - `gold`: excelente para famílias.
  - `silver`: bom, com poucos alertas.
  - `bronze`: viável, exige planejamento.
  - `not_recommended`: não deve ser exibido como recomendação.
- OpenAI pode gerar explicação humanizada, mas recebe somente JSON real e é instruído a não inventar hotéis, preços, fotos ou disponibilidade.

## LGPD

- `user_preferences` guarda apenas o necessário para recomendação.
- `search_requests` registra intenção e contexto sem exigir contato.
- E-mail transacional exige `consentContact`.
- `user_preferences.deletion_requested_at` suporta pedido de exclusão.
- WhatsApp não é obrigatório no MVP.

## Testes

Rodar:

```bash
node --test tests/*.test.mjs
```

Cobertura básica:

- normalização Google Places;
- bloqueio de Pexels para foto específica de hotel;
- atribuição Pexels;
- score familiar e requisitos mínimos;
- dificuldade de rota;
- link afiliado Booking rastreável;
- estimador financeiro por faixa;
- consentimento para e-mail;
- validação de env server-side.

## Deploy

Pré-requisitos locais:

```bash
npm.cmd exec supabase -- login
npm.cmd exec supabase -- link --project-ref roojvzpicxnnqjrrdpdx
```

Aplicar schema:

```bash
npm.cmd exec supabase -- db push
```

Configurar secrets da Edge Function, sempre no Supabase, nunca no frontend:

```bash
npm.cmd exec supabase -- secrets set GOOGLE_MAPS_API_KEY=...
npm.cmd exec supabase -- secrets set PEXELS_API_KEY=...
npm.cmd exec supabase -- secrets set OPENAI_API_KEY=...
npm.cmd exec supabase -- secrets set BOOKING_AFFILIATE_ID=...
npm.cmd exec supabase -- secrets set RESEND_API_KEY=...
npm.cmd exec supabase -- secrets set TRANSACTIONAL_EMAIL_FROM=...
npm.cmd exec supabase -- secrets set WHATSAPP_API_TOKEN=...
npm.cmd exec supabase -- secrets set WHATSAPP_PHONE_NUMBER_ID=...
npm.cmd exec supabase -- secrets set CONCIERGE_CACHE_MINUTES=1440
npm.cmd exec supabase -- secrets set CONCIERGE_RATE_LIMIT_WINDOW_MS=60000
npm.cmd exec supabase -- secrets set CONCIERGE_RATE_LIMIT_MAX=40
```

Publicar função:

```bash
npm.cmd exec supabase -- functions deploy concierge-api --project-ref roojvzpicxnnqjrrdpdx
```

Smoke test com mocks:

```bash
npm.cmd exec supabase -- secrets set CONCIERGE_API_MOCKS=1
curl -X POST "https://roojvzpicxnnqjrrdpdx.supabase.co/functions/v1/concierge-api" \
  -H "Authorization: Bearer <SUPABASE_ANON_OR_PUBLISHABLE_KEY>" \
  -H "Content-Type: application/json" \
  -H "x-concierge-session: smoke-test" \
  -d "{\"action\":\"search-places\",\"payload\":{\"query\":\"Atibaia resort familia\",\"mock\":true}}"
```

Depois do smoke test, remover mock:

```bash
npm.cmd exec supabase -- secrets unset CONCIERGE_API_MOCKS
```
