export const conciergeFamilyItineraries = [
  {
    id: "circuito-das-aguas-aguas-socorro",
    title: "Circuito das Aguas sem trocar mala todo dia",
    region: "Circuito das Aguas Paulista",
    primaryDestinationKeys: ["aguas-de-lindoia", "aguas-de-lindoia-sp"],
    nearbyDestinationKeys: ["socorro-sp", "serra-negra-sp"],
    minNights: 3,
    idealNights: "3 a 5 noites",
    baseStrategy: "Use Aguas de Lindoia como base principal e trate Socorro como extensao regional, nao como obrigacao.",
    bestFor: "familias que querem resort, piscina, passeio leve e um dia de natureza/aventura controlada",
    avoidWhen: "1 ou 2 noites, bebe muito pequeno, chuva forte ou crianca que dorme mal fora de casa",
    routeFacts: [
      { label: "SP -> Aguas", value: "184 km · 2h29", source: "Google Distance Matrix 06/06/2026" },
      { label: "Aguas -> Socorro", value: "26,9 km · 37 min", source: "Google Distance Matrix 06/06/2026" }
    ],
    stops: [
      {
        name: "Aguas de Lindoia",
        role: "base do sono",
        suggestedNights: "2 a 4 noites",
        familyReason: "hotel com rotina, refeicoes e descanso previsivel",
        caution: "nao lotar o dia de chegada"
      },
      {
        name: "Socorro",
        role: "bate-volta leve",
        suggestedNights: "meio dia ou 1 dia",
        familyReason: "natureza, compras locais e atividades outdoor para criancas maiores",
        caution: "evitar aventura pesada com bebe ou crianca cansada"
      },
      {
        name: "Serra Negra",
        role: "opcional",
        suggestedNights: "meio dia",
        familyReason: "centrinho, compras e passeio simples se a familia ainda tiver energia",
        caution: "nao adicionar se a viagem ja estiver corrida"
      }
    ],
    dayPlans: [
      {
        nights: "1 a 2 noites",
        recommendation: "Base unica em Aguas. Socorro so entra se todo mundo acordar bem e o clima ajudar.",
        intensity: "leve"
      },
      {
        nights: "3 a 4 noites",
        recommendation: "Dois dias de resort e um bate-volta curto para Socorro. E o melhor equilibrio para familia.",
        intensity: "equilibrado"
      },
      {
        nights: "5+ noites",
        recommendation: "Aguas como base, Socorro em um dia e Serra Negra opcional. Ainda assim, deixe um dia sem passeio.",
        intensity: "completo"
      }
    ],
    sources: [
      "https://www.benditocacaoresort.com.br/bendito-lindoia",
      "https://paisefilhos.com.br/familia/bendito-cacao-family-resort-conheca-o-hotel-da-cacau-show-em-aguas-de-lindoia/",
      "https://www.jornalomunicipio.com.br/bendito-cacao-family-resort-abre-as-portas-para-o-publico-em-aguas-de-lindoia/"
    ]
  },
  {
    id: "serra-paulista-campos-santo-antonio",
    title: "Serra Paulista com base tranquila",
    region: "Mantiqueira Paulista",
    primaryDestinationKeys: ["campos-do-jordao", "campos-do-jordao-sp"],
    nearbyDestinationKeys: ["santo-antonio-do-pinhal-sp"],
    minNights: 3,
    idealNights: "3 a 4 noites",
    baseStrategy: "Fique em uma base so e use Santo Antonio do Pinhal como passeio mais calmo se Campos estiver cheia.",
    bestFor: "familias que querem frio, chocolate, jardins e restaurantes sem roteiro de parque",
    avoidWhen: "julho lotado com bebe pequeno ou viagem de 1 noite",
    routeFacts: [
      { label: "SP -> Campos", value: "aprox. 3h", source: "curadoria logistica" },
      { label: "Campos -> Santo Antonio", value: "aprox. 35 min", source: "curadoria regional" }
    ],
    stops: [
      { name: "Campos do Jordao", role: "base do sono", suggestedNights: "3 noites", familyReason: "hotelaria forte e plano B indoor", caution: "alta temporada lota" },
      { name: "Santo Antonio do Pinhal", role: "passeio calmo", suggestedNights: "meio dia", familyReason: "mais natureza e menos estimulo que Capivari", caution: "validar estrada e clima" }
    ],
    dayPlans: [
      { nights: "1 a 2 noites", recommendation: "Nao combine cidades. Faca hotel + um passeio leve.", intensity: "leve" },
      { nights: "3 a 4 noites", recommendation: "Inclua Santo Antonio em meio periodo se Campos estiver muito cheia.", intensity: "equilibrado" },
      { nights: "5+ noites", recommendation: "Da para alternar Capivari, parques e um dia mais rural, sempre com pausas.", intensity: "completo" }
    ],
    sources: []
  },
  {
    id: "gramado-canela-familia",
    title: "Gramado + Canela sem maratona",
    region: "Serra Gaucha",
    primaryDestinationKeys: ["gramado", "gramado-rs"],
    nearbyDestinationKeys: ["canela-rs"],
    minNights: 4,
    idealNights: "4 a 6 noites",
    baseStrategy: "Durma em Gramado ou Canela, mas nao troque de hotel. O ganho esta em escolher passeios por proximidade.",
    bestFor: "criancas que ja aproveitam parques, chocolate, restaurantes tematicos e programas indoor",
    avoidWhen: "frio intenso com bebe pequeno ou calendario lotado de Natal/inverno sem reservas",
    routeFacts: [
      { label: "Gramado -> Canela", value: "aprox. 15 min", source: "curadoria regional" }
    ],
    stops: [
      { name: "Gramado", role: "base principal", suggestedNights: "4+ noites", familyReason: "hotelaria, restaurantes e parques fechados", caution: "evitar fazer tudo no mesmo dia" },
      { name: "Canela", role: "passeios selecionados", suggestedNights: "1 dia distribuido", familyReason: "parques e natureza perto", caution: "filas e clima mudam a experiencia" }
    ],
    dayPlans: [
      { nights: "1 a 3 noites", recommendation: "Escolha poucos passeios. Nao tente cobrir Gramado e Canela inteira.", intensity: "leve" },
      { nights: "4 a 5 noites", recommendation: "Intercale dia de parque com dia leve de centro/restaurante.", intensity: "equilibrado" },
      { nights: "6+ noites", recommendation: "Inclua Canela com calma e preserve uma manha sem agenda.", intensity: "completo" }
    ],
    sources: []
  },
  {
    id: "praia-do-forte-salvador-tamar",
    title: "Praia do Forte com cultura sem cansar",
    region: "Litoral Norte da Bahia",
    primaryDestinationKeys: ["praia-do-forte", "praia-do-forte-ba"],
    nearbyDestinationKeys: ["salvador-ba"],
    minNights: 4,
    idealNights: "4 a 6 noites",
    baseStrategy: "Use Praia do Forte como base de descanso e trate Salvador como chegada/saida ou passeio pontual.",
    bestFor: "familias que querem praia, resort, vila caminhavel e Projeto Tamar",
    avoidWhen: "voo chegando tarde ou crianca que nao tolera transfer depois do aeroporto",
    routeFacts: [
      { label: "Salvador -> Praia do Forte", value: "aprox. 1h", source: "curadoria logistica" }
    ],
    stops: [
      { name: "Praia do Forte", role: "base do sono", suggestedNights: "4+ noites", familyReason: "praia, vila e resort sem trocar base", caution: "validar mare e horarios" },
      { name: "Salvador", role: "opcional cultural", suggestedNights: "meio dia", familyReason: "cultura e gastronomia se a familia estiver descansada", caution: "nao colocar logo apos voo tarde" }
    ],
    dayPlans: [
      { nights: "1 a 3 noites", recommendation: "Fique so em Praia do Forte. O transfer ja consome energia.", intensity: "leve" },
      { nights: "4 a 5 noites", recommendation: "Inclua Tamar/vila e no maximo um passeio cultural curto.", intensity: "equilibrado" },
      { nights: "6+ noites", recommendation: "Da para encaixar Salvador com motorista e volta cedo.", intensity: "completo" }
    ],
    sources: []
  }
];
