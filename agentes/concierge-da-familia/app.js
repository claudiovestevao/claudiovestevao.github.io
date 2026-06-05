import { conciergeDestinations } from "./src/data/conciergeFamilyDestinations.js";
import { conciergeHotels } from "./src/data/conciergeFamilyHotels.js";
import { conciergeQuizQuestions } from "./src/data/conciergeFamilyQuiz.js";
import { conciergeCalendar } from "./src/data/conciergeFamilyCalendar.js";

const WHATSAPP_NUMBER = "5511956607921";
const state = {
  quizIndex: 0,
  answers: {},
  result: null,
  selectedCalendar: "julho",
  hotelFilter: "all"
};

const app = document.getElementById("app");

document.addEventListener("click", handleClick);
document.addEventListener("input", handleInput);
render();

function render() {
  app.innerHTML = `
    ${ConciergeHeroSection()}
    ${SaoPauloMvpFocusSection()}
    ${ConciergeDifferentiationSection()}
    ${ConciergeDiagnosisQuiz()}
    ${state.result ? ConciergeDiagnosisResult(state.result) : ""}
    ${BabyConciergeScore()}
    ${CuratedDestinationsSection()}
    ${CuratedHotelsSection()}
    ${TravelCalendarSection()}
    ${AvoidPerrengueSection()}
    ${ConciergeDatabaseSection()}
    ${CommercialTransparencySection()}
    ${ConciergeLeadCaptureForm()}
  `;
}

function AgentCardConciergeFamilia() {
  return {
    name: "Concierge da Familia",
    description: "Encontre destinos, resorts e roteiros que realmente funcionam para familias da capital de Sao Paulo com bebes e criancas pequenas.",
    tags: ["Viagens com bebes", "Familias de Sao Paulo", "Resorts com copa baby", "Roteiros em familia", "Curadoria premium", "IA para planejamento"],
    cta: "Planejar viagem da familia"
  };
}

function ConciergeHeroSection() {
  return `
    <section class="hero section" id="topo">
      <div class="hero-copy">
        <span class="badge">MVP exclusivo para familias da capital de Sao Paulo</span>
        <h1>Planeje a viagem da sua familia saindo de Sao Paulo, com a seguranca de quem entende bebes.</h1>
        <p>O Concierge da Familia encontra destinos, hoteis e roteiros avaliados por copa baby, voo curto, traslado facil, viagem de carro viavel, alimentacao, rotina, seguranca e plano B.</p>
        <strong class="hero-line">Bonito no Instagram nao basta. Precisa funcionar com bebe, saindo de Sao Paulo.</strong>
        <div class="hero-actions">
          <a class="button primary" href="#diagnostico">Comecar diagnostico</a>
          <a class="button secondary" href="#destinos">Ver destinos saindo de SP</a>
        </div>
      </div>
      <div class="sp-map" aria-label="Mapa ilustrativo com Sao Paulo como origem">
        <div class="map-world">Futuro: outras regioes</div>
        <div class="sp-dot">SP</div>
        <span class="route r1"></span>
        <span class="route r2"></span>
        <span class="route r3"></span>
        <span class="floating-card c1">Voo direto</span>
        <span class="floating-card c2">Traslado ate 1h</span>
        <span class="floating-card c3">Copa baby confirmada</span>
        <span class="floating-card c4">Carro ate 3h</span>
      </div>
    </section>
  `;
}

