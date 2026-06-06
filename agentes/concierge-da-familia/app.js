import { conciergeDestinations } from "./src/data/conciergeFamilyDestinations.js?v=family-score-v1-20260606";
import { conciergeHotels } from "./src/data/conciergeFamilyHotels.js?v=family-score-v1-20260606";
import { conciergeHotelAdditions } from "./src/data/conciergeFamilyHotelAdditions.js?v=family-score-v1-20260606";
import { conciergeDestinationImages } from "./src/data/conciergeDestinationImages.js?v=family-score-v1-20260606";
import { conciergeDestinationExperience } from "./src/data/conciergeDestinationExperience.js?v=family-score-v1-20260606";
import { conciergeDestinationGalleries } from "./src/data/conciergeDestinationGalleries.js?v=family-score-v1-20260606";
import { conciergeFamilyItineraries } from "./src/data/conciergeFamilyItineraries.js?v=multi-destino-v1-20260606";
import { conciergeQuizQuestions } from "./src/data/conciergeFamilyQuiz.js?v=family-score-v1-20260606";
import { conciergeCalendar } from "./src/data/conciergeFamilyCalendar.js?v=family-score-v1-20260606";
import { conciergeGooglePlacesCoverage } from "./src/data/conciergeGooglePlacesCoverage.js?v=google-coverage-v1-20260606";

const WHATSAPP_NUMBER = "5511956607921";
const state = {
  intakeComplete: false,
  intake: {},
  intakeDraft: {
    adultsCount: "2",
    childrenCount: "1",
    roomsCount: "1",
    tripDuration: "3 noites",
    childAges: ["1 a 2 anos"],
    travelTimingMode: "unknown",
    destinationInterestKey: "",
    destinationInterestName: ""
  },
  leadId: null,
  quizIndex: 0,
  answers: {},
  result: null,
  selectedDestinationKey: null,
  showMoreDestinations: false,
  hotelRecommendationSent: false,
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
  },
  mapFilters: {
    origin: "Grande SP",
    adults: "2",
    children: "1",
    childAges: ["1 a 2 anos"],
    travel: "2h",
    fit: "all",
    budget: "comfort",
    selectedKey: ""
  },
  routePreview: {
    destinationKey: "",
    status: "idle",
    progress: 0,
    speed: 1,
    showStops: false,
    source: "fallback",
    message: "Escolha um destino e simule o caminho da familia.",
    points: [],
    stops: [],
    summary: null,
    error: ""
  }
};

const destinationImagesByKey = new Map(conciergeDestinationImages.map(image => [image.key, image]));
const destinationExperienceByKey = new Map(conciergeDestinationExperience.map(item => [item.key, item]));
const googleCoverageDestinationsById = new Map(conciergeGooglePlacesCoverage.destinations.map(place => [place.id, place]));
const googleCoverageHotelsById = new Map(conciergeGooglePlacesCoverage.hotels.map(place => [place.id, place]));
const SAO_PAULO_CENTER = { latitude: -23.55052, longitude: -46.63331 };
const SUV_KM_PER_LITER = 8.5;
const GASOLINE_BRL_PER_LITER = 6.1;
const destinationGalleriesByKey = new Map();
conciergeDestinationGalleries.forEach(gallery => {
  destinationGalleriesByKey.set(gallery.key, gallery);
  (gallery.aliases || []).forEach(alias => destinationGalleriesByKey.set(alias, gallery));
});
const curatedHotels = [...conciergeHotels, ...conciergeHotelAdditions].map(normalizeHotel);
const sessionId = getOrCreateSessionId();
const supabaseConfig = resolveSupabaseConfig();
const liveConciergeData = {
  loaded: false,
  loading: false,
  error: null,
  summariesBySlug: new Map(),
  mapPointsBySlug: new Map(),
  hotelCardsBySlug: new Map()
};
const app = document.getElementById("app");
let searchRenderTimer;
let routeAnimationFrame = null;
let routeLastTick = 0;
let discoveryMap = null;
let discoveryMapMarkers = [];

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
render();
loadLiveConciergeData();

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
  destroyDiscoveryMap();
  app.innerHTML = `
    ${ConciergeHeroSection()}
    ${!state.result ? ConciergeMapExplorerSection() : ""}
    ${!state.result ? PopularFamilyDestinationsSection() : ""}
    ${state.result ? ConciergeDiagnosisResult(state.result) : ""}
    ${state.result ? DestinationRecommendationsSection() : ""}
    ${state.result && state.selectedDestinationKey ? RankedHotelsSection() : ""}
    ${state.result ? ShareableResultSection(state.result) : ""}
    ${state.result ? FriendReferralSection() : ""}
    ${state.result ? HotelRecommendationSection() : ""}
    ${state.result ? ConciergeLeadCaptureForm() : ""}
  `;
  syncDynamicIntakeFields();
  initDiscoveryMap();
}

async function loadLiveConciergeData() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey || liveConciergeData.loading || liveConciergeData.loaded) return;
  liveConciergeData.loading = true;
  const requests = await Promise.allSettled([
    fetchSupabaseRows("destination_stay_summary", "slug,destination_name,state,google_top_place,google_rating,google_ratings_total,family_summary,sp_distance_text,sp_drive_minutes,sp_drive_text,sp_drive_text_traffic,movimento_level,event_count,total_predicted_attendance,top_events,holiday_windows,bookable_hotels,avg_guest_rating,top_hotels"),
    fetchSupabaseRows("destination_map_points", "slug,destination_name,state,latitude,longitude,google_rating,sp_drive_text,sp_drive_minutes,sp_distance_text,movimento_level,bookable_hotels"),
    fetchSupabaseRows("destination_hotel_cards", "destination_slug,destination_name,liteapi_id,hotel_name,stars,liteapi_rating,review_count,address,main_photo,thumbnail,latitude,longitude,description")
  ]);
  const [summaries, mapPoints, hotelCards] = requests.map(result => result.status === "fulfilled" ? result.value : []);
  liveConciergeData.summariesBySlug = new Map(summaries.map(item => [item.slug, item]));
  liveConciergeData.mapPointsBySlug = new Map(mapPoints.map(item => [item.slug, item]));
  liveConciergeData.hotelCardsBySlug = groupBy(hotelCards, item => item.destination_slug);
  liveConciergeData.loaded = true;
  liveConciergeData.error = requests
    .filter(result => result.status === "rejected")
    .map(result => result.reason?.message || "Falha em fonte viva")
    .join(" · ");
  liveConciergeData.loading = false;
  render();
}

async function fetchSupabaseRows(table, select) {
  const url = `${supabaseConfig.url.replace(/\/$/, "")}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=200`;
  const response = await fetch(url, {
    headers: {
      apikey: supabaseConfig.anonKey,
      authorization: `Bearer ${supabaseConfig.anonKey}`
    }
  });
  if (!response.ok) throw new Error(`Supabase read failed: ${table} ${response.status}`);
  return response.json();
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function initDiscoveryMap() {
  const container = document.getElementById("familyRealMap");
  if (!container || !window.L) {
    document.querySelector(".real-map-shell")?.classList.add("map-fallback-active");
    return;
  }
  const hotspots = filteredMapHotspots();
  if (!hotspots.length) return;
  const L = window.L;
  discoveryMap = L.map(container, {
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: true
  });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(discoveryMap);

  const originIcon = L.divIcon({
    className: "family-map-origin-icon",
    html: "<b>SP</b><span>origem</span>",
    iconSize: [66, 34],
    iconAnchor: [33, 34]
  });
  L.marker([SAO_PAULO_CENTER.latitude, SAO_PAULO_CENTER.longitude], { icon: originIcon, keyboard: false }).addTo(discoveryMap);

  hotspots.forEach((hotspot, index) => {
    const coordinates = hotspot.coordinates || approximateDestinationCoordinates(hotspot.bestHotel);
    const active = state.mapFilters.selectedKey === hotspot.key || (!state.mapFilters.selectedKey && index === 0);
    const marker = L.marker([coordinates.latitude, coordinates.longitude], {
      icon: L.divIcon({
        className: "family-map-destination-wrap",
        html: `<button class="family-map-destination-icon ${hotspot.familyScore.medal} ${active ? "active" : ""}" type="button" data-action="map-hotspot" data-hotspot-key="${escapeAttr(hotspot.key)}"><b>${index + 1}</b><span>${escapeHtml(hotspot.shortName)}<small>${escapeHtml(hotspot.timeLabel)}</small></span></button>`,
        iconSize: [154, 46],
        iconAnchor: [18, 42]
      }),
      keyboard: true,
      title: hotspot.name
    }).addTo(discoveryMap);
    marker.getElement()?.querySelector(".family-map-destination-icon")?.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      selectMapHotspotFromLeaflet(hotspot);
    });
    marker.on("click", () => selectMapHotspotFromLeaflet(hotspot));
    marker.bindTooltip(`${hotspot.name} | ${hotspot.routeLabel}`, { direction: "top", offset: [0, -26], opacity: .92 });
    discoveryMapMarkers.push(marker);
  });

  fitDiscoveryMapToHotspots(hotspots);
  setTimeout(() => discoveryMap?.invalidateSize(), 80);
  document.querySelector(".real-map-shell")?.classList.add("leaflet-ready");
}

function destroyDiscoveryMap() {
  discoveryMapMarkers = [];
  if (discoveryMap) {
    discoveryMap.remove();
    discoveryMap = null;
  }
}

function fitDiscoveryMapToHotspots(hotspots) {
  const L = window.L;
  const points = hotspots.map(hotspot => hotspot.coordinates || approximateDestinationCoordinates(hotspot.bestHotel));
  points.push(SAO_PAULO_CENTER);
  const hasOnlySaoPauloRange = points.every(point => point.latitude < -19 && point.latitude > -26 && point.longitude < -44 && point.longitude > -54);
  discoveryMap.fitBounds(L.latLngBounds(points.map(point => [point.latitude, point.longitude])), {
    padding: [62, 62],
    maxZoom: hasOnlySaoPauloRange ? 9 : 6,
    animate: false
  });
}

