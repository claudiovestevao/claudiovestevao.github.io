# Minha Viagem mobile refactor - P0/P1

Data: 2026-08-01

## Inventario preservado

- 24 secoes/painels existentes: `conversor`, `hoje`, `visao`, `emergencia`, `cofre`, `mapa`, `mustdo`, `diario`, `frases`, `taticas`, `utilidades`, `aovivo`, `missoes`, `decisoes`, `antes`, `roteiro`, `interativo`, `comer`, `orcamento`, `lojas`, `disney`, `voos`, `hospedagem`, `mala`.
- 28 chamadas de API mantidas, incluindo vouchers, seguro, tickets, estado, check-ins, diario IA, midia, transcricao, briefing proativo, desafio, live travel e cambio.
- 14 chaves locais mantidas: seguro, cofre, ADR, must-do, diario, check-ins, estacionamento, entregas, mercado, calculadora, orcamento e saldos ARC.
- Nenhuma rota, integracao ou armazenamento foi removido nesta etapa.

## Matriz antes -> depois

| Area mobile nova | Entradas preservadas | Depois |
| --- | --- | --- |
| Hoje | `hoje`, `visao`, `aovivo`, `mapa`, `mustdo`, `missoes`, `decisoes`, `antes` | Painel inicial compacto por fase da viagem, com atalhos de acao e contexto do dia. |
| Roteiro | `roteiro`, `interativo`, `disney`, `aovivo`, parte de `comer` | Roteiro e parques ficam como fluxo de execucao, sem misturar com documentos. |
| Compras | `lojas`, `enxoval`, `compras-*`, `price-watch-card`, `conversor`, lancamento rapido de gastos | Compras passa a ser uma area de uso em loja: listas, dolar, calculadora e precos. |
| Reservas | `cofre`, `voos`, `hospedagem`, `comer`, `adrList`, vouchers, PDFs, seguro e tickets | Nova porta de entrada separa Viagem e Restaurantes, mantendo os detalhes nos modulos originais. |
| Mais | `orcamento`, `mala`, `taticas`, `utilidades`, `frases`, `diario`, `emergencia`, backup, busca e configuracoes | Central de modulos secundarios, sem transformar tudo em abas principais. |
| Emergencia global | `emergencia` | Acesso fixo via SOS no header e tambem dentro de Mais. |

## Guardrails aplicados

- Navegacao fixa mobile com no maximo 5 itens.
- Header mobile compacto, com busca e SOS sempre acessiveis.
- Fase da viagem representada como estado: `pre_trip`, `departure_day`, `during_trip`, `return_day`, `post_trip`.
- Acoes destrutivas passam a pedir confirmacao contextual.
- Dados sensiveis do cofre passam a iniciar mascarados, com botao de mostrar/ocultar.
- Status online/offline fica explicito e honesto no topo.

## Pendencias para P2/P3

- Medir em uso real quais modulos devem virar acordeoes internos por frequencia.
- Criar rotinas de teste visual automatizado para capturas mobile/desktop.
- Revisar textos de todos os cards para reduzir ainda mais ruido em telas pequenas.
