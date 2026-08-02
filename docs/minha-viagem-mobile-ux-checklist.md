# Minha Viagem - conformidade UX mobile

Data da revisao: 2026-08-01

Escopo: rota privada `/minha-viagem`, tela de acesso e painel Orlando 2026.

Legenda:

- `OK`: implementado e verificado por teste automatico ou navegador.
- `MANUAL`: a interface esta preparada, mas o criterio exige aparelho ou pessoas reais.

## Resultado medido

| Cenario | Area ocupada por header + navegacao | Alvos menores que 48 px | Texto menor que 12 px | Overflow horizontal |
| --- | ---: | ---: | ---: | ---: |
| 360 x 640, topo | 34,1% | 0 | 0 | 0 |
| 360 x 640, apos rolar | 19,3% | 0 | 0 | 0 |
| 430 x 932, topo | 23,4% | 0 | 0 | 0 |
| Acesso privado, 360 x 640 | fluxo rolavel | 0 | 0 | 0 |

O botao voltar do sistema tambem foi exercitado entre Roteiro e Reservas: ele retornou para Roteiro sem sair do app.

## 1. Layout e espaco

- [x] `OK` Conteudo ocupa pelo menos 60% da viewport nos extremos medidos.
- [x] `OK` Header expande apenas no topo e colapsa para 62 px ao rolar.
- [x] `OK` Conteudo final tem espaco para bottom nav, FAB e safe area.
- [x] `OK` Safe areas de topo, base, esquerda e direita usam `env(...)`.
- [x] `OK` Agrupamento usa espaco, titulos e fundos leves, sem depender de bordas pesadas.
- [x] `OK` Verificado em 360 px e 430 px sem rolagem horizontal.

## 2. Toque e interacao

- [x] `OK` Controles interativos usam alvo minimo de 48 x 48 px.
- [x] `OK` Grupos de acoes e bottom nav usam pelo menos 8 px de gap.
- [x] `OK` Navegacao e registro rapido ficam na zona inferior do polegar.
- [x] `OK` Toques recebem estado ativo imediato; transicoes visuais duram 220 ms.
- [ ] `MANUAL` Teste completo com polegar direito e aparelho na palma.
- [ ] `MANUAL` Pull-to-refresh e swipe-back nativos em iOS e Android fisicos.

## 3. Navegacao

- [x] `OK` Existe uma unica navegacao principal visivel no mobile.
- [x] `OK` Bottom nav fixa tem cinco itens, icone e label.
- [x] `OK` Item ativo combina cor, fundo, peso e `aria-current`.
- [x] `OK` Orelhinha retorna ao Claudio Code; SOS e bottom nav permanecem acessiveis.
- [x] `OK` O historico interno responde corretamente ao voltar do sistema.
- [x] `OK` Modulos ficam a no maximo dois niveis da navegacao principal.

## 4. Hierarquia e conteudo

- [x] `OK` Cada painel aberto representa uma tarefa ou assunto central.
- [x] `OK` Apenas a primeira acao primaria de cada painel mantem destaque forte.
- [x] `OK` Paineis usam titulo direto e apoio curto.
- [x] `OK` Textos de apoio longos recebem recolhimento com Ver mais/Ver menos.
- [x] `OK` Detalhes ficam atras de modulos, busca, Mais ou controles de expansao.
- [x] `OK` Decisoes principais sao divididas em grupos curtos.
- [x] `OK` Listas extensas sao separadas por cards, categorias ou linha do tempo.

## 5. Estado e feedback

- [x] `OK` Status online, offline, sincronizando e salvo permanece visivel.
- [x] `OK` Transicoes ficam entre 200 e 300 ms; carregamento da area privada tem indicador.
- [x] `OK` Busca, diario, check-ins e listas possuem estados vazios.
- [x] `OK` Login invalido permanece desabilitado antes do envio.
- [x] `OK` Erros de check-in, diario e autenticacao explicam o problema e a alternativa.
- [x] `OK` Exclusoes pedem confirmacao; gastos removidos tambem oferecem Desfazer.

## 6. Legibilidade e acessibilidade

- [x] `OK` Pares principais de texto/fundo respeitam contraste de 4,5:1.
- [x] `OK` Base usa 16 px e nenhum texto computado ficou abaixo de 12 px.
- [x] `OK` Estados combinam texto, icone, peso ou fundo; nao dependem apenas de cor.
- [ ] `MANUAL` Validar tamanhos de fonte do sistema no maximo em iOS e Android.
- [x] `OK` Icones funcionais e controles possuem nome acessivel ou texto.

## 7. Convencoes e consistencia

- [x] `OK` Bottom nav, voltar, busca, SOS, loading e desfazer seguem padroes conhecidos.
- [x] `OK` O mesmo componente de navegacao controla todas as telas internas.
- [x] `OK` A interface usa Reservas, Diario, Compras e Roteiro de forma consistente.
- [x] `OK` Icones funcionais possuem label explicita quando o simbolo nao basta.

## 8. Contexto real de uso

- [x] `OK` Offline degrada para uma tela segura com tentar novamente e retorno ao painel.
- [ ] `MANUAL` Repetir os fluxos em 3G real ou simulacao de rede no aparelho.
- [ ] `MANUAL` Executar os fluxos andando e com atencao parcial.
- [x] `OK` Defaults, fase automatica, localizacao sugerida e calculos reduzem decisoes manuais.

## 9. Emocao e jornada

- [x] `OK` Check-in, diario e gastos salvos exibem confirmacao positiva com estrela.
- [x] `OK` Fluxos terminam com estado salvo, proximo passo ou opcao de desfazer.
- [x] `OK` Bottom nav, busca global, FAB e atalhos reduzem toques e rolagem.

## Validacao final de release

- [ ] `MANUAL` Teste com cinco usuarios em contexto real.
- [ ] `MANUAL` Teste completo de uma mao em todas as telas novas.
- [ ] `MANUAL` Teste sob sol e nos brilhos maximo e minimo.
- [ ] `MANUAL` Revisao final em iPhone e Android fisicos.

## Regressao automatica

O arquivo `mobile-ux.test.mjs` bloqueia regressao de navegacao duplicada, alvos pequenos, safe areas, header sem colapso, historico interno, feedback, autenticacao invalida, offline e permissao de localizacao.
