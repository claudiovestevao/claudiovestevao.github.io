# Product Source of Truth — Concierge da Família

> **Status:** documento normativo. É a **fonte única da verdade** do produto.
> Em caso de divergência entre código, banco e qualquer outra doc, **este documento decide** — ou é atualizado de propósito antes da mudança.
> **Última revisão:** 06/06/2026 · **Código:** `origin/main @ 0c7c9c4` · **Banco:** Supabase `roojvzpicxnnqjrrdpdx`

---

## 1. Objetivo do produto

Concierge da Família é uma ferramenta de **curadoria inteligente de viagens para famílias da capital de São Paulo que viajam com bebês e crianças pequenas**. A partir de um diagnóstico do perfil familiar, recomenda destinos e hospedagens adequados, usando **somente dados reais** (nota do Google, tempo de carro real de SP, inventário real de hotéis, movimento/eventos previstos, clima, feriados).

**Regra inegociável:** nada de dados mockados. Toda informação exibida deve ter origem rastreável em uma API real ou em curadoria humana verificada.

**Ponto de partida:** São Paulo (capital) como única origem suportada hoje, para recomendar melhor antes de expandir.

---

## 2. Funcionalidades oficiais

Funcionalidades que fazem parte do produto e são mantidas:

- **Diagnóstico familiar (quiz)** — coleta o perfil da família (idades, preferências) e gera recomendações.
- **Destinos em alta** — vitrine de destinos em destaque.
- **Ranking / score de destinos** — ordenação por adequação familiar (`destination_scores`, `destination_family_fit`).
- **Cards de destino com galerias reais** — imagens e conteúdo turístico curado.
- **Explorador de hotéis** — hotéis por destino, com estrelas, nota de hóspedes e fotos.
- **Calendário familiar** — feriados nacionais e janelas de férias escolares.
- **Captura de lead** — formulário de contato/interesse.
- **Tracking de comportamento** — eventos, leads e cliques em hotéis via Supabase REST com publishable key pública e RLS.
- **Camada de dados reais no banco (backend oficial):**
  - Nota e avaliações do Google (Places).
  - Tempo de carro real de SP (Distance Matrix).
  - Inventário real de hotéis (LiteAPI).
  - Movimento/eventos previstos (PredictHQ).
  - Normais climáticas (Open-Meteo) e feriados (Nager.Date).
- **Mapa interativo de destinos (Mapbox)** — *oficial como objetivo de produto*, porém **ainda não integrado ao site**. O token público deve ser injetado apenas quando o componente Mapbox entrar, para evitar bloqueios de secret scanning.

---

## 3. Funcionalidades descartadas / fora de escopo

Coisas que **não** fazem parte do produto e não devem ser reintroduzidas sem decisão explícita:

- **Qualquer dado mockado ou placeholder** — proibido por princípio.
- **Trilha de migrations do repositório `supabase/migrations/0012–0020`** (accommodations, destination_images, concierge_tracking, destination_experience_catalog, tourism_content) — **substituída** pela trilha viva do banco (0014–0028). Considerada legado; será arquivada.
- **Widgets standalone soltos** (`concierge-stay-widget.html`, `concierge-map.html` fora do repo) — não são entregáveis finais; servem de protótipo. O destino oficial é integrá-los ao `app.js`, não mantê-los avulsos.
- **Edge Functions de busca ao vivo opcionais** (`multimodal`, `isochrone`, `events-sympla`) — **não oficiais** no momento; secrets pendentes. O site lê direto das views, não depende delas.
- **Múltiplas origens além de São Paulo** — fora de escopo por enquanto.

---

## 4. Rotas oficiais

O produto é um **site estático (GitHub Pages)** com uma SPA de página única baseada em **âncoras de hash** — não há roteador multi-página.

| Rota | O que é |
|---|---|
| `/` | Landing "Claudio Code" (`index.html`). |
| `/agentes/concierge-da-familia/` | Aplicação Concierge da Família (`index.html` → `app.js`). |
| `/404.html` | Página de erro. |
| Domínio | `claudiocode.dev` (via `CNAME`). |

**Âncoras oficiais dentro da SPA** (seções renderizadas pelo `app.js`):
`#diagnostico` · `#destinos-em-alta` · `#recomendacoes` · `#ranking` · `#score` · `#destinos` · `#hoteis` · `#calendario` · `#resultado` · `#compartilhar` · `#lead`

