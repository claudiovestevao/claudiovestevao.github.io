import { conciergeDestinations } from "./src/data/conciergeFamilyDestinations.js?v=viral-mvp-v4-20260605";
import { conciergeHotels } from "./src/data/conciergeFamilyHotels.js?v=viral-mvp-v4-20260605";
import { conciergeHotelAdditions } from "./src/data/conciergeFamilyHotelAdditions.js?v=viral-mvp-v4-20260605";
import { conciergeDestinationImages } from "./src/data/conciergeDestinationImages.js?v=viral-mvp-v4-20260605";
import { conciergeQuizQuestions } from "./src/data/conciergeFamilyQuiz.js?v=viral-mvp-v4-20260605";
import { conciergeCalendar } from "./src/data/conciergeFamilyCalendar.js?v=viral-mvp-v4-20260605";

const WHATSAPP_NUMBER = "5511956607921";
const state = {
  intakeComplete: false,
  intake: {},
  quizIndex: 0,
  answers: {},
  result: null,
  selectedDestinationKey: null,
  showMoreDestinations: false,
  selectedCalendar: "julho",
  hotelFilter: "all",
  hotelFilters: {
    destination: "all",
    mode: "all",
    price: "all",
    image: "all",
    amenities: [],
    search: "",
    sort: "score"
  }
};

const destinationImagesByKey = new Map(conciergeDestinationImages.map(image => [image.key, image]));
const curatedHotels = [...conciergeHotels, ...conciergeHotelAdditions].map(normalizeHotel);
const app = document.getElementById("app");
let searchRenderTimer;

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
render();

function defaultHotelFilters() {
  return {
    destination: "all",
    mode: "all",
    price: "all",
    image: "all",
    amenities: [],
    search: "",
    sort: "score"
  };
}

function render() {
  app.innerHTML = `
    ${ConciergeHeroSection()}
    ${state.result ? ConciergeDiagnosisResult(state.result) : ""}
    ${state.result ? ShareableResultSection(state.result) : ""}
    ${state.result ? DestinationRecommendationsSection() : ""}
    ${state.result && state.selectedDestinationKey ? RankedHotelsSection() : ""}
    ${state.result ? ConciergeLeadCaptureForm() : ""}
  `;
}

function AgentCardConciergeFamilia() {
  return {
    name: "Concierge da Família",
    description: "Encontre destinos, resorts e roteiros que realmente funcionam para famílias da capital de São Paulo com bebês e crianças pequenas.",
    tags: ["Viagens com bebês", "Famílias de São Paulo", "Resorts com copa baby", "Roteiros em família", "Curadoria premium", "IA para planejamento"],
    cta: "Planejar viagem da família"
  };
}

function ConciergeHeroSection() {
  return `
    <section class="hero section minimal-hero diagnostic-home" id="diagnostico">
      <div class="hero-copy">
        <span class="badge">Teste das Férias Sem Perrengue</span>
        <h1>Descubra qual viagem combina com a sua família.</h1>
        <p>Um teste gratuito para entender crianças, ritmo dos pais, orçamento e destinos com menor chance de perrengue. O Booking mostra onde ficar. A gente ajuda a descobrir onde sua família vai ficar bem.</p>
        <div class="family-cues" aria-label="Critérios de curadoria familiar">
          <span>WhatsApp e email</span>
          <span>Quem vai viajar</span>
          <span>Orçamento sem susto</span>
        </div>
      </div>
      <div class="diagnostic-panel">
        ${state.result ? ConciergeDiagnosisDonePanel() : state.intakeComplete ? ConciergeDiagnosisQuiz() : ConciergeQuickIntakeForm()}
      </div>
    </section>
  `;
}

function ConciergeQuickIntakeForm() {
  return `
    <form id="intakeForm" class="quiz-card intake-card">
      <div class="quiz-top">
        <span>Cadastro rápido</span>
        <div class="progress"><i style="width:14%"></i></div>
      </div>
      <h3>Antes do diagnóstico, conte quem vai viajar.</h3>
      <div class="intake-grid">
        <label>Nome<input name="name" required autocomplete="name" placeholder="Seu nome"></label>
        <label>WhatsApp<input name="whatsapp" required inputmode="tel" autocomplete="tel" placeholder="11999999999"></label>
        <label>Email<input name="email" required type="email" autocomplete="email" placeholder="voce@email.com"></label>
        <label>Adultos
          <select name="adults">
            <option>1 adulto</option>
            <option selected>2 adultos</option>
            <option>3 adultos</option>
            <option>4+ adultos</option>
          </select>
        </label>
        <label>Crianças
          <select name="children">
            <option>1 criança</option>
            <option selected>2 crianças</option>
            <option>3 crianças</option>
            <option>4+ crianças</option>
          </select>
        </label>
        <label>Idade principal
          <select name="childAge">
            <option>0 a 12 meses</option>
            <option selected>1 a 2 anos</option>
            <option>3 a 5 anos</option>
            <option>6+ anos</option>
          </select>
        </label>
        <label>Pet
          <select name="pet">
            <option selected>Não vai pet</option>
            <option>Vai pet pequeno</option>
            <option>Vai pet médio/grande</option>
          </select>
        </label>
        <label>Quando querem ir?
          <select name="travelPeriod">
            <option>Férias de julho</option>
            <option>Feriado prolongado</option>
            <option>Verão/Janeiro</option>
            <option selected>Ainda não sei</option>
          </select>
        </label>
        <label>Última viagem em família
          <select name="lastTrip">
            <option>Primeira viagem com criança</option>
            <option>Menos de 6 meses</option>
            <option>6 a 18 meses</option>
            <option selected>Mais de 18 meses</option>
          </select>
        </label>
      </div>
      <button class="button primary" type="submit">Começar diagnóstico</button>
    </form>
  `;
}

function ConciergeDiagnosisDonePanel() {
  return `
    <div class="quiz-card compact-quiz done-card">
      <div class="quiz-top">
        <span>Diagnóstico concluído</span>
        <div class="progress"><i style="width:100%"></i></div>
      </div>
      <h3>Suas 3 melhores cidades estão prontas.</h3>
      <p>Comece pelo destino. Depois de escolher uma cidade, mostramos os hotéis que fazem mais sentido para a família.</p>
      <div class="quiz-actions">
        <a class="button primary" href="#recomendacoes">Ver destinos</a>
        <button class="button secondary" type="button" data-action="restart-diagnosis">Refazer</button>
      </div>
    </div>
  `;
}

function SaoPauloMvpFocusSection() {
  const cards = [
    ["Aeroportos certos", "Congonhas, Guarulhos e Viracopos avaliados conforme destino e perfil da família."],
    ["Viagens de carro realistas", "Foco em destinos viáveis saindo da capital, com tempo de estrada adequado para bebê."],
    ["Calendário paulistano", "Férias escolares, feriados prolongados, verão, julho e Réveillon."],
    ["Curadoria mais precisa", "Menos opções genéricas, mais recomendações que funcionam na prática."]
  ];
  return `
    <section class="section band" id="mvp-sp">
      <div class="section-title">
        <span class="badge subtle">Começamos por São Paulo</span>
        <h2>Começamos por São Paulo para recomendar melhor.</h2>
        <p>Viagem com bebê depende muito do ponto de partida. Para uma família que mora na capital de São Paulo, faz diferença saber se o melhor caminho é sair por Congonhas, Guarulhos, Viracopos ou ir de carro.</p>
        <p>Também importa o tempo real até o aeroporto, o horário do voo, o traslado no destino e se a viagem respeita a rotina da criança. Depois, a curadoria poderá ser expandida para outras cidades, regiões e países.</p>
      </div>
      <div class="grid four">
        ${cards.map(([title, text]) => InfoCard(title, text)).join("")}
      </div>
    </section>
  `;
}

function ConciergeDifferentiationSection() {
  return `
    <section class="section split" id="diferenca">
      <div class="section-title">
        <h2>Não é um buscador de viagem. É um concierge para famílias paulistanas.</h2>
        <p>Buscadores comuns mostram preço, fotos e avaliações genéricas. O Concierge da Família avalia os detalhes que realmente importam para quem viaja com bebê saindo de São Paulo.</p>
      </div>
      <div class="compare">
        <div>
          <h3>Buscadores comuns mostram</h3>
          ${BulletList(["preço", "fotos", "estrelas", "nota geral", "localização", "disponibilidade"])}
        </div>
        <div class="highlight">
          <h3>Concierge da Família avalia</h3>
          ${BulletList(["qual aeroporto faz mais sentido?", "o voo é direto?", "o horário é bom para criança?", "o traslado no destino é curto?", "dá para ir de carro sem estourar a rotina?", "tem copa baby?", "funciona com carrinho?", "há farmácia ou hospital por perto?", "funciona em dia de chuva?", "é bom para bebê ou só para criança maior?"])}
        </div>
      </div>
    </section>
  `;
}

function ConciergeDiagnosisQuiz() {
  const question = conciergeQuizQuestions[state.quizIndex];
  const progress = Math.round(((state.quizIndex + 1) / conciergeQuizQuestions.length) * 100);
  return `
      <div class="quiz-card compact-quiz">
        <div class="quiz-top">
          <span>Pergunta ${state.quizIndex + 1} de ${conciergeQuizQuestions.length}</span>
          <div class="progress"><i style="width:${progress}%"></i></div>
        </div>
        <h3>${escapeHtml(question.question)}</h3>
        <div class="chips ${question.type === "multi" ? "multi" : ""}">
          ${question.options.map(option => QuizOption(question, option)).join("")}
        </div>
        ${question.type === "multi" ? `<p class="micro">Escolha até ${question.max} itens.</p>` : ""}
        <div class="quiz-actions">
          <button class="button secondary" data-action="quiz-back" ${state.quizIndex === 0 ? "disabled" : ""}>Voltar</button>
          ${question.type === "multi" ? `<button class="button primary" data-action="quiz-next">${state.quizIndex === conciergeQuizQuestions.length - 1 ? "Ver resultado" : "Continuar"}</button>` : ""}
        </div>
      </div>
  `;
}

function QuizOption(question, option) {
  const answer = state.answers[question.id];
  const active = Array.isArray(answer) ? answer.includes(option) : answer === option;
  return `<button class="chip ${active ? "active" : ""}" data-action="quiz-answer" data-question="${question.id}" data-value="${escapeAttr(option)}">${escapeHtml(option)}</button>`;
}

