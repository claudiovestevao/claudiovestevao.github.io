const DEFAULT_HASSLE = {
  familyHassleLevel: "moderado",
  hassleScore: 42,
  babyFriendlinessScore: 58,
  toddlerFriendlinessScore: 64,
  kids610FriendlinessScore: 72,
  teenFriendlinessScore: 70,
  bestMinimumAge: 3,
  avoidWithBaby: false,
  avoidWithToddler: false,
  requiresCar: true,
  requires4x4: false,
  requiresPrivateGuide: false,
  strollerFriendly: false,
  babyCarrierRecommended: true,
  napFriendly: false,
  medicalStructureWarning: false,
  longDriveWarning: true,
  boatWarning: false,
  altitudeWarning: false,
  heatWarning: false,
  coldWarning: false,
  rainWarning: false,
  limitedFoodOptionsWarning: false,
  mainHassles: ["validar deslocamento real", "escolher hospedagem familiar", "manter roteiro leve"],
  hassleMitigationTips: ["fazer no maximo uma atividade principal por dia", "mapear farmacia e hospital antes", "reservar pausas de descanso"],
  semPerrengueStrategy: "Use o destino como base leve: chegada sem pressa, uma atividade principal por dia e hospedagem bem localizada.",
  recommendedTripPace: "leve",
  maxActivitiesPerDayWithKids: 1,
  recommendedLodgingLocation: "hospedagem central ou com estrutura propria para criancas",
  whenToAvoid: ["feriados muito cheios sem reserva", "roteiro com muitas trocas de base"],
  whenItWorksWell: ["familia aceita ritmo leve", "hospedagem reduz deslocamentos"],
  honestSummary: "Pode funcionar para familias, mas a experiencia depende de hospedagem bem escolhida, ritmo leve e logistica realista.",
  shortHassleAlert: "Vale planejar bem para nao transformar passeio bonito em correria.",
  betterAlternatives: []
};

