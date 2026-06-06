const mapsSearch = query => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
const tripadvisorSearch = query => `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`;

function restaurant(name, destination, note, kidsSpace = "validar") {
  return {
    name,
    destination,
    familyNote: note,
    ratingLabel: kidsSpace === "sim" ? "espaço kids citado; validar Google 4+" : "validar Google 4+",
    source: "google_maps_search",
    googleMapsUrl: mapsSearch(`${name} ${destination}`),
    sourceUrl: mapsSearch(`${name} ${destination}`)
  };
}

function attraction(name, destination, note, sourceUrl = "") {
  return {
    name,
    destination,
    familyNote: note,
    ratingLabel: "atração familiar",
    source: sourceUrl.includes("tripadvisor") ? "tripadvisor" : "curation",
    sourceUrl: sourceUrl || tripadvisorSearch(`${name} ${destination}`)
  };
}

export const conciergeDestinationExperience = [
  {
    key: "campinas-sp",
    name: "Campinas, SP",
    whyVisit: "Campinas funciona quando a família quer resort perto de São Paulo, mas ainda ter cidade grande por perto: parques, shoppings, restaurantes e hospitalidade urbana.",
    restaurants: [
      restaurant("Seo Rosa Cambuí", "Campinas SP", "bom para almoço de família em bairro gastronômico"),
      restaurant("Giovannetti Cambuí", "Campinas SP", "clássico local, útil para família que quer comida previsível"),
      restaurant("Kaizen Japanese Food", "Campinas SP", "opção urbana para famílias que preferem shopping/estrutura")
    ],
    attractions: [
      attraction("Lagoa do Taquaral", "Campinas SP", "cartão-postal com parque, lago e passeio leve", "https://lagoadotaquaral.com.br/"),
      attraction("Bosque dos Jequitibás", "Campinas SP", "área verde tradicional e passeio curto"),
      attraction("Maria Fumaça Campinas", "Campinas SP", "programa lúdico para crianças maiores")
    ]
  },
  {
    key: "atibaia-sp",
    name: "Atibaia, SP",
    whyVisit: "Atibaia é uma das melhores primeiras viagens saindo de São Paulo: montanha, morango, restaurantes com área aberta e resorts sem a fricção de aeroporto.",
    restaurants: [
      restaurant("Restaurante Costelão Atibaia", "Atibaia SP", "site oficial cita espaço kids", "sim"),
      restaurant("Fazenda Paraíso Atibaia", "Atibaia SP", "candidato forte para família com área externa", "sim"),
      restaurant("Restaurante 2 Lagos", "Atibaia SP", "área ampla e proposta familiar", "sim")
    ],
    attractions: [
      attraction("Pedra Grande", "Atibaia SP", "visual da serra e passeio símbolo da cidade", "https://www.tripadvisor.com/Attractions-g675018-Activities-Atibaia_State_of_Sao_Paulo.html"),
      attraction("Parque Edmundo Zanoni", "Atibaia SP", "parque urbano com lago, verde e feira em alguns períodos"),
      attraction("Teleférico de Atibaia", "Atibaia SP", "passeio curto e visual para crianças maiores")
    ]
  },
  {
    key: "mogi-das-cruzes-sp",
    name: "Mogi das Cruzes, SP",
    whyVisit: "Mogi combina resort próximo, clima de interior e programas leves como parques, cultura japonesa e natureza, sem exigir uma viagem longa.",
    restaurants: [
      restaurant("Bife Esquema Mogi", "Mogi das Cruzes SP", "tradicional e fácil para família"),
      restaurant("Santa Helena Restaurante", "Mogi das Cruzes SP", "comida brasileira para almoço sem pressa"),
      restaurant("Mogi Shopping restaurantes", "Mogi das Cruzes SP", "opção pragmática para chuva e crianças")
    ],
    attractions: [
      attraction("Parque Centenário da Imigração Japonesa", "Mogi das Cruzes SP", "parque amplo com lagos e pontes", "https://www.mogidascruzes.sp.gov.br/unidade-e-equipamento/0/parque-centenario-da-imigracao-japonesa"),
      attraction("Pico do Urubu", "Mogi das Cruzes SP", "mirante para famílias aventureiras"),
      attraction("Parque Leon Feffer", "Mogi das Cruzes SP", "área verde para gastar energia")
    ]
  },
  {
    key: "cesario-lange-sp",
    name: "Cesário Lange, SP",
    whyVisit: "Cesário Lange entra pela hospedagem-resort: é menos sobre cidade turística e mais sobre ficar bem instalado, com lazer concentrado e pouca decisão fora do hotel.",
    restaurants: [
      restaurant("Mavsa Resort restaurantes", "Cesário Lange SP", "priorizar refeições do resort"),
      restaurant("Restaurante do Lago Cesário Lange", "Cesário Lange SP", "validar logística local"),
      restaurant("Churrascaria Cesário Lange", "Cesário Lange SP", "opção prática se sair do resort")
    ],
    attractions: [
      attraction("Mavsa Resort lazer", "Cesário Lange SP", "principal motivo da viagem"),
      attraction("Praça Central de Cesário Lange", "Cesário Lange SP", "passeio simples, sem criar expectativa alta"),
      attraction("Roteiro rural regional", "Cesário Lange SP", "validar com o hotel antes de sair")
    ]
  },
  {
    key: "praia-do-forte-ba",
    name: "Praia do Forte, BA",
    whyVisit: "Praia do Forte mistura praia bonita, vila charmosa, Projeto Tamar, bons restaurantes e resorts com estrutura, um equilíbrio raro para família com criança pequena.",
    restaurants: [
      restaurant("Restaurante Sabor da Vila", "Praia do Forte BA", "clássico da vila para frutos do mar"),
      restaurant("Tango Café", "Praia do Forte BA", "opção descontraída no centrinho"),
      restaurant("7 Pizzas Praia do Forte", "Praia do Forte BA", "pizzaria costuma ser coringa com crianças")
    ],
    attractions: [
      attraction("Projeto Tamar Praia do Forte", "Praia do Forte BA", "educativo, visual e ótimo para crianças", "https://www.gov.br/turismo/pt-br/assuntos/noticias/projeto-tamar-na-bahia-recebe-visita-do-secretario-executivo-do-mtur-3"),
      attraction("Vila de Praia do Forte", "Praia do Forte BA", "centrinho caminhável com lojas e restaurantes"),
      attraction("Castelo Garcia D'Ávila", "Praia do Forte BA", "história e vista para crianças maiores")
    ]
  },
  {
    key: "porto-de-galinhas-pe",
    name: "Porto de Galinhas, PE",
    whyVisit: "Porto de Galinhas tem apelo visual imediato: piscinas naturais, resorts, jangadas e uma vila turística fácil de entender, desde que o mar e os horários ajudem.",
    restaurants: [
      restaurant("Beijupirá Porto de Galinhas", "Porto de Galinhas PE", "referência gastronômica local"),
      restaurant("Barcaxeira", "Porto de Galinhas PE", "comida regional e pratos fáceis de dividir"),
      restaurant("Munganga Bistrô", "Porto de Galinhas PE", "opção conhecida para família na vila")
    ],
    attractions: [
      attraction("Piscinas Naturais de Porto de Galinhas", "Porto de Galinhas PE", "programa símbolo, depende de maré"),
      attraction("Praia de Muro Alto", "Porto de Galinhas PE", "mar mais protegido para família"),
      attraction("Vila de Porto de Galinhas", "Porto de Galinhas PE", "lojas, sorvete e jantar sem roteiro complexo")
    ]
  },
  {
    key: "maragogi-al",
    name: "Maragogi, AL",
    whyVisit: "Maragogi é para quem quer cor de mar e foto de cartão-postal, mas com criança eu trataria maré, traslado e passeios como pontos críticos da decisão.",
    restaurants: [
      restaurant("Restaurante Tuyn", "Maragogi AL", "opção gastronômica local para validar com reserva"),
      restaurant("Maragaço Maragogi", "Maragogi AL", "frutos do mar e ambiente turístico"),
      restaurant("Russo Gastrobar", "Maragogi AL", "opção na vila para famílias com crianças maiores")
    ],
    attractions: [
      attraction("Piscinas Naturais de Maragogi", "Maragogi AL", "principal atrativo, sempre validar maré"),
      attraction("Praia de Antunes", "Maragogi AL", "uma das praias mais bonitas da região"),
      attraction("Praia de Barra Grande", "Maragogi AL", "visual forte e passeio de praia")
    ]
  },
  {
    key: "foz-do-iguacu-pr",
    name: "Foz do Iguaçu, PR",
    whyVisit: "Foz entrega natureza grandiosa com cidade estruturada, voo curto e passeios marcantes. Para família, o segredo é não tentar fazer tudo no mesmo dia.",
    restaurants: [
      restaurant("Rafain Churrascaria Show", "Foz do Iguaçu PR", "turístico, prático e espaçoso"),
      restaurant("Noite Italiana Bella Italia", "Foz do Iguaçu PR", "buffet pode facilitar com crianças"),
      restaurant("Castelo Libanês", "Foz do Iguaçu PR", "gastronomia árabe forte na cidade")
    ],
    attractions: [
      attraction("Cataratas do Iguaçu", "Foz do Iguaçu PR", "atração principal e inesquecível", "https://commons.wikimedia.org/wiki/File:Cataratas_Iguacu_Iguazu_Falls.jpg"),
      attraction("Parque das Aves", "Foz do Iguaçu PR", "muito bom para crianças"),
      attraction("Marco das Três Fronteiras", "Foz do Iguaçu PR", "programa de fim de tarde")
    ]
  },
  {
    key: "gramado-rs",
    name: "Gramado, RS",
    whyVisit: "Gramado vende encantamento: chocolate, parques fechados, Natal, restaurantes temáticos e hotelaria forte. Funciona melhor quando a família aceita frio e agenda.",
    restaurants: [
      restaurant("Casa da Velha Bruxa", "Gramado RS", "lúdico e central para doces e lanches"),
      restaurant("Cantina Pastasciutta", "Gramado RS", "italiano clássico para família"),
      restaurant("Galeto Itália Gramado", "Gramado RS", "refeição previsível para criança")
    ],
    attractions: [
      attraction("Lago Negro", "Gramado RS", "passeio leve e visual clássico"),
      attraction("Mini Mundo", "Gramado RS", "muito forte para crianças"),
      attraction("Snowland", "Gramado RS", "atração indoor para famílias")
    ]
  },
  {
    key: "dourado-sp",
    name: "Dourado, SP",
    whyVisit: "Dourado é uma decisão de hotel-fazenda: natureza, comida, rotina calma e lazer dentro da hospedagem. É menos passeio urbano e mais descanso assistido.",
    restaurants: [
      restaurant("Clara Dourado Resort restaurantes", "Dourado SP", "priorizar estrutura da hospedagem"),
      restaurant("Santa Clara Eco Resort restaurante", "Dourado SP", "validar acesso e refeições"),
      restaurant("Restaurante rural Dourado SP", "Dourado SP", "usar como alternativa local")
    ],
    attractions: [
      attraction("Clara Dourado Resort lazer", "Dourado SP", "motivo principal da viagem"),
      attraction("Santa Clara Eco Resort lazer", "Dourado SP", "natureza e estrutura de hotel fazenda"),
      attraction("Museu Histórico de Dourado", "Dourado SP", "ponto cultural simples para crianças maiores")
    ]
  },
  {
    key: "campos-do-jordao-sp",
    name: "Campos do Jordão, SP",
    whyVisit: "Campos do Jordão tem serra, chocolate, Capivari, parques e hotelaria charmosa. É persuasiva para família que quer clima diferente sem avião.",
    restaurants: [
      restaurant("Restaurante Libertango", "Campos do Jordão SP", "carne e ambiente turístico"),
      restaurant("Villa Gourmet Campos do Jordão", "Campos do Jordão SP", "opção no eixo turístico"),
      restaurant("Pastelão do Maluf", "Campos do Jordão SP", "clássico informal com crianças maiores")
    ],
    attractions: [
      attraction("Vila Capivari", "Campos do Jordão SP", "centrinho turístico e gastronômico"),
      attraction("Amantikir", "Campos do Jordão SP", "jardins e fotos, melhor com clima bom"),
      attraction("Parque Estadual Campos do Jordão", "Campos do Jordão SP", "natureza e passeio de dia")
    ]
  },
  {
    key: "sao-roque-sp",
    name: "São Roque, SP",
    whyVisit: "São Roque é bate-volta esperto: vinho para os pais, restaurantes grandes, fazendinhas, empórios e lazer perto da capital.",
    restaurants: [
      restaurant("Vila Don Patto", "São Roque SP", "estrutura turística ampla; validar espaço kids", "sim"),
      restaurant("Quinta do Olivardo", "São Roque SP", "clássico do roteiro, bom para almoço em família"),
      restaurant("Restaurante Vale do Vinho", "São Roque SP", "opção no Roteiro do Vinho")
    ],
    attractions: [
      attraction("Roteiro do Vinho", "São Roque SP", "gastronomia, empórios e passeio curto", "https://www.turismopaulista.tur.br/roteiros-circuitos/roteiro_do_vinho"),
      attraction("Ski Mountain Park", "São Roque SP", "atividade para crianças maiores"),
      attraction("Fazendinha e centros de entretenimento do roteiro", "São Roque SP", "validar idade e horário")
    ]
  },
  {
    key: "guaruja-sp",
    name: "Guarujá, SP",
    whyVisit: "Guarujá é praia com infraestrutura urbana, boa para família que quer litoral sem voo, hotel forte e alternativa de aquário/restaurantes se o tempo virar.",
    restaurants: [
      restaurant("Rufino's Guarujá", "Guarujá SP", "frutos do mar conhecido"),
      restaurant("Dalmo Bárbaro Guarujá", "Guarujá SP", "clássico de praia para almoço especial"),
      restaurant("Avelino's Enseada", "Guarujá SP", "opção tradicional na Enseada")
    ],
    attractions: [
      attraction("Praia da Enseada", "Guarujá SP", "praia urbana com infraestrutura"),
      attraction("Acqua Mundo", "Guarujá SP", "aquário, bom para criança e chuva"),
      attraction("Mirante do Morro da Campina", "Guarujá SP", "visual curto para família")
    ]
  },
  {
    key: "olimpia-sp",
    name: "Olímpia, SP",
    whyVisit: "Olímpia é sobre parque aquático e resort. Para criança maior pode ser uma alegria; para bebê, só vale com pausas, sombra e hotel muito bem escolhido.",
    restaurants: [
      restaurant("Dat Badan Olímpia", "Olímpia SP", "opção conhecida para almoço/jantar"),
      restaurant("Villa da Vó Olímpia", "Olímpia SP", "comida caseira para família"),
      restaurant("Jorge's Bar Olímpia", "Olímpia SP", "validar ambiente e horário com crianças")
    ],
    attractions: [
      attraction("Thermas dos Laranjais", "Olímpia SP", "parque aquático principal", "https://commons.wikimedia.org/wiki/Category:Thermas_dos_Laranjais"),
      attraction("Hot Beach Olímpia", "Olímpia SP", "parque aquático com estrutura de resort"),
      attraction("Vale dos Dinossauros Olímpia", "Olímpia SP", "atração lúdica para crianças")
    ]
  },
  {
    key: "penha-sc",
    name: "Penha, SC",
    whyVisit: "Penha é escolhida pelo Beto Carrero, mas a decisão boa considera idade, altura mínima, filas, shows e descanso entre parque e praia.",
    restaurants: [
      restaurant("Petisqueira Alírio", "Penha SC", "frutos do mar tradicional"),
      restaurant("Casa Ibérica Penha", "Penha SC", "opção gastronômica para jantar"),
      restaurant("Big Pizzas Penha", "Penha SC", "pizzaria costuma funcionar com crianças")
    ],
    attractions: [
      attraction("Beto Carrero World", "Penha SC", "principal motivo da viagem", "https://www.tripadvisor.com/Search?q=Beto%20Carrero%20World%20Penha"),
      attraction("Praia de Armação", "Penha SC", "praia para desacelerar"),
      attraction("Praia Alegre", "Penha SC", "passeio simples de litoral")
    ]
  },
  {
    key: "buenos-aires-argentina",
    name: "Buenos Aires, Argentina",
    whyVisit: "Buenos Aires é uma primeira internacional confortável: voo curto, parques urbanos, cafés, livrarias, sorvetes e cultura em ritmo mais leve que Orlando.",
    restaurants: [
      restaurant("La Cabrera", "Buenos Aires Argentina", "clássico turístico; validar espera com crianças"),
      restaurant("Kansas Palermo", "Buenos Aires Argentina", "estrutura grande e previsível"),
      restaurant("Sottovoce Puerto Madero", "Buenos Aires Argentina", "italiano útil para família")
    ],
    attractions: [
      attraction("Jardín Japonés", "Buenos Aires Argentina", "passeio bonito e curto"),
      attraction("Museo de los Niños Abasto", "Buenos Aires Argentina", "programa indoor infantil"),
      attraction("Caminito La Boca", "Buenos Aires Argentina", "colorido e cultural, melhor de dia")
    ]
  },
  {
    key: "orlando-fl",
    name: "Orlando, FL",
    whyVisit: "Orlando é memorável quando a criança já aproveita parque. Para família pequena, a curadoria precisa controlar custo, fuso, filas e dias de descanso.",
    restaurants: [
      restaurant("Chef Mickey's Orlando", "Orlando FL", "personagens e experiência lúdica"),
      restaurant("Rainforest Cafe Disney Springs", "Orlando FL", "temático, visualmente forte para crianças"),
      restaurant("The Boathouse Disney Springs", "Orlando FL", "estrutura turística em Disney Springs")
    ],
    attractions: [
      attraction("Magic Kingdom", "Orlando FL", "parque mais icônico para criança"),
      attraction("Disney Springs", "Orlando FL", "jantar, lojas e passeio sem ingresso"),
      attraction("Animal Kingdom", "Orlando FL", "bom mix de natureza, shows e personagens")
    ]
  },
  {
    key: "praia-do-forte",
    name: "Praia do Forte, BA",
    whyVisit: "Praia do Forte mistura praia, vila, Tamar e resorts; é uma das praias mais fáceis de explicar para família com criança pequena.",
    restaurants: [],
    attractions: []
  },
  {
    key: "porto-de-galinhas",
    name: "Porto de Galinhas, PE",
    whyVisit: "Porto de Galinhas é forte quando a família quer praia com estrutura e aceita planejar pela maré.",
    restaurants: [],
    attractions: []
  },
  {
    key: "maceio-maragogi",
    name: "Maragogi, AL",
    whyVisit: "Maragogi tem mar de impacto, mas exige mais cuidado com traslado, maré e passeios.",
    restaurants: [],
    attractions: []
  }
];

for (const item of conciergeDestinationExperience) {
  if (!item.restaurants.length) {
    const fallback = conciergeDestinationExperience.find(candidate => candidate.name === item.name && candidate.restaurants.length);
    item.restaurants = fallback?.restaurants || [];
    item.attractions = fallback?.attractions || [];
  }
}