function selectMapHotspotFromLeaflet(hotspot) {
  state.mapFilters.selectedKey = hotspot.key;
  if (state.routePreview.destinationKey !== hotspot.key) stopRouteAnimation();
  trackEvent("map_hotspot_selected", {
    destinationKey: hotspot.key,
    destinationName: hotspot.name,
    bestHotel: hotspot.bestHotel?.name || "",
    source: "real_map_marker"
  });
  render();
  setTimeout(() => document.getElementById("mapa")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
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
        <span class="badge">Family Trip Intelligence</span>
        <h1>Viagens de família sem perrengue</h1>
        <p>Mapa, diagnóstico rápido e destinos que respeitam a rotina da família.</p>
        <div class="hero-actions">
          <a class="button primary" href="#mapa">Explorar mapa</a>
          <a class="button secondary" href="#diagnostico">Falar com assistente</a>
        </div>
        <div class="family-cues" aria-label="Critérios de curadoria familiar">
          <span>Mapa primeiro</span>
          <span>2 minutos</span>
          <span>Hotel só depois</span>
        </div>
      </div>
      <div class="diagnostic-panel">
        ${state.result ? ConciergeDiagnosisDonePanel() : state.intakeComplete ? ConciergeDiagnosisQuiz() : ConciergeQuickIntakeForm()}
      </div>
    </section>
  `;
}

function ConciergeHowItWorksSection() {
  const steps = [
    ["1", "Perfil da família", "Quem vai, idades, quartos, pet e janela de viagem, sem pedir WhatsApp antes do resultado."],
    ["2", "Diagnóstico guiado", "Sete perguntas simples sobre ritmo, orçamento, deslocamento, sazonalidade e riscos que você quer evitar."],
    ["3", "3 destinos melhores", "Primeiro vem a cidade certa. Cada opção explica por que vale visitar, onde comer e o que fazer com crianças."],
    ["4", "Hotéis e disponibilidade", "Depois que você escolhe o destino, abrimos hotéis qualificados e links rastreados para checar disponibilidade."]
  ];
  return `
    <section class="section how-it-works" id="como-funciona">
      <div class="section-title compact-title">
        <span class="badge subtle">Como uma consultora pensaria</span>
        <h2>Primeiro reduzimos risco. Depois comparamos hotel.</h2>
        <p>A experiência foi desenhada para pais decidirem rápido, com clareza e sem cair em hotel bonito na foto que não funciona para a rotina da família.</p>
      </div>
      <div class="how-grid">
        ${steps.map(([number, title, text]) => `
          <article class="how-card">
            <span>${number}</span>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(text)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function ConciergeLiveDataSection() {
  const summaries = [...liveConciergeData.summariesBySlug.values()];
  const routeCount = summaries.filter(item => item.sp_drive_minutes).length;
  const googleCount = conciergeGooglePlacesCoverage.covered;
  const hotelCount = summaries.reduce((sum, item) => sum + (Number(item.bookable_hotels) || 0), 0);
  const calmCount = summaries.filter(item => item.movimento_level === "tranquilo").length;
  const status = liveConciergeData.loading
    ? "Carregando dados vivos..."
    : summaries.length
      ? `${summaries.length} destinos com sinais reais no Supabase`
      : "Dados vivos em validação";
  return `
    <section class="section live-data-home" id="dados-vivos">
      <div class="live-data-strip">
        <div>
          <span class="badge subtle">Dados que entram na decisão</span>
          <h2>Não é só opinião: o diagnóstico cruza sinais reais.</h2>
          <p>${escapeHtml(status)}${liveConciergeData.error ? ` · algumas fontes estão pendentes sem bloquear a experiência` : ""}</p>
        </div>
        <div class="live-data-metrics" aria-label="Cobertura de dados vivos">
          ${LiveDataMetric("Google", googleCount, "destinos e hoteis validados")}
          ${LiveDataMetric("Rotas", routeCount, "tempo saindo de SP")}
          ${LiveDataMetric("Hotéis", hotelCount, "opções bookable")}
          ${LiveDataMetric("Movimento", calmCount, "destinos tranquilos")}
        </div>
      </div>
    </section>
  `;
}

function LiveDataMetric(label, value, detail) {
  return `
    <div class="live-data-metric">
      <strong>${numberLabel(value, 0)}</strong>
      <span>${escapeHtml(label)}</span>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function PopularFamilyDestinationsSection() {
  const destinations = popularFamilyDestinations();
  return `
    <section class="section popular-destinations" id="destinos-em-alta">
      <div class="section-title compact-title">
        <span class="badge subtle">Curadoria em alta para famílias de São Paulo</span>
        <h2>Destinos para começar a explorar.</h2>
        <p>Uma vitrine curta para inspirar. O diagnóstico decide com mais precisão.</p>
      </div>
      <div class="popular-destination-grid" aria-label="Destinos em alta para famílias de São Paulo">
        ${destinations.map((destination, index) => PopularDestinationCard(destination, index)).join("")}
      </div>
    </section>
  `;
}

function popularFamilyDestinations() {
  return [
    {
      key: "atibaia-sp",
      name: "Atibaia",
      imageKey: "atibaia",
      eyebrow: "1h30 de carro",
      reason: "resort, montanha e primeira viagem sem aeroporto"
    },
    {
      key: "aguas-de-lindoia-sp",
      name: "Aguas de Lindoia",
      imageKey: "aguas-de-lindoia",
      eyebrow: "Circuito das Aguas",
      reason: "resort tematico, pensao completa e extensao leve para Socorro"
    },
    {
      key: "praia-do-forte-ba",
      name: "Praia do Forte",
      imageKey: "praia-do-forte",
      eyebrow: "praia + Projeto Tamar",
      reason: "vila caminhável, resort e passeio educativo"
    },
    {
      key: "porto-de-galinhas-pe",
      name: "Porto de Galinhas",
      imageKey: "porto-de-galinhas",
      eyebrow: "piscinas naturais",
      reason: "mar bonito, resorts e centrinho fácil para família"
    },
    {
      key: "gramado-rs",
      name: "Gramado",
      imageKey: "gramado",
      eyebrow: "serra e programação",
      reason: "gastronomia, parques e plano B para chuva"
    },
    {
      key: "olimpia-sp",
      name: "Olímpia",
      imageKey: "olimpia",
      eyebrow: "parque aquático",
      reason: "boa para criança maior e hotel com lazer concentrado"
    }
  ];
}

function PopularDestinationCard(destination, index) {
  const image = approvedDestinationImage(destination.imageKey);
  const experience = destinationExperienceByKey.get(destination.key);
  const why = experience?.whyVisit || destination.reason;
  return `
    <button class="popular-destination-card popular-card-${index + 1}" type="button" data-action="popular-destination" data-destination-key="${escapeAttr(destination.key)}" data-destination-name="${escapeAttr(destination.name)}">
      ${DestinationImage(destination.imageKey, destination.name)}
      <span class="popular-card-scrim" aria-hidden="true"></span>
      <span class="popular-card-copy">
        <span class="popular-card-topline">
          <span>${escapeHtml(destination.eyebrow)}</span>
          <b>${image ? "foto verificada" : "foto pendente"}</b>
        </span>
        <strong>${escapeHtml(destination.name)}</strong>
        <small>${escapeHtml(why)}</small>
      </span>
    </button>
  `;
}

function ConciergeQuickIntakeForm() {
  const adultsCount = Number.parseInt(state.intakeDraft.adultsCount, 10) || 2;
  const childrenCount = Number.parseInt(state.intakeDraft.childrenCount, 10) || 0;
  const roomsCount = Number.parseInt(state.intakeDraft.roomsCount, 10) || 1;
  const tripDuration = state.intakeDraft.tripDuration || "3 noites";
  const travelMode = state.intakeDraft.travelTimingMode || "unknown";
  return `
    <form id="intakeForm" class="quiz-card intake-card">
      <div class="quiz-top">
        <span>Etapa 1 de 2</span>
        <div class="progress"><i style="width:22%"></i></div>
      </div>
      <h3>Crie seu Passaporte Família.</h3>
      <p class="micro">Eu salvo seu diagnóstico e preparo conteúdos úteis da sua viagem. Quando o WhatsApp oficial estiver liberado, a gente valida o envio do roteiro por lá.</p>
      ${state.intakeDraft.destinationInterestName ? `<p class="intent-note">Vamos testar se ${escapeHtml(state.intakeDraft.destinationInterestName)} combina mesmo com sua família.</p>` : ""}
      <div class="intake-contact-card">
        <div>
          <span class="badge subtle">Passaporte Família</span>
          <strong>Seu roteiro fica pronto para continuar depois.</strong>
          <p>Resumo, checklist e alertas úteis. Sem grupo, sem corrente, sem mensagem aleatória.</p>
        </div>
        <div class="contact-grid">
          <label>Seu nome
            <input name="leadName" required autocomplete="name" placeholder="Como posso te chamar?">
          </label>
          <label>WhatsApp
            <input name="leadWhatsapp" required inputmode="tel" autocomplete="tel" placeholder="11999999999">
          </label>
          <label>Email
            <input name="leadEmail" required type="email" autocomplete="email" placeholder="voce@email.com">
          </label>
        </div>
        <label class="consent-check">
          <input name="consentContact" type="checkbox" required>
          <span>Aceito receber meu resumo personalizado, checklist e conteúdos úteis sobre esta viagem. Posso pedir remoção quando quiser.</span>
        </label>
      </div>
      <div class="intake-grid">
        <label>Adultos
          <select name="adultsCount">
            ${[1, 2, 3, 4, 5].map(count => `<option value="${count}" ${adultsCount === count ? "selected" : ""}>${count === 5 ? "5+ adultos" : `${count} ${count === 1 ? "adulto" : "adultos"}`}</option>`).join("")}
          </select>
        </label>
        <label>Crianças
          <select name="childrenCount" data-action="children-count">
            ${[0, 1, 2, 3, 4].map(count => `<option value="${count}" ${childrenCount === count ? "selected" : ""}>${count === 0 ? "Sem criança" : `${count} ${count === 1 ? "criança" : "crianças"}`}</option>`).join("")}
          </select>
        </label>
        <label>Quartos
          <select name="roomsCount">
            ${[1, 2, 3, 4].map(count => `<option value="${count}" ${roomsCount === count ? "selected" : ""}>${count === 4 ? "4+ quartos" : `${count} ${count === 1 ? "quarto" : "quartos"}`}</option>`).join("")}
          </select>
        </label>
        <label>Noites
          <select name="tripDuration">
            ${["1 noite", "2 noites", "3 noites", "4 a 5 noites", "6+ noites"].map(option => `<option ${tripDuration === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
          </select>
        </label>
        ${ChildAgeFields(childrenCount)}
        <label>Pet
          <select name="pet">
            <option selected>Não vai pet</option>
            <option>Vai pet pequeno</option>
            <option>Vai pet médio/grande</option>
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
        <div class="travel-timing-card">
          <span>Quando querem ir?</span>
          <div class="intake-segment" role="radiogroup" aria-label="Quando querem ir">
            ${TravelModeOption("date", "Escolher data", travelMode)}
            ${TravelModeOption("month", "Escolher mês", travelMode)}
            ${TravelModeOption("flexible", "Data flexível", travelMode)}
            ${TravelModeOption("unknown", "Ainda não sei", travelMode)}
          </div>
          <div class="travel-mode-fields">
            <label data-travel-mode-field="date">Data provável<input name="travelDate" type="date"></label>
            <label data-travel-mode-field="month">Mês provável<input name="travelMonth" type="month"></label>
            <label data-travel-mode-field="flexible">Janela flexível
              <select name="flexibleWindow">
                <option>Próximos 30 dias</option>
                <option selected>Próximos 3 meses</option>
                <option>Próximos 6 meses</option>
                <option>Férias escolares</option>
                <option>Feriado prolongado</option>
              </select>
            </label>
          </div>
        </div>
      </div>
      <button class="button primary" type="submit">Encontrar minha viagem ideal</button>
      <p class="privacy-note">O diagnóstico aparece na hora. Seus dados ficam vinculados a esta sessão para personalização e acompanhamento, com opção de exclusão.</p>
    </form>
  `;
}

function LegacyChildAgeFields(childrenCount) {
  return [1, 2, 3, 4].map(index => `
    <label class="child-age-field ${index > childrenCount ? "hidden-field" : ""}" data-child-age-index="${index}">
      Idade criança ${index}
      <select name="childAge${index}" ${index > childrenCount ? "disabled" : ""}>
        <option value="0 a 12 meses">0 a 12 meses</option>
        <option value="1 a 2 anos" ${index === 1 ? "selected" : ""}>1 a 2 anos</option>
        <option value="3 a 5 anos" ${index === 2 ? "selected" : ""}>3 a 5 anos</option>
        <option value="6+ anos">6+ anos</option>
      </select>
    </label>
  `).join("");
}

function ChildAgeFields(childrenCount) {
  const fallbackByIndex = ["1 a 2 anos", "3 a 5 anos", "0 a 12 meses", "0 a 12 meses"];
  const options = ["0 a 12 meses", "1 a 2 anos", "3 a 5 anos", "6+ anos"];
  return [1, 2, 3, 4].map(index => {
    const selected = state.intakeDraft.childAges?.[index - 1] || fallbackByIndex[index - 1];
    return `
      <label class="child-age-field ${index > childrenCount ? "hidden-field" : ""}" data-child-age-index="${index}">
        Idade crianca ${index}
        <select name="childAge${index}" ${index > childrenCount ? "disabled" : ""}>
          ${options.map(option => `<option value="${escapeAttr(option)}" ${selected === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
        </select>
      </label>
    `;
  }).join("");
}

function TravelModeOption(value, label, selected) {
  return `
    <label class="segment-option ${selected === value ? "active" : ""}">
      <input type="radio" name="travelTimingMode" value="${value}" data-action="travel-mode" ${selected === value ? "checked" : ""}>
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function LegacyConciergeMapExplorerSection() {
  const hotspots = filteredMapHotspots();
  const selected = hotspots.find(item => item.key === state.mapFilters.selectedKey) || hotspots[0];
  return `
    <section class="section map-explorer-section" id="mapa">
      <div class="section-title compact-title">
        <span class="badge subtle">Mapa de decisão saindo de São Paulo</span>
        <h2>Explore destinos por logística, estrutura e risco de perrengue.</h2>
        <p>Clique nos hotspots para comparar cidades, hotéis-base e combinações regionais. Depois o assistente transforma essa exploração em recomendação final.</p>
      </div>
      <div class="map-explorer-layout">
        <div class="map-filter-panel">
          <div class="map-filter-group">
            <span>Deslocamento</span>
            ${MapFilterButton("travel", "all", "Todos")}
            ${MapFilterButton("travel", "2h", "Até 2h")}
            ${MapFilterButton("travel", "4h", "Até 4h")}
            ${MapFilterButton("travel", "flight", "Voo + traslado")}
          </div>
          <div class="map-filter-group">
            <span>Fit família</span>
            ${MapFilterButton("fit", "all", "Todos")}
            ${MapFilterButton("fit", "baby", "Bebê")}
            ${MapFilterButton("fit", "kidsClub", "Kids club")}
            ${MapFilterButton("fit", "heatedPool", "Piscina aquecida")}
            ${MapFilterButton("fit", "rain", "Plano B chuva")}
            ${MapFilterButton("fit", "multi", "Multi-destino")}
          </div>
          <div class="map-filter-group">
            <span>Faixa</span>
            ${MapFilterButton("price", "all", "Todas")}
            ${MapFilterButton("price", "mid", "Controlável")}
            ${MapFilterButton("price", "upscale", "Conforto")}
            ${MapFilterButton("price", "luxury", "Premium")}
          </div>
        </div>
        <div class="interactive-map-card">
          <div class="interactive-map-canvas" role="img" aria-label="Mapa interativo com hotspots de destinos familiares saindo de Sao Paulo">
            <span class="map-origin main-origin">São Paulo</span>
            ${hotspots.map((hotspot, index) => MapExplorerPin(hotspot, index)).join("")}
          </div>
          <div class="map-hotspot-list">
            ${hotspots.slice(0, 8).map((hotspot, index) => MapHotspotListItem(hotspot, index)).join("") || EmptyMapHotspotState()}
          </div>
        </div>
        ${selected ? MapHotspotDetail(selected) : ""}
      </div>
      ${selected ? TravelRoutePreview(selected) : ""}
    </section>
  `;
}

function MapFilterButton(group, value, label) {
  return `<button class="filter ${state.mapFilters[group] === value ? "active" : ""}" type="button" data-action="map-filter" data-filter-group="${group}" data-filter-value="${value}">${escapeHtml(label)}</button>`;
}

function LegacyMapExplorerPin(hotspot, index) {
  const position = hotspot.mapPosition;
  return `
    <button class="map-hotspot-pin ${state.mapFilters.selectedKey === hotspot.key ? "active" : ""}" type="button" style="left:${position.x}%;top:${position.y}%" data-action="map-hotspot" data-hotspot-key="${escapeAttr(hotspot.key)}" aria-label="${escapeAttr(`Ver ${hotspot.name}`)}">
      <b>${index + 1}</b>
      <span>${escapeHtml(hotspot.shortName)}</span>
    </button>
  `;
}

function LegacyMapHotspotListItem(hotspot, index) {
  return `
    <button class="map-hotspot-row ${state.mapFilters.selectedKey === hotspot.key ? "active" : ""}" type="button" data-action="map-hotspot" data-hotspot-key="${escapeAttr(hotspot.key)}">
      <b>${index + 1}</b>
      <span>${escapeHtml(hotspot.name)}</span>
      <small>${escapeHtml(hotspot.routeLabel)}</small>
    </button>
  `;
}

function LegacyMapHotspotDetail(hotspot) {
  return `
    <aside class="map-hotspot-detail">
      <span class="badge subtle">${escapeHtml(hotspot.badge)}</span>
      <h3>${escapeHtml(hotspot.name)}</h3>
      <p>${escapeHtml(hotspot.reason)}</p>
      <div class="map-detail-grid">
        <span><b>Base</b>${escapeHtml(hotspot.bestHotel.name)}</span>
        <span><b>Rota</b>${escapeHtml(hotspot.routeLabel)}</span>
        <span><b>Fit</b>${escapeHtml(hotspot.fitLabel)}</span>
        <span><b>Faixa</b>${escapeHtml(priceTierLabel(hotspot.priceTier))}</span>
      </div>
      ${hotspot.itinerary ? `
        <div class="map-itinerary-hint">
          <strong>${escapeHtml(hotspot.itinerary.title)}</strong>
          <small>${escapeHtml(hotspot.itinerary.baseStrategy)}</small>
        </div>
      ` : ""}
      <div class="hero-actions">
        <button class="button primary compact-button" type="button" data-action="map-start-diagnosis" data-hotspot-key="${escapeAttr(hotspot.key)}">Diagnosticar este destino</button>
        <a class="button secondary compact-button" href="${escapeAttr(googleMapsDirectionsUrl(hotspot.name))}" target="_blank" rel="noopener" data-track="map_explorer_route_clicked" data-source="map_explorer" data-destination="${escapeAttr(hotspot.name)}">Ver rota</a>
      </div>
    </aside>
  `;
}

function LegacyEmptyMapHotspotState() {
  return `<div class="empty-map-state"><strong>Nenhum hotspot com estes filtros.</strong><span>Abra um pouco os critérios para comparar mais destinos.</span></div>`;
}

function LegacyFilteredMapHotspots() {
  return buildMapHotspots()
    .filter(hotspot => matchesMapTravelFilter(hotspot))
    .filter(hotspot => matchesMapFitFilter(hotspot))
    .filter(hotspot => state.mapFilters.price === "all" || hotspot.priceTier === state.mapFilters.price)
    .slice(0, 16);
}

function LegacyBuildMapHotspots() {
  const groups = new Map();
  curatedHotels.forEach(hotel => {
    const key = cityKeyForHotel(hotel);
    const current = groups.get(key) || {
      key,
      name: hotel.destination,
      shortName: shortCityName(hotel.destination),
      hotels: [],
      bestScore: 0
    };
    current.hotels.push(hotel);
    current.bestScore = Math.max(current.bestScore, hotel.score || 0);
    groups.set(key, current);
  });
  return [...groups.values()].map(group => {
    const hotels = group.hotels.sort((a, b) => (b.score || 0) - (a.score || 0));
    const bestHotel = hotels[0];
    const itinerary = itineraryForDestinationKey(group.key, bestHotel);
    return {
      ...group,
      bestHotel,
      itinerary,
      mapPosition: mapPositionForDestination(bestHotel),
      routeLabel: mapRouteLabel(bestHotel),
      fitLabel: mapFitLabel(bestHotel, itinerary),
      priceTier: bestHotel.priceTier || "upscale",
      badge: itinerary ? "Pode combinar destinos" : bestHotel.departureMode === "carro" ? "Carro saindo de SP" : "Voo + traslado",
      reason: mapHotspotReason(group, bestHotel, itinerary)
    };
  }).sort((a, b) => b.bestScore - a.bestScore || travelBurden(a.bestHotel) - travelBurden(b.bestHotel));
}

function itineraryForDestinationKey(key, hotel) {
  const keys = new Set([key, hotel.destinationSlug, hotel.destinationKey, imageKeyForHotelDestination(hotel)].filter(Boolean));
  return conciergeFamilyItineraries.find(itinerary => itinerary.primaryDestinationKeys.some(item => keys.has(item)));
}

function LegacyMatchesMapTravelFilter(hotspot) {
  const mode = state.mapFilters.travel;
  const burden = travelBurden(hotspot.bestHotel);
  if (mode === "2h") return hotspot.bestHotel.departureMode === "carro" && burden <= 120;
  if (mode === "4h") return hotspot.bestHotel.departureMode === "carro" && burden <= 240;
  if (mode === "flight") return hotspot.bestHotel.departureMode !== "carro";
  return true;
}

function matchesMapFitFilter(hotspot) {
  const fit = state.mapFilters.fit;
  const hotel = hotspot.bestHotel;
  if (fit === "baby") return Boolean(hotel.copaBaby || hotel.hasKitchenette || hotel.copaBaby24h);
  if (fit === "kidsClub") return Boolean(hotel.kidsClub || hotel.recreation);
  if (fit === "heatedPool") return Boolean(hotel.heatedPool);
  if (fit === "rain") return Boolean(hotel.worksOnRainyDay);
  if (fit === "multi") return Boolean(hotspot.itinerary);
  return true;
}

function mapRouteLabel(hotel) {
  if (hotel.driveTimeFromSaoPaulo) return `${formatHotelTime(hotel)} de carro`;
  return `voo + traslado ${hotel.transferMinutes || "?"} min`;
}

function mapFitLabel(hotel, itinerary) {
  if (itinerary) return "roteiro regional";
  if (hotel.copaBaby || hotel.copaBaby24h) return "forte para bebê";
  if (hotel.allInclusive) return "alimentação resolvida";
  if (hotel.kidsClub || hotel.recreation) return "atividade para criança";
  return "base prática";
}

function LegacyMapHotspotReason(group, hotel, itinerary) {
  if (itinerary) return `${group.shortName} funciona como base e ainda permite explorar a região com calma quando há noites suficientes.`;
  if (hotel.driveTimeFromSaoPaulo && hotel.driveTimeFromSaoPaulo <= 120) return `${group.shortName} reduz fricção: pouca estrada, hotel como base e volta simples se a rotina apertar.`;
  if (hotel.departureMode !== "carro") return `${group.shortName} entra quando a família aceita voo para comprar praia, natureza ou experiência mais marcante.`;
  return `${group.shortName} vale quando a família quer estrutura e aceita planejar melhor estrada, pausas e refeições.`;
}

function mapPositionForDestination(hotel) {
  const bySlug = {
    "resort-interior-sp": { x: 39, y: 61 },
    "campinas-sp": { x: 39, y: 61 },
    atibaia: { x: 47, y: 55 },
    "aguas-de-lindoia": { x: 37, y: 48 },
    "mogi-das-cruzes": { x: 57, y: 61 },
    "cesario-lange": { x: 29, y: 67 },
    "hotel-fazenda-sp": { x: 25, y: 75 },
    olimpia: { x: 24, y: 42 },
    "foz-do-iguacu": { x: 39, y: 82 },
    gramado: { x: 43, y: 88 },
    "praia-do-forte": { x: 76, y: 32 },
    "porto-de-galinhas": { x: 81, y: 24 },
    maragogi: { x: 80, y: 27 },
    "beto-carrero-penha": { x: 49, y: 84 },
    "campos-do-jordao": { x: 52, y: 51 },
    orlando: { x: 88, y: 13 },
    "buenos-aires": { x: 30, y: 91 }
  };
  return bySlug[hotel.destinationSlug] || bySlug[imageKeyForHotelDestination(hotel)] || hotelMapPosition(hotel.id);
}

function ConciergeMapExplorerSection() {
  const hotspots = filteredMapHotspots();
  const selected = hotspots.find(item => item.key === state.mapFilters.selectedKey) || hotspots[0];
  const totalChildren = Math.max(0, Math.min(4, Number.parseInt(state.mapFilters.children, 10) || 0));
  return `
    <section class="section map-explorer-section map-discovery" id="mapa">
      <div class="section-title compact-title map-hero-title">
        <span class="badge subtle">Concierge da Familia Explore</span>
        <h2>Escolha pelo mapa. Refine depois.</h2>
        <p>Origem, filhos, tempo de deslocamento e orçamento. O resto entra quando fizer sentido.</p>
      </div>
      <div class="map-quick-panel" aria-label="Filtros rapidos do mapa">
        <label class="map-field wide">
          <span>Origem</span>
          <input type="text" value="${escapeAttr(state.mapFilters.origin)}" data-action="map-input" data-map-field="origin" placeholder="Grande SP">
        </label>
        <label class="map-field">
          <span>Adultos</span>
          <select data-action="map-input" data-map-field="adults">
            ${[1, 2, 3, 4, 5, 6].map(value => `<option value="${value}" ${state.mapFilters.adults === String(value) ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <label class="map-field">
          <span>Criancas</span>
          <select data-action="map-input" data-map-field="children">
            ${[0, 1, 2, 3, 4].map(value => `<option value="${value}" ${state.mapFilters.children === String(value) ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
        <div class="map-child-ages ${totalChildren ? "" : "is-empty"}">
          ${totalChildren ? Array.from({ length: totalChildren }, (_, index) => MapChildAgeField(index)).join("") : "<span>Sem criancas informadas</span>"}
        </div>
      </div>
      <div class="map-explorer-layout">
        <div class="map-filter-panel">
          <div class="map-filter-group">
            <span>Limite de deslocamento</span>
            ${MapFilterButton("travel", "1h", "Ate 1h")}
            ${MapFilterButton("travel", "2h", "Ate 2h")}
            ${MapFilterButton("travel", "4h", "Ate 4h")}
            ${MapFilterButton("travel", "flight", "Voo curto")}
            ${MapFilterButton("travel", "international", "Viagem internacional")}
          </div>
          <div class="map-filter-group">
            <span>Orcamento</span>
            ${MapFilterButton("budget", "minimum", "Quero gastar o minimo")}
            ${MapFilterButton("budget", "economic", "Economico")}
            ${MapFilterButton("budget", "comfort", "Confortavel")}
            ${MapFilterButton("budget", "premium", "Premium")}
          </div>
          <div class="map-filter-group secondary-filter">
            <span>Refinar agora</span>
            ${MapFilterButton("fit", "all", "Todos")}
            ${MapFilterButton("fit", "baby", "Bebe")}
            ${MapFilterButton("fit", "kidsClub", "Kids club")}
            ${MapFilterButton("fit", "rain", "Plano B chuva")}
            ${MapFilterButton("fit", "multi", "Multi-destino")}
          </div>
          <div class="map-ai-note">
            <strong>Sem chute.</strong>
            <span>Preço e disponibilidade só quando houver fonte real.</span>
          </div>
        </div>
        <div class="interactive-map-card">
          <div class="map-card-topline">
            <strong>${escapeHtml(hotspots.length ? `${hotspots.length} destinos familiares encontrados` : "Nenhum destino com estes filtros")}</strong>
            <span>${escapeHtml(mapDiscoverySummary())}</span>
          </div>
          <div class="interactive-map-canvas real-map-shell" role="img" aria-label="Mapa real do estado de Sao Paulo com destinos familiares recomendados">
            <div id="familyRealMap" class="family-real-map" aria-hidden="true"></div>
            <div class="map-fallback-overlay">
              <span class="map-origin main-origin">${escapeHtml(mapOriginShortLabel())}</span>
              ${hotspots.map((hotspot, index) => MapExplorerPin(hotspot, index)).join("")}
            </div>
            <div class="map-real-caption">
              <strong>Mapa real de Sao Paulo</strong>
              <span>Arraste e toque nas cidades.</span>
            </div>
          </div>
          <div class="map-hotspot-list">
            ${hotspots.slice(0, 10).map((hotspot, index) => MapHotspotListItem(hotspot, index)).join("") || EmptyMapHotspotState()}
          </div>
        </div>
        ${selected ? MapHotspotDetail(selected) : ""}
      </div>
      ${selected ? TravelRoutePreview(selected) : ""}
    </section>
  `;
}

function MapChildAgeField(index) {
  const value = state.mapFilters.childAges[index] || "1 a 2 anos";
  const options = ["0 a 12 meses", "1 a 2 anos", "3 a 5 anos", "6+ anos"];
  return `
    <label class="map-field child-age">
      <span>Idade ${index + 1}</span>
      <select data-action="map-input" data-map-field="childAge" data-child-age-index="${index}">
        ${options.map(option => `<option value="${escapeAttr(option)}" ${value === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function MapExplorerPin(hotspot, index) {
  const position = hotspot.mapPosition;
  return `
    <button class="map-hotspot-pin ${state.mapFilters.selectedKey === hotspot.key ? "active" : ""} ${escapeAttr(hotspot.familyScore.medal)}" type="button" style="left:${position.x}%;top:${position.y}%" data-action="map-hotspot" data-hotspot-key="${escapeAttr(hotspot.key)}" aria-label="${escapeAttr(`Ver ${hotspot.name}`)}">
      <b>${index + 1}</b>
      <span>${escapeHtml(hotspot.shortName)}<small>${escapeHtml(hotspot.costRange.short)}</small></span>
    </button>
  `;
}

function MapHotspotListItem(hotspot, index) {
  return `
    <button class="map-hotspot-row ${state.mapFilters.selectedKey === hotspot.key ? "active" : ""}" type="button" data-action="map-hotspot" data-hotspot-key="${escapeAttr(hotspot.key)}">
      <b>${index + 1}</b>
      <span>${escapeHtml(hotspot.name)}</span>
      <small>${escapeHtml(`${hotspot.routeLabel} | ${hotspot.badgeShort}`)}</small>
    </button>
  `;
}

function MapHotspotDetail(hotspot) {
  return `
    <aside class="map-hotspot-detail">
      <div class="map-detail-header">
        <span class="map-family-badge ${escapeAttr(hotspot.familyScore.medal)}">${escapeHtml(hotspot.badgeShort)}</span>
        <small>${escapeHtml(hotspot.familyScore.score)}/100</small>
      </div>
      <h3>${escapeHtml(hotspot.name)}</h3>
      <p>${escapeHtml(shortSentence(hotspot.reason))}</p>
      <div class="map-detail-grid">
        <span><b>Distancia</b>${escapeHtml(hotspot.distanceLabel)}</span>
        <span><b>Tempo</b>${escapeHtml(hotspot.timeLabel)}</span>
        <span><b>Custo estimado</b>${escapeHtml(hotspot.costRange.label)}</span>
        <span><b>Melhor epoca</b>${escapeHtml(hotspot.bestSeason)}</span>
      </div>
      <div class="map-cost-note">${escapeHtml(hotspot.costRange.detail)}</div>
      <div class="map-mini-columns">
        <div>
          <strong>Atracoes familiares</strong>
          ${MapMiniList(hotspot.attractions)}
        </div>
        <div>
          <strong>Pontos de atencao</strong>
          ${MapMiniList(hotspot.attentionPoints)}
        </div>
      </div>
      ${hotspot.itinerary ? `
        <div class="map-itinerary-hint">
          <strong>${escapeHtml(hotspot.itinerary.title)}</strong>
          <small>${escapeHtml(hotspot.itinerary.baseStrategy)}</small>
        </div>
      ` : ""}
      <div class="map-detail-actions">
        <button class="button primary compact-button" type="button" data-action="route-preview-start" data-hotspot-key="${escapeAttr(hotspot.key)}">Simular rota da familia</button>
        <button class="button primary compact-button" type="button" data-action="map-start-diagnosis" data-hotspot-key="${escapeAttr(hotspot.key)}">Diagnosticar</button>
        <button class="button secondary compact-button" type="button" data-action="map-build-route" data-hotspot-key="${escapeAttr(hotspot.key)}">Montar roteiro</button>
      </div>
    </aside>
  `;
}

function MapMiniList(items) {
  return `<ul>${items.slice(0, 3).map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function TravelRoutePreview(hotspot) {
  const preview = routePreviewForHotspot(hotspot);
  const active = state.routePreview.destinationKey === hotspot.key;
  const status = active ? state.routePreview.status : "idle";
  const progress = active ? state.routePreview.progress : 0;
  const vehicle = pointAtRouteProgress(preview.svgPoints, progress);
  const length = Math.max(1, routeSvgLength(preview.svgPoints));
  const visibleStops = active ? state.routePreview.showStops : false;
  const summary = active && state.routePreview.summary ? state.routePreview.summary : preview.summary;
  const message = active ? routePreviewMessage(preview, progress) : "Veja a estrada antes de decidir. A ideia e sentir o esforco da viagem, nao so olhar quilometragem.";
  return `
    <section class="travel-route-preview" id="previa-rota" aria-label="Previa da Viagem no Mapa">
      <div class="route-preview-copy">
        <span class="badge subtle">Previa da Viagem no Mapa</span>
        <h3>${escapeHtml(hotspot.name)} antes da mala sair do armario.</h3>
        <p>${escapeHtml(message)}</p>
      </div>
      <div class="route-preview-shell route-status-${escapeAttr(status)}">
        <div class="route-preview-map" style="--route-length:${length};--route-offset:${length * (1 - progress)}">
          <svg viewBox="0 0 100 100" role="img" aria-label="Rota animada de Sao Paulo ate ${escapeAttr(hotspot.name)}">
            <defs>
              <linearGradient id="familyRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#006ce4"></stop>
                <stop offset="100%" stop-color="#1b8049"></stop>
              </linearGradient>
            </defs>
            <polyline class="route-preview-shadow" points="${escapeAttr(svgPointsAttribute(preview.svgPoints))}"></polyline>
            <polyline class="route-preview-path" points="${escapeAttr(svgPointsAttribute(preview.svgPoints))}"></polyline>
            ${preview.stops.map((stop, index) => RouteStopMarker(stop, index, progress, visibleStops)).join("")}
            <circle class="route-city origin-city" cx="${preview.svgPoints[0].x}" cy="${preview.svgPoints[0].y}" r="3"></circle>
            <circle class="route-city destination-city" cx="${preview.svgPoints[preview.svgPoints.length - 1].x}" cy="${preview.svgPoints[preview.svgPoints.length - 1].y}" r="3"></circle>
            <g class="route-vehicle" transform="translate(${vehicle.x} ${vehicle.y})">
              <circle r="4.1"></circle>
              <path d="M-2.8 0.6h5.6l-.7-2.2h-4.2zM-2.1 1.5a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm4.2 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z"></path>
            </g>
          </svg>
          <span class="route-map-label origin">SP</span>
          <span class="route-map-label destination">${escapeHtml(hotspot.shortName)}</span>
          <span class="route-preview-status">${escapeHtml(routePreviewStatusLabel(status))}</span>
        </div>
        <div class="route-progress-bar"><i style="width:${Math.round(progress * 100)}%"></i></div>
        <div class="route-preview-controls">
          <button class="button primary compact-button" type="button" data-action="route-preview-start" data-hotspot-key="${escapeAttr(hotspot.key)}">${status === "done" ? "Simular de novo" : "Simular rota da familia"}</button>
          <button class="button secondary compact-button" type="button" data-action="route-preview-pause" ${status === "idle" || status === "loading" ? "disabled" : ""}>${status === "paused" ? "Continuar" : "Pausar"}</button>
          <button class="button ghost compact-button" type="button" data-action="route-preview-speed">${escapeHtml(routeSpeedLabel())}</button>
          <button class="button secondary compact-button" type="button" data-action="route-preview-stops">${visibleStops ? "Ocultar paradas" : "Ver paradas recomendadas"}</button>
          <button class="button primary compact-button" type="button" data-action="map-build-route" data-hotspot-key="${escapeAttr(hotspot.key)}">Montar roteiro com base nessa rota</button>
        </div>
        <div class="route-preview-summary">
          ${RouteSummaryItem("Tempo estimado", summary.timeLabel)}
          ${RouteSummaryItem("Distancia", summary.distanceLabel)}
          ${RouteSummaryItem("Paradas", summary.stopLabel)}
          ${RouteSummaryItem("Esforco familiar", summary.effortLabel)}
          ${RouteSummaryItem("Melhor saida", summary.bestDeparture)}
          ${RouteSummaryItem("Alerta", summary.alert)}
        </div>
        <div class="route-stop-list ${visibleStops ? "open" : ""}">
          ${preview.stops.map(stop => `
            <article>
              <b>${escapeHtml(stop.label)}</b>
              <span>${escapeHtml(stop.message)}</span>
              <small>${escapeHtml(stop.kindLabel)}</small>
            </article>
          `).join("")}
        </div>
      </div>
    </section>
  `;
}

function RouteStopMarker(stop, index, progress, visibleStops) {
  const reached = progress + 0.02 >= stop.progress;
  return `
    <g class="route-poi ${reached ? "reached" : ""} ${visibleStops ? "visible" : ""}" transform="translate(${stop.svg.x} ${stop.svg.y})">
      <circle r="2.7"></circle>
      <text y="-4.2">${escapeHtml(routeStopIcon(stop.kind))}</text>
      <title>${escapeHtml(`${index + 1}. ${stop.label}`)}</title>
    </g>
  `;
}

function RouteSummaryItem(label, value) {
  return `<span><b>${escapeHtml(label)}</b>${escapeHtml(value)}</span>`;
}

function routePreviewForHotspot(hotspot) {
  const active = state.routePreview.destinationKey === hotspot.key && state.routePreview.points.length;
  const geoPoints = active ? state.routePreview.points : fallbackRouteGeoPoints(hotspot);
  const svgPoints = projectRoutePoints(geoPoints);
  const stops = active && state.routePreview.stops.length ? state.routePreview.stops : buildRouteStops(hotspot, geoPoints, svgPoints);
  return {
    hotspot,
    geoPoints,
    svgPoints,
    stops,
    summary: buildRoutePreviewSummary(hotspot)
  };
}

function routeDestinationCoordinates(recommendation, bestHotel, googleCoverage) {
  const canonical = destinationCoordinateBySlug(recommendation.key)
    || destinationCoordinateBySlug(bestHotel.destinationKey)
    || destinationCoordinateBySlug(bestHotel.destinationSlug)
    || destinationCoordinateBySlug(imageKeyForHotelDestination(bestHotel));
  if (canonical) return canonical;
  const livePoint = firstLiveMatch(recommendation, liveConciergeData.mapPointsBySlug);
  if (livePoint?.latitude && livePoint?.longitude) return { latitude: Number(livePoint.latitude), longitude: Number(livePoint.longitude) };
  if (googleCoverage?.latitude && googleCoverage?.longitude) return { latitude: Number(googleCoverage.latitude), longitude: Number(googleCoverage.longitude) };
  const hotelCoverage = googleCoverageForHotel(bestHotel);
  if (hotelCoverage?.latitude && hotelCoverage?.longitude) return { latitude: Number(hotelCoverage.latitude), longitude: Number(hotelCoverage.longitude) };
  return approximateDestinationCoordinates(bestHotel);
}

function approximateDestinationCoordinates(bestHotel) {
  return destinationCoordinateBySlug(bestHotel.destinationKey)
    || destinationCoordinateBySlug(bestHotel.destinationSlug)
    || destinationCoordinateBySlug(imageKeyForHotelDestination(bestHotel))
    || { latitude: -23.116, longitude: -46.553 };
}

function destinationCoordinateBySlug(slug) {
  const bySlug = {
    "campinas-sp": { latitude: -22.9051, longitude: -47.0613 },
    "resort-interior-sp": { latitude: -22.9051, longitude: -47.0613 },
    "atibaia-sp": { latitude: -23.116, longitude: -46.553 },
    atibaia: { latitude: -23.116, longitude: -46.553 },
    "aguas-de-lindoia": { latitude: -22.473, longitude: -46.632 },
    "aguas-de-lindoia-sp": { latitude: -22.473, longitude: -46.632 },
    "mogi-das-cruzes": { latitude: -23.5217, longitude: -46.186 },
    "mogi-das-cruzes-sp": { latitude: -23.5217, longitude: -46.186 },
    "sao-roque": { latitude: -23.5292, longitude: -47.1351 },
    "sao-roque-sp": { latitude: -23.5292, longitude: -47.1351 },
    "guaruja-sp": { latitude: -23.9931, longitude: -46.2564 },
    guaruja: { latitude: -23.9931, longitude: -46.2564 },
    "litoral-norte-sp": { latitude: -23.7903, longitude: -45.5581 },
    maresias: { latitude: -23.7903, longitude: -45.5581 },
    "cesario-lange": { latitude: -23.2247, longitude: -47.9546 },
    olimpia: { latitude: -20.7372, longitude: -48.9111 },
    "campos-do-jordao": { latitude: -22.7408, longitude: -45.5944 },
    "praia-do-forte": { latitude: -12.5746, longitude: -38.005 },
    "porto-de-galinhas": { latitude: -8.5065, longitude: -35.006 },
    maragogi: { latitude: -9.0127, longitude: -35.2214 },
    "foz-do-iguacu": { latitude: -25.5165, longitude: -54.5854 },
    gramado: { latitude: -29.3746, longitude: -50.8764 },
    "beto-carrero-penha": { latitude: -26.7744, longitude: -48.6437 },
    "buenos-aires": { latitude: -34.6037, longitude: -58.3821 },
    orlando: { latitude: 28.5384, longitude: -81.3789 }
  };
  return bySlug[String(slug || "").trim()] || null;
}

function fallbackRouteGeoPoints(hotspot) {
  const start = SAO_PAULO_CENTER;
  const end = hotspot.coordinates || approximateDestinationCoordinates(hotspot.bestHotel);
  const distance = haversineKm(start, end);
  const steps = distance > 600 ? 9 : 7;
  const curve = end.longitude > start.longitude ? -0.18 : 0.18;
  return Array.from({ length: steps }, (_, index) => {
    const t = index / (steps - 1);
    const bend = Math.sin(Math.PI * t) * curve;
    return {
      latitude: start.latitude + (end.latitude - start.latitude) * t + bend,
      longitude: start.longitude + (end.longitude - start.longitude) * t - bend * .6
    };
  });
}

function projectRoutePoints(points) {
  const lats = points.map(point => Number(point.latitude));
  const lngs = points.map(point => Number(point.longitude));
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(.01, maxLat - minLat);
  const lngRange = Math.max(.01, maxLng - minLng);
  return points.map(point => ({
    x: 10 + ((Number(point.longitude) - minLng) / lngRange) * 80,
    y: 88 - ((Number(point.latitude) - minLat) / latRange) * 76
  }));
}

function buildRouteStops(hotspot, geoPoints, svgPoints) {
  const summary = buildRoutePreviewSummary(hotspot);
  const stopCount = Math.max(1, Number.parseInt(summary.stopLabel, 10) || 1);
  const templates = routeStopTemplates(hotspot, stopCount);
  return templates.map(template => ({
    ...template,
    svg: pointAtRouteProgress(svgPoints, template.progress),
    geo: pointAtRouteProgress(projectGeoLikePoints(geoPoints), template.progress)
  }));
}

function projectGeoLikePoints(points) {
  return points.map(point => ({ x: Number(point.longitude), y: Number(point.latitude) }));
}

function routeStopTemplates(hotspot, stopCount) {
  const routeMinutes = travelBurden(hotspot.bestHotel);
  const highSeason = hotspot.bestHotel.destinationSlug === "litoral-norte-sp" || hotspot.bestHotel.destinationSlug === "olimpia";
  const stops = [
    {
      kind: "bathroom",
      kindLabel: "banheiro e alongamento",
      label: "Pausa curta planejada",
      message: "Bom ponto para banheiro, troca e agua antes de a crianca cansar.",
      progress: routeMinutes <= 90 ? .46 : .28
    },
    {
      kind: "fuel",
      kindLabel: "posto de gasolina",
      label: "Abastecer sem pressa",
      message: "Melhor resolver combustivel e lanchinho antes do trecho mais longo.",
      progress: .42
    },
    {
      kind: "restaurant",
      kindLabel: "restaurante kids-friendly",
      label: "Comida facil no caminho",
      message: "Procure parada com refeicao simples, fraldario ou area aberta.",
      progress: routeMinutes > 140 ? .58 : .72
    },
    {
      kind: "toll",
      kindLabel: "pedagio",
      label: "Pedagio e ritmo da estrada",
      message: highSeason ? "Em feriados, esse trecho pode ter transito." : "Trecho bom para manter previsibilidade e evitar paradas improvisadas.",
      progress: .68
    },
    {
      kind: "health",
      kindLabel: "farmacia/hospital",
      label: "Chegada com apoio por perto",
      message: "Chegada proxima: veja restaurantes e farmacias por perto.",
      progress: .88
    }
  ];
  if (routeMinutes <= 90) return [stops[0], stops[4]];
  if (stopCount <= 2) return [stops[0], stops[3], stops[4]];
  return stops;
}

function buildRoutePreviewSummary(hotspot) {
  const route = mapRouteStats(
    { key: hotspot.key, hotels: hotspot.hotels, bestHotel: hotspot.bestHotel, imageKey: imageKeyForHotelDestination(hotspot.bestHotel) },
    hotspot.bestHotel,
    googleCoverageForRecommendation({ key: hotspot.key, bestHotel: hotspot.bestHotel, imageKey: imageKeyForHotelDestination(hotspot.bestHotel), name: hotspot.name }),
    liveSummaryForRecommendation({ key: hotspot.key, bestHotel: hotspot.bestHotel, imageKey: imageKeyForHotelDestination(hotspot.bestHotel), name: hotspot.name })
  );
  const minutes = route.driveMinutes || travelBurden(hotspot.bestHotel);
  const stops = recommendedRouteStopCount(minutes, state.mapFilters.childAges);
  const stress = routeStressLevel({
    isRoadTrip: route.isRoadTrip,
    oneWayKm: route.oneWayKm || 0,
    driveMinutes: minutes,
    transferMinutes: hotspot.bestHotel.transferMinutes
  });
  return {
    timeLabel: route.timeLabel,
    distanceLabel: route.distanceLabel,
    stopLabel: `${stops} ${stops === 1 ? "parada" : "paradas"}`,
    effortLabel: familyRouteEffortLabel(stress.level, minutes),
    bestDeparture: bestFamilyDepartureTime(minutes),
    alert: routeHolidayAlert(hotspot, minutes)
  };
}

function recommendedRouteStopCount(minutes, childAges = []) {
  const hasBaby = childAges.some(age => /0 a 12 meses|1 a 2 anos/i.test(age));
  if (minutes <= 80) return hasBaby ? 1 : 0;
  if (minutes <= 150) return hasBaby ? 2 : 1;
  if (minutes <= 240) return hasBaby ? 3 : 2;
  return hasBaby ? 4 : 3;
}

function familyRouteEffortLabel(level, minutes) {
  if (level === "easy") return "leve, bom para primeira viagem";
  if (level === "medium" || level === "moderate") return minutes > 150 ? "moderado, exige pausa real" : "moderado e previsivel";
  return "alto, planeje sono e paradas";
}

function bestFamilyDepartureTime(minutes) {
  if (minutes <= 90) return "apos cafe, sem correr";
  if (minutes <= 180) return "entre 7h e 8h30";
  return "bem cedo, com primeira pausa combinada";
}

function routeHolidayAlert(hotspot, minutes) {
  const sensitive = ["litoral-norte-sp", "guaruja-sp", "olimpia", "gramado", "campos-do-jordao"].includes(hotspot.bestHotel.destinationSlug);
  if (sensitive) return "em feriados, esse trecho pode ter transito";
  if (minutes > 180) return "trecho mais cansativo para criancas pequenas";
  return "normalidade, ainda assim evite saida no pico";
}

function routeStopIcon(kind) {
  return {
    bathroom: "WC",
    restaurant: "R",
    fuel: "P",
    toll: "$",
    health: "+"
  }[kind] || "i";
}

function routePreviewStatusLabel(status) {
  if (status === "loading") return "calculando rota segura";
  if (status === "playing") return "rota em movimento";
  if (status === "paused") return "pausado";
  if (status === "done") return "chegada prevista";
  if (status === "error") return "usando rota estimada";
  return "pronto para simular";
}

function routePreviewMessage(preview, progress) {
  if (state.routePreview.status === "loading") return "Buscando a rota sem expor chave de API no navegador.";
  if (progress < .18) return "Saida de Sao Paulo: o segredo e evitar pressa e pico.";
  if (progress < .42) return "Bom ponto para uma pausa rapida antes de a crianca perder a paciencia.";
  if (progress < .7) return "Trecho mais cansativo para criancas pequenas: vale ter agua, lanche e plano de sono.";
  if (progress < .9) return "Em feriados, confirme transito e deixe margem para check-in.";
  return "Chegada proxima: veja restaurantes e farmacias por perto.";
}

function routeSpeedLabel() {
  return state.routePreview.speed >= 2 ? "Velocidade 2x" : state.routePreview.speed > 1 ? "Velocidade 1.5x" : "Velocidade 1x";
}

function svgPointsAttribute(points) {
  return points.map(point => `${numberLabel(point.x, 2)},${numberLabel(point.y, 2)}`).join(" ");
}

function routeSvgLength(points) {
  return points.slice(1).reduce((sum, point, index) => {
    const previous = points[index];
    return sum + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}

function pointAtRouteProgress(points, progress) {
  const target = routeSvgLength(points) * Math.max(0, Math.min(1, progress));
  let walked = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const segment = Math.hypot(current.x - previous.x, current.y - previous.y);
    if (walked + segment >= target) {
      const t = segment ? (target - walked) / segment : 0;
      return {
        x: previous.x + (current.x - previous.x) * t,
        y: previous.y + (current.y - previous.y) * t
      };
    }
    walked += segment;
  }
  return points[points.length - 1] || { x: 10, y: 88 };
}

function EmptyMapHotspotState() {
  return `<div class="empty-map-state"><strong>Nenhum hotspot com estes filtros.</strong><span>Tente ampliar o deslocamento ou trocar o orcamento para ver destinos com estrutura familiar minima.</span></div>`;
}

function filteredMapHotspots() {
  return buildMapHotspots()
    .filter(hotspot => matchesMapTravelFilter(hotspot))
    .filter(hotspot => matchesMapFitFilter(hotspot))
    .filter(hotspot => matchesMapBudgetFilter(hotspot))
    .slice(0, 16);
}

function buildMapHotspots() {
  const groups = new Map();
  curatedHotels.forEach(hotel => {
    const key = cityKeyForHotel(hotel);
    const current = groups.get(key) || {
      key,
      name: hotel.destination,
      shortName: shortCityName(hotel.destination),
      hotels: [],
      bestScore: 0
    };
    current.hotels.push(hotel);
    current.bestScore = Math.max(current.bestScore, hotel.score || 0);
    groups.set(key, current);
  });
  return [...groups.values()].map(group => {
    const hotels = group.hotels.sort((a, b) => (b.score || 0) - (a.score || 0));
    const bestHotel = hotels[0];
    const itinerary = itineraryForDestinationKey(group.key, bestHotel);
    const recommendation = {
      ...group,
      hotels,
      bestHotel,
      score: Math.min(10, Math.round((bestHotel.score || 0) * 10) / 10),
      imageKey: imageKeyForHotelDestination(bestHotel)
    };
    const experience = experienceForRecommendation(recommendation);
    const liveSummary = liveSummaryForRecommendation(recommendation);
    const googleCoverage = googleCoverageForRecommendation(recommendation);
    const familyScore = destinationFamilyScore(recommendation, liveSummary, experience);
    const route = mapRouteStats(recommendation, bestHotel, googleCoverage, liveSummary);
    const destinationCatalog = destinationCatalogForHotspot(group.key, bestHotel);
    return {
      ...group,
      bestHotel,
      experience,
      familyScore,
      itinerary,
      mapPosition: mapPositionForDestination(bestHotel),
      coordinates: routeDestinationCoordinates(recommendation, bestHotel, googleCoverage),
      routeLabel: route.routeLabel,
      distanceLabel: route.distanceLabel,
      timeLabel: route.timeLabel,
      costRange: mapTripCostRange(recommendation, bestHotel, route),
      bestSeason: destinationCatalog?.bestSeason || buildSeasonNote(recommendation, bestHotel),
      idealAge: bestHotel.idealAge || mapIdealAgeFromChildren(),
      attractions: mapAttractionsForHotspot(experience),
      attentionPoints: mapAttentionPoints(recommendation, bestHotel, itinerary, destinationCatalog),
      priceTier: bestHotel.priceTier || "upscale",
      badgeShort: mapBadgeShort(familyScore.medal),
      reason: mapHotspotReason(group, bestHotel, itinerary)
    };
  }).filter(hotspot => passesFamilyMinimum(hotspot))
    .sort((a, b) => b.familyScore.score - a.familyScore.score || travelBurden(a.bestHotel) - travelBurden(b.bestHotel));
}

function matchesMapTravelFilter(hotspot) {
  const mode = state.mapFilters.travel;
  const burden = travelBurden(hotspot.bestHotel);
  if (mode === "1h") return hotspot.bestHotel.departureMode === "carro" && burden <= 75;
  if (mode === "2h") return hotspot.bestHotel.departureMode === "carro" && burden <= 120;
  if (mode === "4h") return hotspot.bestHotel.departureMode === "carro" && burden <= 240;
  if (mode === "flight") return hotspot.bestHotel.departureMode !== "carro" && !isInternationalHotspot(hotspot);
  if (mode === "international") return isInternationalHotspot(hotspot);
  return true;
}

function matchesMapBudgetFilter(hotspot) {
  const budget = state.mapFilters.budget;
  const hotel = hotspot.bestHotel;
  if (budget === "minimum") return hotel.departureMode === "carro" && travelBurden(hotel) <= 180 && ["budget", "mid", "upscale"].includes(hotel.priceTier);
  if (budget === "economic") return !isInternationalHotspot(hotspot) && hotel.priceTier !== "luxury";
  if (budget === "comfort") return !isInternationalHotspot(hotspot) || hotel.priceTier !== "luxury";
  if (budget === "premium") return ["upscale", "luxury"].includes(hotel.priceTier) || Boolean(hotel.allInclusive);
  return true;
}

function passesFamilyMinimum(hotspot) {
  const hotel = hotspot.bestHotel;
  if ((hotel.score || 0) < 7.2) return false;
  if (hotspot.familyScore.medal === "not-recommended") return false;
  return Boolean(hotel.copaBaby || hotel.copaBaby24h || hotel.kidsPool || hotel.recreation || hotel.kidsClub || hotel.allInclusive || hotel.worksOnRainyDay || hotel.hasKitchenette || hotel.calmBeach);
}

function mapHotspotReason(group, hotel, itinerary) {
  const family = mapFamilyCompositionLabel();
  if (itinerary) return `${group.shortName} e bom para ${family}: funciona como base e pode virar roteiro regional sem trocar de mala todo dia.`;
  if (hotel.driveTimeFromSaoPaulo && hotel.driveTimeFromSaoPaulo <= 120) return `${group.shortName} reduz atrito para ${family}: pouca estrada, hotel como base e volta simples se a rotina apertar.`;
  if (hotel.departureMode !== "carro") return `${group.shortName} entra quando a familia aceita voo para comprar praia, natureza ou experiencia mais marcante.`;
  return `${group.shortName} vale quando a familia quer estrutura e aceita planejar estrada, pausas e refeicoes com mais cuidado.`;
}

function mapRouteStats(recommendation, bestHotel, googleCoverage, liveSummary) {
  const oneWayKm = estimateOneWayKm(recommendation, bestHotel, googleCoverage);
  const driveMinutes = Number(liveSummary?.sp_drive_minutes || bestHotel.driveTimeFromSaoPaulo || estimateDriveMinutes(oneWayKm) || 0);
  if (bestHotel.departureMode === "carro" || oneWayKm) {
    const distanceLabel = oneWayKm ? `${oneWayKm} km` : "distancia a validar";
    const timeLabel = formatMinutesLabel(driveMinutes);
    return {
      oneWayKm,
      driveMinutes,
      isRoadTrip: true,
      distanceLabel,
      timeLabel,
      routeLabel: `${distanceLabel} | ${timeLabel}`
    };
  }
  const transfer = bestHotel.transferMinutes || 0;
  return {
    oneWayKm: 0,
    driveMinutes: 0,
    isRoadTrip: false,
    distanceLabel: bestHotel.recommendedAirport || "voo a consultar",
    timeLabel: transfer ? `traslado ${transfer} min` : "traslado a validar",
    routeLabel: transfer ? `voo curto + ${transfer} min` : "voo + traslado"
  };
}

function mapTripCostRange(recommendation, bestHotel, route) {
  const nights = mapBudgetNights();
  const people = mapFamilySize();
  const hotels = recommendation.hotels || [bestHotel];
  const nightlyAverage = Math.round(hotels.reduce((sum, hotel) => sum + nightlyEstimateForHotel(hotel), 0) / Math.max(1, hotels.length));
  const lodging = nightlyAverage * nights;
  const food = foodDailyEstimate(bestHotel, people) * nights;
  const road = route.isRoadTrip ? tollRoundTripEstimate(recommendation, bestHotel) + Math.round(((route.oneWayKm || 0) * 2 / SUV_KM_PER_LITER) * GASOLINE_BRL_PER_LITER) : people * mapFlightCostEstimate(bestHotel);
  const total = Math.round((lodging + food + road) * mapBudgetMultiplier());
  const min = Math.round(total * .85);
  const max = Math.round(total * 1.22);
  return {
    short: formatMoneyEstimate(min),
    label: `${formatMoneyEstimate(min)} a ${formatMoneyEstimate(max)}`,
    detail: `${nights} noites | ${people} pessoas | ${mealPlanLabel(bestHotel)}`
  };
}

function mapBudgetNights() {
  if (state.mapFilters.travel === "1h") return 2;
  if (state.mapFilters.travel === "international") return 6;
  if (state.mapFilters.travel === "flight") return 4;
  return 3;
}

function mapBudgetMultiplier() {
  return {
    minimum: .78,
    economic: .9,
    comfort: 1.08,
    premium: 1.35
  }[state.mapFilters.budget] || 1;
}

function mapFlightCostEstimate(bestHotel) {
  if (isInternationalSlug(bestHotel.destinationSlug)) return 2800;
  return bestHotel.transferMinutes && bestHotel.transferMinutes <= 70 ? 980 : 1250;
}

function mapAttractionsForHotspot(experience) {
  const items = experience?.attractions || [];
  if (items.length) return items.slice(0, 3).map(item => item.name || item.familyNote || item);
  return ["passeio leve em familia", "restaurantes e apoio local", "programa para dias de chuva a validar"];
}

function mapAttentionPoints(recommendation, bestHotel, itinerary, destinationCatalog) {
  const items = [
    bestHotel.attentionPoint,
    itinerary?.avoidWhen,
    ...(destinationCatalog?.attentionPoints || [])
  ].filter(Boolean);
  return unique(items).slice(0, 3).length
    ? unique(items).slice(0, 3)
    : ["validar berco, refeicoes e horarios", "evitar chegada tarde", "confirmar disponibilidade antes de reservar"];
}

function destinationCatalogForHotspot(key, bestHotel) {
  const keys = new Set([key, bestHotel.destinationSlug, bestHotel.destinationKey, imageKeyForHotelDestination(bestHotel)].filter(Boolean));
  return conciergeDestinations.find(destination => keys.has(destination.slug) || keys.has(destination.key) || keys.has(slugifyText(destination.name)));
}

function isInternationalHotspot(hotspot) {
  return isInternationalSlug(hotspot.bestHotel.destinationSlug) || /orlando|buenos|argentina|fl/i.test([hotspot.key, hotspot.name, hotspot.bestHotel.destination].join(" "));
}

function isInternationalSlug(slug) {
  return ["orlando", "buenos-aires"].includes(slug);
}

function mapBadgeShort(medal) {
  if (medal === "gold") return "Padrao Ouro";
  if (medal === "silver") return "Padrao Prata";
  return "Padrao Bronze";
}

function mapFamilySize() {
  return (Number.parseInt(state.mapFilters.adults, 10) || 2) + (Number.parseInt(state.mapFilters.children, 10) || 0);
}

function mapFamilyCompositionLabel() {
  const adults = Number.parseInt(state.mapFilters.adults, 10) || 2;
  const children = Number.parseInt(state.mapFilters.children, 10) || 0;
  if (!children) return `${adults} adulto${adults > 1 ? "s" : ""}`;
  return `${adults} adulto${adults > 1 ? "s" : ""} e ${children} crianca${children > 1 ? "s" : ""}`;
}

function mapIdealAgeFromChildren() {
  const ages = state.mapFilters.childAges || [];
  if (ages.includes("0 a 12 meses")) return "bebes, com rotina preservada";
  if (ages.includes("1 a 2 anos")) return "toddlers e criancas pequenas";
  if (ages.includes("3 a 5 anos")) return "3 a 5 anos";
  return "criancas maiores";
}

function mapOriginShortLabel() {
  const origin = String(state.mapFilters.origin || "Grande SP").trim();
  return origin.length > 18 ? `${origin.slice(0, 16)}...` : origin;
}

function mapDiscoverySummary() {
  const travel = {
    "1h": "ate 1h",
    "2h": "ate 2h",
    "4h": "ate 4h",
    flight: "voo curto",
    international: "internacional"
  }[state.mapFilters.travel] || "deslocamento flexivel";
  const budget = {
    minimum: "minimo possivel",
    economic: "economico",
    comfort: "confortavel",
    premium: "premium"
  }[state.mapFilters.budget] || "orcamento flexivel";
  return `${mapFamilyCompositionLabel()} | ${travel} | ${budget}`;
}

function mapDisplacementAnswerLabel() {
  return {
    "1h": "Ate 2h de carro",
    "2h": "Ate 2h de carro",
    "4h": "Ate 4h de carro",
    flight: "Voo direto e traslado ate 1h",
    international: "Aceito mais logistica se valer muito"
  }[state.mapFilters.travel] || "Ate 2h de carro";
}

function syncMapFiltersToIntakeDraft() {
  const children = Math.max(0, Math.min(4, Number.parseInt(state.mapFilters.children, 10) || 0));
  state.intakeDraft.adultsCount = state.mapFilters.adults || "2";
  state.intakeDraft.childrenCount = String(children);
  state.intakeDraft.childAges = Array.from({ length: children }, (_, index) => state.mapFilters.childAges[index] || "1 a 2 anos");
  state.intakeDraft.tripDuration = state.mapFilters.travel === "1h" ? "2 noites" : state.mapFilters.travel === "international" ? "6+ noites" : state.mapFilters.travel === "flight" ? "4 a 5 noites" : "3 noites";
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
  const remaining = conciergeQuizQuestions.length - state.quizIndex - 1;
  return `
      <div class="quiz-card compact-quiz assistant-quiz">
        <div class="quiz-top">
          <span>Assistente Concierge · ${state.quizIndex + 1}/${conciergeQuizQuestions.length}${remaining ? ` · faltam ${remaining}` : " · última"}</span>
          <div class="progress"><i style="width:${progress}%"></i></div>
        </div>
        <div class="assistant-thread">
          ${AssistantAnswerHistory()}
          <div class="assistant-message">
            <span>Concierge da Família</span>
            <h3>${escapeHtml(question.question)}</h3>
            ${question.help ? `<p class="question-help">${escapeHtml(question.help)}</p>` : ""}
          </div>
        </div>
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

function AssistantAnswerHistory() {
  return conciergeQuizQuestions.slice(0, state.quizIndex).map(question => {
    const answer = state.answers[question.id];
    if (!answer || (Array.isArray(answer) && !answer.length)) return "";
    const value = Array.isArray(answer) ? answer.join(", ") : answer;
    return `
      <div class="assistant-history-row">
        <small>${escapeHtml(question.question)}</small>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }).join("");
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
        <p>${escapeHtml(shortResultProfile(result.profile))}</p>
        <div class="viral-score-grid">
          ${MetricCard("Índice Sem Perrengue", `${result.semPerrengue.score}/100`, result.semPerrengue.label)}
          ${MetricCard("Fit Financeiro", result.financialFit.label, result.financialFit.detail)}
          ${MetricCard("Esforço logístico", result.travelEffort.label, result.travelEffort.detail)}
        </div>
        ${TravelTimingResultPanel()}
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
        <div class="result-next-step">
          <strong>Próximo passo: escolha a cidade.</strong>
          <span>Trago só as 3 melhores. Hotel vem depois.</span>
          <a class="button primary compact-button" href="#recomendacoes">Ver minhas 3 cidades</a>
        </div>
        ${ExcellenceCriteriaPanel()}
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

function shortResultProfile(text) {
  return String(text || "").split(".").filter(Boolean).slice(0, 1).join(".").trim() || text || "";
}

function TravelTimingResultPanel() {
  const timing = travelTimingInsight();
  return `
    <div class="travel-timing-result" aria-label="Periodo desejado para a viagem">
      <div>
        <span class="eyebrow">Quando voces querem ir</span>
        <strong>${escapeHtml(timing.label)}</strong>
      </div>
      <div>
        <span>Clima esperado</span>
        <b>${escapeHtml(timing.climate)}</b>
      </div>
      <div>
        <span>Eventos e movimento</span>
        <b>${escapeHtml(timing.events)}</b>
      </div>
    </div>
  `;
}

function ExcellenceCriteriaPanel() {
  return `
    <details class="criteria-transparency" aria-label="Critérios de curadoria de excelência">
      <summary>Como calculamos os selos de curadoria</summary>
      <div class="criteria-title">
        <p>Selo não é publicidade: é uma leitura de risco familiar com dados reais, curadoria e IA.</p>
      </div>
      <div class="criteria-grid">
        ${CriteriaItem("Ouro", "Experiência Família Excelente", "baixa fricção, boa estrutura infantil e poucos alertas.")}
        ${CriteriaItem("Prata", "Muito bom para Famílias", "boa escolha, com pontos simples para confirmar.")}
        ${CriteriaItem("Bronze", "Muito bom para famílias", "funciona, mas pede mais planejamento.")}
      </div>
      <div class="criteria-factors">
        <span><b>Dados</b> Google Places, rotas, hotéis curados, fotos, avaliações e Supabase.</span>
        <span><b>Pesos</b> idade, distância, alimentação, estrutura infantil, clima, eventos e custo.</span>
        <span><b>Bloqueio</b> hotel sem mínimo familiar não vira recomendado.</span>
      </div>
    </details>
  `;
}

function CriteriaItem(level, title, text) {
  return `
    <div>
      <strong>${escapeHtml(level)}</strong>
      <b>${escapeHtml(title)}</b>
      <span>${escapeHtml(text)}</span>
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
            <p>${escapeHtml(shareableProfilePunchline(result.profileName))} · Índice Sem Perrengue: ${result.semPerrengue.score}/100</p>
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
            ${ProfileBar("Família Resort Raiz, Pulseirinha e Paz", 32)}
            ${ProfileBar("Família Hotel Fazenda, Mesa Farta e Soneca", 24)}
            ${ProfileBar("Família Praia com Plano B", 18)}
            ${ProfileBar("Família Boa Memória, Sem Loucura", 14)}
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

function shareableProfilePunchline(profileName) {
  const punchlines = {
    "Família Resort Raiz, Pulseirinha e Paz": "Seu lema: check-in feito, criança feliz, adulto respirando",
    "Família Praia com Plano B": "Sol, água e uma saída honrosa se chover",
    "Família Hotel Fazenda, Mesa Farta e Soneca": "Natureza, comida boa e a esperança de uma soneca sincronizada",
    "Família Mini Aventureira, Mochila Leve": "Passeio sim, maratona de perrengue não",
    "Família Parque & Pausa Programada": "Encantamento com intervalo oficial para todo mundo voltar a ser gente",
    "Família Boa Memória, Sem Loucura": "Memória boa, roteiro esperto e zero vontade de complicar",
    "Família Zero Perrengue, Checklist no Bolso": "Previsibilidade no bolso e improviso só se for divertido"
  };
  return punchlines[profileName] || "Viagem boa começa com menos perrengue";
}

function FriendReferralSection() {
  const hasResult = Boolean(state.result);
  const title = hasResult
    ? "Tem amigos pais que tambem estao escolhendo viagem?"
    : "Indique o Concierge da Familia para outros pais";
  const text = hasResult
    ? "Envie seu achado para outro pai ou mae fazer o diagnostico em 2 minutos."
    : "Compartilhe a ferramenta com uma familia que esta tentando escolher destino sem perrengue.";
  return `
    <section class="section referral-section" id="indicar-amigos">
      <div class="referral-box">
        <div>
          <span class="badge subtle">Indique para amigos</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(text)} O link vai com uma referencia anonima da sessao para medirmos quais indicacoes estao trazendo novas familias.</p>
        </div>
        <div class="referral-actions">
          <a class="button primary referral-whatsapp" href="${escapeAttr(whatsappShareUrl(friendReferralMessage()))}" target="_blank" rel="noopener" data-action="friend-referral-whatsapp">Enviar pelo WhatsApp</a>
          <button class="button secondary" type="button" data-action="copy-referral-link">Copiar link</button>
        </div>
      </div>
    </section>
  `;
}

function DestinationRecommendationsSection() {
  const recommendations = buildDestinationRecommendations();
  const visibleRecommendations = state.showMoreDestinations ? recommendations : recommendations.slice(0, 3);
  return `
    <section class="section destination-recommendations" id="recomendacoes">
      <div class="section-title">
        <span class="badge subtle">Decisão de mãe: primeiro o destino</span>
        <h2>As 3 cidades que eu avaliaria primeiro.</h2>
        <p>Direto ao ponto: prazer da viagem, custo, época e logística.</p>
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
  const experience = experienceForRecommendation(recommendation);
  const liveSummary = liveSummaryForRecommendation(recommendation);
  const familyScore = destinationFamilyScore(recommendation, liveSummary, experience);
  const googleCoverage = googleCoverageForRecommendation(recommendation);
  return `
    <article class="recommendation-card ${active ? "active" : ""}">
      <div class="recommendation-rank">
        <span>${index + 1}</span>
        <strong>${familyScore.score}</strong>
        <small>/100</small>
      </div>
      ${DestinationPhotoGallery(recommendation)}
      <div class="recommendation-copy">
        <div class="family-score-line">
          ${FamilyMedalBadge(familyScore)}
          <span class="eyebrow">${escapeHtml(recommendation.familyFit)}</span>
        </div>
        <h3>${escapeHtml(recommendation.name)}</h3>
        <p>${escapeHtml(recommendation.reason)}</p>
        ${DestinationFactModules(recommendation, liveSummary, experience, googleCoverage)}
        ${DestinationRouteSketch(recommendation, liveSummary, googleCoverage)}
        <button class="button primary hotel-availability-cta" data-action="select-destination-recommendation" data-destination-key="${escapeAttr(recommendation.key)}">
          ${active ? "Hotéis e disponibilidade abertos abaixo" : `Ver hotéis e disponibilidade em ${escapeHtml(recommendation.shortName)}`}
        </button>
        ${FamilyItinerarySuggestion(recommendation)}
        ${experience ? DestinationExperiencePreview(experience) : ""}
      </div>
    </article>
  `;
}

function FamilyMedalBadge(score) {
  return `<span class="family-medal ${escapeAttr(score.medal)}">${escapeHtml(familyMedalDisplayLabel(score.medal, score.label))}</span>`;
}

function familyMedalDisplayLabel(medal, fallback = "") {
  if (medal === "gold") return "Ouro - Experiência Família Excelente";
  if (medal === "silver") return "Prata - Muito bom para Famílias";
  if (medal === "bronze") return "Bronze - Muito bom para famílias";
  return fallback || "Não recomendar";
}

function DestinationFactModules(recommendation, liveSummary, experience, googleCoverage) {
  const facts = destinationDecisionFacts(recommendation, liveSummary, experience, googleCoverage);
  return `
    <div class="destination-fact-modules" aria-label="Dados objetivos para escolher ${escapeAttr(recommendation.name)}">
      ${DecisionFact("Cal", "Epoca", facts.timing.primary, facts.timing.detail)}
      ${DecisionFact("Fluxo", "Lotacao", facts.crowd.primary, facts.crowd.detail)}
      ${DecisionFact("🛣️", "Logística", facts.logistics.primary, facts.logistics.detail)}
      ${DecisionFact("💰", "Custo total", facts.cost.primary, facts.cost.detail)}
    </div>
  `;
}

function DestinationRouteSketch(recommendation, liveSummary, googleCoverage) {
  const bestHotel = recommendation.bestHotel || {};
  const oneWayKm = estimateOneWayKm(recommendation, bestHotel, googleCoverage);
  const driveMinutes = Number(liveSummary?.sp_drive_minutes || bestHotel.driveTimeFromSaoPaulo || estimateDriveMinutes(oneWayKm) || 0);
  const isRoadTrip = Boolean(bestHotel.driveTimeFromSaoPaulo || (oneWayKm > 0 && oneWayKm <= 360));
  const stress = routeStressLevel({ isRoadTrip, oneWayKm, driveMinutes, transferMinutes: bestHotel.transferMinutes });
  const distanceWidth = isRoadTrip ? Math.max(18, Math.min(92, Math.round((oneWayKm / 450) * 100))) : 72;
  const modeLabel = isRoadTrip ? "carro saindo de SP" : `voo + traslado ${bestHotel.transferMinutes || "?"} min`;
  const timeLabel = isRoadTrip ? formatMinutesLabel(driveMinutes) : bestHotel.recommendedAirport || "aeroporto a definir";
  return `
    <div class="route-sketch route-${escapeAttr(stress.level)}" aria-label="Mapa esquematico do deslocamento para ${escapeAttr(recommendation.name)}">
      <div class="route-sketch-map">
        <span class="route-node origin">SP</span>
        <span class="route-line" style="--route-width:${distanceWidth}%"><i></i></span>
        <span class="route-node destination">${escapeHtml(recommendation.shortName.slice(0, 3).toUpperCase())}</span>
      </div>
      <div class="route-sketch-copy">
        <strong>${escapeHtml(stress.label)}</strong>
        <span>${escapeHtml(isRoadTrip ? `${oneWayKm} km · ${timeLabel}` : modeLabel)}</span>
        <small>${escapeHtml(stress.detail)}</small>
        <a href="${escapeAttr(googleMapsDirectionsUrl(recommendation.name))}" target="_blank" rel="noopener" data-track="route_map_clicked" data-source="destination_result" data-destination="${escapeAttr(recommendation.name)}">Abrir rota no Maps</a>
      </div>
    </div>
  `;
}

function googleMapsDirectionsUrl(destinationName) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", "Sao Paulo, SP");
  url.searchParams.set("destination", destinationName);
  return url.toString();
}

function FamilyItinerarySuggestion(recommendation) {
  const itinerary = itineraryForRecommendation(recommendation);
  if (!itinerary) return "";
  const nights = tripNights(state.answers.trip_duration);
  const plan = itineraryPlanForNights(itinerary, nights);
  const canCombine = nights >= itinerary.minNights;
  const stops = itinerary.stops.slice(0, 3);
  return `
    <div class="family-itinerary-card ${canCombine ? "can-combine" : "single-base"}">
      <div class="itinerary-head">
        <span class="badge subtle">${canCombine ? "Roteiro combinavel" : "Melhor base unica"}</span>
        <strong>${escapeHtml(itinerary.title)}</strong>
      </div>
      <p>${escapeHtml(plan.recommendation)}</p>
      <div class="itinerary-route-facts">
        ${itinerary.routeFacts.slice(0, 2).map(fact => `
          <span><b>${escapeHtml(fact.label)}</b>${escapeHtml(fact.value)}</span>
        `).join("")}
      </div>
      <div class="itinerary-stops">
        ${stops.map(stop => `
          <span>
            <b>${escapeHtml(stop.name)}</b>
            <small>${escapeHtml(stop.role)} · ${escapeHtml(stop.familyReason)}</small>
          </span>
        `).join("")}
      </div>
      <small>${escapeHtml(canCombine ? itinerary.baseStrategy : itinerary.avoidWhen)}</small>
    </div>
  `;
}

function itineraryForRecommendation(recommendation) {
  const keys = new Set(liveSlugCandidates(recommendation));
  keys.add(recommendation.key);
  keys.add(recommendation.imageKey);
  keys.add(recommendation.bestHotel?.destinationSlug);
  return conciergeFamilyItineraries.find(itinerary =>
    itinerary.primaryDestinationKeys.some(key => keys.has(key))
  );
}

function itineraryPlanForNights(itinerary, nights) {
  if (nights <= 2) return itinerary.dayPlans.find(plan => plan.nights.includes("1 a 2")) || itinerary.dayPlans[0];
  if (nights <= 4) return itinerary.dayPlans.find(plan => plan.nights.includes("3 a 4") || plan.nights.includes("4 a 5")) || itinerary.dayPlans[1] || itinerary.dayPlans[0];
  return itinerary.dayPlans.find(plan => plan.nights.includes("5+") || plan.nights.includes("6+")) || itinerary.dayPlans[itinerary.dayPlans.length - 1];
}

function routeStressLevel({ isRoadTrip, oneWayKm, driveMinutes, transferMinutes }) {
  if (!isRoadTrip) {
    const transfer = Number(transferMinutes || 0);
    if (transfer && transfer <= 60) return { level: "easy", label: "Voo simples", detail: "traslado curto ajuda a preservar rotina" };
    if (transfer && transfer <= 100) return { level: "medium", label: "Voo com atencao", detail: "controle horario de chegada e transfer" };
    return { level: "hard", label: "Logistica sensivel", detail: "voo e traslado pedem margem real" };
  }
  if (oneWayKm <= 90 || driveMinutes <= 90) return { level: "easy", label: "Rota leve", detail: "boa para primeira viagem ou fim de semana" };
  if (oneWayKm <= 180 || driveMinutes <= 180) return { level: "medium", label: "Rota moderada", detail: "planeje saida fora do pico e uma parada" };
  return { level: "hard", label: "Rota longa", detail: "exige paradas reais e chegada sem pressa" };
}

function DecisionFact(icon, label, primary, detail) {
  return `
    <div class="decision-fact">
      <span aria-hidden="true">${icon}</span>
      <b>${escapeHtml(label)}</b>
      <strong>${escapeHtml(primary)}</strong>
      <small>${escapeHtml(detail)}</small>
    </div>
  `;
}

function destinationDecisionFacts(recommendation, liveSummary, experience, googleCoverage) {
  const bestHotel = recommendation.bestHotel || {};
  const hotels = recommendation.hotels || [];
  const oneWayKm = estimateOneWayKm(recommendation, bestHotel, googleCoverage);
  const driveMinutes = Number(liveSummary?.sp_drive_minutes || bestHotel.driveTimeFromSaoPaulo || 0);
  const isRoadTrip = Boolean(bestHotel.driveTimeFromSaoPaulo || (oneWayKm > 0 && oneWayKm <= 360));
  const tollRoundTrip = isRoadTrip ? tollRoundTripEstimate(recommendation, bestHotel) : 0;
  const fuelRoundTrip = isRoadTrip ? Math.round((oneWayKm * 2 / SUV_KM_PER_LITER) * GASOLINE_BRL_PER_LITER) : 0;
  const nightlyAverage = Math.round(hotels.reduce((sum, hotel) => sum + nightlyEstimateForHotel(hotel), 0) / Math.max(1, hotels.length));
  const nights = tripNights(state.answers.trip_duration);
  const familyPeople = familySize(state.intake || {});
  const foodDaily = foodDailyEstimate(bestHotel, familyPeople);
  const lodgingTotal = nightlyAverage * Math.max(1, nights || 1);
  const foodTotal = foodDaily * Math.max(1, nights || 1);
  const roadTotal = isRoadTrip ? tollRoundTrip + fuelRoundTrip : 0;
  const tripTotal = lodgingTotal + foodTotal + roadTotal;
  const restaurants = experience?.restaurants?.length || 0;
  const attractions = experience?.attractions?.length || 0;
  const googleRating = averageGoogleHotelRating(hotels);
  const timing = destinationTimingInsight(recommendation, bestHotel, liveSummary);
  const crowd = destinationCrowdInsight(liveSummary);
  return {
    logistics: {
      primary: isRoadTrip
        ? `${oneWayKm} km · ${formatMinutesLabel(driveMinutes || estimateDriveMinutes(oneWayKm))}`
        : `voo + traslado ${bestHotel.transferMinutes || "?"} min`,
      detail: isRoadTrip
        ? `Centro de SP como referência; pedágio ~${formatMoneyEstimate(tollRoundTrip)} ida e volta`
        : `Saída: ${bestHotel.recommendedAirport || "aeroporto a definir"}`
    },
    timing: {
      primary: timing.primary,
      detail: timing.detail
    },
    crowd: {
      primary: crowd.primary,
      detail: crowd.detail
    },
    cost: {
      primary: isRoadTrip
        ? `${formatMoneyEstimate(tripTotal)} est.`
        : `${priceTierLabel(bestHotel.priceTier)} + aéreo`,
      detail: isRoadTrip
        ? `SUV: combustível ~${formatMoneyEstimate(fuelRoundTrip)}; diária média ~${formatMoneyEstimate(nightlyAverage)}`
        : `diária média ~${formatMoneyEstimate(nightlyAverage)}; aéreo varia por data`
    },
    food: {
      primary: mealPlanLabel(bestHotel),
      detail: foodDaily
        ? `alimentação extra ~${formatMoneyEstimate(foodDaily)}/dia para a família`
        : "sem custo extra relevante de refeição no hotel"
    },
    safety: {
      primary: googleRating ? `Google ${numberLabel(googleRating, 1)}` : "base validada",
      detail: bestHotel.copaBaby || bestHotel.copaBaby24h
        ? "tem apoio claro para bebê na curadoria"
        : "confirmar berço, farmácia e atendimento antes da reserva"
    },
    entertainment: {
      primary: `${attractions || "3+"} atrações · ${restaurants || "3+"} restaurantes`,
      detail: bestHotel.worksOnRainyDay
        ? "tem plano B para chuva/rotina dentro do hotel"
        : "depende mais de agenda externa e clima"
    }
  };
}

function FamilyDecisionSummary(score) {
  return `
    <div class="family-score-summary">
      <div><b>Family Trip Score</b><span>${score.score}/100 · ${escapeHtml(score.verdict)}</span></div>
      <div><b>Risco de perrengue</b><span>${escapeHtml(score.riskLabel)}</span></div>
    </div>
  `;
}

function FamilyInfrastructurePanel(recommendation, liveSummary, experience) {
  const score = familyInfrastructureScore(recommendation, liveSummary, experience);
  const restaurantCount = experience?.restaurants?.length || 0;
  const attractionCount = experience?.attractions?.length || 0;
  const hotelCount = Number(liveSummary?.bookable_hotels) || recommendation.hotels.length;
  return `
    <div class="family-infra-panel">
      <div>
        <b>Family Infrastructure Score</b>
        <strong>${score}/100</strong>
      </div>
      <p>${escapeHtml(familyInfrastructureCopy(score, liveSummary))}</p>
      <div class="infra-grid">
        <span><b>${hotelCount}</b> hospedagens analisadas</span>
        <span><b>${restaurantCount}</b> restaurantes familiares</span>
        <span><b>${attractionCount}</b> atrações locais</span>
        <span><b>${liveSummary?.sp_drive_text_traffic || liveSummary?.sp_drive_text || "rota em validação"}</b> saindo de SP</span>
      </div>
    </div>
  `;
}

function LiveDestinationSignals(summary) {
  const googleLabel = summary.google_rating
    ? `${numberLabel(summary.google_rating, 1)} Google · ${numberLabel(summary.google_ratings_total, 0)} avaliações`
    : "Google em validação";
  const routeLabel = summary.sp_drive_text_traffic || summary.sp_drive_text || summary.sp_distance_text || "rota em validação";
  const movementLabel = summary.movimento_level
    ? `${summary.movimento_level}${summary.event_count ? ` · ${summary.event_count} eventos` : ""}`
    : "movimento em validação";
  const hotelLabel = summary.bookable_hotels
    ? `${summary.bookable_hotels} hotéis LiteAPI${summary.avg_guest_rating ? ` · média ${numberLabel(summary.avg_guest_rating, 1)}` : ""}`
    : "hotéis em validação";
  return `
    <div class="live-signals" aria-label="Dados vivos do destino">
      <span class="badge subtle">Dados vivos</span>
      <div><b>Nota local</b><span>${escapeHtml(googleLabel)}</span></div>
      <div><b>Saindo de SP</b><span>${escapeHtml(routeLabel)}</span></div>
      <div><b>Movimento</b><span>${escapeHtml(movementLabel)}</span></div>
      <div><b>Hospedagem</b><span>${escapeHtml(hotelLabel)}</span></div>
      ${summary.family_summary ? `<p>${escapeHtml(summary.family_summary)}</p>` : ""}
    </div>
  `;
}

function destinationCrowdInsight(summary) {
  const events = Number(summary?.event_count || 0);
  const attendance = Number(summary?.total_predicted_attendance || 0);
  const level = String(summary?.movimento_level || "").toLowerCase();
  const hasHoliday = Array.isArray(summary?.holiday_windows) && summary.holiday_windows.length > 0;
  const topEvent = Array.isArray(summary?.top_events) ? summary.top_events[0] : null;
  if (level === "movimentado" || events >= 50 || attendance >= 10000) {
    const title = topEvent?.title ? String(topEvent.title) : "";
    const shortTitle = title.length > 34 ? `${title.slice(0, 31)}...` : title;
    return {
      status: "busy",
      primary: "Cidade cheia",
      detail: `${events || "muitos"} eventos mapeados${shortTitle ? `; checar ${shortTitle}` : "; reserve horarios"}`
    };
  }
  if (events >= 12 || attendance >= 2500 || hasHoliday) {
    return {
      status: "attention",
      primary: "Atencao a movimento",
      detail: `${events || "alguns"} eventos/janelas no radar; evite chegar tarde`
    };
  }
  if (level === "tranquilo" || events <= 6) {
    return {
      status: "normal",
      primary: "Dentro da normalidade",
      detail: events ? `${events} eventos mapeados, sem sinal forte de lotacao` : "sem evento forte na base viva"
    };
  }
  return {
    status: "unknown",
    primary: "Movimento a validar",
    detail: "sem leitura suficiente de eventos para esta janela"
  };
}

function GoogleDestinationSignals(place) {
  const photoLabel = place.photos?.length
    ? `${place.photos.length} fotos Google Places`
    : "fotos ainda sem retorno";
  const locationLabel = place.latitude && place.longitude
    ? `${numberLabel(place.latitude, 3)}, ${numberLabel(place.longitude, 3)}`
    : "coordenadas em validacao";
  return `
    <div class="google-trust-panel" aria-label="Validacao Google Places do destino">
      <span class="badge subtle">Google Places</span>
      <div><b>Localidade validada</b><span>${escapeHtml(place.googleName || place.name)}</span></div>
      <div><b>Endereco-base</b><span>${escapeHtml(place.formattedAddress || "endereco em validacao")}</span></div>
      <div><b>Coordenadas</b><span>${escapeHtml(locationLabel)}</span></div>
      <div><b>Fotos reais</b><span>${escapeHtml(photoLabel)}</span></div>
    </div>
  `;
}

function GoogleHotelSignals(place) {
  const ratingLabel = place.rating
    ? `${numberLabel(place.rating, 1)} Google`
    : "nota em validacao";
  const reviewsLabel = place.userRatingCount
    ? `${numberLabel(place.userRatingCount, 0)} avaliacoes`
    : "volume em validacao";
  const photosLabel = place.photos?.length
    ? `${place.photos.length} fotos do Google Place Photos`
    : "foto Google indisponivel";
  return `
    <div class="google-trust-panel hotel-google-panel" aria-label="Dados Google Places do hotel">
      <span class="badge subtle">Google verificado</span>
      <div><b>Nota publica</b><span>${escapeHtml(ratingLabel)} / ${escapeHtml(reviewsLabel)}</span></div>
      <div><b>Endereco</b><span>${escapeHtml(place.formattedAddress || "endereco em validacao")}</span></div>
      <div><b>Contato</b><span>${escapeHtml(place.phoneNumber || "telefone nao retornado")}</span></div>
      <div><b>Fotos reais</b><span>${escapeHtml(photosLabel)}</span></div>
    </div>
  `;
}

function destinationFamilyScore(recommendation, liveSummary, experience) {
  let score = Math.round((recommendation.score || 0) * 10);
  const drive = Number(liveSummary?.sp_drive_minutes || recommendation.bestHotel?.driveTimeFromSaoPaulo || 0);
  const google = Number(liveSummary?.google_rating || 0);
  const avgGuest = Number(liveSummary?.avg_guest_rating || 0);
  const events = Number(liveSummary?.event_count || 0);
  const hotels = Number(liveSummary?.bookable_hotels || recommendation.hotels.length || 0);
  if (drive && drive <= 90) score += 8;
  else if (drive && drive <= 150) score += 4;
  else if (drive && drive > 240) score -= 10;
  if (google >= 4.7) score += 7;
  else if (google >= 4.4) score += 4;
  else if (google && google < 4.1) score -= 8;
  if (avgGuest >= 9) score += 5;
  else if (avgGuest >= 8.5) score += 3;
  if (liveSummary?.movimento_level === "tranquilo") score += 4;
  if (events > 50 || liveSummary?.movimento_level === "movimentado") score -= 4;
  if (hotels >= 5) score += 3;
  if ((experience?.restaurants?.length || 0) >= 3) score += 2;
  if ((experience?.attractions?.length || 0) >= 3) score += 2;
  score = Math.max(0, Math.min(100, score));
  const medal = score >= 84 ? "gold" : score >= 72 ? "silver" : score >= 60 ? "bronze" : "not-recommended";
  return {
    score,
    medal,
    label: medal === "gold" ? "Padrão Ouro" : medal === "silver" ? "Padrão Prata" : medal === "bronze" ? "Padrão Bronze" : "Não recomendar",
    verdict: medal === "gold" ? "excelente escolha" : medal === "silver" ? "boa escolha com poucos alertas" : medal === "bronze" ? "viável, exige planejamento" : "fora do padrão família",
    riskLabel: drive > 240 ? "alto pela logística" : events > 50 ? "moderado por movimento local" : "baixo a moderado"
  };
}

function familyInfrastructureScore(recommendation, liveSummary, experience) {
  let score = 58;
  const drive = Number(liveSummary?.sp_drive_minutes || recommendation.bestHotel?.driveTimeFromSaoPaulo || 0);
  if (drive && drive <= 90) score += 12;
  else if (drive && drive <= 150) score += 8;
  else if (drive && drive > 240) score -= 10;
  score += Math.min(10, (Number(liveSummary?.bookable_hotels) || recommendation.hotels.length || 0) * 2);
  score += Math.min(8, (experience?.restaurants?.length || 0) * 3);
  score += Math.min(8, (experience?.attractions?.length || 0) * 3);
  if (liveSummary?.movimento_level === "tranquilo") score += 6;
  if (liveSummary?.movimento_level === "movimentado") score -= 4;
  if (recommendation.bestHotel?.worksOnRainyDay) score += 5;
  if (recommendation.bestHotel?.allInclusive || recommendation.bestHotel?.hasKitchenette) score += 4;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function familyInfrastructureCopy(score, liveSummary) {
  if (score >= 84) return "Boa estrutura para família: há sinais fortes de logística, hospedagem e plano B para reduzir perrengue.";
  if (score >= 70) return "Estrutura familiar boa, com alguns pontos para validar antes da reserva.";
  if (liveSummary?.movimento_level === "movimentado") return "Estrutura útil, mas o movimento local pede atenção a horários, filas e reservas.";
  return "Estrutura em validação: use esta opção com planejamento extra e confira apoio próximo.";
}

function DestinationExperiencePreview(experience) {
  return `
    <div class="destination-experience">
      <div class="experience-pitch">
        <b>Vale pelo quê</b>
        <span>${escapeHtml(shortSentence(experience.whyVisit))}</span>
      </div>
      <div class="experience-columns">
        ${ExperienceColumn("Gastronomia família", experience.restaurants, "restaurant")}
        ${ExperienceColumn("Atrações locais", experience.attractions, "attraction")}
      </div>
    </div>
  `;
}

function ExperienceColumn(title, items, type) {
  return `
    <div class="experience-column">
      <strong>${escapeHtml(title)}</strong>
      ${items.slice(0, 2).map(item => `
        <a href="${escapeAttr(item.sourceUrl || item.googleMapsUrl || "#")}" target="_blank" rel="noopener" data-track="${type === "restaurant" ? "destination_restaurant_click" : "destination_attraction_click"}" data-source="${escapeAttr(item.source || "curation")}" data-destination="${escapeAttr(item.destination || "")}" data-hotel-id="" data-hotel-name="${escapeAttr(item.name)}">
          <span>${escapeHtml(item.name)}</span>
          <small>${escapeHtml(item.ratingLabel || item.familyNote || "curadoria local")}</small>
        </a>
      `).join("")}
    </div>
  `;
}

function shortSentence(text) {
  return String(text || "").split(".").filter(Boolean).slice(0, 1).join(".").trim() || text || "";
}

function RankedHotelsSection() {
  const ranked = getFilteredRankedHotels();
  const destinationGroups = buildDestinationGroups(ranked);
  const selectedRecommendation = buildDestinationRecommendations().find(item => item.key === state.selectedDestinationKey);
  return `
    <section class="section ranking-section" id="ranking">
      <div class="section-title">
        <span class="badge subtle">Agora sim: hotéis</span>
        <h2>Hotéis aprovados em ${escapeHtml(selectedRecommendation?.name || "destino escolhido")}</h2>
        <p>Compare estrutura infantil, faixa de preço e disponibilidade sem perder o foco.</p>
      </div>
      ${ranked.length ? ConciergeMap(ranked) : ""}
      <button class="button secondary compact-button back-destination-button" data-action="back-to-destinations">Trocar destino</button>
      ${HotelExplorerControls(ranked)}
      ${selectedRecommendation ? LiveHotelCards(selectedRecommendation) : ""}
      ${DestinationSummary(destinationGroups)}
      <div class="ranking-list">
        ${ranked.length ? ranked.map((hotel, index) => RankedHotelCard(hotel, index)).join("") : EmptyHotelState()}
      </div>
    </section>
  `;
}

function LiveHotelCards(recommendation) {
  const liveHotels = liveHotelsForRecommendation(recommendation).slice(0, 3);
  if (!liveHotels.length) return "";
  return `
    <div class="live-hotel-panel">
      <div class="live-panel-title">
        <span class="badge subtle">LiteAPI</span>
        <div>
          <h3>Disponibilidade real encontrada para ${escapeHtml(recommendation.shortName)}</h3>
          <p>Links rastreados. Preço final só na consulta real.</p>
        </div>
      </div>
      <div class="live-hotel-grid">
        ${liveHotels.map(hotel => LiveHotelCard(hotel, recommendation)).join("")}
      </div>
    </div>
  `;
}

function LiveHotelCard(hotel, recommendation) {
  const rating = hotel.liteapi_rating ? `${numberLabel(hotel.liteapi_rating, 1)}/10` : "nota a validar";
  const reviewCount = hotel.review_count ? `${numberLabel(hotel.review_count, 0)} avaliações` : "sem volume de avaliações";
  const stars = hotel.stars ? `${numberLabel(hotel.stars, 1)} estrelas` : "categoria a validar";
  return `
    <article class="live-hotel-card">
      ${TravelImage(hotel.main_photo || hotel.thumbnail, hotel.hotel_name, "Foto do inventário LiteAPI", hotel.main_photo || hotel.thumbnail ? "destination" : "missing")}
      <div>
        <h4>${escapeHtml(hotel.hotel_name)}</h4>
        <p>${escapeHtml(hotel.address || recommendation.name)}</p>
        <div class="tags compact-tags">
          <span>${escapeHtml(rating)}</span>
          <span>${escapeHtml(reviewCount)}</span>
          <span>${escapeHtml(stars)}</span>
        </div>
        <a class="button secondary compact-button" href="${escapeAttr(bookingSearchUrl({ name: hotel.hotel_name, destination: recommendation.name }))}" target="_blank" rel="noopener" data-track="hotel_availability_click" data-source="liteapi_booking_search" data-hotel-id="${escapeAttr(hotel.liteapi_id || "")}" data-hotel-name="${escapeAttr(hotel.hotel_name)}" data-destination="${escapeAttr(recommendation.name)}">Ver disponibilidade</a>
      </div>
    </article>
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
      <div class="route-summary-grid">
        ${rankedHotels.slice(0, 3).map((hotel, index) => MapRouteSummary(hotel, index)).join("")}
      </div>
    </div>
  `;
}

function MapRouteSummary(hotel, index) {
  const isRoadTrip = Boolean(hotel.driveTimeFromSaoPaulo);
  const distance = isRoadTrip ? Math.round((hotel.driveTimeFromSaoPaulo / 60) * 68) : null;
  const stress = routeStressLevel({
    isRoadTrip,
    oneWayKm: distance || 0,
    driveMinutes: hotel.driveTimeFromSaoPaulo || 0,
    transferMinutes: hotel.transferMinutes
  });
  return `
    <div class="route-summary-card route-${escapeAttr(stress.level)}">
      <b>${index + 1}. ${escapeHtml(shortCityName(hotel.destination))}</b>
      <span>${escapeHtml(isRoadTrip ? `${distance} km · ${formatHotelTime(hotel)}` : `voo + traslado ${hotel.transferMinutes || "?"} min`)}</span>
      <small>${escapeHtml(stress.label)}</small>
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
    "bendito-cacao-family-resort": { x: 37, y: 48, label: "Águas" },
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
  const approval = hotel.familyApproval || familyApprovalForHotel(hotel);
  const googleCoverage = googleCoverageForHotel(hotel);
  const officialAvailabilityUrl = hotel.officialSiteUrl || googleCoverage?.websiteUri || hotel.sourceUrl;
  return `
    <article class="ranking-row">
      <span class="rank-number">${index + 1}</span>
      ${TravelImage(hotel.image, hotel.name, hotel.imageNote, hotel.imageConfidence)}
      <div class="ranking-copy">
        <div class="ranking-title">
          <h3>${escapeHtml(hotel.name)}</h3>
          <span>${escapeHtml(hotel.destination)}</span>
        </div>
        <div class="hotel-family-approval">
          ${FamilyMedalBadge(approval)}
          <span>Stay Score ${approval.score}/100</span>
          <span>Baby Comfort ${approval.babyComfort}/100</span>
          <span>Infra ${approval.infrastructure}/100</span>
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
        ${HotelApprovalExplanation(approval)}
        ${googleCoverage ? GoogleHotelSignals(googleCoverage) : ""}
        ${HotelFamilyTestimonials(hotel, googleCoverage)}
        ${hotel.rankingNotes.length ? `<small>${escapeHtml(hotel.rankingNotes.join(" · "))}</small>` : ""}
        <div class="availability-actions">
          <a class="button primary compact-button" href="${escapeAttr(officialAvailabilityUrl)}" target="_blank" rel="noopener" data-track="hotel_availability_click" data-source="official" data-hotel-id="${escapeAttr(hotel.id)}" data-hotel-name="${escapeAttr(hotel.name)}" data-destination="${escapeAttr(hotel.destination)}">Ver disponibilidade</a>
          <a class="button secondary compact-button" href="${escapeAttr(hotel.bookingUrl || bookingSearchUrl(hotel))}" target="_blank" rel="noopener" data-track="hotel_availability_click" data-source="booking" data-hotel-id="${escapeAttr(hotel.id)}" data-hotel-name="${escapeAttr(hotel.name)}" data-destination="${escapeAttr(hotel.destination)}">Ver disponibilidade na Booking</a>
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
      <strong>Nenhum hotel aprovado com estes filtros.</strong>
      <p>O Padrão Família bloqueia hospedagens que não cumprem requisitos mínimos do perfil informado. Remova algum critério ou troque o destino.</p>
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
  }).map(hotel => ({
    ...hotel,
    familyApproval: familyApprovalForHotel(hotel)
  })).filter(hotel => hotel.familyApproval.minimumPassed)
    .sort((a, b) => b.adjustedScore - a.adjustedScore || b.familyApproval.score - a.familyApproval.score || b.score - a.score);
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

function familyApprovalForHotel(hotel) {
  const answers = state.answers || {};
  const must = arrayAnswer(answers.comfort_needs);
  const concerns = arrayAnswer(answers.avoid_risks);
  const childAges = state.intake?.childAges || [];
  const googleCoverage = googleCoverageForHotel(hotel);
  const googleRating = Number(googleCoverage?.rating || 0);
  const googleReviewCount = Number(googleCoverage?.userRatingCount || 0);
  const hasBaby = childAges.some(age => /0 a 12 meses|1 a 2 anos/i.test(age)) || state.intake?.childAge === "0 a 12 meses";
  const failures = [];
  const hasFamilyStructure = Boolean(
    hotel.copaBaby || hotel.copaBaby24h || hotel.kidsClub || hotel.kidsPool || hotel.heatedPool ||
    hotel.allInclusive || hotel.worksOnRainyDay || hotel.hasKitchenette || hotel.recreation
  );
  if ((hotel.adjustedScore || hotel.score || 0) < 7.2) failures.push("score familiar baixo");
  if (!googleCoverage?.placeId) failures.push("sem validacao Google Places");
  if (googleRating && googleRating < 4 && googleReviewCount >= 20) failures.push("avaliacao Google abaixo do minimo");
  if (!hasFamilyStructure) failures.push("sem estrutura familiar mínima validada");
  if (must.includes("Copa baby") && !hotel.copaBaby && !hotel.copaBaby24h) failures.push("não atende copa baby");
  if (must.includes("Copa baby 24h") && !hotel.copaBaby24h) failures.push("não atende copa baby 24h");
  if (must.includes("Kids club") && !hotel.kidsClub) failures.push("não atende kids club");
  if (must.includes("Kitchenette/cozinha") && !hotel.hasKitchenette) failures.push("sem cozinha/kitchenette validada");
  if (hasBaby && hotel.transferMinutes > 120) failures.push("traslado longo demais para bebê");
  if (concerns.includes("Estrada cansativa") && hotel.driveTimeFromSaoPaulo > 260) failures.push("estrada cansativa demais");
  const base = Math.round((hotel.adjustedScore || hotel.score || 0) * 10);
  const infrastructure = Math.max(0, Math.min(100, 48
    + (hotel.kidsClub ? 12 : 0)
    + (hotel.kidsPool ? 9 : 0)
    + (hotel.heatedPool ? 7 : 0)
    + (hotel.worksOnRainyDay ? 10 : 0)
    + (hotel.allInclusive || hotel.hasKitchenette ? 8 : 0)
    + (hotel.copaBaby || hotel.copaBaby24h ? 10 : 0)
    + (googleRating >= 4.6 && googleReviewCount >= 100 ? 4 : 0)));
  const babyComfort = Math.max(0, Math.min(100, 42
    + (hotel.copaBaby ? 18 : 0)
    + (hotel.copaBaby24h ? 14 : 0)
    + (hotel.hasKitchenette ? 12 : 0)
    + (hotel.heatedPool ? 8 : 0)
    + (travelBurden(hotel) <= 120 ? 10 : travelBurden(hotel) > 240 ? -12 : 2)));
  const googleTrust = googleCoverage?.placeId
    ? Math.max(0, Math.min(100, 58 + (googleRating >= 4.6 ? 18 : googleRating >= 4.3 ? 10 : googleRating ? -10 : 0) + Math.min(18, googleReviewCount / 120)))
    : 0;
  const score = Math.max(0, Math.min(100, Math.round((base * 0.45) + (infrastructure * 0.28) + (babyComfort * 0.2) + (googleTrust * 0.07))));
  const medal = failures.length ? "not-recommended" : score >= 86 ? "gold" : score >= 74 ? "silver" : "bronze";
  return {
    minimumPassed: failures.length === 0 && score >= 58,
    failures,
    score,
    infrastructure,
    babyComfort,
    googleTrust,
    medal,
    label: medal === "gold" ? "Padrão Ouro" : medal === "silver" ? "Padrão Prata" : medal === "bronze" ? "Padrão Bronze" : "Reprovado",
    verdict: medal === "gold" ? "excelente para famílias" : medal === "silver" ? "bom, com poucos alertas" : medal === "bronze" ? "viável, exige planejamento" : "não atende o Padrão Família"
  };
}

function HotelApprovalExplanation(approval) {
  if (!approval.minimumPassed) return "";
  const text = approval.medal === "gold"
    ? "Aprovado porque combina estrutura infantil, conforto dos pais e menor risco operacional para a viagem."
    : approval.medal === "silver"
      ? "Aprovado, mas vale validar detalhes como berço, horários e política de refeições antes de reservar."
      : "Viável, desde que a família aceite alguns pontos de planejamento antes da reserva.";
  return `<p class="approval-copy">${escapeHtml(text)}</p>`;
}

function HotelFamilyTestimonials(hotel, googleCoverage) {
  const testimonials = hotel.familyTestimonials?.length
    ? hotel.familyTestimonials.slice(0, 5).map(item => ({ ...item, verified: true }))
    : inferredFamilyTestimonials(hotel, googleCoverage);
  if (!testimonials.length) return "";
  const verified = testimonials.some(item => item.verified);
  return `
    <div class="hotel-testimonials" aria-label="Comentarios familiares sobre ${escapeAttr(hotel.name)}">
      <div class="hotel-testimonials-title">
        <b>${verified ? "Depoimentos de familias" : "Comentarios familiares em validacao"}</b>
        <span>${verified ? "Trechos curados de familias que relataram experiencia no hotel." : "Ainda sem review textual autorizado; abaixo sao sinteses da curadoria para orientar a leitura de avaliacoes reais."}</span>
      </div>
      <div class="testimonial-list">
        ${testimonials.slice(0, 5).map(item => `
          <blockquote>
            <p>${escapeHtml(item.text)}</p>
            <footer>${escapeHtml(item.source || (item.verified ? "familia verificada" : "sintese da curadoria"))}</footer>
          </blockquote>
        `).join("")}
      </div>
    </div>
  `;
}

function inferredFamilyTestimonials(hotel, googleCoverage) {
  const comments = [];
  const source = googleCoverage?.rating
    ? `sintese + Google ${numberLabel(googleCoverage.rating, 1)} (${numberLabel(googleCoverage.userRatingCount || 0, 0)} avaliacoes)`
    : "sintese da curadoria";
  if (hotel.driveTimeFromSaoPaulo) {
    comments.push({
      text: `Para familias saindo de Sao Paulo, o deslocamento de cerca de ${formatMinutesLabel(hotel.driveTimeFromSaoPaulo)} ajuda a reduzir cansaco antes mesmo do check-in.`,
      source
    });
  } else if (hotel.transferMinutes) {
    comments.push({
      text: `Depois do voo, o ponto critico para familias e o traslado de aproximadamente ${hotel.transferMinutes} min; vale combinar horario e chegada com folga.`,
      source
    });
  }
  if (hotel.copaBaby || hotel.copaBaby24h) {
    comments.push({
      text: "Para quem viaja com bebe, a estrutura de copa baby aparece como diferencial para mamadeira, papinha e rotina noturna.",
      source
    });
  }
  if (hotel.kidsClub || hotel.recreation) {
    comments.push({
      text: "Familias com criancas pequenas tendem a valorizar recreacao e espacos infantis porque o hotel sustenta parte do dia sem roteiro corrido.",
      source
    });
  }
  if (hotel.kidsPool || hotel.heatedPool) {
    comments.push({
      text: "Piscina infantil ou aquecida pesa muito na experiencia: e o tipo de coisa que salva tarde de energia alta e clima incerto.",
      source
    });
  }
  if (hotel.allInclusive) {
    comments.push({
      text: "Quando a alimentacao esta mais resolvida, a familia decide menos no dia e reduz aquele efeito 'onde vamos comer agora?'.",
      source
    });
  } else if (hotel.hasKitchenette) {
    comments.push({
      text: "Cozinha ou apoio para lanche facilita a vida de quem precisa manter horario de comida, leite ou pequenas emergencias de fome.",
      source
    });
  }
  if (hotel.worksOnRainyDay) {
    comments.push({
      text: "Ter plano B dentro do hotel e essencial para familia: chuva deixa de virar crise e vira mudanca de agenda.",
      source
    });
  }
  if (hotel.sourceHighlights?.length) {
    comments.push({
      text: `A curadoria encontrou sinais publicos relevantes: ${hotel.sourceHighlights[0]}`,
      source: "fonte publica consultada"
    });
  }
  if (hotel.attentionPoint) {
    comments.push({
      text: `Ponto que familia costuma precisar confirmar antes de reservar: ${hotel.attentionPoint}`,
      source: "alerta de curadoria"
    });
  }
  return comments.length >= 3 ? comments.slice(0, 5) : comments.concat(fallbackFamilyTestimonials(hotel)).slice(0, 3);
}

function fallbackFamilyTestimonials(hotel) {
  return [
    {
      text: "Antes de reservar, vale ler reviews recentes procurando mencoes a limpeza, barulho, filas e atendimento com criancas.",
      source: "checklist de reviews"
    },
    {
      text: "Para familias, o melhor hotel nao e so o mais bonito: e o que reduz decisoes dificeis no meio do dia.",
      source: "sintese da curadoria"
    },
    {
      text: `Confirme diretamente com ${hotel.name} itens como berco, horarios de recreacao, refeicoes infantis e politica de cancelamento.`,
      source: "validacao recomendada"
    }
  ];
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

function experienceForRecommendation(recommendation) {
  return destinationExperienceByKey.get(recommendation.key)
    || destinationExperienceByKey.get(recommendation.bestHotel?.destinationSlug)
    || destinationExperienceByKey.get(recommendation.imageKey);
}

function liveSummaryForRecommendation(recommendation) {
  return firstLiveMatch(recommendation, liveConciergeData.summariesBySlug);
}

function googleCoverageForRecommendation(recommendation) {
  const candidates = [
    recommendation.key,
    recommendation.imageKey,
    recommendation.bestHotel?.destinationSlug,
    recommendation.bestHotel?.destinationKey,
    slugifyText(recommendation.name || ""),
    removeStateSuffix(slugifyText(recommendation.name || ""))
  ];
  return candidates.map(key => googleCoverageDestinationsById.get(key)).find(Boolean) || null;
}

function googleCoverageForHotel(hotel) {
  return googleCoverageHotelsById.get(hotel.id) || null;
}

function liveHotelsForRecommendation(recommendation) {
  const match = liveSlugCandidates(recommendation).find(slug => liveConciergeData.hotelCardsBySlug.has(slug));
  if (!match) return [];
  const unique = new Map();
  liveConciergeData.hotelCardsBySlug.get(match).forEach(hotel => {
    const key = slugifyText(hotel.hotel_name);
    const current = unique.get(key);
    if (!current || liveHotelSortValue(hotel) > liveHotelSortValue(current)) unique.set(key, hotel);
  });
  return [...unique.values()].sort((a, b) => liveHotelSortValue(b) - liveHotelSortValue(a));
}

function firstLiveMatch(recommendation, sourceMap) {
  return liveSlugCandidates(recommendation).map(slug => sourceMap.get(slug)).find(Boolean) || null;
}

function liveSlugCandidates(recommendation) {
  const values = [
    recommendation.key,
    recommendation.imageKey,
    recommendation.bestHotel?.destinationSlug,
    recommendation.bestHotel?.destinationKey,
    recommendation.name,
    recommendation.bestHotel?.destination
  ];
  const candidates = new Set();
  values.filter(Boolean).forEach(value => {
    const slug = slugifyText(value);
    candidates.add(slug);
    candidates.add(removeStateSuffix(slug));
  });
  return [...candidates].filter(Boolean);
}

function removeStateSuffix(slug) {
  return String(slug || "").replace(/-(sp|rj|ba|pe|al|pr|rs|sc|go|mg|ce|rn|pb|es|fl|argentina|brasil)$/i, "");
}

function liveHotelSortValue(hotel) {
  return (Number(hotel.liteapi_rating) || 0) * 10000 + (Number(hotel.review_count) || 0);
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

function DestinationPhotoGallery(recommendation) {
  const gallery = galleryForRecommendation(recommendation);
  const photos = Array.isArray(gallery?.photos) ? gallery.photos.filter(photo => photo?.status === "approved") : [];
  if (photos.length < 3) {
    return `
      <div class="destination-photo-gallery missing-gallery">
        ${DestinationImage(recommendation.imageKey, recommendation.name)}
        <div class="gallery-warning">
          <strong>Fotos em validação</strong>
          <span>Este destino ainda não tem as 3 fotos reais obrigatórias aprovadas.</span>
        </div>
      </div>
    `;
  }
  const gallerySource = gallerySourceForPhotos(photos);
  return `
    <div class="destination-photo-gallery" aria-label="Fotos reais de ${escapeAttr(recommendation.name)}">
      <div class="gallery-topline">
        <span>3 fotos reais em alta resolução</span>
        <a href="${escapeAttr(gallerySource.url)}" target="_blank" rel="noopener">${escapeHtml(gallerySource.label)}</a>
      </div>
      <div class="gallery-grid">
        ${photos.slice(0, 3).map((photo, index) => DestinationGalleryPhoto(photo, index, recommendation)).join("")}
      </div>
    </div>
  `;
}

function DestinationGalleryPhoto(photo, index, recommendation) {
  const src = photo.thumbnailUrl || photo.imageUrl;
  const highResUrl = photo.imageUrl || photo.sourceUrl || src;
  const note = `${photo.width}x${photo.height} · ${photo.license || "fonte pública"}`;
  return `
    <figure class="gallery-photo ${index === 0 ? "main-photo" : "thumb-photo"}">
      <a href="${escapeAttr(highResUrl)}" target="_blank" rel="noopener" data-track="destination_photo_click" data-source="${escapeAttr(photo.source || "wikimedia_commons")}" data-destination="${escapeAttr(recommendation.name)}" data-hotel-id="" data-hotel-name="${escapeAttr(photo.title || recommendation.name)}">
        <div class="warning-mark image-error-mark" aria-hidden="true">!</div>
        <img src="${escapeAttr(src)}" alt="${escapeAttr(photo.alt || recommendation.name)}" loading="lazy" onerror="this.hidden=true;this.closest('figure').classList.add('missing-image','image-load-failed');">
      </a>
      <figcaption>
        <span>${escapeHtml(photo.alt || recommendation.name)}</span>
        <small>${escapeHtml(note)}</small>
      </figcaption>
    </figure>
  `;
}

function galleryForRecommendation(recommendation) {
  return destinationGalleriesByKey.get(recommendation.key)
    || destinationGalleriesByKey.get(recommendation.bestHotel?.destinationSlug)
    || destinationGalleriesByKey.get(recommendation.imageKey)
    || destinationGalleriesByKey.get(recommendation.bestHotel?.destinationKey);
}

function gallerySourceForPhotos(photos) {
  const labels = new Set(photos.map(photoSourceLabel));
  const firstSourceUrl = photos.find(photo => photo.sourceUrl)?.sourceUrl;
  return {
    label: labels.size === 1 ? [...labels][0] : "fontes verificadas",
    url: firstSourceUrl || "https://commons.wikimedia.org/"
  };
}

function photoSourceLabel(photo) {
  if (photo.sourceLabel) return photo.sourceLabel;
  if (photo.source === "wikimedia_commons") return "Wikimedia Commons";
  if (photo.source === "official_hotel_site") return "site oficial";
  return "fonte verificada";
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
      <div class="warning-mark image-error-mark" aria-hidden="true">!</div>
      <img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" loading="lazy" onerror="this.hidden=true;this.closest('figure').classList.add('missing-image','image-load-failed');">
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

function HotelRecommendationSection() {
  return `
    <section class="section hotel-recommendation-section" id="indicar-hotel">
      <div class="hotel-recommendation-box">
        <div class="hotel-recommendation-copy">
          <span class="badge subtle">Ajude a curadoria</span>
          <h2>Conhece um hotel bom para famílias?</h2>
          <p>Indique. A gente valida antes de colocar no ranking.</p>
          ${state.hotelRecommendationSent ? `<p class="form-success">Indicação recebida. Vamos avaliar antes de incluir na base curada.</p>` : ""}
        </div>
        <form id="hotelRecommendationForm" class="hotel-recommendation-form">
          <label>Nome do hotel
            <input name="hotelName" required placeholder="Ex: Resort Família Feliz">
          </label>
          <label>Site do hotel
            <input name="hotelWebsite" required inputmode="url" placeholder="https://www.hotel.com.br">
          </label>
          <div class="location-grid">
            <label>Cidade<input name="city" required placeholder="Ex: Atibaia"></label>
            <label>Estado<input name="state" required placeholder="Ex: SP"></label>
            <label>País<input name="country" required placeholder="Ex: Brasil"></label>
          </div>
          <label>Por que você está indicando?
            <textarea name="recommendationReason" required rows="4" maxlength="700" placeholder="Conte rapidamente o que funcionou para família: alimentação, copa baby, piscina, recreação, atendimento, localização..."></textarea>
          </label>
          <button class="button primary compact-button" type="submit">${state.hotelRecommendationSent ? "Indicar outro hotel" : "Enviar indicação"}</button>
          <p class="privacy-note">Usaremos esta indicação apenas para revisar a curadoria. Não publicamos seu texto como avaliação sem validação.</p>
        </form>
      </div>
    </section>
  `;
}

function ConciergeLeadCaptureForm() {
  return `
    <section class="section lead-section" id="lead">
      <div class="lead-box">
        <div>
          <span class="badge subtle">Próximo passo</span>
          <h2>Quer receber o dossiê da viagem com próximos passos?</h2>
          <p>Resumo com cidades, hotéis e checklist. Sem grupo, sem spam.</p>
        </div>
        <form id="leadForm" class="lead-form">
          <label>Nome<input name="name" required placeholder="Seu nome" value="${escapeAttr(state.intake.name || "")}"></label>
          <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="11999999999" value="${escapeAttr(state.intake.whatsapp || "")}"></label>
          <label>Email<input name="email" type="email" placeholder="voce@email.com" value="${escapeAttr(state.intake.email || "")}"></label>
          <label>Região de São Paulo<input name="region" placeholder="Ex: Zona Sul"></label>
          <label>Idade da criança<input name="age" placeholder="Ex: 1 ano e 8 meses" value="${escapeAttr(state.intake.childAge || "")}"></label>
          <label>Mês provável da viagem<input name="month" placeholder="Ex: julho" value="${escapeAttr(state.intake.travelPeriod || "")}"></label>
          <label>Tipo de viagem desejada<input name="trip" placeholder="Ex: resort com copa baby"></label>
          <button class="button primary" type="submit">Receber dossiê da viagem no WhatsApp</button>
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
    const clickPayload = {
      source: trackedLink.dataset.source || "",
      hotelId: trackedLink.dataset.hotelId || "",
      hotelName: trackedLink.dataset.hotelName || "",
      destination: trackedLink.dataset.destination || "",
      href: trackedLink.href
    };
    trackEvent(trackedLink.dataset.track, clickPayload);
    if (trackedLink.dataset.track.startsWith("hotel_")) persistHotelClick(clickPayload);
    return;
  }
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (action === "map-filter") {
    state.mapFilters[target.dataset.filterGroup] = target.dataset.filterValue;
    state.mapFilters.selectedKey = "";
    trackEvent("map_filter_applied", { group: target.dataset.filterGroup, value: target.dataset.filterValue });
    render();
    return;
  }
  if (action === "map-hotspot") {
    state.mapFilters.selectedKey = target.dataset.hotspotKey || "";
    if (state.routePreview.destinationKey !== state.mapFilters.selectedKey) stopRouteAnimation();
    const hotspot = buildMapHotspots().find(item => item.key === state.mapFilters.selectedKey);
    trackEvent("map_hotspot_selected", {
      destinationKey: state.mapFilters.selectedKey,
      destinationName: hotspot?.name || "",
      bestHotel: hotspot?.bestHotel?.name || ""
    });
    render();
    setTimeout(() => document.getElementById("mapa")?.scrollIntoView({ behavior: "smooth", block: "start" }), 20);
    return;
  }
  if (action === "route-preview-start") {
    const hotspot = buildMapHotspots().find(item => item.key === target.dataset.hotspotKey) || filteredMapHotspots()[0];
    if (!hotspot) return;
    startRoutePreview(hotspot);
    return;
  }
  if (action === "route-preview-pause") {
    toggleRoutePreviewPause();
    return;
  }
  if (action === "route-preview-speed") {
    cycleRoutePreviewSpeed();
    return;
  }
  if (action === "route-preview-stops") {
    state.routePreview.showStops = !state.routePreview.showStops;
    trackEvent("route_preview_stops_toggled", { open: state.routePreview.showStops });
    render();
    return;
  }
  if (action === "map-start-diagnosis") {
    const hotspot = buildMapHotspots().find(item => item.key === target.dataset.hotspotKey);
    syncMapFiltersToIntakeDraft();
    state.intakeDraft.destinationInterestKey = hotspot?.key || target.dataset.hotspotKey || "";
    state.intakeDraft.destinationInterestName = hotspot?.name || "";
    trackEvent("map_diagnosis_started", {
      destinationKey: state.intakeDraft.destinationInterestKey,
      destinationName: state.intakeDraft.destinationInterestName,
      bestHotel: hotspot?.bestHotel?.name || ""
    });
    render();
    setTimeout(() => {
      document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("#intakeForm [name='leadName']")?.focus({ preventScroll: true });
    }, 40);
    return;
  }
  if (action === "map-build-route") {
    const hotspot = buildMapHotspots().find(item => item.key === target.dataset.hotspotKey);
    syncMapFiltersToIntakeDraft();
    state.intakeDraft.destinationInterestKey = hotspot?.key || target.dataset.hotspotKey || "";
    state.intakeDraft.destinationInterestName = hotspot?.name || "";
    state.answers.trip_duration = hotspot?.itinerary ? "4 a 5 noites" : state.mapFilters.travel === "1h" ? "2 noites" : "3 noites";
    state.answers.displacement_limit = mapDisplacementAnswerLabel();
    trackEvent("map_route_builder_started", {
      destinationKey: state.intakeDraft.destinationInterestKey,
      destinationName: state.intakeDraft.destinationInterestName,
      itinerary: hotspot?.itinerary?.title || ""
    });
    render();
    setTimeout(() => document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth", block: "start" }), 40);
    return;
  }
  if (action === "map-compare") {
    state.mapFilters.selectedKey = "";
    trackEvent("map_compare_requested");
    render();
    setTimeout(() => document.querySelector(".map-hotspot-list")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
    return;
  }
  if (action === "popular-destination") {
    state.intakeDraft.destinationInterestKey = target.dataset.destinationKey || "";
    state.intakeDraft.destinationInterestName = target.dataset.destinationName || "";
    trackEvent("popular_destination_clicked", {
      destinationKey: state.intakeDraft.destinationInterestKey,
      destinationName: state.intakeDraft.destinationInterestName,
      source: "homepage_curated_grid"
    });
    render();
    setTimeout(() => {
      document.getElementById("diagnostico")?.scrollIntoView({ behavior: "smooth", block: "start" });
      document.querySelector("#intakeForm [name='adultsCount']")?.focus({ preventScroll: true });
    }, 40);
    return;
  }
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
  if (action === "friend-referral-whatsapp") return trackFriendReferral("whatsapp");
  if (action === "copy-referral-link") return copyReferralLink(target);
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

async function copyReferralLink(button) {
  const url = referralUrl();
  await copyText(url);
  trackFriendReferral("copy_link");
  markTemporaryButton(button, "Link copiado");
}

function trackFriendReferral(channel) {
  trackEvent("friend_referral_clicked", {
    ...analyticsResultPayload(),
    channel,
    referralUrl: referralUrl()
  });
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
    `Custo estimado: ${state.result.costEstimate.headline}`,
    `Destinos preferidos: ${destinations}`,
    `Quando querem ir: ${state.intake.travelPeriod || "data flexível"}`,
    `Orçamento confortável: ${state.answers.budget_total || "a definir"}`
  ].join("\n");
  trackEvent("family_alert_requested", analyticsResultPayload());
  markTemporaryButton(button, "Abrindo WhatsApp");
  window.open(leadWhatsAppUrl(text), "_blank", "noopener");
}

function friendReferralMessage() {
  const intro = state.result
    ? `Eu fiz um diagnostico de viagem em familia e meu perfil deu ${state.result.profileName}.`
    : "Achei um diagnostico rapido para escolher viagem em familia com menos perrengue.";
  return [
    intro,
    "Ele cruza idade das criancas, orcamento, epoca, logistica saindo de SP, hoteis e risco de perrengue.",
    "Talvez ajude voces tambem:",
    referralUrl()
  ].join("\n");
}

function referralUrl() {
  const url = new URL(`${window.location.origin}${window.location.pathname}`);
  url.searchParams.set("ref", sessionId.slice(0, 10));
  url.hash = "diagnostico";
  return url.toString();
}

function whatsappShareUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

async function submitHotelRecommendation(formElement) {
  const form = new FormData(formElement);
  const payload = {
    session_id: sessionId,
    hotel_name: String(form.get("hotelName") || "").trim(),
    hotel_website: normalizeWebsiteUrl(form.get("hotelWebsite") || ""),
    city: String(form.get("city") || "").trim(),
    state: String(form.get("state") || "").trim(),
    country: String(form.get("country") || "").trim(),
    recommendation_reason: String(form.get("recommendationReason") || "").trim().slice(0, 700),
    lead_name: state.intake.name || null,
    lead_email: state.intake.email || null,
    lead_whatsapp: state.intake.whatsapp || null,
    source_page: window.location.href,
    status: "pending_review",
    created_at: new Date().toISOString()
  };
  if (!payload.hotel_name || !payload.hotel_website || !payload.city || !payload.state || !payload.country || !payload.recommendation_reason) return;
  trackEvent("hotel_recommendation_submitted", {
    hotelName: payload.hotel_name,
    city: payload.city,
    state: payload.state,
    country: payload.country,
    hasLead: Boolean(payload.lead_email || payload.lead_whatsapp)
  });
  persistLocalHotelRecommendation(payload);
  await persistSupabase("concierge_hotel_recommendations", payload);
  state.hotelRecommendationSent = true;
  formElement.reset();
  render();
  setTimeout(() => document.getElementById("indicar-hotel")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
}

function persistLocalHotelRecommendation(payload) {
  try {
    const key = "conciergeHotelRecommendations";
    const current = JSON.parse(window.localStorage.getItem(key) || "[]");
    current.push(payload);
    window.localStorage.setItem(key, JSON.stringify(current.slice(-40)));
  } catch (error) {
    window.__conciergeHotelRecommendations = [...(window.__conciergeHotelRecommendations || []), payload].slice(-40);
  }
}

function shareResultText(result) {
  const destinations = buildDestinationRecommendations().slice(0, 3).map((item, index) => `${index + 1}. ${item.name}`).join("\n");
  return [
    "Fiz o diagnóstico Viagens de família sem perrengue.",
    `Meu perfil de viagem em família: ${result.profileName}`,
    shareableProfilePunchline(result.profileName),
    `Índice Sem Perrengue: ${result.semPerrengue.score}/100 (${result.semPerrengue.label})`,
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
    sessionId,
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
  persistSupabase("concierge_events", {
    session_id: sessionId,
    event_name: eventName,
    payload,
    page_url: window.location.href,
    user_agent: navigator.userAgent
  });
}

async function persistLeadIntake(stage) {
  const response = await persistSupabase("concierge_leads", {
    session_id: sessionId,
    stage,
    name: state.intake.name || null,
    whatsapp: state.intake.whatsapp || null,
    email: state.intake.email || null,
    adults_count: state.intake.adultsCount || null,
    children_count: state.intake.childrenCount || 0,
    rooms_count: state.intake.roomsCount || null,
    child_ages: state.intake.childAges || [],
    pet: state.intake.pet || null,
    travel_timing_mode: state.intake.travelTimingMode || null,
    travel_date: state.intake.travelDate || null,
    travel_month: state.intake.travelMonth || null,
    flexible_window: state.intake.flexibleWindow || null,
    travel_period_label: state.intake.travelPeriod || null,
    last_trip: state.intake.lastTrip || null,
    answers: state.answers || {},
    result: state.result || {},
    raw_intake: state.intake || {},
    page_url: window.location.href
  });
  if (response?.id) state.leadId = response.id;
}

function persistHotelClick(payload) {
  persistSupabase("concierge_hotel_clicks", {
    session_id: sessionId,
    lead_id: state.leadId,
    hotel_id: payload.hotelId || null,
    hotel_name: payload.hotelName || null,
    destination: payload.destination || null,
    click_source: payload.source || null,
    href: payload.href || null,
    profile_name: state.result?.profileName || null,
    sem_perrengue_score: state.result?.semPerrengue?.score || null,
    budget_total: state.answers.budget_total || null,
    trip_duration: state.answers.trip_duration || null,
    travel_period_label: state.intake.travelPeriod || null,
    page_url: window.location.href,
    user_agent: navigator.userAgent
  }, { keepalive: true });
}

async function persistSupabase(table, payload, options = {}) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return null;
  try {
    const response = await fetch(`${supabaseConfig.url.replace(/\/$/, "")}/rest/v1/${table}`, {
      method: "POST",
      keepalive: Boolean(options.keepalive),
      headers: {
        apikey: supabaseConfig.anonKey,
        authorization: `Bearer ${supabaseConfig.anonKey}`,
        "content-type": "application/json",
        prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) throw new Error(`Supabase insert failed: ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows[0] : null;
  } catch (error) {
    const failed = {
      table,
      payload,
      error: error.message,
      at: new Date().toISOString()
    };
    window.__conciergeSupabaseQueue = [...(window.__conciergeSupabaseQueue || []), failed].slice(-80);
    return null;
  }
}

function resolveSupabaseConfig() {
  const runtime = window.CONCIERGE_SUPABASE || {};
  return {
    url: runtime.url || window.CONCIERGE_SUPABASE_URL || document.querySelector('meta[name="concierge-supabase-url"]')?.content || "",
    anonKey: runtime.anonKey || window.CONCIERGE_SUPABASE_ANON_KEY || document.querySelector('meta[name="concierge-supabase-anon-key"]')?.content || ""
  };
}

function getOrCreateSessionId() {
  const key = "conciergeFamilySessionId";
  try {
    const current = window.localStorage.getItem(key);
    if (current) return current;
    const next = crypto.randomUUID();
    window.localStorage.setItem(key, next);
    return next;
  } catch (error) {
    return crypto.randomUUID();
  }
}

function handleInput(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  if (target.dataset.action === "map-input") {
    const field = target.dataset.mapField;
    if (field === "childAge") {
      const index = Number.parseInt(target.dataset.childAgeIndex, 10) || 0;
      state.mapFilters.childAges[index] = target.value;
    } else {
      state.mapFilters[field] = target.value;
      if (field === "children") {
        const count = Math.max(0, Math.min(4, Number.parseInt(target.value, 10) || 0));
        state.mapFilters.childAges = Array.from({ length: count }, (_, index) => state.mapFilters.childAges[index] || "1 a 2 anos");
      }
    }
    syncMapFiltersToIntakeDraft();
    clearTimeout(searchRenderTimer);
    searchRenderTimer = setTimeout(render, 120);
    return;
  }
  if (target.dataset.action === "children-count") {
    state.intakeDraft.childrenCount = target.value;
    syncChildAgeFields(Number.parseInt(target.value, 10) || 0);
  }
  if (target.dataset.action === "travel-mode") {
    state.intakeDraft.travelTimingMode = target.value;
    syncTravelModeFields(target.value);
  }
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

function syncDynamicIntakeFields() {
  const form = document.getElementById("intakeForm");
  if (!form) return;
  const childrenCount = Number.parseInt(form.elements.childrenCount?.value || state.intakeDraft.childrenCount, 10) || 0;
  const travelMode = form.elements.travelTimingMode?.value || state.intakeDraft.travelTimingMode || "unknown";
  syncChildAgeFields(childrenCount);
  syncTravelModeFields(travelMode);
}

function syncChildAgeFields(childrenCount) {
  document.querySelectorAll("[data-child-age-index]").forEach(field => {
    const index = Number.parseInt(field.dataset.childAgeIndex, 10);
    const enabled = index <= childrenCount;
    field.classList.toggle("hidden-field", !enabled);
    const select = field.querySelector("select");
    if (select) select.disabled = !enabled;
  });
}

function syncTravelModeFields(mode) {
  document.querySelectorAll(".segment-option").forEach(option => {
    const input = option.querySelector("input");
    option.classList.toggle("active", input?.value === mode && input.checked);
  });
  document.querySelectorAll("[data-travel-mode-field]").forEach(field => {
    const enabled = field.dataset.travelModeField === mode;
    field.classList.toggle("hidden-field", !enabled);
    field.querySelectorAll("input, select").forEach(input => {
      input.disabled = !enabled;
    });
  });
}

function startRoutePreview(hotspot) {
  state.mapFilters.selectedKey = hotspot.key;
  state.routePreview = {
    ...state.routePreview,
    destinationKey: hotspot.key,
    status: "loading",
    progress: 0,
    showStops: false,
    source: "server",
    message: "Calculando a rota da familia...",
    points: [],
    stops: [],
    summary: buildRoutePreviewSummary(hotspot),
    error: ""
  };
  trackEvent("route_preview_started", {
    destinationKey: hotspot.key,
    destinationName: hotspot.name,
    bestHotel: hotspot.bestHotel?.name || ""
  });
  render();
  setTimeout(() => document.getElementById("previa-rota")?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  loadRoutePreviewData(hotspot);
}

async function loadRoutePreviewData(hotspot) {
  const fallbackPoints = fallbackRouteGeoPoints(hotspot);
  let routeData = null;
  try {
    routeData = await fetchRoutePreviewFromApi(hotspot);
  } catch (error) {
    state.routePreview.error = error?.message || "rota_api_unavailable";
  }
  const decoded = routeData?.encodedPolyline ? decodeEncodedPolyline(routeData.encodedPolyline) : [];
  const points = decoded.length >= 2 ? decoded : fallbackPoints;
  const svgPoints = projectRoutePoints(points);
  state.routePreview.points = points;
  state.routePreview.stops = buildRouteStops(hotspot, points, svgPoints);
  state.routePreview.summary = routeSummaryFromApiOrFallback(hotspot, routeData);
  state.routePreview.source = decoded.length >= 2 ? "google_routes" : "fallback";
  state.routePreview.status = "playing";
  state.routePreview.message = decoded.length >= 2 ? "Rota real carregada pela camada segura." : "Rota estimada com coordenadas verificadas enquanto a polilinha real nao chega.";
  render();
  requestAnimationFrame(() => startRouteAnimation());
}

async function fetchRoutePreviewFromApi(hotspot) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return null;
  const destination = hotspot.coordinates || approximateDestinationCoordinates(hotspot.bestHotel);
  const response = await fetch(`${supabaseConfig.url.replace(/\/$/, "")}/functions/v1/concierge-api`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseConfig.anonKey,
      authorization: `Bearer ${supabaseConfig.anonKey}`,
      "x-concierge-session": sessionId
    },
    body: JSON.stringify({
      action: "route",
      payload: {
        origin: SAO_PAULO_CENTER,
        destination,
        travelMode: "DRIVE",
        childAges: state.mapFilters.childAges || []
      }
    })
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json.ok === false) throw new Error(json.message || `route_api_${response.status}`);
  return json.data || null;
}

function routeSummaryFromApiOrFallback(hotspot, routeData) {
  const fallback = buildRoutePreviewSummary(hotspot);
  if (!routeData) return fallback;
  const minutes = Math.round(Number(routeData.durationSeconds || 0) / 60);
  const km = Math.round(Number(routeData.distanceMeters || 0) / 1000);
  const stops = recommendedRouteStopCount(minutes || travelBurden(hotspot.bestHotel), state.mapFilters.childAges);
  const difficulty = routeData.difficulty || {};
  return {
    ...fallback,
    timeLabel: minutes ? formatMinutesLabel(minutes) : fallback.timeLabel,
    distanceLabel: km ? `${km} km` : fallback.distanceLabel,
    stopLabel: `${stops} ${stops === 1 ? "parada" : "paradas"}`,
    effortLabel: difficulty.label ? String(difficulty.label).toLowerCase() : fallback.effortLabel
  };
}

function startRouteAnimation() {
  stopRouteAnimation(false);
  routeLastTick = 0;
  const tick = timestamp => {
    if (state.routePreview.status !== "playing") return;
    if (!routeLastTick) routeLastTick = timestamp;
    const delta = timestamp - routeLastTick;
    routeLastTick = timestamp;
    const duration = 10500 / Math.max(.75, state.routePreview.speed || 1);
    state.routePreview.progress = Math.min(1, state.routePreview.progress + (delta / duration));
    updateRoutePreviewDom();
    if (state.routePreview.progress >= 1) {
      state.routePreview.status = "done";
      routeAnimationFrame = null;
      updateRoutePreviewDom();
      render();
      return;
    }
    routeAnimationFrame = requestAnimationFrame(tick);
  };
  routeAnimationFrame = requestAnimationFrame(tick);
}

function stopRouteAnimation(resetStatus = true) {
  if (routeAnimationFrame) cancelAnimationFrame(routeAnimationFrame);
  routeAnimationFrame = null;
  routeLastTick = 0;
  if (resetStatus && state.routePreview.status === "playing") state.routePreview.status = "paused";
}

function toggleRoutePreviewPause() {
  if (state.routePreview.status === "playing") {
    state.routePreview.status = "paused";
    stopRouteAnimation(false);
    render();
    return;
  }
  if (["paused", "done"].includes(state.routePreview.status)) {
    if (state.routePreview.status === "done") state.routePreview.progress = 0;
    state.routePreview.status = "playing";
    render();
    requestAnimationFrame(() => startRouteAnimation());
  }
}

function cycleRoutePreviewSpeed() {
  state.routePreview.speed = state.routePreview.speed >= 2 ? 1 : state.routePreview.speed >= 1.5 ? 2 : 1.5;
  trackEvent("route_preview_speed_changed", { speed: state.routePreview.speed });
  render();
  if (state.routePreview.status === "playing") requestAnimationFrame(() => startRouteAnimation());
}

function updateRoutePreviewDom() {
  const hotspot = buildMapHotspots().find(item => item.key === state.routePreview.destinationKey);
  if (!hotspot) return;
  const preview = routePreviewForHotspot(hotspot);
  const progress = Math.max(0, Math.min(1, state.routePreview.progress));
  const length = routeSvgLength(preview.svgPoints);
  const vehicle = pointAtRouteProgress(preview.svgPoints, progress);
  const path = document.querySelector(".route-preview-path");
  if (path) path.style.strokeDashoffset = String(length * (1 - progress));
  const marker = document.querySelector(".route-vehicle");
  if (marker) marker.setAttribute("transform", `translate(${vehicle.x} ${vehicle.y})`);
  const svg = document.querySelector(".route-preview-map svg");
  if (svg) svg.style.transform = routeCameraTransform(progress);
  const bar = document.querySelector(".route-progress-bar i");
  if (bar) bar.style.width = `${Math.round(progress * 100)}%`;
  const status = document.querySelector(".route-preview-status");
  if (status) status.textContent = routePreviewStatusLabel(state.routePreview.status);
  const copy = document.querySelector(".route-preview-copy p");
  if (copy) copy.textContent = routePreviewMessage(preview, progress);
  document.querySelectorAll(".route-poi").forEach((node, index) => {
    const stop = preview.stops[index];
    if (stop) node.classList.toggle("reached", progress + 0.02 >= stop.progress);
  });
}

function routeCameraTransform(progress) {
  if (progress < .18) return "scale(1.18) translate(3%, -2%)";
  if (progress > .82) return "scale(1.14) translate(-3%, 2%)";
  return "scale(1.03)";
}

function decodeEncodedPolyline(encoded = "") {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    const latitude = decodePolylineValue(encoded, index);
    index = latitude.index;
    lat += latitude.value;
    const longitude = decodePolylineValue(encoded, index);
    index = longitude.index;
    lng += longitude.value;
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function decodePolylineValue(encoded, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte = 0;
  do {
    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20 && index < encoded.length);
  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    index
  };
}

function travelPeriodLabel({ mode, date, month, flexibleWindow }) {
  if (mode === "date" && date) return `Data provável: ${formatDateLabel(date)}`;
  if (mode === "month" && month) return `Mês provável: ${formatMonthLabel(month)}`;
  if (mode === "flexible") return `Data flexível: ${flexibleWindow || "janela a definir"}`;
  return "Ainda não sei";
}

function formatDateLabel(value) {
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(value) {
  const [year, month] = String(value).split("-");
  if (!year || !month) return value;
  return `${month}/${year}`;
}

document.addEventListener("submit", event => {
  if (event.target.id === "intakeForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const childrenCount = Number.parseInt(form.get("childrenCount"), 10) || 0;
    const childAges = [1, 2, 3, 4]
      .map(index => form.get(`childAge${index}`))
      .filter((_, index) => index < childrenCount);
    const travelTimingMode = form.get("travelTimingMode") || "unknown";
    state.intake = {
      name: String(form.get("leadName") || "").trim(),
      whatsapp: normalizePhone(form.get("leadWhatsapp") || ""),
      email: String(form.get("leadEmail") || "").trim(),
      consentContact: form.get("consentContact") === "on",
      adultsCount: Number.parseInt(form.get("adultsCount"), 10) || 2,
      childrenCount,
      roomsCount: Number.parseInt(form.get("roomsCount"), 10) || 1,
      tripDuration: form.get("tripDuration") || "3 noites",
      childAges,
      adults: `${Number.parseInt(form.get("adultsCount"), 10) || 2} adulto(s)`,
      children: `${childrenCount} criança(s)`,
      childAge: childAges[0] || "",
      pet: form.get("pet") || "",
      travelTimingMode,
      travelDate: form.get("travelDate") || "",
      travelMonth: form.get("travelMonth") || "",
      flexibleWindow: form.get("flexibleWindow") || "",
      travelPeriod: travelPeriodLabel({
        mode: travelTimingMode,
        date: form.get("travelDate") || "",
        month: form.get("travelMonth") || "",
        flexibleWindow: form.get("flexibleWindow") || ""
      }),
      lastTrip: form.get("lastTrip") || "",
      interestDestinationKey: state.intakeDraft.destinationInterestKey || "",
      interestDestinationName: state.intakeDraft.destinationInterestName || ""
    };
    state.answers.child_age = state.intake.childAge;
    state.answers.travel_period = state.intake.travelPeriod;
    state.answers.destination_interest = state.intake.interestDestinationName;
    state.answers.trip_duration = state.intake.tripDuration;
    state.intakeComplete = true;
    trackEvent("diagnosis_intake_completed", {
      travelPeriod: state.intake.travelPeriod,
      childAge: state.intake.childAge,
      pet: state.intake.pet,
      adults: state.intake.adultsCount,
      children: state.intake.childrenCount,
      rooms: state.intake.roomsCount,
      tripDuration: state.intake.tripDuration,
      childAges: state.intake.childAges,
      lastTrip: state.intake.lastTrip,
      hasContact: Boolean(state.intake.whatsapp || state.intake.email),
      consentContact: state.intake.consentContact,
      interestDestinationKey: state.intake.interestDestinationKey,
      interestDestinationName: state.intake.interestDestinationName
    });
    persistLeadIntake("pre_diagnosis_started");
    render();
    return;
  }
  if (event.target.id === "hotelRecommendationForm") {
    event.preventDefault();
    return submitHotelRecommendation(event.target);
  }
  if (event.target.id !== "leadForm") return;
  event.preventDefault();
  const form = new FormData(event.target);
  state.intake = {
    ...state.intake,
    name: form.get("name") || state.intake.name || "",
    whatsapp: form.get("phone") || state.intake.whatsapp || "",
    email: form.get("email") || state.intake.email || ""
  };
  const text = [
    "Oi! Quero receber opções curadas do Concierge da Família.",
    `Nome: ${form.get("name") || state.intake.name || ""}`,
    `WhatsApp: ${form.get("phone") || state.intake.whatsapp || ""}`,
    `Email: ${form.get("email") || state.intake.email || ""}`,
    `Região de SP: ${form.get("region") || ""}`,
    `Idade da criança: ${form.get("age") || state.intake.childAge || ""}`,
    `Mês provável: ${form.get("month") || state.intake.travelPeriod || ""}`,
    `Quem vai: ${state.intake.adults || ""}, ${state.intake.children || ""}, ${state.intake.roomsCount || ""} quarto(s), ${state.intake.pet || ""}`,
    `Idades das crianças: ${(state.intake.childAges || []).join(", ") || "não informado"}`,
    `Última viagem: ${state.intake.lastTrip || ""}`,
    `Destino de interesse: ${state.intake.interestDestinationName || "não informado"}`,
    `Orçamento/época: ${state.answers.budget_season_strategy || ""}`,
    `Tipo de viagem: ${form.get("trip") || ""}`
  ].join("\n");
  trackEvent("lead_whatsapp_requested", analyticsResultPayload());
  persistLeadIntake("lead_requested");
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
    persistLeadIntake("diagnosis_completed");
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
  if (answers.budget_total === "Até R$ 1.500" || answers.budget_season_strategy === "Baixa temporada, prefiro custo-benefício") return "Família Boa Memória, Sem Loucura";
  if (intake.childAge === "0 a 12 meses" || intake.lastTrip === "Primeira viagem com criança" || answers.travel_goal === "Primeira viagem sem susto") return "Família Zero Perrengue, Checklist no Bolso";
  if (answers.travel_goal === "Praia e piscina" || answers.stay_style === "Praia com resort") return "Família Praia com Plano B";
  if (answers.stay_style === "Hotel fazenda" || answers.travel_goal === "Natureza e ar livre") return "Família Hotel Fazenda, Mesa Farta e Soneca";
  if (answers.travel_goal === "Parque ou muita atividade") return "Família Parque & Pausa Programada";
  if (answers.stay_style === "Resort completo" || answers.decision_profile === "Melhor estrutura, mesmo mais caro") return "Família Resort Raiz, Pulseirinha e Paz";
  return "Família Mini Aventureira, Mochila Leve";
}

function inferFamilyPersona(answers, intake, profileName = inferProfileName(answers, intake)) {
  const descriptions = {
    "Família Resort Raiz, Pulseirinha e Paz": "Vocês querem conforto, estrutura, recreação e pouca improvisação; a pulseirinha do resort entra quase como item de sobrevivência adulta",
    "Família Praia com Plano B": "Vocês amam praia, mas precisam de sombra, alimentação fácil e alternativa para chuva",
    "Família Hotel Fazenda, Mesa Farta e Soneca": "Vocês combinam com natureza, comida boa, espaço aberto e aquela tentativa nobre de todo mundo descansar ao mesmo tempo",
    "Família Mini Aventureira, Mochila Leve": "Vocês gostam de novidade, mas precisam equilibrar passeio com descanso; aventura sim, roteiro impossível não",
    "Família Parque & Pausa Programada": "Vocês querem encantamento e atividade, com atenção para fila, estímulo e uma pausa oficial para recuperar a humanidade",
    "Família Boa Memória, Sem Loucura": "Vocês querem criar memória boa com escolhas espertas, sem transformar a viagem em operação de guerra",
    "Família Zero Perrengue, Checklist no Bolso": "Vocês priorizam previsibilidade, conforto, segurança e facilidade; o checklist vem antes da mala emocional"
  };
  return `Perfil: ${descriptions[profileName] || descriptions["Família Mini Aventureira, Mochila Leve"]}`;
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

function travelTimingInsight() {
  const window = selectedTravelWindow();
  const label = state.intake?.travelPeriod || "Ainda nao sei";
  if (window.mode === "unknown") {
    return {
      label,
      climate: "data aberta: clima depende da cidade escolhida",
      events: "vou sinalizar eventos e feriados em cada destino"
    };
  }
  const climate = window.months.length === 1
    ? genericClimateForMonth(window.months[0])
    : genericClimateForMonthRange(window.months);
  return {
    label,
    climate,
    events: window.eventHint
  };
}

function destinationTimingInsight(recommendation, bestHotel, liveSummary) {
  const window = selectedTravelWindow();
  const months = window.months.length ? window.months : [new Date().getMonth() + 1];
  const climate = destinationClimateLabel(recommendation, bestHotel, months);
  const matchingEvents = matchingLiveEvents(liveSummary?.top_events, window).slice(0, 2);
  const matchingHolidays = matchingLiveEvents(liveSummary?.holiday_windows, window).slice(0, 1);
  const movement = liveSummary?.movimento_level || "movimento a validar";
  if (matchingEvents.length) {
    return {
      primary: shortTravelWindowLabel(window),
      detail: `${climate}; evento: ${eventShortLabel(matchingEvents[0])}`
    };
  }
  if (matchingHolidays.length) {
    return {
      primary: shortTravelWindowLabel(window),
      detail: `${climate}; janela escolar/feriado na base`
    };
  }
  return {
    primary: shortTravelWindowLabel(window),
    detail: `${climate}; ${movement}${liveSummary?.event_count ? `, ${liveSummary.event_count} eventos mapeados` : ", sem evento forte na janela"}`
  };
}

function selectedTravelWindow() {
  const intake = state.intake || {};
  const mode = intake.travelTimingMode || "unknown";
  const now = new Date();
  if (mode === "date" && intake.travelDate) {
    const date = parseDateValue(intake.travelDate);
    const month = date ? date.getMonth() + 1 : 0;
    const end = date ? new Date(date) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return {
      mode,
      label: intake.travelPeriod,
      shortLabel: month ? monthName(month) : "data",
      start: date,
      end,
      months: month ? [month] : [],
      eventHint: "eventos filtrados pela data escolhida"
    };
  }
  if (mode === "month" && intake.travelMonth) {
    const [year, monthText] = String(intake.travelMonth).split("-");
    const month = Number(monthText);
    return {
      mode,
      label: intake.travelPeriod,
      shortLabel: month ? monthName(month) : "mes",
      start: month ? new Date(Number(year), month - 1, 1) : null,
      end: month ? new Date(Number(year), month, 0, 23, 59, 59) : null,
      months: month ? [month] : [],
      eventHint: "eventos filtrados pelo mes escolhido"
    };
  }
  if (mode === "flexible") {
    const flexible = intake.flexibleWindow || "";
    const normalizedFlexible = removeAccents(flexible).toLowerCase();
    if (normalizedFlexible.includes("ferias")) return namedMonthWindow([1, 7, 12], intake.travelPeriod, "ferias escolares pedem reserva cedo");
    if (flexible.includes("30")) return rollingWindow(now, 30, intake.travelPeriod);
    if (flexible.includes("6 meses")) return rollingWindow(now, 180, intake.travelPeriod);
    if (flexible.includes("Ferias") || flexible.includes("FÃ©rias")) return namedMonthWindow([1, 7, 12], intake.travelPeriod, "ferias escolares pedem reserva cedo");
    if (flexible.includes("Feriado")) return namedMonthWindow([new Date().getMonth() + 1], intake.travelPeriod, "feriados tendem a elevar estrada, diaria e restaurantes");
    return rollingWindow(now, 90, intake.travelPeriod);
  }
  return {
    mode: "unknown",
    label: intake.travelPeriod || "Ainda nao sei",
    shortLabel: "Data aberta",
    start: null,
    end: null,
    months: [],
    eventHint: "eventos avaliados quando a janela ficar clara"
  };
}

function rollingWindow(start, days, label) {
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return {
    mode: "flexible",
    label: label || "Data flexivel",
    shortLabel: days <= 31 ? "30 dias" : days >= 170 ? "6 meses" : "3 meses",
    start,
    end,
    months: monthsBetween(start, end),
    eventHint: "eventos reais buscados dentro da janela flexivel"
  };
}

function namedMonthWindow(months, label, eventHint) {
  return {
    mode: "flexible",
    label: label || "Data flexivel",
    shortLabel: label?.replace("Data flexÃ­vel: ", "").replace("Data flexivel: ", "") || "Janela flexivel",
    start: null,
    end: null,
    months,
    eventHint
  };
}

function monthsBetween(start, end) {
  const months = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= limit && months.length < 12) {
    months.push(cursor.getMonth() + 1);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return unique(months);
}

function matchingLiveEvents(events, window) {
  if (!Array.isArray(events) || !events.length) return [];
  return events.filter(item => {
    const date = parseDateValue(item.start || item.end);
    if (!date) return false;
    if (window.start && window.end) return date >= window.start && date <= window.end;
    return window.months.includes(date.getMonth() + 1);
  });
}

function eventShortLabel(event) {
  const date = parseDateValue(event.start || event.end);
  const dateLabel = date ? `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}` : "data a validar";
  const title = String(event.title || "evento local");
  return `${dateLabel} ${title.length > 46 ? `${title.slice(0, 43)}...` : title}`;
}

function shortTravelWindowLabel(window) {
  return window.shortLabel || window.label || "Data aberta";
}

function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthName(month) {
  return ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"][month - 1] || "mes";
}

function genericClimateForMonth(month) {
  if ([12, 1, 2, 3].includes(month)) return "calor, chuva de verao e maior demanda em praias";
  if ([6, 7, 8].includes(month)) return "clima mais seco/frio; serra lota e encarece";
  if ([4, 5, 9, 10].includes(month)) return "transicao boa para custo-beneficio e menos lotacao";
  return "primavera/verao: calor cresce e chuva pode aparecer";
}

function genericClimateForMonthRange(months) {
  if (months.some(month => [12, 1, 2].includes(month))) return "inclui meses quentes: bom para agua, pior para pico de preco";
  if (months.some(month => [6, 7, 8].includes(month))) return "inclui inverno/ferias: serra valoriza, destinos lotam mais";
  return "janela flexivel favorece comparar clima, tarifa e lotacao";
}

function destinationClimateLabel(recommendation, bestHotel, months) {
  const slug = bestHotel.destinationSlug || recommendation.key || "";
  const firstMonth = months[0] || new Date().getMonth() + 1;
  const beach = isBeachDestination(bestHotel) || /praia|guaruja|forte|galinhas|maragogi|maceio|litoral/i.test(slug);
  const mountain = /gramado|campos|jordan|serra/i.test(slug);
  const park = /orlando|beto|olimpia|rio-quente/i.test(slug);
  if (mountain) {
    if ([6, 7, 8].includes(firstMonth)) return "frio/alta procura na serra";
    if ([12, 1, 2, 3].includes(firstMonth)) return "serra mais amena, chuva de verao possivel";
    return "serra com clima ameno e melhor para passeios";
  }
  if (beach) {
    if ([4, 5, 6, 7].includes(firstMonth)) return "praia com maior risco de chuva em parte do Nordeste";
    if ([12, 1, 2].includes(firstMonth)) return "calor forte e alta demanda";
    return "boa chance de praia, checar mar e chuva";
  }
  if (park) {
    if ([12, 1, 2, 7].includes(firstMonth)) return "parques mais cheios; programe pausas";
    if ([6, 7, 8, 9].includes(firstMonth) && slug.includes("orlando")) return "calor/chuvas em Orlando, com filas sazonais";
    return "parques pedem ritmo leve e plano B";
  }
  if ([12, 1, 2, 3].includes(firstMonth)) return "interior quente, chuva de verao possivel";
  if ([6, 7, 8].includes(firstMonth)) return "interior mais seco/frio pela manha";
  return "clima geralmente mais ameno e previsivel";
}

function estimateOneWayKm(recommendation, bestHotel, googleCoverage) {
  const manual = {
    "campinas-sp": 99,
    "atibaia-sp": 67,
    "mogi-das-cruzes-sp": 62,
    "cesario-lange-sp": 150,
    "sao-roque-sp": 63,
    "guaruja-sp": 95,
    "dourado-sp": 290,
    "campos-do-jordao-sp": 180,
    "olimpia-sp": 440
  };
  const key = recommendation.key || cityKeyForHotel(bestHotel);
  if (manual[key]) return manual[key];
  if (googleCoverage?.latitude && googleCoverage?.longitude) {
    const straightKm = haversineKm(SAO_PAULO_CENTER, googleCoverage);
    return Math.round(straightKm * (straightKm > 180 ? 1.22 : 1.34));
  }
  if (bestHotel.driveTimeFromSaoPaulo) return Math.round((bestHotel.driveTimeFromSaoPaulo / 60) * 68);
  return 0;
}

function estimateDriveMinutes(oneWayKm) {
  if (!oneWayKm) return 0;
  const speed = oneWayKm <= 90 ? 55 : oneWayKm <= 180 ? 68 : 74;
  return Math.round((oneWayKm / speed) * 60);
}

function tollRoundTripEstimate(recommendation, bestHotel) {
  const tollOneWay = {
    "campinas-sp": 26,
    "atibaia-sp": 6,
    "mogi-das-cruzes-sp": 0,
    "cesario-lange-sp": 42,
    "sao-roque-sp": 18,
    "guaruja-sp": 38,
    "dourado-sp": 58,
    "campos-do-jordao-sp": 24,
    "olimpia-sp": 78,
    "resort-interior-sp": 18,
    "hotel-fazenda-sp": 58,
    "litoral-norte-sp": 38
  };
  const key = recommendation.key || cityKeyForHotel(bestHotel);
  return (tollOneWay[key] || 0) * 2;
}

function nightlyEstimateForHotel(hotel) {
  const base = {
    budget: 520,
    mid: 780,
    upscale: 1250,
    luxury: 1900
  }[hotel.priceTier] || 980;
  const mealMultiplier = hotel.allInclusive ? 1.28 : mealPlanForHotel(hotel) === "fullBoard" ? 1.14 : 1;
  return Math.round(base * mealMultiplier);
}

function foodDailyEstimate(hotel, familyPeople) {
  if (hotel.allInclusive || mealPlanForHotel(hotel) === "fullBoard") return 0;
  if (hotel.hasKitchenette) return Math.round(familyPeople * 65);
  return Math.round(familyPeople * 115);
}

function mealPlanForHotel(hotel) {
  if (hotel.allInclusive) return "allInclusive";
  const text = [hotel.mainStrength, hotel.verdict, hotel.sourceHighlights?.join(" ")].join(" ");
  if (/pens[aã]o completa|refei[cç][oõ]es inclu/i.test(removeAccents(text))) return "fullBoard";
  if (hotel.hasKitchenette) return "kitchenette";
  return "breakfastOnly";
}

function mealPlanLabel(hotel) {
  const plan = mealPlanForHotel(hotel);
  if (plan === "allInclusive") return "all inclusive";
  if (plan === "fullBoard") return "pensão completa";
  if (plan === "kitchenette") return "cozinha de apoio";
  return "refeições à parte";
}

function averageGoogleHotelRating(hotels) {
  const ratings = hotels
    .map(hotel => Number(googleCoverageForHotel(hotel)?.rating || 0))
    .filter(Boolean);
  if (!ratings.length) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function haversineKm(from, to) {
  const radius = 6371;
  const dLat = degreesToRadians(Number(to.latitude) - Number(from.latitude));
  const dLng = degreesToRadians(Number(to.longitude) - Number(from.longitude));
  const lat1 = degreesToRadians(Number(from.latitude));
  const lat2 = degreesToRadians(Number(to.latitude));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value) {
  return value * Math.PI / 180;
}

function formatMinutesLabel(minutes) {
  const numeric = Number(minutes);
  if (!numeric) return "tempo a validar";
  const hours = Math.floor(numeric / 60);
  const mins = numeric % 60;
  if (!hours) return `${mins} min`;
  return mins ? `${hours}h${String(mins).padStart(2, "0")}` : `${hours}h`;
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
    headline: `${formatMoneyEstimate(economicMin)} a ${formatMoneyEstimate(balancedMax)}`,
    economic: `${formatMoneyEstimate(economicMin)}-${formatMoneyEstimate(economicMax)}`,
    balanced: `${formatMoneyEstimate(balancedMin)}-${formatMoneyEstimate(balancedMax)}`,
    comfort: `${formatMoneyEstimate(comfortMin)}-${formatMoneyEstimate(comfortMax)}`,
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

function formatMoneyEstimate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "R$ ?";
  if (Math.abs(numeric) >= 1000) {
    const rounded = Math.round(numeric / 100) / 10;
    return `R$ ${rounded.toLocaleString("pt-BR", {
      minimumFractionDigits: Number.isInteger(rounded) ? 0 : 1,
      maximumFractionDigits: 1
    })}k`;
  }
  const rounded = Math.round(numeric / 50) * 50;
  return `R$ ${rounded.toLocaleString("pt-BR")}`;
}

function numberLabel(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
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
  if (destination.includes("aguas de lindoia") || destination.includes("lindoia")) return "aguas-de-lindoia";
  if (destination.includes("mogi")) return "mogi-das-cruzes";
  if (destination.includes("cesario")) return "cesario-lange";
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

function normalizePhone(value) {
  return String(value || "").replace(/\D+/g, "");
}

function normalizeWebsiteUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^https?:\/\//i.test(text) ? text : `https://${text}`;
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