export const curatedFamilyHassleBySlug = {
  "cunha-sp": easy({
    bestMinimumAge: 0,
    honestSummary: "Cunha e uma das escolhas mais leves para sair de Sao Paulo: natureza, boa gastronomia, atelies e ritmo tranquilo.",
    shortHassleAlert: "Boa com bebe se a pousada tiver estrutura.",
    mainHassles: ["estradas rurais em alguns trechos", "chuva pode limitar passeios", "nem toda pousada tem estrutura de bebe"],
    semPerrengueStrategy: "Escolha uma pousada confortavel, faca lavandario/atelie em horario curto e deixe meio periodo livre por dia.",
    recommendedLodgingLocation: "perto do centro ou em pousada com restaurante proprio"
  }),
  "goncalves-mg": easy({
    bestMinimumAge: 0,
    honestSummary: "Goncalves combina muito com descanso, chale, comida boa e natureza sem pressa.",
    shortHassleAlert: "Otima para desacelerar com bebe.",
    mainHassles: ["estradas de terra podem cansar", "frio e chuva pedem plano B", "programacao infantil e mais contemplativa"],
    semPerrengueStrategy: "Use a hospedagem como experiencia principal e escolha restaurantes proximos, sem roteiro cheio."
  }),
  "sao-bento-do-sapucai-sp": easy({
    familyHassleLevel: "baixo",
    hassleScore: 28,
    bestMinimumAge: 0,
    honestSummary: "Sao Bento do Sapucai e forte para fim de semana de montanha com ritmo familiar, desde que as aventuras fiquem para criancas maiores.",
    shortHassleAlert: "Leve para bebe; aventura so para maiores.",
    mainHassles: ["atracoes de aventura nao servem para todas as idades", "carro ajuda bastante", "frio pode incomodar bebes"],
    coldWarning: true
  }),
  "urubici-sc": moderate({
    bestMinimumAge: 3,
    coldWarning: true,
    honestSummary: "Urubici encanta pelo frio e pela serra, mas exige carro, casacos bons e cuidado com estrada.",
    shortHassleAlert: "Familiar, mas frio e carro pedem planejamento.",
    mainHassles: ["frio intenso em algumas epocas", "atracoes espalhadas", "estradas e mirantes exigem cuidado"],
    semPerrengueStrategy: "Monte uma base confortavel, faca mirantes curtos e deixe passeios longos fora de dias seguidos."
  }),
  "sao-miguel-dos-milagres-al": easy({
    familyHassleLevel: "moderado",
    hassleScore: 36,
    bestMinimumAge: 0,
    boatWarning: true,
    honestSummary: "Sao Miguel dos Milagres pode ser maravilhoso com crianca pequena quando a mare e a hospedagem trabalham a favor da rotina.",
    shortHassleAlert: "Praia calma, mas depende de mare e hospedagem.",
    mainHassles: ["mare define o melhor horario", "deslocamentos locais podem ser lentos", "estrutura varia entre hospedagens"],
    semPerrengueStrategy: "Fique em hospedagem pe na areia ou muito proxima da praia e planeje passeios pela tabua de mare."
  }),
  "bonito-ms": moderate({
    bestMinimumAge: 5,
    avoidWithBaby: true,
    honestSummary: "Bonito e organizado e educativo, mas muitos passeios tem custo, horario marcado e idade minima.",
    shortHassleAlert: "Organizado, mas melhor com crianca que aproveita passeio.",
    mainHassles: ["idade minima em passeios", "agenda engessada", "custos altos por atividade", "deslocamentos ate atracoes"],
    semPerrengueStrategy: "Reserve so uma atividade principal por dia, priorize balnearios e cheque idade minima antes de comprar."
  }),
  "piranhas-al": moderate({
    bestMinimumAge: 3,
    heatWarning: true,
    boatWarning: true,
    honestSummary: "Piranhas e uma alternativa linda e educativa, mas calor e passeios de barco exigem horario certo.",
    shortHassleAlert: "Linda, mas calor e barco pedem cuidado.",
    mainHassles: ["calor forte", "passeios de barco", "escadarias e ruas inclinadas"],
    semPerrengueStrategy: "Faca passeios cedo, deixe a tarde para descanso e confirme colete/tamanho para criancas."
  }),
  "ponta-grossa-pr": moderate({
    bestMinimumAge: 4,
    honestSummary: "Ponta Grossa e Campos Gerais funcionam bem para familia curiosa, com natureza e passeios educativos.",
    shortHassleAlert: "Educativo, mas exige carro e caminhadas leves.",
    mainHassles: ["carro necessario", "algumas caminhadas", "vento/frio em areas abertas"],
    semPerrengueStrategy: "Escolha uma atracao por periodo e priorize Vila Velha com tempo folgado."
  }),
  "conceicao-do-ibitipoca-mg": hard({
    bestMinimumAge: 6,
    avoidWithBaby: true,
    avoidWithToddler: true,
    honestSummary: "Ibitipoca e belissima, mas o parque e as trilhas tornam a viagem pouco natural para bebe ou crianca pequena.",
    shortHassleAlert: "Parque lindo, mas trilhas dificultam com bebe.",
    mainHassles: ["trilhas", "estrutura rustica", "subidas", "pouca flexibilidade com carrinho"],
    semPerrengueStrategy: "Durma perto da vila, faca trilhas curtas e descarte qualquer roteiro de parque inteiro com criancas pequenas.",
    betterAlternatives: ["cunha-sp", "goncalves-mg", "ponta-grossa-pr"]
  }),
  "jalapao-to": veryHard({
    bestMinimumAge: 8,
    avoidWithBaby: true,
    avoidWithToddler: true,
    requires4x4: true,
    requiresPrivateGuide: true,
    heatWarning: true,
    medicalStructureWarning: true,
    honestSummary: "O Jalapao e magico, mas e uma operacao logistica pesada para familias com criancas pequenas.",
    shortHassleAlert: "Magico, mas pesado em deslocamento e estrutura.",
    mainHassles: ["muitas horas de carro", "estradas dificeis", "calor", "pouca flexibilidade", "estrutura medica distante"],
    semPerrengueStrategy: "So considere com criancas maiores, agencia excelente, roteiro curto, pausas reais e expectativa de aventura.",
    betterAlternatives: ["bonito-ms", "piranhas-al", "sao-miguel-dos-milagres-al", "urubici-sc"]
  }),
  "lencois-ba": hard({
    bestMinimumAge: 6,
    avoidWithBaby: true,
    avoidWithToddler: true,
    heatWarning: true,
    honestSummary: "Lencois e uma base incrivel para a Chapada Diamantina, mas nao e naturalmente facil para familias com bebes.",
    shortHassleAlert: "Lindo, mas pode ser puxado com bebe.",
    mainHassles: ["trilhas", "calor", "passeios longos", "dificuldade com carrinho", "rotina de sono prejudicada"],
    semPerrengueStrategy: "Fique bem localizado em Lencois, faca uma atracao leve por dia e use guia privado quando o passeio tiver deslocamento.",
    betterAlternatives: ["cunha-sp", "goncalves-mg", "bonito-ms", "ponta-grossa-pr"]
  }),
  "alto-paraiso-de-goias-go": hard({
    bestMinimumAge: 6,
    avoidWithBaby: true,
    avoidWithToddler: true,
    heatWarning: true,
    honestSummary: "Alto Paraiso e Sao Jorge entregam natureza forte, mas a Chapada exige carro, trilhas e escolhas conservadoras com criancas.",
    shortHassleAlert: "Chapada linda, mas exige trilha e planejamento.",
    mainHassles: ["trilhas", "estradas", "sol forte", "atracoes espalhadas"],
    semPerrengueStrategy: "Escolha base unica, evite cachoeiras longas e intercale passeio com dia de descanso.",
    betterAlternatives: ["bonito-ms", "ponta-grossa-pr", "urubici-sc"]
  }),
  "barra-grande-ba": hard({
    bestMinimumAge: 4,
    avoidWithBaby: true,
    requiresCar: true,
    longDriveWarning: true,
    rainWarning: true,
    honestSummary: "Barra Grande e peninsula de Marau sao lindas, mas o acesso pode consumir a energia da familia antes da praia.",
    shortHassleAlert: "Praia incrivel, acesso cansativo.",
    mainHassles: ["acesso dificil", "estrada ruim em chuva", "deslocamentos locais", "pouca previsibilidade"],
    semPerrengueStrategy: "Va com mais noites, transfer confiavel e hospedagem que resolva alimentacao e praia sem deslocamento diario.",
    betterAlternatives: ["sao-miguel-dos-milagres-al", "praia-do-forte-ba", "porto-de-galinhas-pe"]
  }),
  "alter-do-chao-pa": hard({
    bestMinimumAge: 5,
    avoidWithBaby: true,
    boatWarning: true,
    heatWarning: true,
    honestSummary: "Alter do Chao e uma experiencia amazonica especial, mas depende muito da epoca certa e de logistica bem combinada.",
    shortHassleAlert: "Encantador, mas epoca e barco mudam tudo.",
    mainHassles: ["calor", "barcos", "epoca das praias", "estrutura variavel"],
    semPerrengueStrategy: "Viaje na epoca adequada, reduza passeios de barco longos e fique perto da vila.",
    betterAlternatives: ["piranhas-al", "bonito-ms", "sao-miguel-dos-milagres-al"]
  }),
  "pocon-chile": hard({
    bestMinimumAge: 6,
    avoidWithBaby: true,
    coldWarning: true,
    honestSummary: "Pucon e lindo e completo, mas muitas experiencias sao de aventura, frio ou natureza ativa.",
    shortHassleAlert: "Completo, mas aventura pesa com pequenos.",
    mainHassles: ["atividades de aventura", "frio", "deslocamentos", "passeios com restricao de idade"],
    semPerrengueStrategy: "Priorize termas familiares, hospedagem central e passeios curtos; deixe vulcao e aventura para criancas maiores.",
    betterAlternatives: ["puerto-varas-chile", "villa-la-angostura-argentina"]
  }),
  "pucon-chile": hard({
    bestMinimumAge: 6,
    avoidWithBaby: true,
    coldWarning: true,
    honestSummary: "Pucon e lindo e completo, mas muitas experiencias sao de aventura, frio ou natureza ativa.",
    shortHassleAlert: "Completo, mas aventura pesa com pequenos.",
    mainHassles: ["atividades de aventura", "frio", "deslocamentos", "passeios com restricao de idade"],
    semPerrengueStrategy: "Priorize termas familiares, hospedagem central e passeios curtos; deixe vulcao e aventura para criancas maiores.",
    betterAlternatives: ["puerto-varas-chile", "villa-la-angostura-argentina"]
  }),
  "puerto-varas-chile": easy({
    familyHassleLevel: "moderado",
    hassleScore: 34,
    bestMinimumAge: 0,
    coldWarning: true,
    honestSummary: "Puerto Varas e uma das opcoes internacionais mais equilibradas para familias: bonita, estruturada e com ritmo adaptavel.",
    shortHassleAlert: "Boa internacional com crianca, cuidando do frio.",
    mainHassles: ["frio e chuva", "deslocamentos para parques", "logistica internacional"],
    semPerrengueStrategy: "Fique em hotel central, escolha dias leves e use passeios de meio periodo."
  }),
  "colonia-del-sacramento-uruguai": easy({
    bestMinimumAge: 0,
    requiresCar: false,
    strollerFriendly: true,
    napFriendly: true,
    honestSummary: "Colonia del Sacramento e pequena, caminhavel e muito boa para familias que querem charme sem maratona.",
    shortHassleAlert: "Pequena e tranquila, boa para bebe.",
    mainHassles: ["ruas de pedra podem incomodar carrinho", "poucas atracoes infantis tradicionais"],
    semPerrengueStrategy: "Fique no centro historico, faca caminhadas curtas e use cafes/restaurantes como pausas."
  })
};

