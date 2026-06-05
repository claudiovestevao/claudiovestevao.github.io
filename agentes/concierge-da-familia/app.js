import { conciergeDestinations } from "./src/data/conciergeFamilyDestinations.js?v=family-diagnostic-images-v2-20260605";
import { conciergeHotels } from "./src/data/conciergeFamilyHotels.js?v=family-diagnostic-images-v2-20260605";
import { conciergeHotelAdditions } from "./src/data/conciergeFamilyHotelAdditions.js?v=family-diagnostic-images-v2-20260605";
import { conciergeDestinationImages } from "./src/data/conciergeDestinationImages.js?v=family-diagnostic-images-v2-20260605";
import { conciergeQuizQuestions } from "./src/data/conciergeFamilyQuiz.js?v=family-diagnostic-images-v2-20260605";
import { conciergeCalendar } from "./src/data/conciergeFamilyCalendar.js?v=family-diagnostic-images-v2-20260605";

const WHATSAPP_NUMBER = "5511956607921";
const state = {
  intakeComplete: false,
  intake: {},
  quizIndex: 0,
  answers: {},
  result: null,
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

function render() {
  app.innerHTML = `
    ${ConciergeHeroSection()}
    ${state.result ? ConciergeDiagnosisResult(state.result) : ""}
    ${state.result ? RankedHotelsSection() : ""}
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
        <span class="badge">Diagnóstico em até 2 minutos</span>
        <h1>Encontre o destino certo para sua família.</h1>
        <p>Primeiro entendemos quem viaja, quando vocês querem ir e quanta logística a família tolera. Depois o ranking mostra destinos e hotéis reais, com filtros e links de disponibilidade.</p>
        <div class="family-cues" aria-label="Critérios de curadoria familiar">
          <span>WhatsApp e email</span>
          <span>Quem vai viajar</span>
          <span>Ritmo da família</span>
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
      <h3>Ranking pronto para a sua família.</h3>
      <p>Use os filtros abaixo para comparar destino, logística, estrutura infantil, faixa de preço e imagens verificadas.</p>
      <div class="quiz-actions">
        <a class="button primary" href="#ranking">Ver hotéis</a>
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
        <span class="badge">Resultado</span>
        <h2>Seu perfil de viagem</h2>
        <p>${escapeHtml(result.profile)}</p>
        <div class="quick-insights">
          <div>
          <h3>Recomendamos priorizar</h3>
            ${BulletList(result.prioritize.slice(0, 3))}
          </div>
          <div>
          <h3>Evitar por enquanto</h3>
            ${BulletList(result.avoid.slice(0, 2))}
          </div>
        </div>
      </div>
    </section>
  `;
}

function RankedHotelsSection() {
  const ranked = getFilteredRankedHotels();
  const destinationGroups = buildDestinationGroups(ranked);
  return `
    <section class="section ranking-section" id="ranking">
      <div class="section-title">
        <span class="badge subtle">Curadoria ajustada pelo diagnóstico</span>
        <h2>Destinos e hotéis recomendados</h2>
        <p>Use os filtros para comparar logística, estrutura infantil, preço estimado e evidência visual. Cada hotel abre em uma página externa para consultar disponibilidade.</p>
      </div>
      ${ranked.length ? ConciergeMap(ranked) : ""}
      ${HotelExplorerControls(ranked)}
      ${DestinationSummary(destinationGroups)}
      <div class="ranking-list">
        ${ranked.length ? ranked.map((hotel, index) => RankedHotelCard(hotel, index)).join("") : EmptyHotelState()}
      </div>
    </section>
  `;
}

function HotelExplorerControls(rankedHotels) {
  const destinations = buildDestinationOptions();
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
          <a class="button primary compact-button" href="${escapeAttr(hotel.officialSiteUrl || hotel.sourceUrl)}" target="_blank" rel="noopener">Ver disponibilidade</a>
          <a class="button secondary compact-button" href="${escapeAttr(hotel.bookingUrl || bookingSearchUrl(hotel))}" target="_blank" rel="noopener">Buscar no Booking</a>
          ${hotel.sourceUrl ? `<a class="source-link" href="${escapeAttr(hotel.sourceUrl)}" target="_blank" rel="noopener">Fonte da curadoria</a>` : ""}
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
  const avoidPlane = answers.displacement_limit === "Até 2h de carro" || answers.displacement_limit === "Até 4h de carro";
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
  const ranked = rankHotelsForAnswers().filter(hotel => matchesHotelFilters(hotel, filters));
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

function buildDestinationOptions() {
  const seen = new Map();
  curatedHotels.forEach(hotel => seen.set(hotel.destinationSlug, destinationName(hotel.destinationSlug, hotel.destination)));
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
    state.intakeComplete = false;
    render();
    setTimeout(() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
    return;
  }
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
    state.hotelFilters = {
      destination: "all",
      mode: "all",
      price: "all",
      image: "all",
      amenities: [],
      search: "",
      sort: "score"
    };
    render();
  }
  if (action === "calendar") {
    state.selectedCalendar = target.dataset.calendar;
    render();
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
    `Tipo de viagem: ${form.get("trip") || ""}`
  ].join("\n");
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
  const persona = inferFamilyPersona(answers, intake);
  const babySmall = intake.childAge === "0 a 12 meses";
  const hasPet = intake.pet && intake.pet !== "Não vai pet";
  const profile = `${persona}. Viagem para ${intake.adults || "2 adultos"} e ${intake.children || "criança(s)"}, ${hasPet ? "com pet" : "sem pet"}, pensando em ${intake.travelPeriod || "data flexível"}. Última viagem: ${intake.lastTrip || "não informado"}.`;
  const prioritize = [
    answers.displacement_limit === "Até 2h de carro" ? "destinos muito próximos de São Paulo para reduzir imprevisibilidade" : "logística que combine deslocamento total, horário de chegada e tolerância da criança",
    babySmall ? "copa baby, alimentação fácil, quarto silencioso e pouca necessidade de sair do hotel" : "hotel que ofereça atividade, pausa e alimentação sem roteiro corrido",
    answers.stay_style === "Apart-hotel com cozinha" ? "hospedagens com kitchenette para manter rotina de lanche, leite e descanso" : "hospedagens com estrutura familiar real, não só fotos bonitas",
    hasPet ? "confirmar política pet, taxa, porte permitido e áreas de circulação antes de reservar" : "",
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
    profile,
    prioritize: unique(prioritize).slice(0, 6),
    avoid: unique(avoid).slice(0, 5),
    paths: [
      { title: "Campinas ou Atibaia", text: "melhor se quiser evitar avião e reduzir logística." },
      { title: "Porto de Galinhas ou Praia do Forte", text: "melhor se quiser praia e estrutura de resort." },
      { title: "Gramado ou Campos do Jordão", text: "melhor se quiser clima diferente, mas exige cuidado com deslocamentos e lotação." }
    ]
  };
}

function inferFamilyPersona(answers, intake) {
  if (intake.childAge === "0 a 12 meses" || intake.lastTrip === "Primeira viagem com criança") return "Perfil: primeira viagem com bebê, precisa de baixa fricção e alta previsibilidade";
  if (answers.travel_goal === "Parque ou muita atividade") return "Perfil: família com energia, boa para destinos de parque e hotel com recreação";
  if (answers.decision_profile === "Evitar lotação e filas") return "Perfil: família sensível a lotação, melhor com datas e destinos mais tranquilos";
  if (answers.stay_style === "Apart-hotel com cozinha") return "Perfil: família que valoriza rotina e autonomia na alimentação";
  if (answers.decision_profile === "Melhor estrutura, mesmo mais caro") return "Perfil: família conforto premium, prefere pagar para reduzir risco";
  return "Perfil: família prática, buscando equilíbrio entre logística, estrutura e descanso";
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

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