function SaoPauloMvpFocusSection() {
  const cards = [
    ["Aeroportos certos", "Congonhas, Guarulhos e Viracopos avaliados conforme destino e perfil da familia."],
    ["Viagens de carro realistas", "Foco em destinos viaveis saindo da capital, com tempo de estrada adequado para bebe."],
    ["Calendario paulistano", "Ferias escolares, feriados prolongados, verao, julho e Reveillon."],
    ["Curadoria mais precisa", "Menos opcoes genericas, mais recomendacoes que funcionam na pratica."]
  ];
  return `
    <section class="section band" id="mvp-sp">
      <div class="section-title">
        <span class="badge subtle">Comecamos por Sao Paulo</span>
        <h2>Comecamos por Sao Paulo para recomendar melhor.</h2>
        <p>Viagem com bebe depende muito do ponto de partida. Para uma familia que mora na capital de Sao Paulo, faz diferenca saber se o melhor caminho e sair por Congonhas, Guarulhos, Viracopos ou ir de carro.</p>
        <p>Tambem importa o tempo real ate o aeroporto, o horario do voo, o traslado no destino e se a viagem respeita a rotina da crianca. Depois, a curadoria podera ser expandida para outras cidades, regioes e paises.</p>
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
        <h2>Nao e um buscador de viagem. E um concierge para familias paulistanas.</h2>
        <p>Buscadores comuns mostram preco, fotos e avaliacoes genericas. O Concierge da Familia avalia os detalhes que realmente importam para quem viaja com bebe saindo de Sao Paulo.</p>
      </div>
      <div class="compare">
        <div>
          <h3>Buscadores comuns mostram</h3>
          ${BulletList(["preco", "fotos", "estrelas", "nota geral", "localizacao", "disponibilidade"])}
        </div>
        <div class="highlight">
          <h3>Concierge da Familia avalia</h3>
          ${BulletList(["qual aeroporto faz mais sentido?", "o voo e direto?", "o horario e bom para crianca?", "o traslado no destino e curto?", "da para ir de carro sem estourar a rotina?", "tem copa baby?", "funciona com carrinho?", "ha farmacia ou hospital por perto?", "funciona em dia de chuva?", "e bom para bebe ou so para crianca maior?"])}
        </div>
      </div>
    </section>
  `;
}

function ConciergeDiagnosisQuiz() {
  const question = conciergeQuizQuestions[state.quizIndex];
  const progress = Math.round((state.quizIndex / conciergeQuizQuestions.length) * 100);
  return `
    <section class="section quiz-section" id="diagnostico">
      <div class="section-title">
        <span class="badge subtle">Diagnostico inteligente</span>
        <h2>Descubra a viagem ideal para sua familia saindo de Sao Paulo</h2>
        <p>Uma boa viagem com bebe comeca antes da reserva. Responda uma conversa curta e veja um resultado simulado.</p>
      </div>
      <div class="quiz-card">
        <div class="quiz-top">
          <span>Pergunta ${state.quizIndex + 1} de ${conciergeQuizQuestions.length}</span>
          <div class="progress"><i style="width:${progress}%"></i></div>
        </div>
        <h3>${escapeHtml(question.question)}</h3>
        <div class="chips ${question.type === "multi" ? "multi" : ""}">
          ${question.options.map(option => QuizOption(question, option)).join("")}
        </div>
        ${question.type === "multi" ? `<p class="micro">Escolha ate ${question.max} itens.</p>` : ""}
        <div class="quiz-actions">
          <button class="button secondary" data-action="quiz-back" ${state.quizIndex === 0 ? "disabled" : ""}>Voltar</button>
          ${question.type === "multi" ? `<button class="button primary" data-action="quiz-next">${state.quizIndex === conciergeQuizQuestions.length - 1 ? "Ver resultado" : "Continuar"}</button>` : ""}
        </div>
      </div>
    </section>
  `;
}

function QuizOption(question, option) {
  const answer = state.answers[question.id];
  const active = Array.isArray(answer) ? answer.includes(option) : answer === option;
  return `<button class="chip ${active ? "active" : ""}" data-action="quiz-answer" data-question="${question.id}" data-value="${escapeAttr(option)}">${escapeHtml(option)}</button>`;
}

function ConciergeDiagnosisResult(result) {
  return `
    <section class="section result-section" id="resultado">
      <div class="section-title">
        <span class="badge">Resultado simulado</span>
        <h2>Seu perfil de viagem saindo de Sao Paulo</h2>
        <p>${escapeHtml(result.profile)}</p>
      </div>
      <div class="grid three">
        <div class="result-card good">
          <h3>Recomendamos priorizar</h3>
          ${BulletList(result.prioritize)}
        </div>
        <div class="result-card avoid">
          <h3>Evitar por enquanto</h3>
          ${BulletList(result.avoid)}
        </div>
        <div class="result-card">
          <h3>3 caminhos que combinam</h3>
          ${result.paths.map(path => `
            <article class="mini-path">
              <strong>${escapeHtml(path.title)}</strong>
              <span>${escapeHtml(path.text)}</span>
            </article>
          `).join("")}
        </div>
      </div>
      <a class="button primary wide" href="${leadWhatsAppUrl("Quero receber opcoes curadas para minha familia saindo de Sao Paulo.")}" target="_blank" rel="noopener">Receber opcoes curadas no WhatsApp</a>
    </section>
  `;
}