curatedFamilyHassleBySlug["bonito"] = curatedFamilyHassleBySlug["bonito-ms"];
curatedFamilyHassleBySlug["sao-miguel-dos-milagres"] = curatedFamilyHassleBySlug["sao-miguel-dos-milagres-al"];
curatedFamilyHassleBySlug["urubici"] = curatedFamilyHassleBySlug["urubici-sc"];
curatedFamilyHassleBySlug["alter-do-chao"] = curatedFamilyHassleBySlug["alter-do-chao-pa"];
curatedFamilyHassleBySlug["pucon"] = curatedFamilyHassleBySlug["pucon-chile"];
curatedFamilyHassleBySlug["palmas-jalapao"] = curatedFamilyHassleBySlug["jalapao-to"];
curatedFamilyHassleBySlug["chapada-diamantina"] = curatedFamilyHassleBySlug["lencois-ba"];
curatedFamilyHassleBySlug["lencois-maranhenses"] = hard({
  bestMinimumAge: 5,
  avoidWithBaby: true,
  avoidWithToddler: true,
  heatWarning: true,
  boatWarning: true,
  honestSummary: "Lencois Maranhenses e um dos destinos mais bonitos do Brasil, mas a logistica de lagoas, sol, areia e passeios longos pode pesar com bebe.",
  shortHassleAlert: "Visual inesquecivel, mas areia, sol e deslocamento cansam.",
  mainHassles: ["calor e sol", "areia e 4x4", "passeios longos", "pouca sombra", "rotina de sono dificil"],
  semPerrengueStrategy: "Escolha base confortavel, evite horario de sol forte e faca poucos passeios, com pausas reais entre eles.",
  betterAlternatives: ["sao-miguel-dos-milagres", "piranhas-al", "bonito"]
});
curatedFamilyHassleBySlug["chapada-dos-veadeiros"] = curatedFamilyHassleBySlug["alto-paraiso-de-goias-go"];
curatedFamilyHassleBySlug["chapada-dos-guimaraes"] = hard({
  bestMinimumAge: 6,
  avoidWithBaby: true,
  avoidWithToddler: true,
  heatWarning: true,
  honestSummary: "Chapada dos Guimaraes e linda e mais acessivel que alguns destinos remotos, mas ainda envolve calor, mirantes, trilhas e carro.",
  shortHassleAlert: "Natureza forte, melhor com criancas que caminham bem.",
  mainHassles: ["calor", "mirantes e trilhas", "carro necessario", "pouca sombra em alguns passeios"],
  semPerrengueStrategy: "Fique em base unica, faca mirantes curtos e deixe trilhas longas para criancas maiores.",
  betterAlternatives: ["bonito", "ponta-grossa-pr", "urubici"]
});

