# Casa em Dia - Plano de Implementacao

Data: 2026-07-12
Status: planejamento apenas. Nenhuma implementacao de produto foi feita neste PR/turno.

## Escopo deste documento

Este plano traduz a especificacao do produto Casa em Dia em uma sequencia segura de implementacao para o repositorio atual. O objetivo e orientar PRs pequenos, revisaveis e com baixo risco, cobrindo gaps, riscos, arquivos afetados e criterios de aceite.

## Entradas inspecionadas

- `AGENTS.md`: nao encontrado na raiz do repositorio.
- `docs/CASA_EM_DIA_SPEC.md`: nao encontrado no repositorio.
- `C:\Users\cvito\Downloads\CASA_EM_DIA_SPEC.md`: usado como fonte da especificacao recebida.
- `package.json`
- `apps/web/package.json`
- `apps/web/lib/config.js`
- `apps/web/lib/supabase/server.js`
- `apps/web/middleware.js`
- `apps/web/app/minha-viagem/api/auth/session/route.js`
- `apps/web/app/minha-viagem/api/whatsapp/webhook/route.js`
- `supabase/migrations/0035_orlando_trip_private_auth.sql`
- Estrutura geral de `apps/web`, `docs`, `supabase/migrations` e testes existentes.

## Leitura do repositorio atual

O repositorio ja possui uma aplicacao Next.js em `apps/web`, servida via workspace npm, com rotas App Router, Supabase, middleware e integracoes especificas da area privada `minha-viagem`.

O produto Orlando/Minha Viagem ja tem:

- auth privada propria via cookies e sessao Supabase;
- middleware protegendo ` /minha-viagem `;
- webhook WhatsApp robusto para diario, audio, imagem e video;
- uso de OpenAI e Supabase;
- migracoes Supabase com padrao de RLS, membros e papeis;
- testes Node para partes de destino e APIs da viagem.

O Casa em Dia deve nascer como um produto separado, em `/casa`, sem herdar automaticamente as regras, cookies, permissoes ou modelos de dados de `/minha-viagem`.

## Decisoes arquiteturais recomendadas

1. Criar o Casa em Dia como namespace proprio em `/casa`.
   - Evita misturar viagem, financas familiares e automacoes pessoais.
   - Facilita aplicar auth, RLS e privacidade com regras diferentes.

2. Nao reutilizar o modelo de acesso de `minha-viagem`.
   - A viagem usa acesso privado orientado ao roteiro.
   - O Casa em Dia lida com dados financeiros sensiveis e precisa de Supabase Auth, household membership, papeis e escopos de privacidade.

3. Criar cliente Supabase user-scoped para rotas autenticadas.
   - Hoje `apps/web/lib/supabase/server.js` pode usar service role por padrao.
   - Para Casa em Dia, rotas user-facing devem respeitar RLS.
   - Service role deve ficar restrito a jobs, webhooks, tarefas internas e sincronizacoes auditadas.

4. Usar tabelas com prefixo `casa_` ou schema dedicado.
   - Recomendacao pratica para este repositorio: prefixo `casa_` em `public`.
   - Reduz colisao com tabelas de viagem e simplifica politicas RLS no Supabase atual.

5. Implementar financas com motor deterministico.
   - Calculos de saldo, liquidez, patrimonio, reserva, fluxo de caixa e simulacoes nao devem depender de LLM.
   - LLM deve apenas classificar, resumir, explicar ou sugerir acoes com saida estruturada.

6. Criar trilha de auditoria desde a primeira migracao real.
   - Toda escrita financeira relevante deve registrar `actor`, `household`, entidade, antes/depois quando aplicavel e origem.

7. Manter WhatsApp Casa separado do WhatsApp Viagem.
   - Nova rota: `apps/web/app/api/casa/whatsapp/webhook/route.js`.
   - Pode reaproveitar padroes de assinatura Meta, resposta e envio, mas nao misturar intents nem logs.

8. Tratar Open Finance como interface de provider.
   - Primeiro PR de Open Finance deve ter mock/provider interface, consentimento e logs.
   - Nao armazenar senha bancaria.
   - Nao implementar conexao real sem provider definido e revisao de seguranca.

9. Documentos financeiros precisam de politica explicita.
   - Storage privado.
   - Retencao e exclusao.
   - Redacao de logs.
   - Confirmacao humana antes de transformar extracao em dado financeiro oficial.

10. Lancar por feature flag ou acesso restrito.
    - Casa em Dia nao deve ficar publico antes de auth, RLS e auditoria basicos.

## Gaps encontrados

### Governanca e documentacao

- `AGENTS.md` nao existe na raiz do repositorio.
- `docs/CASA_EM_DIA_SPEC.md` nao existe, apesar de a tarefa citar esse caminho.
- Nao ha ainda documento de modelo de dados Casa em Dia.
- Nao ha runbook de operacao, incidentes, backups ou rotacao de secrets para dados financeiros.
- Nao ha politica documentada de retencao de documentos financeiros.