function ConciergeDiagnosisResult(result) {
  return `
    <section class="section result-section compact-result" id="resultado">
      <div class="result-card good">
        <span class="badge">Seu resultado</span>
        <h2>${escapeHtml(result.profileName)}</h2>
        <p>${escapeHtml(result.profile)}</p>
        <div class="viral-score-grid">
          ${MetricCard("Índice Sem Perrengue", `${result.semPerrengue.score}/100`, result.semPerrengue.label)}
          ${MetricCard("Fit Financeiro", result.financialFit.label, result.financialFit.detail)}
          ${MetricCard("Esforço logístico", result.travelEffort.label, result.travelEffort.detail)}
        </div>
        <div class="cost-estimate">
          <div>
            <span class="eyebrow">Estimativa inicial de custo</span>
            <h3>${escapeHtml(result.costEstimate.headline)}</h3>
            <p>${escapeHtml(result.costEstimate.note)}</p>
          </div>
          <div class="cost-grid">
            <span><b>Econômico</b>${escapeHtml(result.costEstimate.economic)}</span>
            <span><b>Equilibrado</b>${escapeHtml(result.costEstimate.balanced)}</span>
            <span><b>Conforto</b>${escapeHtml(result.costEstimate.comfort)}</span>
          </div>
        </div>
        <p class="micro">Este índice é uma estimativa criada a partir das suas respostas para ajudar na decisão. Não representa garantia de experiência ou preço.</p>
        <div class="quick-insights">
          <div>
          <h3>Eu priorizaria</h3>
            ${BulletList(result.prioritize.slice(0, 3))}
          </div>
          <div>
          <h3>Eu evitaria por enquanto</h3>
            ${BulletList(result.avoid.slice(0, 2))}
          </div>
        </div>
      </div>
    </section>
  `;
}

function MetricCard(label, value, detail) {
  return `
    <div class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </div>
  `;
}

function ShareableResultSection(result) {
  return `
    <section class="section share-section" id="compartilhar">
      <div class="share-layout">
        <div class="share-card">
          <span class="badge subtle">Card compartilhável</span>
          <h2>Mostre o perfil da sua família.</h2>
          <div class="share-preview">
            <span>Meu perfil de viagem em família é...</span>
            <strong>${escapeHtml(result.profileName)}</strong>
            <p>Índice Sem Perrengue: ${result.semPerrengue.score}/100 · Fit financeiro: ${escapeHtml(result.financialFit.label)}</p>
          </div>
          <div class="hero-actions">
            <button class="button primary" type="button" data-action="share-result">Compartilhar resultado</button>
            <button class="button secondary" type="button" data-action="copy-share-text">Copiar texto</button>
            <button class="button secondary" type="button" data-action="family-alert">Ativar alerta de oportunidade</button>
          </div>
        </div>
        <div class="social-proof-card">
          <span class="badge subtle">Exemplo beta</span>
          <h3>Perfis mais comuns esta semana</h3>
          <div class="profile-bars">
            ${ProfileBar("Família Resort Raiz", 32)}
            ${ProfileBar("Família Hotel Fazenda", 24)}
            ${ProfileBar("Família Praia com Plano B", 18)}
            ${ProfileBar("Família Econômica Inteligente", 14)}
          </div>
        </div>
      </div>
    </section>
  `;
}

function ProfileBar(label, value) {
  return `
    <div class="profile-bar">
      <span>${escapeHtml(label)} <b>${value}%</b></span>
      <i style="width:${value}%"></i>
    </div>
  `;
}

function DestinationRecommendationsSection() {
  const recommendations = buildDestinationRecommendations();
  const visibleRecommendations = state.showMoreDestinations ? recommendations : recommendations.slice(0, 3);
  return `
    <section class="section destination-recommendations" id="recomendacoes">
      <div class="section-title">
        <span class="badge subtle">Decisão de mãe: primeiro o destino</span>
        <h2>Eu começaria por estas 3 cidades.</h2>
        <p>Antes de entrar em hotel, escolha o lugar que mais combina com rotina, orçamento e época da viagem. Depois você compara os resorts daquele destino.</p>
      </div>
      <div class="recommendation-grid">
        ${visibleRecommendations.map((recommendation, index) => DestinationRecommendationCard(recommendation, index)).join("")}
      </div>
      <div class="recommendation-actions">
        ${!state.showMoreDestinations && recommendations.length > 3 ? `<button class="button secondary" data-action="show-more-destinations">Ver mais destinos avaliados</button>` : ""}
        ${state.showMoreDestinations ? `<button class="button secondary" data-action="show-top-destinations">Voltar para as 3 melhores</button>` : ""}
      </div>
    </section>
  `;
}

function DestinationRecommendationCard(recommendation, index) {
  const active = state.selectedDestinationKey === recommendation.key;
  return `
    <article class="recommendation-card ${active ? "active" : ""}">
      <div class="recommendation-rank">
        <span>${index + 1}</span>
        <strong>${recommendation.score.toFixed(1)}</strong>
      </div>
      ${DestinationImage(recommendation.imageKey, recommendation.name)}
      <div class="recommendation-copy">
        <span class="eyebrow">${escapeHtml(recommendation.familyFit)}</span>
        <h3>${escapeHtml(recommendation.name)}</h3>
        <p>${escapeHtml(recommendation.reason)}</p>
        <div class="decision-lens">
          <div>
            <b>Orçamento</b>
            <span>${escapeHtml(recommendation.budgetNote)}</span>
          </div>
          <div>
            <b>Sazonalidade</b>
            <span>${escapeHtml(recommendation.seasonNote)}</span>
          </div>
          <div>
            <b>Meu cuidado</b>
            <span>${escapeHtml(recommendation.momCheck)}</span>
          </div>
        </div>
        <div class="tags compact-tags">
          ${recommendation.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
        <button class="button primary" data-action="select-destination-recommendation" data-destination-key="${escapeAttr(recommendation.key)}">
          ${active ? "Hotéis deste destino abaixo" : `Ver hotéis em ${escapeHtml(recommendation.shortName)}`}
        </button>
      </div>
    </article>
  `;
}

function RankedHotelsSection() {
  const ranked = getFilteredRankedHotels();
  const destinationGroups = buildDestinationGroups(ranked);
  const selectedRecommendation = buildDestinationRecommendations().find(item => item.key === state.selectedDestinationKey);
  return `
    <section class="section ranking-section" id="ranking">
      <div class="section-title">
        <span class="badge subtle">Agora sim: hotéis</span>
        <h2>Hotéis em ${escapeHtml(selectedRecommendation?.name || "destino escolhido")}</h2>
        <p>Agora que o destino foi escolhido, compare estrutura infantil, faixa de preço e disponibilidade. Eu manteria a lista curta e olharia primeiro os melhores encaixes.</p>
      </div>
      ${ranked.length ? ConciergeMap(ranked) : ""}
      <button class="button secondary compact-button back-destination-button" data-action="back-to-destinations">Trocar destino</button>
      ${HotelExplorerControls(ranked)}
      ${DestinationSummary(destinationGroups)}
      <div class="ranking-list">
        ${ranked.length ? ranked.map((hotel, index) => RankedHotelCard(hotel, index)).join("") : EmptyHotelState()}
      </div>
    </section>
  `;
}

function HotelExplorerControls(rankedHotels) {
  const destinations = buildDestinationOptions(rankedHotels);
  const amenityFilters = [
    ["copa", "Copa baby"],
    ["copa24", "Copa 24h"],
    ["kidsClub", "Kids club"],
    ["kidsPool", "Piscina infantil"],
    ["heatedPool", "Piscina aquecida"],
    ["allInclusive", "All inclusive"],
    ["rain", "Plano B chuva"],
    ["kitchen", "Kitchenette"]
  ];
  return `
    <div class="hotel-explorer">
      <div class="filter-summary">
        <strong>${rankedHotels.length}</strong>
        <span>hotéis qualificados encontrados</span>
      </div>
      <label class="search-field">
        <span>Buscar hotel ou destino</span>
        <input type="search" value="${escapeAttr(state.hotelFilters.search)}" placeholder="Ex: Gramado, copa baby, resort" data-action="hotel-search">
      </label>
      <div class="select-grid">
        ${FilterSelect("destination", "Destino", destinations)}
        ${FilterSelect("mode", "Deslocamento", [["all", "Todos"], ["carro", "Carro"], ["voo", "Voo"], ["voo internacional", "Internacional"]])}
        ${FilterSelect("price", "Faixa", [["all", "Todas"], ["mid", "Mid"], ["upscale", "Upscale"], ["luxury", "Luxury"]])}
        ${FilterSelect("sort", "Ordenar", [["score", "Melhor score"], ["distance", "Menor deslocamento"], ["name", "Nome"]])}
        ${FilterSelect("image", "Imagem", [["all", "Todas"], ["verified", "Com imagem"], ["missing", "Sem imagem"]])}
      </div>
      <div class="filters amenity-filters">
        ${amenityFilters.map(([id, label]) => `
          <button class="filter ${state.hotelFilters.amenities.includes(id) ? "active" : ""}" data-action="amenity-filter" data-filter="${id}">${label}</button>
        `).join("")}
        <button class="filter reset-filter" data-action="reset-hotel-filters">Limpar filtros</button>
      </div>
    </div>
  `;
}