export function applyFamilyHassleCuration(destination = {}) {
  const key = String(destination.slug || "").toLowerCase();
  const curated = curatedFamilyHassleBySlug[key] || inferHassle(destination);
  const explicit = Object.fromEntries(Object.entries({
    familyHassleLevel: destination.familyHassleLevel,
    hassleScore: destination.hassleScore,
    babyFriendlinessScore: destination.babyFriendlinessScore,
    toddlerFriendlinessScore: destination.toddlerFriendlinessScore,
    kids610FriendlinessScore: destination.kids610FriendlinessScore,
    teenFriendlinessScore: destination.teenFriendlinessScore,
    bestMinimumAge: destination.bestMinimumAge,
    avoidWithBaby: destination.avoidWithBaby,
    avoidWithToddler: destination.avoidWithToddler,
    requiresCar: destination.requiresCar,
    requires4x4: destination.requires4x4,
    requiresPrivateGuide: destination.requiresPrivateGuide,
    strollerFriendly: destination.strollerFriendly,
    babyCarrierRecommended: destination.babyCarrierRecommended,
    napFriendly: destination.napFriendly,
    medicalStructureWarning: destination.medicalStructureWarning,
    longDriveWarning: destination.longDriveWarning,
    boatWarning: destination.boatWarning,
    altitudeWarning: destination.altitudeWarning,
    heatWarning: destination.heatWarning,
    coldWarning: destination.coldWarning,
    rainWarning: destination.rainWarning,
    limitedFoodOptionsWarning: destination.limitedFoodOptionsWarning,
    mainHassles: destination.mainHassles?.length ? destination.mainHassles : undefined,
    hassleMitigationTips: destination.hassleMitigationTips?.length ? destination.hassleMitigationTips : undefined,
    semPerrengueStrategy: destination.semPerrengueStrategy,
    recommendedTripPace: destination.recommendedTripPace,
    maxActivitiesPerDayWithKids: destination.maxActivitiesPerDayWithKids,
    recommendedLodgingLocation: destination.recommendedLodgingLocation,
    whenToAvoid: destination.whenToAvoid?.length ? destination.whenToAvoid : undefined,
    whenItWorksWell: destination.whenItWorksWell?.length ? destination.whenItWorksWell : undefined,
    honestSummary: destination.honestSummary,
    shortHassleAlert: destination.shortHassleAlert,
    betterAlternatives: destination.betterAlternatives?.length ? destination.betterAlternatives : undefined
  }).filter(([, value]) => value !== undefined && value !== null && value !== ""));
  const merged = { ...DEFAULT_HASSLE, ...curated, ...explicit };
  return {
    ...destination,
    ...merged,
    familyScore: calculateFamilyFitScore(destination.familyScore, merged),
    categoryScores: {
      ...(destination.categoryScores || {}),
      hassle: Math.max(0, Math.round((10 - merged.hassleScore / 10) * 10) / 10)
    }
  };
}