### Stack e padroes

- A app atual esta majoritariamente em JavaScript/JSX, enquanto a spec pede Next.js + TypeScript strict.
- Nao ha `zod` no `apps/web/package.json`, mas a spec pede saidas estruturadas e validacao forte.
- Nao ha camada Casa para auth, finance engine, audit, WhatsApp intents ou jobs.
- Nao ha Sentry/observabilidade com redacao de PII.

### Seguranca e privacidade

- O helper Supabase server atual pode usar service role de forma ampla.
- Middleware atual protege apenas `/minha-viagem`.
- Nao existe modelo de household, membro, papel e escopo de privacidade para financas.
- Nao existem testes RLS para o dominio Casa.
- Nao existe audit trail financeiro.
- Nao existe estrategia de logs sem dados sensiveis.

### Produto

- Nao existem telas `/casa`.
- Nao existe dashboard financeiro.
- Nao existe cadastro de contas, cartoes, dividas, investimentos, metas ou contas recorrentes.
- Nao existe fluxo de upload e revisao de documentos.
- Nao existe calendario financeiro.
- Nao existe digest semanal.
- Nao existe "next best action".
- Nao existe projecao 40/45/50/55/60.

### Integracoes

- WhatsApp atual e orientado a diario da viagem, nao a financas familiares.
- Nao ha outbox persistente para mensagens, lembretes e retries do Casa.
- Nao ha provider Open Finance.
- Nao ha job scheduler Casa para rotinas diarias, semanais, mensais e trimestrais.

## Riscos principais

1. Vazamento ou acesso indevido a dados financeiros.
   - Mitigacao: RLS desde o primeiro PR de dados, cliente user-scoped, audit trail e testes de permissoes.

2. Bypass acidental de RLS por service role.
   - Mitigacao: criar helpers separados: user client, admin client e job client; revisar imports em PR.

3. Crescimento excessivo do primeiro PR.
   - Mitigacao: separar fundacao, modelo financeiro, UI, WhatsApp, documentos e IA em PRs distintos.

4. LLM tomando decisoes financeiras.
   - Mitigacao: LLM nunca calcula nem decide sozinho; apenas gera sugestoes explicaveis sobre dados ja calculados.

5. Duplicidade de eventos WhatsApp.
   - Mitigacao: idempotency key por mensagem Meta, tabela de eventos processados e outbox transacional.

6. Logs com PII ou valores financeiros.
   - Mitigacao: logger Casa com redacao, Sentry configurado sem payload sensivel e testes de snapshot onde fizer sentido.

7. Extracao de documentos virando dado incorreto.
   - Mitigacao: estado `draft/reviewed/posted`, revisao humana obrigatoria e trilha de auditoria.

8. Open Finance com escopo regulatorio mal definido.
   - Mitigacao: comecar com interface mock, consentimento explicito e provider real apenas apos desenho juridico/tecnico.

9. Conflito com experiencia atual do site.
   - Mitigacao: rota isolada `/casa`, navegacao propria e sem alterar Orlando alem de links intencionais.

10. Migracoes dificeis de reverter.
    - Mitigacao: migracoes pequenas, nomes claros, seeds anonimos e testes locais antes de deploy.

## Arquivos e areas provavelmente afetados

### Documentacao

- `AGENTS.md`
- `docs/CASA_EM_DIA_SPEC.md`
- `docs/CASA_EM_DIA_IMPLEMENTATION_PLAN.md`
- `docs/CASA_EM_DIA_DATA_MODEL.md`
- `docs/CASA_EM_DIA_SECURITY.md`
- `docs/CASA_EM_DIA_RUNBOOK.md`
- `docs/CASA_EM_DIA_FINANCIAL_CALCULATIONS.md`

### Configuracao e dependencias

- `package.json`
- `apps/web/package.json`
- `apps/web/lib/config.js`
- `apps/web/middleware.js`
- Possivel `apps/web/tsconfig.json` ou configuracao incremental TypeScript, se adotada.

### Supabase

- `supabase/migrations/0038_casa_foundation.sql`
- `supabase/migrations/0039_casa_financial_core.sql`
- `supabase/migrations/0040_casa_bills_documents_jobs.sql`
- `supabase/migrations/0041_casa_whatsapp_ai_audit.sql`
- Testes SQL/RLS a definir em `tests` ou pasta dedicada de Supabase.

### App Casa

- `apps/web/app/casa/page.jsx` ou `.tsx`
- `apps/web/app/casa/layout.jsx` ou `.tsx`
- `apps/web/app/casa/(auth)/**`
- `apps/web/app/casa/dashboard/**`
- `apps/web/app/casa/contas/**`
- `apps/web/app/casa/documentos/**`
- `apps/web/app/casa/metas/**`
- `apps/web/app/casa/cenarios/**`
- `apps/web/components/casa/**`
- `apps/web/lib/casa/**`

