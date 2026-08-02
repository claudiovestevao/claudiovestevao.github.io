# Claudio OS Design System

Claudio OS e a base visual para o hub de agentes da Claudio Code: produtos familiares, digitais e operacionais, com foco em abrir rapido no celular e deixar claro o que esta no ar, privado ou em desenho.

## Principios

- Produto primeiro: cada tela deve mostrar o agente, o estado e a proxima acao antes de explicar demais.
- Denso sem pesar: cards compactos, dados visiveis, espacos curtos e hierarquia clara.
- Status consistente: `No ar`, `Reservado`, `Privado`, `Publico`, `Lista` e `Em breve` devem aparecer como linguagem do sistema.
- Familiar sem infantilizar: copy simples, visual quente, mas interface de produto real.

## Tokens

- Radius: `8px` para cards, botoes, campos e paineis.
- Base: `#07111f` para texto forte, `#64748b` para texto secundario, `#ffffff` para superficies.
- Linha: `rgba(98, 116, 142, .22)`.
- Acentos: azul `#165dff`, teal `#0f766e`, coral `#ef6a4d`, ouro `#f2b84b`, violeta `#6d5dfc`.
- Sombras: `0 18px 54px rgba(7, 17, 31, .1)` para superficies principais.

## Componentes Base

- `Topbar`: marca, atalhos de secao e CTA principal.
- `Hero operacional`: headline do hub, acoes primarias e painel de sinais.
- `Agent card`: icone, status, acesso, descricao, metrica e acao.
- `Status pill`: chip curto para estados de produto e acesso.
- `System tile`: principio ou regra do sistema em bloco compacto.

## Tons Por Agente

- Concierge da Familia: teal, mapas e destinos.
- Minha Viagem: azul, roteiro e viagem.
- Economics: verde, financas e cofre.
- Kanban: violeta, operacao e tarefas.
- Festas: coral, eventos e memoria.
- KidSquare: ouro, rotina kids-friendly.

## Regras De Uso

- Use cards para itens repetidos, nao para embrulhar secoes inteiras.
- CTAs devem ser verbos curtos: `Abrir`, `Entrar`, `Ver`, `Criar`.
- Todo agente precisa de um status e uma metrica curta.
- Em mobile, manter a navegacao curta e priorizar o CTA principal.
