# STATUS.md — Handoff Codex → Claude (12/07/2026)

Fonte de verdade do estado do projeto minha-viagem. Toda sessão (Claude ou Codex) começa lendo este arquivo e o atualiza ao final.

## Arquitetura real (verificada no código)

- **App**: Next.js em `apps/web`, rota `/minha-viagem` (site claudiocode.dev, deploy Vercel)
- **Auth**: senha própria da família (`TravelPasswordAuth`) + Google callback + recover/reset
- **Dados**: Supabase (project `roojvzpicxnnqjrrdpdx`) — migrations `0035` (auth privada), `0036` (diário WhatsApp), `0037` (diário vídeos); estado do robô em Supabase Storage (bucket `orlando-trip-private`, `proactive/v1.json`, fallback em memória)
- **WhatsApp**: API oficial Meta Graph v25.0 (envio) + webhook de entrada (`api/whatsapp/webhook`) + health check
- **Crons (Vercel)**: `orlando-daily` 11:00, 16:00 e 22:00 UTC (=08:00, 13:00 e 19:00 BRT) e `price-watch` 12:00 UTC (=09:00 BRT); auth por `cronSecret` (Bearer ou query) + smoke test 2026-07-11
- **LLM**: OpenAI chat completions (mensagens do robô + transcrição do diário)
- **Core do robô**: `api/_lib/orlando-proactive.js` (608 linhas)

## Implementado ✅ (vs specs F1–F5 + addons)

| Spec | Status no código |
|---|---|
| F1 countdown WhatsApp | ✅ `runDailyBriefing` — destinatários corretos (Vitor + Nathalie, fones e e-mails), 3 horários/dia, mensagens curtas com emojis/acentos, humor contextual, dólar (AwesomeAPI), clima (Open-Meteo), **radar de furacão (NHC)** já incluso |
| F1 go-live 11/07 | ✅ smoke test hardcoded no auth do cron |
| F4 monitor enxoval | ✅ cron `price-watch` + 15 seeds de itens do enxoval com preço-alvo (babá eletrônica, mamadeiras, bodies etc.) |
| Diário WhatsApp | ✅ webhook + transcrição + mídia + migrations 0036/0037 |
| Cofre/documentos | ✅ PDFs em `_private/` (vouchers, ingressos MK/Epic 2 day base, Bubba Gump 11/07?) |
| APIs de apoio | ✅ reservations, tickets, vouchers, state, desafio, proactive (trigger manual) |
| Roteiro visual dos parques | ✅ aba Parques detalhada em `orlando-agente.html`: plano tático por parque, cronograma hora-a-hora, atrações, shows/personagens, restrições gestante/criança/visão monocular e fontes oficiais Disney/Universal |
| Controle ARC/dólares | ✅ aba Orçamento ganhou painel ARC com saldo editável do print (US$ 1.172,63), cálculo automático de dólares ainda a comprar, prioridades por envelope aberto e separação de pagamentos BRL fora da ARC |
| Financeiro transacionado | ✅ wording corrigido de “pago” para “transacionado/contratado”; valores reais lançados: hotel R$ 5.283,05 Itaú à vista, bagagem EUA→Brasil R$ 1.077,90 Itaú à vista, carro R$ 2.863,04 Itaú 10x, voos R$ 5.414,25 + R$ 4.008,87 Itaú à vista, ingressos via PIX |
| Saldo ARC vivo | ✅ cards do Orçamento agora mostram “Saldo ARC USD”; cálculo usa saldo informado + dólares adicionados - despesas com pagamento ARC débito, sincronizado no estado privado |
| Memory Maker + seguro | ✅ orçamento ganhou envelope Disney Memory Maker/PhotoPass de R$ 1.000, reduzindo Restaurantes de R$ 4.500 para R$ 3.500 para manter teto R$ 60 mil; seguro viagem marcado como contratado/isento sem custo |
| Diário melhorado | ✅ aba Diário remove automaticamente o registro-sujeira de 09/08 com texto Douglas/Rayan, separa humor individual de Nathalie/Vitor/Luiza e reorganiza gravação de áudio/vídeo com botões claros |
| Decisões premium MK | ✅ seguro não aparece mais como pendência; Cinderella's Royal Table e Bibbidi Bobbidi Boutique foram marcados como cortados, removidos das reservas pendentes e trocados por quick service/fotos no castelo no plano do Magic Kingdom |