export function calculateFamilyFitScore(baseFamilyScore = 70, hassle = DEFAULT_HASSLE, preferences = {}) {
  let penalty = hasslePenalty(hassle.familyHassleLevel);
  const childAge = Number(preferences.youngestChildAge);
  if (Number.isFinite(childAge)) {
    if (childAge <= 2 && hassle.avoidWithBaby) penalty += 25;
    if (childAge >= 3 && childAge <= 5 && hassle.avoidWithToddler) penalty += 15;
    if (childAge >= Number(hassle.bestMinimumAge || 0)) penalty -= 8;
  }
  if (preferences.travelEffort === "short" && hassle.longDriveWarning) penalty += 8;
  if (preferences.budget === "smart" && ["alto", "muito_alto"].includes(hassle.familyHassleLevel)) penalty += 6;
  if (preferences.restFirst && ["alto", "muito_alto"].includes(hassle.familyHassleLevel)) penalty += 10;
  return clamp(Math.round(Number(baseFamilyScore || 70) - penalty), 0, 100);
}

export function hasslePenalty(level) {
  if (level === "baixo") return 0;
  if (level === "moderado") return 8;
  if (level === "alto") return 18;
  if (level === "muito_alto") return 30;
  return 8;
}

function easy(overrides = {}) {
  return {
    familyHassleLevel: "baixo",
    hassleScore: 20,
    babyFriendlinessScore: 84,
    toddlerFriendlinessScore: 84,
    kids610FriendlinessScore: 78,
    teenFriendlinessScore: 64,
    bestMinimumAge: 0,
    avoidWithBaby: false,
    avoidWithToddler: false,
    strollerFriendly: true,
    babyCarrierRecommended: false,
    napFriendly: true,
    longDriveWarning: false,
    recommendedTripPace: "leve",
    shortHassleAlert: "Destino leve quando a hospedagem e bem escolhida.",
    ...overrides
  };
}