function BabyConciergeScore() {
  const criteria = [
    ["Copa baby e estrutura infantil", 25],
    ["Voo direto, curto ou estrada viavel", 15],
    ["Traslado simples no destino", 15],
    ["Alimentacao e rotina", 15],
    ["Seguranca e saude por perto", 10],
    ["Hotel que sustenta dia de chuva", 10],
    ["Conforto dos pais", 10]
  ];
  const labels = ["Excelente para bebe", "Bom para toddler", "Melhor acima de 4 anos", "Evitar com bebe pequeno", "So vale com carro", "Otimo para primeira viagem", "Bom saindo de Congonhas", "Bom saindo de Guarulhos", "Melhor ir de carro", "Traslado longo: atencao"];
  return `
    <section class="section score-section" id="score">
      <div class="section-title">
        <span class="badge subtle">Metodo proprietario</span>
        <h2>Score Bebe Concierge</h2>
        <p>Uma avaliacao pensada para saber se aquela viagem realmente funciona para familias que saem de Sao Paulo com bebe.</p>
      </div>
      <div class="score-layout">
        <div class="score-meter">
          <strong>8,7</strong>
          <span>/10</span>
          <p>Exemplo: primeira viagem com bebe saindo da capital.</p>
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
        <h2>Destinos que funcionam saindo de Sao Paulo</h2>
        <p>Dados mockados para demonstrar a visao do produto. A curadoria real combinara dados publicos, informacoes oficiais, validacao direta e revisao editorial.</p>
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
      <div class="card-head">
        <span class="score">${destination.score.toFixed(1)}/10</span>
        <span class="badge subtle">${escapeHtml(destination.bestDepartureMode)}</span>
      </div>
      <h3>${escapeHtml(destination.name)}</h3>
      <p>${escapeHtml(destination.region)}</p>
      <dl>
        <div><dt>Melhor idade</dt><dd>${escapeHtml(destination.idealAge)}</dd></div>
        <div><dt>Melhor epoca</dt><dd>${escapeHtml(destination.bestSeason)}</dd></div>
        <div><dt>Saida de SP</dt><dd>${escapeHtml(destination.recommendedAirport || destination.driveTimeFromSaoPaulo || "avaliar caso a caso")}</dd></div>
        <div><dt>Voo/traslado</dt><dd>${escapeHtml([destination.flightFromSP, destination.transferTime].filter(Boolean).join(" · ") || "sem aviao")}</dd></div>
      </dl>
      <div class="tags">${destination.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <strong class="verdict">${escapeHtml(destination.verdict)}</strong>
      <details>
        <summary>Ver analise concierge</summary>
        <b>Pontos fortes</b>
        ${BulletList(destination.strengths)}
        <b>Pontos de atencao</b>
        ${BulletList(destination.attentionPoints)}
      </details>
    </article>
  `;
}

function CuratedHotelsSection() {
  const filters = [
    ["all", "Todos"],
    ["drive2", "Carro ate 2h"],
    ["drive3", "Carro ate 3h"],
    ["direct", "Voo direto"],
    ["copa", "Copa baby"],
    ["copa24", "Copa baby 24h"],
    ["allinclusive", "All inclusive"],
    ["rain", "Funciona com chuva"],
    ["noCar", "Nao precisa alugar carro"]
  ];
  const filtered = conciergeHotels.filter(matchesHotelFilter);
  return `
    <section class="section band" id="hoteis">
      <div class="section-title">
        <span class="badge subtle">Sem parcerias reais declaradas</span>
        <h2>Resorts e hoteis pensados para bebes, partindo de Sao Paulo</h2>
        <p>Cards placeholder para testar a experiencia. Nenhuma comodidade deve ser tratada como validada sem confirmacao.</p>
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
      <div class="card-head">
        <span class="score">${hotel.score.toFixed(1)}/10</span>
        <span class="badge subtle">${hotel.confidenceLevel === "mock" ? "dados mockados" : "validado"}</span>
      </div>
      <h3>${escapeHtml(hotel.name)}</h3>
      <p>${escapeHtml(hotel.destination)}</p>
      <dl>
        <div><dt>Indicado para</dt><dd>${escapeHtml(hotel.idealAge)}</dd></div>
        <div><dt>Saida</dt><dd>${escapeHtml(hotel.departureMode === "carro" ? "carro da capital de Sao Paulo" : hotel.recommendedAirport || "avaliar voo")}</dd></div>
        <div><dt>Tempo estimado</dt><dd>${escapeHtml(hotel.driveTimeFromSaoPaulo ? `ate ${Math.round(hotel.driveTimeFromSaoPaulo / 60)}h${hotel.driveTimeFromSaoPaulo % 60 ? "30" : ""}` : `${hotel.transferMinutes || "?"} min de traslado`)}</dd></div>
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
        <p><b>Ponto de atencao:</b> ${escapeHtml(hotel.attentionPoint)}</p>
      </details>
    </article>
  `;
}

