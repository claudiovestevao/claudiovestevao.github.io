# Next Market Stack

Esta camada adiciona uma arquitetura mais alinhada com produto de mercado sem remover o site estático atual.

## Estrutura

- `apps/web`: aplicação Next.js App Router.
- `apps/web/app`: páginas e API routes.
- `apps/web/lib`: serviços server-side.
- `apps/web/components`: componentes React.
- `supabase/migrations/0031_destination_search_and_enrichment_jobs.sql`: índices de busca e fila de enriquecimento.
- `vercel.json`: build e cron diário.

## Stack

- Frontend/app: Next.js App Router + React.
- UI bootstrap: Bootstrap 5 + componentes próprios.
- Banco: Supabase Postgres.
- Integrações: API routes server-side e/ou Supabase Edge Functions.
- Busca: Postgres com índices btree, GIN e trigram.
- Enriquecimento: cron Vercel chamando `/api/cron/enrich-destinations`.
- Fallback: catálogo estático `familyDestinationCatalog1001.js` quando Supabase server-side não estiver configurado.

## Variáveis de ambiente

Obrigatórias para produção com Supabase:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
NEXT_PUBLIC_SITE_URL=
```

O frontend não deve receber `service_role`. A app usa essa chave apenas em rotas server-side.

## Comandos

```bash
npm install
npm run web:dev
npm run web:build
npm test
```

## Deploy

Vercel:

- Root: repositório.
- Build command: `npm run web:build`.
- Install command: `npm install`.
- Framework: Next.js.

Cloudflare Pages/Workers:

- Usar adapter compatível com Next.js quando a decisão de plataforma for fechada.
- Manter as APIs server-side em Functions/Workers.

## Regra de produto

O catálogo 1001 amplia descoberta. Ele não transforma automaticamente um destino em recomendação final. Hotéis recomendados continuam exigindo validação familiar mínima, fotos reais, rota, avaliações e disponibilidade rastreável.