### APIs Casa

- `apps/web/app/api/casa/auth/**`
- `apps/web/app/api/casa/dashboard/**`
- `apps/web/app/api/casa/accounts/**`
- `apps/web/app/api/casa/bills/**`
- `apps/web/app/api/casa/documents/**`
- `apps/web/app/api/casa/goals/**`
- `apps/web/app/api/casa/scenarios/**`
- `apps/web/app/api/casa/whatsapp/webhook/route.js`
- `apps/web/app/api/casa/cron/**`

### Integracoes compartilhaveis

- `apps/web/lib/supabase/server.js`
- Novo `apps/web/lib/supabase/user-server.js`
- Novo `apps/web/lib/casa/audit.js`
- Novo `apps/web/lib/casa/finance/**`
- Novo `apps/web/lib/casa/whatsapp/**`
- Novo `apps/web/lib/casa/open-finance/**`
- Novo `apps/web/lib/casa/documents/**`

### Deploy e jobs

- `vercel.json`
- Variaveis Vercel/Supabase:
  - `CASA_FEATURE_ENABLED`
  - `CASA_CRON_SECRET`
  - `CASA_WHATSAPP_VERIFY_TOKEN`
  - `CASA_WHATSAPP_PHONE_NUMBER_ID`
  - `CASA_WHATSAPP_ACCESS_TOKEN`
  - `CASA_OPENAI_MODEL`
  - `SENTRY_DSN` se observabilidade for adicionada.

## Sequencia proposta de PRs

### PR 0 - Governanca e documentacao

Objetivo: deixar o contrato do produto versionado antes de qualquer codigo.

Mudancas:

- Adicionar `AGENTS.md` na raiz com regras de trabalho do repositorio.
- Copiar ou normalizar a spec para `docs/CASA_EM_DIA_SPEC.md`.
- Manter este plano em `docs/CASA_EM_DIA_IMPLEMENTATION_PLAN.md`.
- Criar stubs de seguranca, modelo de dados e calculos.

Criterios de aceite:

- Nenhum codigo de produto implementado.
- Caminhos citados pela especificacao existem.
- Gaps e riscos permanecem visiveis para revisao.

### PR 1 - Fundacao Casa, auth e household

Objetivo: criar o esqueleto seguro de `/casa`.

Mudancas:

- Criar rota protegida `/casa`.
- Criar cliente Supabase user-scoped para server routes/components.
- Adicionar migracao `casa_households`, `casa_household_members`, `casa_member_preferences`, `casa_audit_events`.
- Implementar RLS de membership e papeis.
- Adicionar testes de RLS basicos.
- Adicionar feature flag `CASA_FEATURE_ENABLED`.

Criterios de aceite:

- Usuario autenticado ve apenas households em que e membro.
- Usuario sem acesso nao ve dados Casa.
- Service role nao e usado em rotas user-facing.

### PR 2 - Modelo financeiro central

Objetivo: criar o dominio financeiro sem UI complexa.

Mudancas:

- Migracoes para instituicoes, contas, saldos, categorias, transacoes, cartoes, dividas, ativos e passivos.
- Biblioteca deterministica inicial em `apps/web/lib/casa/finance`.
- Testes unitarios para agregacoes basicas.
- Audit trail em escritas financeiras.

Criterios de aceite:

- Patrimonio liquido e liquidez calculados sem LLM.
- Toda escrita financeira relevante gera evento de auditoria.
- RLS cobre todas as tabelas novas.

### PR 3 - Dashboard MVP

Objetivo: entregar a primeira tela util do Casa em Dia.

Mudancas:

- Dashboard `/casa` com cards de patrimonio, liquidez, contas proximas, fluxo 30/60/90 e alertas.
- APIs read-only para dashboard.
- Estados vazio, carregando e erro.
- Seeds anonimos opcionais para desenvolvimento.

Criterios de aceite:

- Dashboard funciona sem dados.
- Dashboard funciona com dados seed.
- Nenhum valor sensivel aparece em logs.

### PR 4 - Contas recorrentes e calendario

Objetivo: controlar vencimentos e rotina financeira.

Mudancas:

- Tabelas `casa_bill_definitions` e `casa_bill_instances`.
- Job para gerar proximas instancias.
- Tela de contas/calendario.
- Acoes de marcar como pago, adiar e ignorar.

Criterios de aceite:

- Geracao recorrente idempotente.
- Historico nao e apagado ao editar uma recorrencia futura.
- Fluxo 30/60/90 considera contas previstas.

### PR 5 - WhatsApp Casa MVP