function TravelCalendarSection() {
  const selected = conciergeCalendar.find(item => item.id === state.selectedCalendar) || conciergeCalendar[0];
  return `
    <section class="section" id="calendario">
      <div class="section-title">
        <span class="badge subtle">Calendario paulistano</span>
        <h2>Para quando voces querem viajar saindo de Sao Paulo?</h2>
        <p>Feriado, ferias e alta temporada mudam completamente a logistica de uma familia com bebe.</p>
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
            <h4>Pontos de atencao</h4>
            ${BulletList(selected.attention)}
          </div>
        </div>
        <a class="button secondary" href="#lead">Encontrar minha viagem de ${escapeHtml(selected.label)}</a>
      </div>
    </section>
  `;
}

function AvoidPerrengueSection() {
  const items = ["voos que chegam tarde demais", "conexoes desnecessarias", "sair por aeroporto ruim para o perfil da familia", "hoteis bonitos, mas longe de tudo", "resorts com traslado muito longo", "viagens de carro longas demais para bebe", "praias lindas, mas ruins para bebe", "passeios incompatíveis com soneca", "restaurantes com fila e pouca estrutura", "destinos sem plano B para chuva", "hoteis family-friendly so no marketing"];
  return `
    <section class="section band">
      <div class="section-title">
        <h2>A gente tambem te diz o que evitar saindo de Sao Paulo</h2>
        <p>A melhor curadoria nao e so dizer para onde ir. E ajudar sua familia a evitar escolhas que parecem boas na foto, mas viram perrengue na pratica.</p>
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
        <p>A base do Concierge da Familia sera construida combinando dados publicos, informacoes oficiais dos hoteis, validacao direta com fornecedores, avaliacoes de familias e revisao editorial.</p>
      </div>
      <div class="database-examples">
        <div>
          <h3>Copa baby 24h</h3>
          ${BulletList(["declarada pelo hotel", "confirmada com foto", "validada por familias", "ultima atualizacao", "nivel de confianca"])}
        </div>
        <div>
          <h3>Saida de Sao Paulo</h3>
          ${BulletList(["aeroporto recomendado", "tempo de voo", "tempo ate aeroporto", "traslado no destino", "necessidade de carro", "risco de horario ruim"])}
        </div>
      </div>
    </section>
  `;
}

function CommercialTransparencySection() {
  return `
    <section class="section transparency">
      <span class="badge">Gratuito para familias</span>
      <h2>Gratuito para familias. Transparente nas recomendacoes.</h2>
      <p>O Concierge da Familia e gratuito para familias. No futuro, poderemos receber comissao ou apoio comercial de parceiros quando uma reserva for feita, mas as recomendacoes devem seguir criterios claros de curadoria: estrutura, logistica, seguranca, rotina e adequacao a idade da crianca.</p>
      <p><strong>Parceiros podem aparecer em destaque, mas nunca substituem o veredito concierge.</strong></p>
    </section>
  `;
}