---

## 5. Componentes oficiais

**Front-end** (`agentes/concierge-da-familia/`):

- `app.js` — SPA principal (renderização, quiz, ranking, cards, tracking).
- `index.html` — shell da aplicação.
- `styles.css` — estilos.
- `src/data/*.js` (8 módulos oficiais, todos importados pelo `app.js`):
  `conciergeFamilyDestinations`, `conciergeFamilyHotels`, `conciergeFamilyHotelAdditions`, `conciergeDestinationImages`, `conciergeDestinationExperience`, `conciergeDestinationGalleries`, `conciergeFamilyQuiz`, `conciergeFamilyCalendar`.

**Tooling (dev, não-runtime):**
`scripts/fetchDestinationImages.mjs`, `scripts/auditDestinationGalleries.mjs`, `supabase/queries/*` — auxiliares de manutenção, não fazem parte do bundle servido.

**Banco (views oficiais para consumo de front):**
`destination_stay_summary`, `destination_map_points`, `destination_primary_rating`, `destination_hotel_cards`.

> Nota: os módulos `src/data/*.js` (estáticos) e as views do banco (dados ao vivo) hoje coexistem. A direção oficial é o front passar a consumir as **views** (ver Riscos e Pendências).

---

## 6. Integrações oficiais

| Integração | Uso | Onde a chave vive |
|---|---|---|
| **Supabase** | Banco, REST, RLS, funções, tracking | publishable key no front (leitura, RLS); `service_role` secreta |
| **Google Maps — Places** | Nota, avaliações, resumo familiar | função `SECURITY DEFINER` no banco |
| **Google Maps — Distance Matrix** | Tempo de carro real de SP | função `SECURITY DEFINER` no banco |
| **LiteAPI** | Inventário real de hotéis | função `SECURITY DEFINER` no banco |
| **PredictHQ** | Movimento/eventos previstos | função `SECURITY DEFINER` no banco (secret edge pendente) |
| **Mapbox** | Mapa interativo | token público `pk.*` no front |
| **Open-Meteo** | Normais climáticas | grátis, sem chave |
| **Nager.Date** | Feriados nacionais | grátis, sem chave |

**Princípio de segurança:** chaves secretas nunca no front. Ficam dentro de funções `SECURITY DEFINER` com `EXECUTE` revogado de `public/anon/authenticated`. Apenas tokens públicos por design (`pk.*` Mapbox, `sb_publishable_*` Supabase) podem aparecer no cliente.

---

## 7. Modelo de dados oficial

**Banco oficial:** Supabase `roojvzpicxnnqjrrdpdx`. Todas as tabelas com RLS habilitado (leitura pública).

**Tabelas núcleo (destinos e adequação):**

| Tabela | Linhas | Papel |
|---|---|---|
| `destinations` | 152 | Catálogo de destinos |
| `destination_origin_access` | 163 | Acesso/logística por origem |
| `destination_family_fit` | 608 | Adequação por perfil familiar |
| `destination_seasonality` | 456 | Sazonalidade |
| `destination_risk_factors` | 122 | Fatores de risco |
| `destination_scores` | 84 | Pontuação consolidada |
| `destination_tags` | 113 | Tags |
| `destination_recommended_property_types` | 23 | Tipos de hospedagem sugeridos |

**Tabelas de origem e perfil:**
`travel_origins` (1) · `origin_transport_hubs` (6) · `family_profiles` (11)

**Tabelas de dados ao vivo (integrações):**

| Tabela | Linhas | Fonte |
|---|---|---|
| `destination_google_places` | 6 | Google Places |
| `destination_sp_route` | 67 | Google Distance Matrix |
| `destination_hotels` | 56 | LiteAPI |
| `destination_event_demand` | 67 | PredictHQ |
| `destination_events` | 0 | PredictHQ (detalhe de eventos) |
| `destination_climate_normals` | 648 | Open-Meteo |
| `br_public_holidays` | 30 | Nager.Date |

**Views oficiais (consumo de front):**
`destination_stay_summary` (1 linha/destino: nota, resumo, tempo de carro, movimento, top hotéis) · `destination_map_points` (pontos do mapa) · `destination_primary_rating` · `destination_hotel_cards`.

**Funções de sincronização (restritas a `service_role`/admin):**
`gm_sync_place`, `gm_sync_route`, `liteapi_sync_city`, `phq_sync_demand`.