function FilterSelect(id, label, options) {
  return `
    <label class="filter-select">
      <span>${escapeHtml(label)}</span>
      <select data-action="hotel-select" data-filter="${id}">
        ${options.map(([value, text]) => `<option value="${escapeAttr(value)}" ${state.hotelFilters[id] === value ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}
      </select>
    </label>
  `;
}

function DestinationSummary(groups) {
  return `
    <div class="destination-strip" aria-label="Destinos com hotéis filtrados">
      ${groups.map(group => `
        <button class="destination-pill ${state.hotelFilters.destination === group.slug ? "active" : ""}" data-action="destination-filter" data-destination="${escapeAttr(group.slug)}">
          <strong>${escapeHtml(group.name)}</strong>
          <span>${group.count} ${group.count === 1 ? "hotel" : "hotéis"}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function ConciergeMap(rankedHotels) {
  const topHotel = rankedHotels[0];
  const topDrive = rankedHotels.find(hotel => hotel.departureMode === "carro");
  const topBeach = rankedHotels.find(hotel => hotel.departureMode === "voo");
  return `
    <div class="concierge-map-card" aria-label="Mapa simplificado com destinos recomendados">
      <div class="map-copy">
        <span class="badge subtle">Mapa da curadoria</span>
        <h3>De São Paulo para destinos reais</h3>
        <p>O ranking trabalha com lugares concretos, como ${escapeHtml(topHotel.destination)}, ${escapeHtml(topDrive?.destination || "Atibaia, SP")} e ${escapeHtml(topBeach?.destination || "Porto de Galinhas, PE")}.</p>
      </div>
      <div class="map-canvas" role="img" aria-label="Mapa visual simplificado com São Paulo como origem e pins de hotéis">
        <span class="map-origin">São Paulo</span>
        ${rankedHotels.map((hotel, index) => MapPin(hotel, index)).join("")}
      </div>
    </div>
  `;
}

function MapPin(hotel, index) {
  const position = hotelMapPosition(hotel.id);
  const offset = index % 2 === 0 ? 0 : 1.6;
  return `
    <span class="map-pin" style="left:${position.x + offset}%;top:${position.y + offset}%">
      <b>${index + 1}</b>
      <small>${escapeHtml(position.label)}</small>
    </span>
  `;
}

function hotelMapPosition(id) {
  const positions = {
    "royal-palm-plaza-campinas": { x: 38, y: 62, label: "Campinas" },
    "bourbon-atibaia": { x: 45, y: 54, label: "Atibaia" },
    "taua-resort-atibaia": { x: 47, y: 55, label: "Atibaia" },
    "club-med-lake-paradise": { x: 56, y: 61, label: "Mogi das Cruzes" },
    "mavsa-resort": { x: 30, y: 66, label: "Cesário Lange" },
    "tivoli-praia-do-forte": { x: 74, y: 34, label: "Praia do Forte" },
    "salinas-maragogi": { x: 79, y: 23, label: "Maragogi" },
    "summerville-porto-galinhas": { x: 82, y: 27, label: "Porto de Galinhas" },
    "enotel-porto-galinhas": { x: 84, y: 31, label: "Porto de Galinhas" },
    "hot-beach-resort-olimpia": { x: 27, y: 48, label: "Olimpia" },
    "wish-foz-do-iguacu": { x: 20, y: 82, label: "Foz" },
    "recanto-cataratas-resort": { x: 23, y: 84, label: "Foz" },
    "hotel-alpestre-gramado": { x: 31, y: 88, label: "Gramado" },
    "wish-serrano-gramado": { x: 34, y: 86, label: "Gramado" },
    "clara-dourado-resort": { x: 34, y: 54, label: "Dourado" },
    "toriba-campos-do-jordao": { x: 60, y: 58, label: "Campos" },
    "villa-rossa-sao-roque": { x: 40, y: 68, label: "Sao Roque" },
    "casa-grande-guaruja": { x: 55, y: 74, label: "Guaruja" },
    "vila-olaria-penha": { x: 38, y: 82, label: "Penha" },
    "bulnes-eco-suites-buenos-aires": { x: 26, y: 92, label: "Buenos Aires" },
    "disney-art-of-animation-resort": { x: 14, y: 28, label: "Orlando" }
  };
  return positions[id] || { x: 55, y: 50, label: "Destino" };
}

function RankedHotelCard(hotel, index) {
  return `
    <article class="ranking-row">
      <span class="rank-number">${index + 1}</span>
      ${TravelImage(hotel.image, hotel.name, hotel.imageNote, hotel.imageConfidence)}
      <div class="ranking-copy">
        <div class="ranking-title">
          <h3>${escapeHtml(hotel.name)}</h3>
          <span>${escapeHtml(hotel.destination)}</span>
        </div>
        <p>${escapeHtml(hotel.verdict)}</p>
        <div class="tags compact-tags">
          ${hotel.departureMode === "carro" ? "<span>carro</span>" : "<span>voo direto</span>"}
          ${hotel.copaBaby ? "<span>copa baby</span>" : ""}
          ${hotel.kidsClub ? "<span>kids club</span>" : ""}
          ${hotel.heatedPool ? "<span>piscina aquecida</span>" : ""}
          ${hotel.allInclusive ? "<span>all inclusive</span>" : ""}
          ${hotel.worksOnRainyDay ? "<span>plano B chuva</span>" : ""}
        </div>
        ${hotel.rankingNotes.length ? `<small>${escapeHtml(hotel.rankingNotes.join(" · "))}</small>` : ""}
        <div class="availability-actions">
          <a class="button primary compact-button" href="${escapeAttr(hotel.officialSiteUrl || hotel.sourceUrl)}" target="_blank" rel="noopener" data-track="hotel_availability_click" data-source="official" data-hotel-id="${escapeAttr(hotel.id)}" data-hotel-name="${escapeAttr(hotel.name)}" data-destination="${escapeAttr(hotel.destination)}">Ver disponibilidade</a>
          <a class="button secondary compact-button" href="${escapeAttr(hotel.bookingUrl || bookingSearchUrl(hotel))}" target="_blank" rel="noopener" data-track="hotel_availability_click" data-source="booking" data-hotel-id="${escapeAttr(hotel.id)}" data-hotel-name="${escapeAttr(hotel.name)}" data-destination="${escapeAttr(hotel.destination)}">Buscar no Booking</a>
          ${hotel.sourceUrl ? `<a class="source-link" href="${escapeAttr(hotel.sourceUrl)}" target="_blank" rel="noopener" data-track="hotel_source_click" data-source="curation" data-hotel-id="${escapeAttr(hotel.id)}" data-hotel-name="${escapeAttr(hotel.name)}" data-destination="${escapeAttr(hotel.destination)}">Fonte da curadoria</a>` : ""}
        </div>
      </div>
      <div class="ranking-score">
        <strong>${hotel.adjustedScore.toFixed(1)}</strong>
        <span>/10</span>
      </div>
    </article>
  `;
}

function EmptyHotelState() {
  return `
    <div class="empty-state">
      <strong>Nenhum hotel com estes filtros.</strong>
      <p>Remova algum critério ou limpe os filtros para voltar à curadoria completa.</p>
      <button class="button secondary" data-action="reset-hotel-filters">Limpar filtros</button>
    </div>
  `;
}

function rankHotelsForAnswers() {
  const answers = state.answers || {};
  const must = arrayAnswer(answers.comfort_needs);
  const concerns = arrayAnswer(answers.avoid_risks);
  const intake = state.intake || {};
  const budgetSeason = answers.budget_season_strategy || "";
  const babySmall = intake.childAge === "0 a 12 meses";
  const hasPet = intake.pet && intake.pet !== "Não vai pet";

  return curatedHotels.map(hotel => {
    let adjustedScore = hotel.score;
    const rankingNotes = [];

    if (answers.displacement_limit === "Até 2h de carro" && hotel.departureMode === "carro" && hotel.driveTimeFromSaoPaulo <= 120) {
      adjustedScore += 0.45;
      rankingNotes.push("carro curto");
    }
    if (answers.displacement_limit === "Até 4h de carro" && hotel.departureMode === "carro" && hotel.driveTimeFromSaoPaulo <= 240) {
      adjustedScore += 0.35;
      rankingNotes.push("viável de carro");
    }
    if (answers.displacement_limit === "Voo direto e traslado até 1h" && hotel.directFlight && (!hotel.transferMinutes || hotel.transferMinutes <= 60)) {
      adjustedScore += 0.35;
      rankingNotes.push("voo e traslado simples");
    }
    if (must.includes("Copa baby") && hotel.copaBaby) adjustedScore += 0.35;
    if (must.includes("Copa baby 24h") && hotel.copaBaby24h) adjustedScore += 0.45;
    if (must.includes("All inclusive") && hotel.allInclusive) adjustedScore += 0.25;
    if (must.includes("Kids club") && hotel.kidsClub) adjustedScore += 0.22;
    if (must.includes("Piscina aquecida") && hotel.heatedPool) adjustedScore += 0.24;
    if (must.includes("Plano B para chuva") && hotel.worksOnRainyDay) adjustedScore += 0.2;
    if (must.includes("Kitchenette/cozinha") && hotel.hasKitchenette) adjustedScore += 0.28;
    if (must.includes("Não alugar carro") && hotel.departureMode.includes("voo")) adjustedScore += 0.2;

    if (answers.stay_style === "Resort completo" && hotel.propertyType === "resort") adjustedScore += 0.25;
    if (answers.stay_style === "Hotel fazenda" && hotel.destinationSlug === "hotel-fazenda-sp") adjustedScore += 0.35;
    if (answers.stay_style === "Praia com resort" && hotel.calmBeach) adjustedScore += 0.32;
    if (answers.stay_style === "Cidade com passeios" && ["buenos-aires", "orlando", "foz-do-iguacu", "gramado"].includes(hotel.destinationSlug)) adjustedScore += 0.18;
    if (answers.stay_style === "Apart-hotel com cozinha" && hotel.hasKitchenette) adjustedScore += 0.35;

    if (answers.travel_goal === "Primeira viagem sem susto" && hotel.driveTimeFromSaoPaulo && hotel.driveTimeFromSaoPaulo <= 120) adjustedScore += 0.28;
    if (answers.travel_goal === "Praia e piscina" && (hotel.calmBeach || hotel.kidsPool)) adjustedScore += 0.22;
    if (answers.travel_goal === "Natureza e ar livre" && ["hotel-fazenda-sp", "foz-do-iguacu", "campos-do-jordao", "sao-roque"].includes(hotel.destinationSlug)) adjustedScore += 0.22;
    if (answers.travel_goal === "Parque ou muita atividade" && ["olimpia", "beto-carrero-penha", "orlando"].includes(hotel.destinationSlug)) adjustedScore += 0.28;

    if (answers.decision_profile === "Melhor custo-benefício" && hotel.priceTier === "mid") adjustedScore += 0.18;
    if (answers.decision_profile === "Melhor estrutura, mesmo mais caro" && hotel.priceTier === "luxury") adjustedScore += 0.18;
    if (answers.decision_profile === "Evitar lotação e filas" && ["orlando", "beto-carrero-penha", "olimpia"].includes(hotel.destinationSlug)) adjustedScore -= 0.22;

    if (budgetSeason === "Alta temporada, quero segurança mesmo pagando mais") {
      if (["luxury", "upscale"].includes(hotel.priceTier) && hotel.worksOnRainyDay) adjustedScore += 0.24;
      if (travelBurden(hotel) <= 150) adjustedScore += 0.12;
      rankingNotes.push("bom para alta temporada");
    }
    if (budgetSeason === "Feriado curto, preciso logística simples") {
      if (travelBurden(hotel) <= 120) adjustedScore += 0.32;
      if (hotel.transferMinutes > 90 || hotel.driveTimeFromSaoPaulo > 180) adjustedScore -= 0.28;
      rankingNotes.push("melhor para feriado curto");
    }
    if (budgetSeason === "Baixa temporada, prefiro custo-benefício") {
      if (["mid", "upscale"].includes(hotel.priceTier)) adjustedScore += 0.24;
      if (hotel.priceTier === "luxury") adjustedScore -= 0.12;
      rankingNotes.push("olhar datas fora de pico");
    }
    if (budgetSeason === "Verão/praia, aceito pagar mais pelo clima") {
      if (hotel.calmBeach || ["praia-do-forte", "porto-de-galinhas", "maceio-maragogi", "litoral-norte-sp"].includes(hotel.destinationSlug)) adjustedScore += 0.3;
      if (hotel.allInclusive) adjustedScore += 0.12;
      rankingNotes.push("depende de voo e clima");
    }
    if (budgetSeason === "Data flexível, quero a melhor oportunidade") {
      if (hotel.priceTier !== "luxury" || hotel.driveTimeFromSaoPaulo) adjustedScore += 0.14;
      rankingNotes.push("bom para monitorar oportunidade");
    }

    if (concerns.includes("Traslado longo") && hotel.transferMinutes > 90) {
      adjustedScore -= 0.45;
      rankingNotes.push("atenção ao traslado");
    }
    if (concerns.includes("Estrada cansativa") && hotel.driveTimeFromSaoPaulo > 120) {
      adjustedScore -= 0.35;
      rankingNotes.push("estrada mais longa");
    }
    if (concerns.includes("Fila e lotação") && ["orlando", "beto-carrero-penha", "olimpia", "gramado"].includes(hotel.destinationSlug)) adjustedScore -= 0.2;
    if (concerns.includes("Sem plano B para chuva") && !hotel.worksOnRainyDay) adjustedScore -= 0.18;
    if (concerns.includes("Sem comida fácil") && !hotel.allInclusive && !hotel.hasKitchenette) adjustedScore -= 0.12;
    if (babySmall && hotel.transferMinutes > 90) adjustedScore -= 0.35;
    if (babySmall && hotel.copaBaby) rankingNotes.push("mais forte para bebê pequeno");
    if (hasPet) rankingNotes.push("confirmar política pet");

    return {
      ...hotel,
      adjustedScore: Math.max(0, Math.min(10, Math.round(adjustedScore * 10) / 10)),
      rankingNotes: rankingNotes.slice(0, 2)
    };
  }).sort((a, b) => b.adjustedScore - a.adjustedScore || b.score - a.score);
}

function getFilteredRankedHotels() {
  const filters = state.hotelFilters;
  const ranked = rankHotelsForAnswers()
    .filter(hotel => !state.selectedDestinationKey || cityKeyForHotel(hotel) === state.selectedDestinationKey)
    .filter(hotel => matchesHotelFilters(hotel, filters));
  if (filters.sort === "distance") {
    return ranked.sort((a, b) => travelBurden(a) - travelBurden(b) || b.adjustedScore - a.adjustedScore);
  }
  if (filters.sort === "name") {
    return ranked.sort((a, b) => a.name.localeCompare(b.name));
  }
  return ranked;
}

function matchesHotelFilters(hotel, filters) {
  if (filters.destination !== "all" && hotel.destinationSlug !== filters.destination) return false;
  if (filters.mode !== "all" && !hotel.departureMode.includes(filters.mode)) return false;
  if (filters.price !== "all" && hotel.priceTier !== filters.price) return false;
  if (filters.image === "verified" && hotel.imageConfidence === "missing") return false;
  if (filters.image === "missing" && hotel.imageConfidence !== "missing") return false;
  if (filters.search) {
    const haystack = [hotel.name, hotel.destination, hotel.idealAge, hotel.verdict, hotel.mainStrength, hotel.propertyType].join(" ").toLowerCase();
    if (!haystack.includes(filters.search.toLowerCase())) return false;
  }
  return filters.amenities.every(filter => matchesAmenity(hotel, filter));
}

function matchesAmenity(hotel, filter) {
  const checks = {
    copa: hotel.copaBaby,
    copa24: hotel.copaBaby24h,
    kidsClub: hotel.kidsClub,
    kidsPool: hotel.kidsPool,
    heatedPool: hotel.heatedPool,
    allInclusive: hotel.allInclusive,
    rain: hotel.worksOnRainyDay,
    kitchen: hotel.hasKitchenette
  };
  return Boolean(checks[filter]);
}

function travelBurden(hotel) {
  if (hotel.driveTimeFromSaoPaulo) return hotel.driveTimeFromSaoPaulo;
  return 180 + (hotel.transferMinutes || 90);
}

function buildDestinationGroups(hotels) {
  const groups = new Map();
  hotels.forEach(hotel => {
    const slug = hotel.destinationSlug || hotel.id;
    const current = groups.get(slug) || { slug, name: destinationName(slug, hotel.destination), count: 0, bestScore: 0 };
    current.count += 1;
    current.bestScore = Math.max(current.bestScore, hotel.adjustedScore || hotel.score);
    groups.set(slug, current);
  });
  return [...groups.values()].sort((a, b) => b.bestScore - a.bestScore || a.name.localeCompare(b.name)).slice(0, 12);
}

function buildDestinationRecommendations() {
  const groups = new Map();
  rankHotelsForAnswers().forEach(hotel => {
    const key = cityKeyForHotel(hotel);
    const current = groups.get(key) || {
      key,
      name: hotel.destination,
      shortName: shortCityName(hotel.destination),
      hotels: [],
      bestScore: 0,
      imageKey: imageKeyForHotelDestination(hotel)
    };
    current.hotels.push(hotel);
    current.bestScore = Math.max(current.bestScore, hotel.adjustedScore || hotel.score);
    groups.set(key, current);
  });

  return [...groups.values()].map(group => {
    const sortedHotels = group.hotels.sort((a, b) => b.adjustedScore - a.adjustedScore || b.score - a.score);
    const bestHotel = sortedHotels[0];
    const topHotels = sortedHotels.slice(0, 2);
    const topScoreAverage = topHotels.reduce((sum, hotel) => sum + hotel.adjustedScore, 0) / topHotels.length;
    const score = Math.min(10, Math.round((topScoreAverage + destinationStrategicBonus(group, bestHotel)) * 10) / 10);
    return {
      ...group,
      hotels: sortedHotels,
      bestHotel,
      score,
      familyFit: buildFamilyFit(group, bestHotel),
      reason: buildDestinationReason(group, bestHotel),
      budgetNote: buildBudgetNote(group, bestHotel),
      seasonNote: buildSeasonNote(group, bestHotel),
      momCheck: buildMomCheck(group, bestHotel),
      tags: recommendationTags(group, bestHotel)
    };
  }).sort((a, b) => b.score - a.score || b.bestScore - a.bestScore || a.name.localeCompare(b.name));
}

function destinationStrategicBonus(group, bestHotel) {
  const answers = state.answers || {};
  const budget = budgetMaxValue(answers.budget_total);
  const shortTrip = ["Bate-volta", "1 noite"].includes(answers.trip_duration);
  const longTrip = answers.trip_duration === "6+ noites";
  let bonus = group.hotels.length > 1 ? 0.1 : 0;
  if (answers.budget_season_strategy === "Feriado curto, preciso logística simples" && travelBurden(bestHotel) <= 120) bonus += 0.18;
  if (answers.budget_season_strategy === "Baixa temporada, prefiro custo-benefício" && group.hotels.some(hotel => hotel.priceTier === "mid")) bonus += 0.14;
  if (answers.budget_season_strategy === "Verão/praia, aceito pagar mais pelo clima" && isBeachDestination(bestHotel)) bonus += 0.16;
  if (budget && budget <= 3000) {
    if (bestHotel.departureMode === "carro" && travelBurden(bestHotel) <= 150) bonus += 0.26;
    if (group.hotels.some(hotel => hotel.priceTier === "mid")) bonus += 0.14;
    if (bestHotel.priceTier === "luxury" || bestHotel.departureMode.includes("voo")) bonus -= 0.28;
  }
  if (budget && budget > 3000 && budget <= 5000) {
    if (bestHotel.departureMode === "carro") bonus += 0.1;
    if (bestHotel.priceTier === "luxury" && !answers.budget_season_strategy?.includes("Baixa temporada")) bonus -= 0.12;
  }
  if (budget && budget >= 8000 && answers.decision_profile === "Melhor estrutura, mesmo mais caro" && ["upscale", "luxury"].includes(bestHotel.priceTier)) bonus += 0.12;
  if (shortTrip && travelBurden(bestHotel) > 150) bonus -= 0.22;
  if (longTrip && (bestHotel.allInclusive || isBeachDestination(bestHotel))) bonus += 0.1;
  if (answers.decision_profile === "Evitar lotação e filas" && ["orlando", "beto-carrero-penha", "olimpia", "gramado"].includes(bestHotel.destinationSlug)) bonus -= 0.22;
  return bonus;
}

function buildFamilyFit(group, bestHotel) {
  if (bestHotel.driveTimeFromSaoPaulo && bestHotel.driveTimeFromSaoPaulo <= 120) return "menos logística, mais previsibilidade";
  if (isBeachDestination(bestHotel)) return "praia com estrutura para descansar";
  if (bestHotel.allInclusive) return "alimentação mais resolvida";
  if (bestHotel.hasKitchenette) return "rotina e autonomia";
  return group.hotels.length > 1 ? "boa base para comparar hotéis" : "opção bem específica";
}

function buildDestinationReason(group, bestHotel) {
  const answers = state.answers || {};
  if (answers.travel_goal === "Primeira viagem sem susto") return `${group.shortName} reduz pontos de atrito: deslocamento mais simples, hotel com estrutura e menos decisões no dia.`;
  if (answers.travel_goal === "Praia e piscina" && isBeachDestination(bestHotel)) return `${group.shortName} entrega o combo mais óbvio para família: água, pausa e resort como base principal.`;
  if (answers.travel_goal === "Parque ou muita atividade") return `${group.shortName} faz sentido se a criança já aguenta dias mais cheios e vocês topam controlar fila e descanso.`;
  if (answers.stay_style === "Hotel fazenda") return `${group.shortName} é uma escolha mais acolhedora quando a família quer natureza, refeição fácil e rotina menos urbana.`;
  return `Eu colocaria ${group.shortName} na frente porque combina melhor logística, estrutura infantil e chance de a viagem fluir sem excesso de roteiro.`;
}

function buildBudgetNote(group, bestHotel) {
  const strategy = state.answers?.budget_season_strategy || "";
  const budgetLabel = state.answers?.budget_total || "";
  const budget = budgetMaxValue(budgetLabel);
  const tiers = unique(group.hotels.map(hotel => hotel.priceTier));
  const hasMid = tiers.includes("mid");
  const hasLuxury = tiers.includes("luxury");
  if (budget && budget <= 1500) return bestHotel.driveTimeFromSaoPaulo ? "eu trataria como bate-volta ou 1 noite bem simples" : "alto risco de estourar; melhor trocar por destino perto";
  if (budget && budget <= 3000) return bestHotel.driveTimeFromSaoPaulo ? "mais realista se controlar diária, pedágio e refeições" : "só faz sentido com promoção muito boa e pouca bagagem";
  if (budget && budget <= 5000) return hasMid ? "cabe melhor em datas fora de pico e hotéis mid" : "pode apertar; compare taxas e refeições antes";
  if (budget && budget >= 8000) return hasLuxury ? "permite comprar estrutura e previsibilidade" : "há folga para quarto melhor ou mais noites";
  if (strategy.includes("Baixa temporada")) return hasMid ? "melhor chance de controlar diária fora de pico" : "vale monitorar promoção; tende a ser mais caro";
  if (strategy.includes("Alta temporada")) return hasLuxury ? "não é barato, mas compra previsibilidade" : "pode performar bem se reservar cedo";
  if (strategy.includes("Feriado curto")) return bestHotel.driveTimeFromSaoPaulo ? "economiza voo, mas atenção à estrada" : "voo curto ajuda; compre com antecedência";
  if (strategy.includes("Verão/praia")) return "preço sobe rápido no calor; trave aéreo e política de cancelamento";
  if (hasMid) return "há opção mais controlável para testar datas";
  return "orçamento médio/alto; compare meia pensão, taxas e extras";
}

function buildSeasonNote(group, bestHotel) {
  const period = state.intake?.travelPeriod || "Ainda não sei";
  const strategy = state.answers?.budget_season_strategy || "";
  const duration = state.answers?.trip_duration || "";
  if (["Bate-volta", "1 noite"].includes(duration)) return travelBurden(bestHotel) <= 150 ? "bom para viagem curta; sair cedo muda tudo" : "curto demais para tanta logística";
  if (duration === "6+ noites" && isBeachDestination(bestHotel)) return "mais noites diluem o deslocamento, mas eu evitaria pico e chuva forte";
  if (strategy.includes("Baixa temporada")) return "fora de férias, eu procuraria melhor tarifa e mais espaço no hotel";
  if (period === "Férias de julho" && ["gramado", "campos-do-jordao"].includes(bestHotel.destinationSlug)) return "julho combina com serra, mas lota e encarece bastante";
  if (period === "Verão/Janeiro" && isBeachDestination(bestHotel)) return "verão favorece praia, mas exige reserva cedo e plano para chuva";
  if (period === "Feriado prolongado") return travelBurden(bestHotel) <= 150 ? "boa para feriado porque a logística não engole a viagem" : "feriado pede chegada cedo e margem para imprevistos";
  if (strategy.includes("Alta temporada")) return "priorize hotel com plano B, política clara e horários confortáveis";
  return "com data flexível, eu compararia preço por semana e evitaria pico escolar";
}

function buildMomCheck(group, bestHotel) {
  if (state.intake?.childAge === "0 a 12 meses" && !bestHotel.copaBaby) return "confirmar berço, copa baby e comida antes de reservar";
  if (bestHotel.transferMinutes > 90) return "só escolheria com voo chegando cedo e traslado privado";
  if (bestHotel.driveTimeFromSaoPaulo > 180) return "planejar paradas reais, não só tempo de mapa";
  if (bestHotel.destinationSlug === "olimpia") return "bom para criança maior; para bebê eu teria cautela";
  return "validar horário de chegada, refeições e política de cancelamento";
}

function recommendationTags(group, bestHotel) {
  return unique([
    bestHotel.driveTimeFromSaoPaulo ? `${formatHotelTime(bestHotel)} de carro` : `traslado ${bestHotel.transferMinutes || "?"} min`,
    priceTierLabel(bestHotel.priceTier),
    bestHotel.copaBaby ? "copa baby" : "",
    bestHotel.allInclusive ? "all inclusive" : "",
    bestHotel.worksOnRainyDay ? "plano B chuva" : "",
    `${group.hotels.length} ${group.hotels.length === 1 ? "hotel" : "hotéis"}`
  ]).slice(0, 4);
}

function buildDestinationOptions(hotels = curatedHotels) {
  const seen = new Map();
  hotels.forEach(hotel => seen.set(hotel.destinationSlug, destinationName(hotel.destinationSlug, hotel.destination)));
  return [["all", "Todos"], ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))];
}

function destinationName(slug, fallback) {
  const destination = conciergeDestinations.find(item => item.id === slug);
  return destination?.name || fallback || slug;
}

function BabyConciergeScore() {
  const criteria = [
    ["Copa baby e estrutura infantil", 25],
    ["Voo direto, curto ou estrada viável", 15],
    ["Traslado simples no destino", 15],
    ["Alimentação e rotina", 15],
    ["Segurança e saúde por perto", 10],
    ["Hotel que sustenta dia de chuva", 10],
    ["Conforto dos pais", 10]
  ];
  const labels = ["Excelente para bebê", "Bom para toddler", "Melhor acima de 4 anos", "Evitar com bebê pequeno", "Só vale com carro", "Ótimo para primeira viagem", "Bom saindo de Congonhas", "Bom saindo de Guarulhos", "Melhor ir de carro", "Traslado longo: atenção"];
  return `
    <section class="section score-section" id="score">
      <div class="section-title">
        <span class="badge subtle">Método proprietário</span>
        <h2>Score Bebê Concierge</h2>
        <p>Uma avaliação pensada para saber se aquela viagem realmente funciona para famílias que saem de São Paulo com bebê.</p>
      </div>
      <div class="score-layout">
        <div class="score-meter">
          <strong>8,7</strong>
          <span>/10</span>
          <p>Exemplo: primeira viagem com bebê saindo da capital.</p>
        </div>
        <div class="criteria">
          ${criteria.map(([label, weight]) => `
            <div class="criterion">
              <span>${escapeHtml(label)}</span>
              <b>${weight}%</b>
              <i style="width:${weight * 3}%"></i>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="labels">${labels.map(label => `<span>${escapeHtml(label)}</span>`).join("")}</div>
    </section>
  `;
}

function CuratedDestinationsSection() {
  return `
    <section class="section" id="destinos">
      <div class="section-title">
        <span class="badge subtle">Curadoria MVP</span>
        <h2>Destinos que funcionam saindo de São Paulo</h2>
        <p>Uma primeira base editorial para famílias paulistanas. A curadoria cruza logística, rotina de bebê, tipo de hospedagem, clima, deslocamento e dados públicos para reduzir escolhas ruins antes da reserva.</p>
      </div>
      <div class="destination-grid">
        ${conciergeDestinations.map(CuratedDestinationCard).join("")}
      </div>
    </section>
  `;
}

function CuratedDestinationCard(destination) {
  return `
    <article class="travel-card">
      ${DestinationImage(destination.id, destination.name)}
      <div class="card-head">
        <span class="score">${destination.score.toFixed(1)}/10</span>
        <span class="badge subtle">${escapeHtml(destination.bestDepartureMode)}</span>
      </div>
      <h3>${escapeHtml(destination.name)}</h3>
      <p>${escapeHtml(destination.region)}</p>
      <dl>
        <div><dt>Melhor idade</dt><dd>${escapeHtml(destination.idealAge)}</dd></div>
        <div><dt>Melhor época</dt><dd>${escapeHtml(destination.bestSeason)}</dd></div>
        <div><dt>Saída de SP</dt><dd>${escapeHtml(destination.recommendedAirport || destination.driveTimeFromSaoPaulo || "avaliar caso a caso")}</dd></div>
        <div><dt>Voo/traslado</dt><dd>${escapeHtml([destination.flightFromSP, destination.transferTime].filter(Boolean).join(" · ") || "sem avião")}</dd></div>
      </dl>
      <div class="tags">${destination.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <strong class="verdict">${escapeHtml(destination.verdict)}</strong>
      <details>
        <summary>Ver análise concierge</summary>
        <b>Pontos fortes</b>
        ${BulletList(destination.strengths)}
        <b>Pontos de atenção</b>
        ${BulletList(destination.attentionPoints)}
      </details>
    </article>
  `;
}

function CuratedHotelsSection() {
  const filters = [
    ["all", "Todos"],
    ["drive2", "Carro até 2h"],
    ["drive3", "Carro até 3h"],
    ["direct", "Voo direto"],
    ["copa", "Copa baby"],
    ["copa24", "Copa baby 24h"],
    ["allinclusive", "All inclusive"],
    ["rain", "Funciona com chuva"],
    ["noCar", "Não precisa alugar carro"]
  ];
  const filtered = curatedHotels.filter(matchesHotelFilter);
  return `
    <section class="section band" id="hoteis">
      <div class="section-title">
        <span class="badge subtle">Hotéis reais, fontes públicas</span>
        <h2>Resorts e hotéis pensados para bebês, partindo de São Paulo</h2>
        <p>Curadoria inicial com hotéis reais e links oficiais. As fotos são inspiracionais, e comodidades sensíveis devem ser confirmadas antes da reserva.</p>
      </div>
      <div class="filters">${filters.map(([id, label]) => `<button class="filter ${state.hotelFilter === id ? "active" : ""}" data-action="hotel-filter" data-filter="${id}">${label}</button>`).join("")}</div>
      <div class="hotel-grid">
        ${filtered.map(CuratedHotelCard).join("")}
      </div>
    </section>
  `;
}

function CuratedHotelCard(hotel) {
  return `
    <article class="travel-card hotel-card">
      ${TravelImage(hotel.image, hotel.name, hotel.imageNote)}
      <div class="card-head">
        <span class="score">${hotel.score.toFixed(1)}/10</span>
        <span class="badge subtle">${escapeHtml(hotel.confidenceLevel || "fonte pública")}</span>
      </div>
      <h3>${escapeHtml(hotel.name)}</h3>
      <p>${escapeHtml(hotel.destination)}</p>
      <dl>
        <div><dt>Indicado para</dt><dd>${escapeHtml(hotel.idealAge)}</dd></div>
        <div><dt>Saída</dt><dd>${escapeHtml(hotel.departureMode === "carro" ? "carro da capital de São Paulo" : hotel.recommendedAirport || "avaliar voo")}</dd></div>
        <div><dt>Tempo estimado</dt><dd>${escapeHtml(formatHotelTime(hotel))}</dd></div>
        <div><dt>Copa baby</dt><dd>${hotel.copaBaby ? "sim" : "a confirmar"}${hotel.copaBaby24h ? " · 24h" : ""}</dd></div>
      </dl>
      <div class="tags">
        ${hotel.directFlight ? "<span>voo direto</span>" : ""}
        ${hotel.allInclusive ? "<span>all inclusive</span>" : ""}
        ${hotel.kidsPool ? "<span>piscina infantil</span>" : ""}
        ${hotel.worksOnRainyDay ? "<span>plano B chuva</span>" : ""}
      </div>
      <strong class="verdict">${escapeHtml(hotel.verdict)}</strong>
      <details>
        <summary>Ver por que recomendamos</summary>
        <p><b>Ponto forte:</b> ${escapeHtml(hotel.mainStrength)}</p>
        <p><b>Ponto de atenção:</b> ${escapeHtml(hotel.attentionPoint)}</p>
        ${hotel.sourceHighlights?.length ? `<b>Base pública consultada</b>${BulletList(hotel.sourceHighlights)}` : ""}
        ${hotel.sourceUrl ? `<a class="source-link" href="${escapeAttr(hotel.sourceUrl)}" target="_blank" rel="noopener">Ver fonte oficial</a>` : ""}
      </details>
    </article>
  `;
}

function DestinationImage(destinationKey, alt) {
  const image = approvedDestinationImage(destinationKey);
  return TravelImage(
    image?.imageUrl,
    alt,
    image ? `${image.alt || alt} · ${image.attributionText}` : "Imagem do destino pendente de revisão",
    image ? "destination" : "missing"
  );
}

function TravelImage(src, alt, note = "Foto do destino", confidence = "destination") {
  if (!src || confidence === "missing") {
    return `
      <figure class="travel-image missing-image">
        <div class="warning-mark" aria-hidden="true">!</div>
        <figcaption>${escapeHtml(note || "Imagem do local ainda não verificada")}</figcaption>
      </figure>
    `;
  }
  return `
    <figure class="travel-image ${confidence === "destination" ? "verified-image" : ""}">
      <img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy">
      <figcaption>${escapeHtml(note)}</figcaption>
    </figure>
  `;
}

function formatHotelTime(hotel) {
  if (hotel.driveTimeFromSaoPaulo) {
    const hours = Math.floor(hotel.driveTimeFromSaoPaulo / 60);
    const minutes = hotel.driveTimeFromSaoPaulo % 60;
    return `até ${hours}h${minutes ? String(minutes).padStart(2, "0") : ""}`;
  }
  return `${hotel.transferMinutes || "?"} min de traslado`;
}

function TravelCalendarSection() {
  const selected = conciergeCalendar.find(item => item.id === state.selectedCalendar) || conciergeCalendar[0];
  return `
    <section class="section" id="calendario">
      <div class="section-title">
        <span class="badge subtle">Calendário paulistano</span>
        <h2>Para quando vocês querem viajar saindo de São Paulo?</h2>
        <p>Feriado, férias e alta temporada mudam completamente a logística de uma família com bebê.</p>
      </div>
      <div class="calendar-tabs">${conciergeCalendar.map(item => `<button class="filter ${state.selectedCalendar === item.id ? "active" : ""}" data-action="calendar" data-calendar="${item.id}">${escapeHtml(item.label)}</button>`).join("")}</div>
      <div class="calendar-result">
        <h3>${escapeHtml(selected.title)}</h3>
        <div class="grid two">
          <div>
            <h4>Melhores caminhos</h4>
            ${BulletList(selected.bestPaths)}
          </div>
          <div>
            <h4>Pontos de atenção</h4>
            ${BulletList(selected.attention)}
          </div>
        </div>
        <a class="button secondary" href="#lead">Encontrar minha viagem de ${escapeHtml(selected.label)}</a>
      </div>
    </section>
  `;
}

function AvoidPerrengueSection() {
  const items = ["voos que chegam tarde demais", "conexões desnecessárias", "sair por aeroporto ruim para o perfil da família", "hotéis bonitos, mas longe de tudo", "resorts com traslado muito longo", "viagens de carro longas demais para bebê", "praias lindas, mas ruins para bebê", "passeios incompatíveis com soneca", "restaurantes com fila e pouca estrutura", "destinos sem plano B para chuva", "hotéis family-friendly só no marketing"];
  return `
    <section class="section band">
      <div class="section-title">
        <h2>A gente também te diz o que evitar saindo de São Paulo</h2>
        <p>A melhor curadoria não é só dizer para onde ir. É ajudar sua família a evitar escolhas que parecem boas na foto, mas viram perrengue na prática.</p>
      </div>
      <div class="avoid-grid">${items.map(item => `<span>${escapeHtml(item)}</span>`).join("")}</div>
    </section>
  `;
}

function ConciergeDatabaseSection() {
  return `
    <section class="section split">
      <div class="section-title">
        <span class="badge subtle">Base de dados e curadoria</span>
        <h2>Nossa curadoria olha para detalhes que os buscadores ignoram</h2>
        <p>A base do Concierge da Família será construída combinando dados públicos, informações oficiais dos hotéis, validação direta com fornecedores, avaliações de famílias e revisão editorial.</p>
      </div>
      <div class="database-examples">
        <div>
          <h3>Copa baby 24h</h3>
          ${BulletList(["declarada pelo hotel", "confirmada com foto", "validada por famílias", "última atualização", "nível de confiança"])}
        </div>
        <div>
          <h3>Saída de São Paulo</h3>
          ${BulletList(["aeroporto recomendado", "tempo de voo", "tempo até aeroporto", "traslado no destino", "necessidade de carro", "risco de horário ruim"])}
        </div>
      </div>
    </section>
  `;
}

function CommercialTransparencySection() {
  return `
    <section class="section transparency">
      <span class="badge">Gratuito para famílias</span>
      <h2>Gratuito para famílias. Transparente nas recomendações.</h2>
      <p>O Concierge da Família é gratuito para famílias. No futuro, poderemos receber comissão ou apoio comercial de parceiros quando uma reserva for feita, mas as recomendações devem seguir critérios claros de curadoria: estrutura, logística, segurança, rotina e adequação à idade da criança.</p>
      <p><strong>Parceiros podem aparecer em destaque, mas nunca substituem o veredito concierge.</strong></p>
    </section>
  `;
}

function ConciergeLeadCaptureForm() {
  return `
    <section class="section lead-section" id="lead">
      <div class="lead-box">
        <div>
          <span class="badge subtle">Próximo passo</span>
          <h2>Quer receber opções curadas para sua família saindo de São Paulo?</h2>
          <p>Sem spam. A ideia é te ajudar a escolher uma viagem que funcione para sua família.</p>
        </div>
        <form id="leadForm" class="lead-form">
          <label>Nome<input name="name" required placeholder="Seu nome" value="${escapeAttr(state.intake.name || "")}"></label>
          <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="11999999999" value="${escapeAttr(state.intake.whatsapp || "")}"></label>
          <label>Email<input name="email" type="email" placeholder="voce@email.com" value="${escapeAttr(state.intake.email || "")}"></label>
          <label>Região de São Paulo<input name="region" placeholder="Ex: Zona Sul"></label>
          <label>Idade da criança<input name="age" placeholder="Ex: 1 ano e 8 meses" value="${escapeAttr(state.intake.childAge || "")}"></label>
          <label>Mês provável da viagem<input name="month" placeholder="Ex: julho" value="${escapeAttr(state.intake.travelPeriod || "")}"></label>
          <label>Tipo de viagem desejada<input name="trip" placeholder="Ex: resort com copa baby"></label>
          <button class="button primary" type="submit">Receber opções curadas no WhatsApp</button>
        </form>
      </div>
    </section>
  `;
}

function InfoCard(title, text) {
  return `<article class="info-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></article>`;
}

function BulletList(items) {
  return `<ul class="clean-list">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function handleClick(event) {
  const trackedLink = event.target.closest("a[data-track]");
  if (trackedLink) {
    trackEvent(trackedLink.dataset.track, {
      source: trackedLink.dataset.source || "",
      hotelId: trackedLink.dataset.hotelId || "",
      hotelName: trackedLink.dataset.hotelName || "",
      destination: trackedLink.dataset.destination || "",
      href: trackedLink.href
    });
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "quiz-answer") return answerQuiz(target.dataset.question, target.dataset.value);
  if (action === "quiz-next") return nextQuiz();
  if (action === "quiz-back") return backQuiz();
  if (action === "restart-diagnosis") {
    state.quizIndex = 0;
    state.answers = {};
    state.result = null;
    state.selectedDestinationKey = null;
    state.showMoreDestinations = false;
    state.intakeComplete = false;
    trackEvent("diagnosis_restarted");
    render();
    setTimeout(() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
  if (action === "show-more-destinations") {
    state.showMoreDestinations = true;
    trackEvent("destination_more_options_opened", analyticsResultPayload());
    render();
    setTimeout(() => document.getElementById("recomendacoes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
  if (action === "show-top-destinations") {
    state.showMoreDestinations = false;
    trackEvent("destination_top_three_restored", analyticsResultPayload());
    render();
    setTimeout(() => document.getElementById("recomendacoes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
  if (action === "select-destination-recommendation") {
    state.selectedDestinationKey = target.dataset.destinationKey;
    state.hotelFilters = defaultHotelFilters();
    const recommendation = buildDestinationRecommendations().find(item => item.key === state.selectedDestinationKey);
    trackEvent("destination_selected", {
      ...analyticsResultPayload(),
      destinationKey: state.selectedDestinationKey,
      destinationName: recommendation?.name || "",
      destinationScore: recommendation?.score || null
    });
    render();
    setTimeout(() => document.getElementById("ranking")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
  if (action === "back-to-destinations") {
    state.selectedDestinationKey = null;
    trackEvent("destination_selection_reopened", analyticsResultPayload());
    render();
    setTimeout(() => document.getElementById("recomendacoes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
  if (action === "share-result") return shareCurrentResult(target);
  if (action === "copy-share-text") return copyCurrentResult(target);
  if (action === "family-alert") return activateFamilyAlert(target);
  if (action === "hotel-filter") {
    state.hotelFilter = target.dataset.filter;
    render();
  }
  if (action === "amenity-filter") {
    const filter = target.dataset.filter;
    state.hotelFilters.amenities = state.hotelFilters.amenities.includes(filter)
      ? state.hotelFilters.amenities.filter(item => item !== filter)
      : [...state.hotelFilters.amenities, filter];
    render();
  }
  if (action === "destination-filter") {
    state.hotelFilters.destination = target.dataset.destination;
    render();
  }
  if (action === "reset-hotel-filters") {
    state.hotelFilters = defaultHotelFilters();
    render();
  }
  if (action === "calendar") {
    state.selectedCalendar = target.dataset.calendar;
    render();
  }
}

async function shareCurrentResult(button) {
  if (!state.result) return;
  const text = shareResultText(state.result);
  const url = `${window.location.origin}${window.location.pathname}#diagnostico`;
  trackEvent("result_share_attempted", analyticsResultPayload());
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Meu perfil no Concierge da Família",
        text,
        url
      });
      trackEvent("result_shared", analyticsResultPayload());
      markTemporaryButton(button, "Compartilhado");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyText(text);
  trackEvent("result_share_copied_fallback", analyticsResultPayload());
  markTemporaryButton(button, "Texto copiado");
}

async function copyCurrentResult(button) {
  if (!state.result) return;
  await copyText(shareResultText(state.result));
  trackEvent("result_copied", analyticsResultPayload());
  markTemporaryButton(button, "Texto copiado");
}

function activateFamilyAlert(button) {
  if (!state.result) return;
  const destinations = buildDestinationRecommendations().slice(0, 3).map(item => item.name).join(", ");
  const text = [
    "Oi! Quero ativar o Alerta Família Concierge para oportunidades de viagem.",
    `Nome: ${state.intake.name || ""}`,
    `WhatsApp: ${state.intake.whatsapp || ""}`,
    `Email: ${state.intake.email || ""}`,
    `Perfil: ${state.result.profileName}`,
    `Índice Sem Perrengue: ${state.result.semPerrengue.score}/100`,
    `Fit financeiro: ${state.result.financialFit.label}`,
    `Custo estimado: ${state.result.costEstimate.headline}`,
    `Destinos preferidos: ${destinations}`,
    `Quando querem ir: ${state.intake.travelPeriod || "data flexível"}`,
    `Duração: ${state.answers.trip_duration || "a definir"}`,
    `Orçamento confortável: ${state.answers.budget_total || "a definir"}`
  ].join("\n");
  trackEvent("family_alert_requested", analyticsResultPayload());
  markTemporaryButton(button, "Abrindo WhatsApp");
  window.open(leadWhatsAppUrl(text), "_blank", "noopener");
}

function shareResultText(result) {
  const destinations = buildDestinationRecommendations().slice(0, 3).map((item, index) => `${index + 1}. ${item.name}`).join("\n");
  return [
    "Fiz o Teste das Férias Sem Perrengue.",
    `Meu perfil de viagem em família: ${result.profileName}`,
    `Índice Sem Perrengue: ${result.semPerrengue.score}/100 (${result.semPerrengue.label})`,
    `Fit financeiro: ${result.financialFit.label}`,
    `Custo estimado: ${result.costEstimate.headline}`,
    "",
    "Minhas 3 cidades recomendadas:",
    destinations,
    "",
    `${window.location.origin}${window.location.pathname}`
  ].join("\n");
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Browser permission can fail on some embedded previews; prompt keeps the flow usable.
    }
  }
  window.prompt("Copie seu resultado:", text);
}