Objetivo: permitir lembretes e confirmacoes por WhatsApp com seguranca.

Mudancas:

- Nova rota `apps/web/app/api/casa/whatsapp/webhook/route.js`.
- Verificacao de assinatura Meta.
- Tabela de eventos recebidos para idempotencia.
- Outbox de mensagens.
- Intents iniciais: `paguei`, `lembrar amanha`, `quanto falta`, `proximas contas`.
- Templates preparados, mesmo que algum canal ainda esteja pendente.

Criterios de aceite:

- Mensagens duplicadas da Meta nao duplicam lancamentos.
- Respostas respeitam household e numero autorizado.
- Logs nao incluem conteudo financeiro sensivel bruto.

### PR 6 - Documentos e extracao assistida

Objetivo: transformar boletos, faturas e comprovantes em dados revisaveis.

Mudancas:

- Storage privado para documentos Casa.
- Tabelas de documentos e extracoes.
- Upload UI.
- Extracao via OpenAI com schema validado.
- Tela de revisao antes de postar dado oficial.

Criterios de aceite:

- Documento enviado fica privado ao household.
- Extracao nao altera financas sem confirmacao humana.
- Erros de extracao sao rastreaveis.

### PR 7 - Fluxo de caixa, reserva e patrimonio

Objetivo: evoluir de cadastro para planejamento financeiro real.

Mudancas:

- Refinar liquidez por buckets.
- Calcular reserva de emergencia.
- Melhorar patrimonio liquido.
- Criar reconciliacao manual de transacoes.
- Categorias e regras deterministicas.

Criterios de aceite:

- Fluxo 30/60/90 bate com contas, transacoes e recorrencias.
- Reserva usa parametros configuraveis.
- Calculos tem testes com cenarios limite.

### PR 8 - Metas e projecoes 40/45/50/55/60

Objetivo: atender a promessa de liberdade aos 55.

Mudancas:

- Tabelas de metas, cenarios e resultados.
- Motor deterministico de projecao.
- Tela de cenarios.
- Comparacao de caminhos por idade.

Criterios de aceite:

- Projecoes sao reproduziveis.
- Premissas ficam salvas com o resultado.
- UI deixa claro que e simulacao, nao recomendacao financeira formal.

### PR 9 - Digest semanal e next best action

Objetivo: criar acompanhamento familiar simples e acionavel.

Mudancas:

- Job semanal.
- Geração de resumo com dados calculados.
- Sugestoes com guardrails.
- Envio por email e preparacao para WhatsApp.

Criterios de aceite:

- Digest nao vaza dados de um membro para outro fora do escopo permitido.
- Sugestoes sao explicaveis e baseadas em dados reais.
- Falha de envio fica registrada e pode ser reprocessada.

### PR 10 - Open Finance mock e interface de provider

Objetivo: preparar integracao futura sem assumir fornecedor agora.

Mudancas:

- Interface `OpenFinanceProvider`.
- Provider mock/local.
- Modelo de consentimento.
- Job de sync simulado.
- Tela de status de conexoes.

Criterios de aceite:

- Nenhuma senha bancaria e armazenada.
- Consentimento pode ser revogado.
- Provider real pode ser adicionado sem refazer dominio.

### PR 11 - Hardening, observabilidade e operacao

Objetivo: preparar uso real com dados sensiveis.

Mudancas:

- Sentry ou equivalente com redacao.
- Rate limiting duravel para APIs sensiveis.
- Runbook de incidentes.
- Backup/restore documentado.
- Testes E2E principais.
- Revisao de secrets e CSP.

Criterios de aceite:

- Fluxos principais cobertos por E2E.
- Logs revisados para PII.
- Procedimento de incidente e restore documentado.

## Ordem minima para iniciar sem retrabalho

Antes de implementar o primeiro codigo de produto, resolver:

1. Confirmar se o Casa em Dia sera TypeScript strict desde o inicio ou JS com migracao gradual.
2. Versionar `docs/CASA_EM_DIA_SPEC.md` no repositorio.
3. Criar `AGENTS.md` na raiz.
4. Definir papeis iniciais do household: `owner`, `admin`, `member`, `viewer`.
5. Definir escopos de privacidade iniciais: `household`, `aggregate_only`, `owner_only`.
6. Decidir se documentos financeiros terao retencao padrao ou exclusao manual.
7. Decidir se `/casa` comeca atras de feature flag e lista de emails permitidos.
8. Definir estrategia de teste RLS local/CI.

## Primeira fatia recomendada

A primeira entrega de codigo deve ser pequena:

- `/casa` protegido;
- household e membros;
- RLS testado;
- audit events;
- tela vazia com mensagem objetiva;
- nenhum dado financeiro ainda.

Isso cria a base certa para evitar o maior risco do produto: dados financeiros sensiveis crescendo em cima de uma autorizacao fraca.