## NÃO implementado ainda ❌

- F2 copiloto durante viagem: blocos de parque (Queue-Times, themeparks.wiki — zero referência no código), fila ao vivo, lembrete Lightning Lane 7h
- F3 scanner de nota por upload + radar cota US$1.000
- F5 relatório final ROI cupons
- Addon A1/A2 (inglês do dia, atração do dia da Luiza) — parcialmente iniciado no `orlando-proactive`: camada de história/curiosidade da Luiza por slot, ainda sem inglês do dia.
- Correção AK → HS no site (ver `proposta-codex-roteiro-parques.md`)

## ⚠️ RISCOS — atualização 02/08/2026 (Claude)

Alertas anteriores RESOLVIDOS/verificados em 02/08/2026:

1. ✅ `minha-viagem` e migrations 0035–0037 estão commitados no `main` (commit `d2de849`). O trabalho novo pós-12/07 (45 modificados + 42 novos: disney-stories, check-ins, diário noturno, seguro, owntracks, economics planning, kanban calendar) foi commitado na branch `claude/snapshot-2026-08-02`. **Pendente: `git push origin claude/snapshot-2026-08-02` pelo Vitor.**
2. ✅ Locks órfãos do `.git` removidos (`index.lock`, `refs/heads/codex-snapshot.lock`); `git fsck` limpo. A branch `codex-snapshot` NÃO está incompleta — contém o snapshot de 12/07 (commit `49a6d44`, local-only); mantida como backup.
3. ✅ PDFs em `_private/` NUNCA foram para o GitHub — a pasta está no `.gitignore` (linhas 12 e 17) e não aparece em nenhuma branch. Ficam só no disco; sugestão de backup: subir para o bucket privado `orlando-trip-private` no Supabase Storage.

Risco novo identificado:

4. ⚠️ Telefones reais da família hardcoded em `orlando-proactive.js` (linha ~40, `whatsappPhones`) num repo público. Sugestão: mover para env var (`WHATSAPP_RECIPIENTS`) no Vercel.
5. ⚠️ CRÍTICO evitado em 02/08: `tmp/owntracks-production.env` na raiz contém TODAS as chaves de produção (OpenAI, Supabase service role, WhatsApp permanent token, senhas). Um `git add -A` teria publicado tudo — `tmp/` e `apps/web/tmp/` agora estão no `.gitignore`. NUNCA remover essas linhas. Sugestão: apagar o arquivo do disco (as envs vivem no Vercel).

Observação: o histórico de migrations do Supabase remoto registra só até `0028`; 0029–0040 foram aplicadas manualmente (as tabelas/buckets existem). Dados do diário/robô vivem em Storage (buckets privados `diario`, `orlando-trip-private`), não em tabelas.

## Fluxo de trabalho combinado

- Claude trabalha em branch `claude/evolucao`, commits pequenos; push/merge sempre pelo Vitor
- Specs de referência (na pasta outputs do Claude, mover para `docs/specs/` no repo): `spec-codex-4-features.md`, `spec-codex-addon-dining-ingles-trivia.md`, `proposta-codex-roteiro-parques.md`, `cupons-orlando-ago2026.md`, `cupons-orlando-consolidado-para-codex.md`
- Próxima tarefa sugerida: F2 copiloto durante viagem (filas ao vivo/Queue-Times + lembrete Lightning Lane 7h) e checagem final de horários oficiais dos shows 5 dias antes de cada parque.