> **Camada estática paralela (a desativar gradualmente):** os arquivos `src/data/*.js` ainda carregam destinos/hotéis/imagens curados e funcionam como fallback. O site já lê `destination_stay_summary`, `destination_map_points` e `destination_hotel_cards` para enriquecer cards com dados vivos quando houver correspondência.

---

## 8. Fluxos principais

1. **Diagnóstico → recomendação.** Visitante responde o quiz (`#diagnostico`) → gera perfil → recebe destinos recomendados (`#recomendacoes`, `#ranking`, `#score`).
2. **Exploração de destino.** Visitante navega pelos cards (`#destinos`) com galerias, e — quando integrado — nota do Google, tempo de carro de SP e nível de movimento.
3. **Hospedagem.** Visitante vê hotéis com disponibilidade (`#hoteis`); cliques são rastreados (`concierge_hotel_clicks`).
4. **Conversão.** Visitante deixa contato (`#lead` → `concierge_leads`).
5. **Compartilhamento.** Resultado do diagnóstico compartilhável (`#resultado`, `#compartilhar`).
6. **Atualização de dados (backend).** Sincronização semanal re-popula nota Google, hotéis, tempo de carro e movimento via funções de sync (ver Pendências: agendamento aguarda aprovação na tela).

---

## 9. Pendências

- **Expandir a integração das views vivas.** O site já consome `destination_stay_summary`, `destination_map_points` e `destination_hotel_cards` como enriquecimento. Falta migrar ranking/scoring principal para o banco e reduzir dependência dos módulos estáticos.
- **Monitorar tracking no Supabase.** A config pública foi injetada no HTML; validar em produção se `concierge_events`, `concierge_leads` e `concierge_hotel_clicks` recebem inserts com as policies atuais.
- **Reconciliar as migrations.** Rodar `supabase db pull` numa pasta limpa, renumerar para uma trilha única e **arquivar** `supabase/migrations/0012–0020` (legado).
- **Definir camada de dados única** (estática `src/data` vs. views do banco) e remover a duplicidade.
- **Secrets das Edge Functions** `PREDICTHQ_TOKEN` e `MAPBOX_TOKEN` no painel.
- **Agendar refresh semanal** das funções de sync (precisa de aprovação on-screen).
- **Limpar ruído de CRLF** no working tree antes de commits futuros (`.gitattributes` com `* text=auto eol=lf`).
- **Popular dados ao vivo faltantes** (ex.: `destination_google_places` só tem 6 linhas; `destination_events` vazia).

---

## 10. Riscos técnicos

- **Colisão de migrations (alto).** Repo `0014–0020` e banco `0014–0028` têm o mesmo número com conteúdo diferente. `db push`/`db pull` sem reconciliação pode sobrescrever ou conflitar dados.
- **Duas camadas de dados divergentes (alto).** Site mostra dados estáticos; banco tem dados reais mais ricos. Risco de o usuário ver informação defasada e de manutenção dobrada.
- **Tracking dependente de RLS/policies (médio).** Config pública já está injetada; se policies ou grants mudarem, inserts podem cair na fila local silenciosa.
- **Sem build/test/lint/CI (médio).** Nenhuma rede de proteção automática contra regressão. Scripts `.mjs` sem `package.json` declarando dependências.
- **CRLF sem normalização (baixo).** Gera commits whitespace-only que poluem histórico/blame.
- **Dependências de infraestrutura do banco (médio).** Tudo depende da extensão `http` e de funções `SECURITY DEFINER`; mudanças aí afetam toda a camada ao vivo.
- **Limites de API (baixo/médio).** LiteAPI sandbox tem rate limit (sincronizar em lotes). Destinos sem rota terrestre de SP retornam `ZERO_RESULTS` (esperado).
- **Token Mapbox público sem restrição (baixo).** `pk.*` é público por design, mas deve ser restringido por URL no painel do Mapbox.

---

### Decisões de fonte da verdade (resumo)

- **Código do site:** `origin/main @ 0c7c9c4`. Descartar mudanças não commitadas (são CRLF).
- **Banco de dados:** projeto vivo `roojvzpicxnnqjrrdpdx` (migrations 0014–0028). As migrations antigas do repo são legado.
- **Dados exibidos:** o banco (views) é a verdade; a camada `src/data` estática deve ser aposentada após a integração.

*Este documento não altera código de aplicação. É apenas a definição normativa do produto.*