function ConciergeLeadCaptureForm() {
  return `
    <section class="section lead-section" id="lead">
      <div class="lead-box">
        <div>
          <span class="badge subtle">Proximo passo</span>
          <h2>Quer receber opcoes curadas para sua familia saindo de Sao Paulo?</h2>
          <p>Sem spam. A ideia e te ajudar a escolher uma viagem que funcione para sua familia.</p>
        </div>
        <form id="leadForm" class="lead-form">
          <label>Nome<input name="name" required placeholder="Seu nome"></label>
          <label>WhatsApp<input name="phone" required inputmode="tel" placeholder="11999999999"></label>
          <label>Regiao de Sao Paulo<input name="region" placeholder="Ex: Zona Sul"></label>
          <label>Idade da crianca<input name="age" placeholder="Ex: 1 ano e 8 meses"></label>
          <label>Mes provavel da viagem<input name="month" placeholder="Ex: julho"></label>
          <label>Tipo de viagem desejada<input name="trip" placeholder="Ex: resort com copa baby"></label>
          <button class="button primary" type="submit">Receber opcoes curadas no WhatsApp</button>
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
  if (action === "hotel-filter") {
    state.hotelFilter = target.dataset.filter;
    render();
  }
  if (action === "calendar") {
    state.selectedCalendar = target.dataset.calendar;
    render();
  }
}

function handleInput() {}

document.addEventListener("submit", event => {
  if (event.target.id !== "leadForm") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const text = [
    "Oi! Quero receber opcoes curadas do Concierge da Familia.",
    `Nome: ${form.get("name") || ""}`,
    `WhatsApp: ${form.get("phone") || ""}`,
    `Regiao de SP: ${form.get("region") || ""}`,
    `Idade da crianca: ${form.get("age") || ""}`,
    `Mes provavel: ${form.get("month") || ""}`,
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
  const concerns = arrayAnswer(answers.main_concerns);
  const must = arrayAnswer(answers.must_have);
  const avoidPlane = answers.max_flight === "Prefiro evitar aviao" || answers.airport_preference === "Prefiro evitar aviao";
  const babySmall = ["0 a 6 meses", "6 a 12 meses"].includes(answers.child_age);
  const south = answers.sao_paulo_region === "Zona Sul";
  const july = answers.travel_period === "Ferias de julho";
  const profile = `Familia de ${answers.sao_paulo_region || "Sao Paulo"}, com ${answers.child_age || "crianca pequena"}, busca ${answers.trip_type || "uma viagem em familia"} e precisa equilibrar logistica, rotina e estrutura saindo da capital.`;
  const prioritize = [
    south ? "Congonhas pode ser conveniente dependendo do destino e horario, mas Guarulhos pode oferecer mais voos diretos." : "comparar Congonhas, Guarulhos e Viracopos conforme horario, destino e deslocamento de casa",
    avoidPlane ? "resort no interior de SP, hotel fazenda, Atibaia, Sao Roque ou litoral norte com alerta de transito" : "destino com voo direto, horario bom e traslado simples",
    babySmall ? "copa baby, hotel com restaurante, pouca necessidade de deslocamento e traslado ate 1h" : "roteiro leve com pausas e atividades adequadas por idade",
    concerns.includes("Sono/rotina") ? "hotel que sustente tarde de descanso e quarto silencioso" : "hotel com estrutura real para familia",
    july ? "resort no interior, hotel fazenda, Gramado com roteiro leve ou Nordeste com voo direto" : "plano B para chuva e conforto dos pais"
  ];
  const avoid = [
    "destinos com conexao desnecessaria",
    "voos chegando tarde da noite",
    "hoteis longe do aeroporto ou sem restaurante facil",
    concerns.includes("Estrada") ? "saida em horario de pico e estrada acima de 2h30 sem parada planejada" : "resorts com traslado acima de 2h",
    "roteiros com muitos passeios no mesmo dia"
  ];
  if (must.includes("Copa baby 24h")) prioritize.push("confirmar copa baby 24h com evidencia antes da reserva");
  return {
    profile,
    prioritize: unique(prioritize).slice(0, 6),
    avoid: unique(avoid).slice(0, 5),
    paths: [
      { title: "Resort no interior de SP", text: "melhor se quiser evitar aviao e reduzir logistica." },
      { title: "Nordeste com voo direto", text: "melhor se quiser praia e estrutura de resort." },
      { title: "Serra/cidade charmosa com roteiro leve", text: "melhor se quiser clima diferente, mas exige cuidado com deslocamentos e lotacao." }
    ]
  };
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
