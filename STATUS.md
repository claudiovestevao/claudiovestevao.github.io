# STATUS.md — Handoff Codex → Claude (12/07/2026)

Fonte de verdade do estado do projeto minha-viagem. Toda sessão (Claude ou Codex) começa lendo este arquivo e o atualiza ao final.

## Arquitetura real (verificada no código)

- **App**: Next.js em `apps/web`, rota `/minha-viagem` (site claudiocode.dev, deploy Vercel)
- **Auth**: senha própria da família (`TravelPasswordAuth`) + Google callback + recover/reset
- **Dados**: Supabase (project `roojvzpicxnnqjrrdpdx`) — migrations `0035` (auth privada), `0036` (diário WhatsApp), `0037` (diário vídeos); estado do robô em Supabase Storage (bucket `orlando-trip-private`, `proactive/v1.json`, fallback em memória)
- **WhatsApp**: API oficial Meta Graph v25.0 (envio) + webhook de entrada (`api/whatsapp/webhook`) + health check
- **Crons (Vercel)**: `orlando-daily` 11:00 UTC (=08:00 BRT) e `price-watch` 12:00 UTC (=09:00 BRT); auth por `cronSecret` (Bearer ou query) + smoke test 2026-07-11
- **LLM**: OpenAI chat completions (mensagens do robô + transcrição do diário)
- **Core do robô**: `api/_lib/orlando-proactive.js` (608 linhas)

## Implementado ✅ (vs specs F1–F5 + addons)

| Spec | Status no código |
|---|---|
| F1 countdown WhatsApp | ✅ `runDailyBriefing` — destinatários corretos (Vitor + Nathalie, fones e e-mails), humor, dólar (AwesomeAPI), clima (Open-Meteo), **radar de furacão (NHC)** já incluso |
| F1 go-live 11/07 | ✅ smoke test hardcoded no auth do cron |
| F4 monitor enxoval | ✅ cron `price-watch` + 15 seeds de itens do enxoval com preço-alvo (babá eletrônica, mamadeiras, bodies etc.) |
| Diário WhatsApp | ✅ webhook + transcrição + mídia + migrations 0036/0037 |
| Cofre/documentos | ✅ PDFs em `_private/` (vouchers, ingressos MK/Epic 2 day base, Bubba Gump 11/07?) |
| APIs de apoio | ✅ reservations, tickets, vouchers, state, desafio, proactive (trigger manual) |

## NÃO implementado ainda ❌

- F2 copiloto durante viagem: blocos de parque (Queue-Times, themeparks.wiki — zero referência no código), fila ao vivo, lembrete Lightning Lane 7h
- F3 scanner de nota por upload + radar cota US$1.000
- F5 relatório final ROI cupons
- Addon A1/A2 (inglês do dia, atração do dia da Luiza) — não encontrado no orlando-proactive
- Roteiro visual dos parques (proposta v3: MK 11h + HS abertura + Epic 11h, cards com foto, 👑 imperdíveis, 😱 janelas radicais, listas gestante) — spec pronta, não implementada
- Correção AK → HS no site (ver `proposta-codex-roteiro-parques.md`)

## ⚠️ RISCOS URGENTES

1. **`apps/web/app/minha-viagem/` e migrations 0035–0037 NUNCA foram commitados** — semanas de trabalho só neste disco + deploy. Fazer snapshot JÁ (comandos abaixo)
2. `.git` com locks órfãos (`index.lock`, `packed-refs.lock`) e uma branch `codex-snapshot` incompleta criada em 12/07 — apagar ambos
3. PDFs pessoais em `_private/` dentro do repo: conferir se a rota é protegida e se devem ir para o GitHub (sugestão: mover para Supabase Storage privado)

## Snapshot pendente (rodar no terminal do Windows, com Codex fechado)

```
cd C:\Users\cvito\Documents\Codex\2026-05-28\dentro-site-claudiocode-dev-qual-tipo\claudiovestevao.github.io
del .git\index.lock .git\packed-refs.lock .git\refs\heads\codex-snapshot.lock
git branch -D codex-snapshot
git checkout -b codex-snapshot && git add -A && git commit -m "Snapshot trabalho Codex: minha-viagem completo + migrations 0035-0037"
git push origin codex-snapshot
```

## Fluxo de trabalho combinado

- Claude trabalha em branch `claude/evolucao`, commits pequenos; push/merge sempre pelo Vitor
- Specs de referência (na pasta outputs do Claude, mover para `docs/specs/` no repo): `spec-codex-4-features.md`, `spec-codex-addon-dining-ingles-trivia.md`, `proposta-codex-roteiro-parques.md`, `cupons-orlando-ago2026.md`, `cupons-orlando-consolidado-para-codex.md`
- Próxima tarefa sugerida: correção AK→HS + roteiro visual v3 (maior valor, viagem em 28 dias)