function markTemporaryButton(button, label) {
  if (!button) return;
  const original = button.textContent;
  button.textContent = label;
  window.setTimeout(() => {
    button.textContent = original;
  }, 1800);
}

function analyticsResultPayload() {
  if (!state.result) return {};
  return {
    profileName: state.result.profileName,
    semPerrengue: state.result.semPerrengue.score,
    financialFit: state.result.financialFit.label,
    travelEffort: state.result.travelEffort.label,
    budgetTotal: state.answers.budget_total || "",
    tripDuration: state.answers.trip_duration || "",
    travelPeriod: state.intake.travelPeriod || ""
  };
}

function trackEvent(eventName, payload = {}) {
  const event = {
    event: eventName,
    at: new Date().toISOString(),
    payload
  };
  window.dataLayer?.push({ event: eventName, ...payload });
  try {
    const current = JSON.parse(window.localStorage.getItem("conciergeFamilyAnalytics") || "[]");
    current.push(event);
    window.localStorage.setItem("conciergeFamilyAnalytics", JSON.stringify(current.slice(-120)));
  } catch (error) {
    window.__conciergeFamilyAnalytics = [...(window.__conciergeFamilyAnalytics || []), event].slice(-120);
  }
}

function handleInput(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "hotel-search") {
    state.hotelFilters.search = target.value;
    clearTimeout(searchRenderTimer);
    searchRenderTimer = setTimeout(render, 180);
  }
  if (target.dataset.action === "hotel-select") {
    state.hotelFilters[target.dataset.filter] = target.value;
    render();
  }
}