function moderate(overrides = {}) {
  return {
    familyHassleLevel: "moderado",
    hassleScore: 44,
    babyFriendlinessScore: 58,
    toddlerFriendlinessScore: 68,
    kids610FriendlinessScore: 80,
    teenFriendlinessScore: 76,
    recommendedTripPace: "leve",
    shortHassleAlert: "Muito bom, mas pede roteiro com pausas.",
    ...overrides
  };
}

function hard(overrides = {}) {
  return {
    familyHassleLevel: "alto",
    hassleScore: 72,
    babyFriendlinessScore: 28,
    toddlerFriendlinessScore: 42,
    kids610FriendlinessScore: 76,
    teenFriendlinessScore: 84,
    bestMinimumAge: 6,
    avoidWithBaby: true,
    avoidWithToddler: true,
    strollerFriendly: false,
    babyCarrierRecommended: true,
    napFriendly: false,
    longDriveWarning: true,
    recommendedTripPace: "leve",
    shortHassleAlert: "Lindo, mas exige roteiro adaptado.",
    ...overrides
  };
}

function veryHard(overrides = {}) {
  return {
    ...hard(),
    familyHassleLevel: "muito_alto",
    hassleScore: 88,
    babyFriendlinessScore: 12,
    toddlerFriendlinessScore: 24,
    kids610FriendlinessScore: 58,
    teenFriendlinessScore: 82,
    bestMinimumAge: 8,
    requiresPrivateGuide: true,
    medicalStructureWarning: true,
    shortHassleAlert: "Visual incrivel, mas logistica pesada.",
    ...overrides
  };
}

function inferHassle(destination = {}) {
  const text = [
    destination.name,
    destination.destinationType,
    destination.macroRegion,
    ...(destination.tags || []),
    ...(destination.attentionPoints || [])
  ].join(" ").toLowerCase();

  if (text.includes("chapada") || text.includes("jalapao") || text.includes("aventura") || text.includes("trilha")) {
    return hard({
      mainHassles: ["passeios longos", "trilhas ou terreno irregular", "roteiro exige planejamento"],
      betterAlternatives: ["cunha-sp", "bonito-ms", "ponta-grossa-pr"]
    });
  }
  if (text.includes("resort") || text.includes("hotel fazenda") || text.includes("perto de sp")) {
    return easy({
      mainHassles: ["confirmar estrutura infantil real", "evitar saida em horario de pico"],
      semPerrengueStrategy: "Priorize hospedagem com refeicoes e lazer no proprio local."
    });
  }
  if (text.includes("praia")) {
    return moderate({
      boatWarning: true,
      heatWarning: true,
      mainHassles: ["sol e calor", "mare ou mar agitado", "estrutura varia por praia"],
      semPerrengueStrategy: "Escolha hospedagem perto da praia, saia cedo e proteja soneca/almoco."
    });
  }
  if (text.includes("serra") || text.includes("frio")) {
    return moderate({
      coldWarning: true,
      mainHassles: ["frio", "estradas de serra", "programacao depende do clima"],
      semPerrengueStrategy: "Use a hospedagem como base de conforto e monte passeios curtos."
    });
  }
  return DEFAULT_HASSLE;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