document.addEventListener("submit", event => {
  if (event.target.id === "intakeForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    state.intake = {
      name: form.get("name") || "",
      whatsapp: form.get("whatsapp") || "",
      email: form.get("email") || "",
      adults: form.get("adults") || "",
      children: form.get("children") || "",
      childAge: form.get("childAge") || "",
      pet: form.get("pet") || "",
      travelPeriod: form.get("travelPeriod") || "",
      lastTrip: form.get("lastTrip") || ""
    };
    state.answers.child_age = state.intake.childAge;
    state.answers.travel_period = state.intake.travelPeriod;
    state.intakeComplete = true;
    trackEvent("diagnosis_intake_completed", {
      travelPeriod: state.intake.travelPeriod,
      childAge: state.intake.childAge,
      pet: state.intake.pet,
      adults: state.intake.adults,
      children: state.intake.children,
      lastTrip: state.intake.lastTrip
    });
    render();
    return;
  }
  if (event.target.id !== "leadForm") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const text = [
    "Oi! Quero receber opções curadas do Concierge da Família.",
    `Nome: ${form.get("name") || state.intake.name || ""}`,
    `WhatsApp: ${form.get("phone") || state.intake.whatsapp || ""}`,
    `Email: ${form.get("email") || state.intake.email || ""}`,
    `Região de SP: ${form.get("region") || ""}`,
    `Idade da criança: ${form.get("age") || state.intake.childAge || ""}`,
    `Mês provável: ${form.get("month") || state.intake.travelPeriod || ""}`,
    `Quem vai: ${state.intake.adults || ""}, ${state.intake.children || ""}, ${state.intake.pet || ""}`,
    `Última viagem: ${state.intake.lastTrip || ""}`,
    `Orçamento/época: ${state.answers.budget_season_strategy || ""}`,
    `Tipo de viagem: ${form.get("trip") || ""}`
  ].join("\n");
  trackEvent("lead_whatsapp_requested", analyticsResultPayload());
  window.open(leadWhatsAppUrl(text), "_blank", "noopener");
});

function answerQuiz(questionId, value) {
  const question = conciergeQuizQuestions.find(item => item.id === questionId);
  if (!question) return;
  if (question.type === "multi") {
    const current = Array.isArray(state.answers[questionId]) ? state.answers[questionId] : [];
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
    state.answers[questionId] = next.slice(0, question.max || 99);
    render();
    return;
  }
  state.answers[questionId] = value;
  nextQuiz();
}

function nextQuiz() {
  if (state.quizIndex < conciergeQuizQuestions.length - 1) {
    state.quizIndex += 1;
  } else {
    state.result = buildDiagnosisResult(state.answers);
    state.selectedDestinationKey = null;
    state.showMoreDestinations = false;
    state.hotelFilters = defaultHotelFilters();
    trackEvent("diagnosis_completed", analyticsResultPayload());
    setTimeout(() => document.getElementById("resultado")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }
  render();
}

function backQuiz() {
  if (state.quizIndex > 0) state.quizIndex -= 1;
  render();
}

function buildDiagnosisResult(answers) {
  const concerns = arrayAnswer(answers.avoid_risks);
  const must = arrayAnswer(answers.comfort_needs);
  const intake = state.intake || {};
  const profileName = inferProfileName(answers, intake);
  const persona = inferFamilyPersona(answers, intake, profileName);
  const babySmall = intake.childAge === "0 a 12 meses";
  const hasPet = intake.pet && intake.pet !== "Não vai pet";
  const budgetSeason = answers.budget_season_strategy || "orçamento e data ainda flexíveis";
  const costEstimate = estimateTripCost(answers, intake);
  const financialFit = calculateFinancialFit(answers, costEstimate);
  const travelEffort = calculateTravelEffort(answers, intake);
  const semPerrengue = calculateSemPerrengueIndex(answers, intake, financialFit, travelEffort);
  const profile = `${persona}. Viagem para ${intake.adults || "2 adultos"} e ${intake.children || "criança(s)"}, ${hasPet ? "com pet" : "sem pet"}, pensando em ${intake.travelPeriod || "data flexível"}. Estratégia: ${budgetSeason}. Última viagem: ${intake.lastTrip || "não informado"}.`;
  const prioritize = [
    "escolher primeiro a cidade que reduz risco para a rotina da família, antes de comparar resort",
    answers.displacement_limit === "Até 2h de carro" ? "destinos muito próximos de São Paulo para reduzir imprevisibilidade" : "logística que combine deslocamento total, horário de chegada e tolerância da criança",
    babySmall ? "copa baby, alimentação fácil, quarto silencioso e pouca necessidade de sair do hotel" : "hotel que ofereça atividade, pausa e alimentação sem roteiro corrido",
    answers.stay_style === "Apart-hotel com cozinha" ? "hospedagens com kitchenette para manter rotina de lanche, leite e descanso" : "hospedagens com estrutura familiar real, não só fotos bonitas",
    hasPet ? "confirmar política pet, taxa, porte permitido e áreas de circulação antes de reservar" : "",
    answers.budget_season_strategy === "Baixa temporada, prefiro custo-benefício" ? "usar baixa temporada para buscar melhor tarifa, mais espaço e menos fila" : "",
    answers.budget_season_strategy === "Alta temporada, quero segurança mesmo pagando mais" ? "reservar cedo e priorizar política clara de cancelamento" : "",
    must.includes("Plano B para chuva") ? "plano B indoor para dias de chuva ou cansaço" : "",
    answers.decision_profile === "Evitar lotação e filas" ? "datas fora de pico e destinos menos dependentes de parque/fila" : ""
  ];
  const avoid = [
    concerns.includes("Chegar tarde") ? "voos chegando à noite ou check-in tarde demais para a rotina" : "roteiro que comece cansando a família no primeiro dia",
    concerns.includes("Traslado longo") ? "destinos com traslado acima de 90 minutos depois do voo" : "",
    concerns.includes("Estrada cansativa") ? "estrada longa sem pausas planejadas" : "",
    concerns.includes("Hotel só bonito na foto") ? "hotel sem fonte oficial clara para estrutura infantil" : "",
    "roteiros com muitos passeios no mesmo dia"
  ];
  if (must.includes("Copa baby 24h")) prioritize.push("confirmar copa baby 24h com evidência antes da reserva");
  return {
    profileName,
    profile,
    semPerrengue,
    financialFit,
    travelEffort,
    costEstimate,
    prioritize: unique(prioritize).slice(0, 6),
    avoid: unique(avoid).slice(0, 5),
    paths: [
      { title: "Campinas ou Atibaia", text: "melhor se quiser evitar avião e reduzir logística." },
      { title: "Porto de Galinhas ou Praia do Forte", text: "melhor se quiser praia e estrutura de resort." },
      { title: "Gramado ou Campos do Jordão", text: "melhor se quiser clima diferente, mas exige cuidado com deslocamentos e lotação." }
    ]
  };
}

function inferProfileName(answers, intake) {
  if (answers.budget_total === "Até R$ 1.500" || answers.budget_season_strategy === "Baixa temporada, prefiro custo-benefício") return "Família Econômica Inteligente";
  if (intake.childAge === "0 a 12 meses" || intake.lastTrip === "Primeira viagem com criança" || answers.travel_goal === "Primeira viagem sem susto") return "Família Zero Perrengue";
  if (answers.travel_goal === "Praia e piscina" || answers.stay_style === "Praia com resort") return "Família Praia com Plano B";
  if (answers.stay_style === "Hotel fazenda" || answers.travel_goal === "Natureza e ar livre") return "Família Hotel Fazenda";
  if (answers.travel_goal === "Parque ou muita atividade") return "Família Parque & Diversão";
  if (answers.stay_style === "Resort completo" || answers.decision_profile === "Melhor estrutura, mesmo mais caro") return "Família Resort Raiz";
  return "Família Mini Aventureira";
}

function inferFamilyPersona(answers, intake, profileName = inferProfileName(answers, intake)) {
  const descriptions = {
    "Família Resort Raiz": "Vocês querem conforto, estrutura, recreação e pouca improvisação",
    "Família Praia com Plano B": "Vocês amam praia, mas precisam de sombra, alimentação fácil e alternativa para chuva",
    "Família Hotel Fazenda": "Vocês combinam com natureza, comida boa, espaço aberto e uma rotina mais tranquila",
    "Família Mini Aventureira": "Vocês gostam de novidade, mas precisam equilibrar passeio com descanso",
    "Família Parque & Diversão": "Vocês querem encantamento e atividade, com atenção para fila, estímulo e pausa",
    "Família Econômica Inteligente": "Vocês querem criar memória sem transformar a viagem em sufoco financeiro",
    "Família Zero Perrengue": "Vocês priorizam previsibilidade, conforto, segurança e facilidade"
  };
  return `Perfil: ${descriptions[profileName] || descriptions["Família Mini Aventureira"]}`;
}

function calculateSemPerrengueIndex(answers, intake, financialFit, travelEffort) {
  const must = arrayAnswer(answers.comfort_needs);
  const concerns = arrayAnswer(answers.avoid_risks);
  let score = 72;
  if (answers.displacement_limit === "Até 2h de carro") score += 10;
  if (answers.displacement_limit === "Até 4h de carro") score += 5;
  if (answers.displacement_limit === "Aceito mais logística se valer muito") score -= 8;
  if (intake.childAge === "0 a 12 meses" && answers.displacement_limit?.includes("Voo")) score -= 5;
  if (must.includes("Copa baby")) score += 5;
  if (must.includes("Plano B para chuva")) score += 5;
  if (must.includes("All inclusive") || must.includes("Kitchenette/cozinha")) score += 4;
  if (answers.budget_season_strategy?.includes("Alta temporada")) score -= 5;
  if (answers.budget_season_strategy?.includes("Baixa temporada")) score += 4;
  if (financialFit.risk === "high") score -= 16;
  if (financialFit.risk === "medium") score -= 7;
  if (travelEffort.risk === "high") score -= 12;
  if (concerns.includes("Fila e lotação")) score -= 4;
  if (concerns.includes("Traslado longo")) score -= 5;
  score = Math.max(28, Math.min(96, Math.round(score)));
  return {
    score,
    label: score >= 86 ? "excelente fit familiar" : score >= 66 ? "boa escolha com atenção" : score >= 41 ? "atenção aos detalhes" : "alto risco de perrengue"
  };
}

function calculateFinancialFit(answers, estimate) {
  const budget = budgetMaxValue(answers.budget_total);
  if (!budget) return { label: "A confirmar", detail: "sem orçamento total informado", risk: "unknown" };
  if (budget >= estimate.balancedMax) return { label: "Cabe bem", detail: "há espaço para uma escolha confortável", risk: "low" };
  if (budget >= estimate.economicMax) return { label: "Cabe com atenção", detail: "dá para buscar boa opção sem muitos extras", risk: "medium" };
  if (budget >= estimate.economicMin) return { label: "Pode apertar", detail: "melhor encurtar, evitar pico ou trocar destino", risk: "medium" };
  return { label: "Risco de estourar", detail: "eu olharia bate-volta ou baixa temporada", risk: "high" };
}

function calculateTravelEffort(answers, intake) {
  if (answers.displacement_limit === "Até 2h de carro") return { label: "Leve", detail: "bom para fim de semana e criança pequena", risk: "low" };
  if (answers.displacement_limit === "Até 4h de carro") return { label: "Moderado", detail: "funciona com pausas e saída bem planejada", risk: "medium" };
  if (answers.displacement_limit === "Voo direto e traslado até 1h") return { label: "Moderado", detail: "voo ajuda, mas horário de chegada importa muito", risk: "medium" };
  return { label: "Alto", detail: "só vale se o destino compensar e a família tolerar logística", risk: "high" };
}

function estimateTripCost(answers, intake) {
  const nights = tripNights(answers.trip_duration);
  const people = familySize(intake);
  const flightTrip = answers.displacement_limit === "Voo direto e traslado até 1h" || answers.stay_style === "Praia com resort";
  const premium = answers.decision_profile === "Melhor estrutura, mesmo mais caro" || answers.budget_season_strategy?.includes("Alta temporada");
  const lowSeason = answers.budget_season_strategy?.includes("Baixa temporada") || answers.budget_season_strategy?.includes("Data flexível");
  const lodgingBase = flightTrip ? 920 : 620;
  const multiplier = premium ? 1.25 : lowSeason ? .86 : 1;
  const lodgingEconomic = Math.round(lodgingBase * .72 * multiplier * Math.max(1, nights));
  const lodgingBalanced = Math.round(lodgingBase * 1.22 * multiplier * Math.max(1, nights));
  const lodgingComfort = Math.round(lodgingBase * 2.05 * multiplier * Math.max(1, nights));
  const transportEconomic = flightTrip ? people * 550 : 260;
  const transportBalanced = flightTrip ? people * 900 : 480;
  const transportComfort = flightTrip ? people * 1450 : 760;
  const foodFactor = answers.comfort_needs?.includes("All inclusive") ? .45 : 1;
  const foodEconomic = Math.round(people * Math.max(1, nights) * 65 * foodFactor);
  const foodBalanced = Math.round(people * Math.max(1, nights) * 120 * foodFactor);
  const foodComfort = Math.round(people * Math.max(1, nights) * 210 * foodFactor);
  const economicMin = Math.round((lodgingEconomic + transportEconomic + foodEconomic) * .9);
  const economicMax = Math.round((lodgingEconomic + transportEconomic + foodEconomic) * 1.2);
  const balancedMin = Math.round((lodgingBalanced + transportBalanced + foodBalanced) * .92);
  const balancedMax = Math.round((lodgingBalanced + transportBalanced + foodBalanced) * 1.25);
  const comfortMin = Math.round((lodgingComfort + transportComfort + foodComfort) * .95);
  const comfortMax = Math.round((lodgingComfort + transportComfort + foodComfort) * 1.32);
  return {
    economicMin,
    economicMax,
    balancedMax,
    headline: `${formatCurrency(economicMin)} a ${formatCurrency(balancedMax)}`,
    economic: `${formatCurrency(economicMin)}-${formatCurrency(economicMax)}`,
    balanced: `${formatCurrency(balancedMin)}-${formatCurrency(balancedMax)}`,
    comfort: `${formatCurrency(comfortMin)}-${formatCurrency(comfortMax)}`,
    note: `Faixa estimada para ${answers.trip_duration || "3 noites"} considerando hospedagem, transporte, alimentação e extras básicos.`
  };
}

function tripNights(duration) {
  const map = {
    "Bate-volta": 0,
    "1 noite": 1,
    "2 noites": 2,
    "3 noites": 3,
    "4 a 5 noites": 4,
    "6+ noites": 6
  };
  return map[duration] ?? 3;
}

function familySize(intake) {
  const adults = Number.parseInt(intake.adults, 10) || 2;
  const children = Number.parseInt(intake.children, 10) || 1;
  return adults + children;
}

function budgetMaxValue(range) {
  const map = {
    "Até R$ 1.500": 1500,
    "R$ 1.500 a R$ 3.000": 3000,
    "R$ 3.000 a R$ 5.000": 5000,
    "R$ 5.000 a R$ 8.000": 8000,
    "Acima de R$ 8.000": 12000
  };
  return map[range] || null;
}

function formatCurrency(value) {
  return `R$ ${Math.round(value).toLocaleString("pt-BR")}`;
}

function matchesHotelFilter(hotel) {
  switch (state.hotelFilter) {
    case "drive2": return hotel.driveTimeFromSaoPaulo && hotel.driveTimeFromSaoPaulo <= 120;
    case "drive3": return hotel.driveTimeFromSaoPaulo && hotel.driveTimeFromSaoPaulo <= 180;
    case "direct": return hotel.directFlight === true;
    case "copa": return hotel.copaBaby;
    case "copa24": return hotel.copaBaby24h;
    case "allinclusive": return hotel.allInclusive;
    case "rain": return hotel.worksOnRainyDay;
    case "noCar": return hotel.departureMode === "voo";
    default: return true;
  }
}

function cityKeyForHotel(hotel) {
  return slugifyText(hotel.destination || hotel.destinationSlug || hotel.id);
}

function shortCityName(destination) {
  return String(destination || "destino").split(",")[0].trim();
}

function imageKeyForHotelDestination(hotel) {
  const destination = removeAccents(String(hotel.destination || "").toLowerCase());
  if (destination.includes("campinas")) return "resort-interior-sp";
  if (destination.includes("atibaia")) return "atibaia";
  if (destination.includes("dourado")) return "hotel-fazenda-sp";
  if (destination.includes("guaruja")) return "litoral-norte-sp";
  if (hotel.destinationSlug === "resort-interior-sp") return null;
  return hotel.destinationSlug;
}

function isBeachDestination(hotel) {
  return Boolean(hotel.calmBeach || ["praia-do-forte", "porto-de-galinhas", "maceio-maragogi", "litoral-norte-sp"].includes(hotel.destinationSlug));
}

function priceTierLabel(tier) {
  const labels = {
    mid: "custo médio",
    upscale: "médio/alto",
    luxury: "alto investimento",
    budget: "econômico"
  };
  return labels[tier] || "orçamento a confirmar";
}

function leadWhatsAppUrl(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function normalizeHotel(hotel) {
  const sourceUrl = hotel.sourceUrl || hotel.officialSiteUrl;
  const destinationSlug = hotel.destinationSlug || inferDestinationSlug(hotel);
  const destinationImage = approvedDestinationImage(destinationSlug);
  return {
    ...hotel,
    destinationSlug,
    destinationKey: slugifyText(hotel.destination || destinationSlug),
    propertyType: hotel.propertyType || (hotel.allInclusive || hotel.kidsClub ? "resort" : "hotel"),
    priceTier: hotel.priceTier || inferPriceTier(hotel.score),
    officialSiteUrl: hotel.officialSiteUrl || sourceUrl,
    sourceUrl,
    kidsClub: hotel.kidsClub ?? hotel.recreation ?? false,
    heatedPool: hotel.heatedPool ?? false,
    hasKitchenette: hotel.hasKitchenette ?? false,
    image: destinationImage?.imageUrl || null,
    imageConfidence: destinationImage ? "destination" : "missing",
    imageNote: destinationImage ? `${destinationImage.alt || hotel.destination} · ${destinationImage.attributionText}` : "Imagem do destino pendente de revisão",
    imageMeta: destinationImage || null
  };
}

function approvedDestinationImage(destinationKey) {
  const image = destinationImagesByKey.get(destinationKey);
  if (!image || !["approved", "auto_approved"].includes(image.status) || !image.imageUrl) return null;
  return image;
}

function inferDestinationSlug(hotel) {
  const text = [hotel.id, hotel.destination].join(" ").toLowerCase();
  if (text.includes("atibaia") || text.includes("campinas") || text.includes("mogi") || text.includes("cesario")) return "resort-interior-sp";
  if (text.includes("praia do forte")) return "praia-do-forte";
  if (text.includes("porto de galinhas")) return "porto-de-galinhas";
  if (text.includes("maragogi") || text.includes("maceio")) return "maceio-maragogi";
  if (text.includes("foz")) return "foz-do-iguacu";
  if (text.includes("gramado")) return "gramado";
  if (text.includes("orlando")) return "orlando";
  return "outros";
}

function inferPriceTier(score) {
  if (score >= 8.8) return "luxury";
  if (score >= 7.8) return "upscale";
  return "mid";
}

function bookingSearchUrl(hotel) {
  return `https://www.booking.com/searchresults.pt-br.html?ss=${encodeURIComponent(`${hotel.name} ${hotel.destination}`)}`;
}

function arrayAnswer(value) {
  return Array.isArray(value) ? value : [];
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function slugifyText(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
