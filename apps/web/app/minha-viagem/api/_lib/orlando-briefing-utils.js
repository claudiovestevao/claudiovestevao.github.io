import { episodeSlug, storyForDate } from "./disney-stories-core.js";

const SITE_URL = "https://claudiocode.dev/minha-viagem";
const TRIP_START = "2026-08-09";
const TRIP_END = "2026-08-18";

export const BRIEFING_SLOTS = {
  "08": { label: "08h", theme: "briefing do dia" },
  "13": { label: "13h", theme: "decisao util" },
  "19": { label: "19h", theme: "fechamento e magia" }
};

const PARK_DAYS = {
  "2026-08-12": {
    name: "Magic Kingdom",
    morning: "princesas cedo, Fantasyland leve e almoco no castelo sem pressa.",
    midday: "agua, banheiro e ar-condicionado antes do Cinderella's Royal Table.",
    night: "Mickey, PeopleMover ou fogos so se Luiza e Nathalie ainda estiverem bem.",
    attraction: "Peter Pan's Flight parece uma historinha em movimento; e escuro, lento e costuma valer Lightning Lane.",
    safety: "Luiza manda no ritmo; Nathalie evita qualquer placa para gestantes; Vitor deixa radical como bonus."
  },
  "2026-08-15": {
    name: "Hollywood Studios",
    morning: "Toy Story cedo, Runaway Railway e Frozen/Disney Jr como respiro.",
    midday: "trocar fila no sol por show sentado; Frozen e Beauty seguram o dia.",
    night: "Fantasmic so entra se energia real sobrar.",
    attraction: "Toy Story Mania e um brinquedo 3D de pontaria: Luiza brinca, Vitor compete e todos descansam do calor.",
    safety: "Toy Story gira leve; simuladores e coasters ficam para Vitor solo se a janela estiver facil."
  },
  "2026-08-17": {
    name: "Epic Universe",
    morning: "Nintendo primeiro, depois Berk e shows antes de pensar em radical.",
    midday: "Viking Training Camp, Untrainable Dragon ou Le Cirque Arcanus protegem a energia.",
    night: "aniversario gostoso vale mais que completar lista de atracoes.",
    attraction: "Yoshi's Adventure deve ser o brinquedo mais Luiza do Epic: colorido, familiar e de baixa intensidade.",
    safety: "Mario Kart e AR/3D podem cansar visao monocular; piso molhado de Fyre Drill pede calma."
  }
};

const DURING_DAYS = {
  "2026-08-09": {
    title: "Chegada em Orlando",
    morning: "ativar o album Orlando 2026: Vitor no Android e Nathalie no iPhone, cada um em sua conta.",
    midday: "hidratar, comer simples e nao tentar resolver compras hoje.",
    night: "Target Flamingo Crossings so para a primeira compra leve; depois hotel, banho e cama."
  },
  "2026-08-10": {
    title: "Beauty Master + Carter's Clearance",
    morning: "Beauty Master as 9h e Carter's do Orlando Outlet Marketplace na abertura, as 10h.",
    midday: "resolver Nike, Calvin e Tommy no mesmo outlet; almoco simples antes do mercado.",
    night: "piscina e organizacao das compras sem abrir um segundo roteiro."
  },
  "2026-08-11": {
    title: "Vineland curto + T-REX",
    morning: "descansar no hotel; Lake Buena Vista so entra se faltar um item critico.",
    midday: "Character Warehouse + uma loja, no maximo; T-REX a noite precisa de energia da Luiza.",
    night: "guardar notas e separar o que ainda ficou faltando."
  },
  "2026-08-13": {
    title: "Descanso Disney",
    morning: "hotel, piscina e um bloco pequeno de compra ou mercado.",
    midday: "lavanderia, soneca ou pausa longa sem culpa.",
    night: "preparar Hollywood com mochila leve e protetor auricular."
  },
  "2026-08-14": {
    title: "Florida Mall + MacroBaby",
    morning: "itens pendentes do enxoval e eletronicos so se fizer sentido.",
    midday: "evitar atravessar Orlando por impulso; uma loja principal por vez.",
    night: "dormir cedo para Hollywood Studios."
  },
  "2026-08-16": {
    title: "Outlet final + fechamento",
    morning: "comprar so o que ficou na lista; nada de garimpo infinito.",
    midday: "comecar a organizar malas antes da noite.",
    night: "separar roupa e mochila do Epic."
  },
  "2026-08-18": {
    title: "Volta para casa",
    morning: "malas, documentos e recibos; sem loja extra antes do aeroporto.",
    midday: "devolver o carro na Hertz MCO ate 13h45 e estar no terminal por volta de 14h15.",
    night: "voo, agua, remedios e descanso."
  }
};

const FLORIDA_TIPS = [
  {
    fact: "Em agosto, Orlando costuma ter calor forte e pancadas de chuva no fim da tarde.",
    tip: "O melhor turismo e de manha, com pausa no meio do dia e plano flexivel a noite."
  },
  {
    fact: "A Florida tem muitos lagos, areas alagadas e vida selvagem perto de parques e hoteis.",
    tip: "Com crianca, nunca chegue perto da borda de lago ou grama junto da agua."
  },
  {
    fact: "Kennedy Space Center fica em Cabo Canaveral, a leste de Orlando.",
    tip: "E passeio de dia inteiro; com Luiza pequena, so vale se virar prioridade real."
  },
  {
    fact: "Everglades e um ecossistema enorme de pantanos e grama alta, bem diferente de Orlando.",
    tip: "Airboat pode ser marcante, mas exige calor sob controle, protetor auricular e operador confiavel."
  },
  {
    fact: "As springs da Florida tem agua cristalina e temperatura mais constante que piscina comum.",
    tip: "Se entrar no roteiro, escolha uma perto, de manha, com roupa extra e sem pressa."
  },
  {
    fact: "Disney, Universal e outlets ficam em regioes diferentes; Orlando parece perto no mapa e longe no cansaco.",
    tip: "Agrupe por area e corte deslocamento quando alguem estiver perto do limite."
  },
  {
    fact: "Ar-condicionado nos EUA costuma ser forte, inclusive em restaurante, loja e show.",
    tip: "Leve uma camada leve para Luiza e Nathalie mesmo em dia quente."
  }
];

const DURING_BEDTIME = {
  "2026-08-09": "Hoje a Luiza voou em cima das nuvens e chegou numa cidade cheia de luzinhas. A mala descansou, o carrinho descansou, e amanha a aventura acorda devagar.",
  "2026-08-10": "Hoje a Luiza encontrou pequenas ferramentas de exploradora: agua, sombra, lanchinho e um ventilador amigo. Todo heroi de parque tambem aprende a descansar.",
  "2026-08-11": "Hoje as lojas viraram uma caca ao tesouro para o Arthur. A Luiza ajudou a familia a escolher com carinho e guardar energia para os dinossauros.",
  "2026-08-12": "Hoje o castelo piscou para a Luiza. As princesas deixaram um brilho pequenininho no coracao dela, daqueles que entram no sonho sem fazer barulho.",
  "2026-08-13": "Hoje a piscina e o hotel tambem foram parque. As aventuras grandes ficam mais bonitas quando a familia sabe respirar entre uma magia e outra.",
  "2026-08-14": "Hoje a Luiza foi companheira de missao. Enquanto a familia resolvia compras, ela guardava no bolso invisivel a paciencia e os pequenos encantos do caminho.",
  "2026-08-15": "Hoje os brinquedos do Andy pareciam gigantes e as musicas do Frozen fizeram o dia ficar mais leve. A Luiza entrou nos filmes sem sair da mao da familia.",
  "2026-08-16": "Hoje foi dia de fechar sacolas e escolher lembrancas. Algumas coisas voltam na mala; outras voltam no coracao e aparecem depois nas fotos.",
  "2026-08-17": "Hoje a Luiza atravessou portais, procurou Yoshi e ouviu dragao de pertinho. O aniversario da familia virou uma estrela acesa em Celestial Park.",
  "2026-08-18": "Hoje a aventura guardou os sapatos, fechou as malas e entrou no aviao de volta. Orlando ficou para tras, mas a historia veio junto."
};

export function buildDeterministicBriefing(context) {
  const ctx = normalizeBriefingContext(context);
  const lines = ctx.phase === "during" ? duringMessage(ctx) : beforeMessage(ctx);
  if (ctx.hurricane?.active) lines.splice(1, 0, `Radar: ${ctx.hurricane.summary}`);
  return lines.filter(Boolean).join("\n").slice(0, 620);
}

export function taskForDate(date, slot = "08") {
  const day = DURING_DAYS[date] || PARK_DAYS[date];
  if (day) {
    if (slot === "13") return day.midday || day.morning;
    if (slot === "19") return day.night || "registrar memoria do dia e preparar amanha.";
    return day.morning || day.midday;
  }

  const tasks = {
    "2026-07-12": "abrir passaportes/vistos, conferir vencimentos e salvar foto da pagina principal no celular.",
    "2026-07-13": "criar uma pasta 'Orlando offline' no celular com passaporte, visto, seguro, ingressos e reserva.",
    "2026-07-14": "testar login nos apps My Disney Experience, Universal Orlando, companhia aerea e hotel.",
    "2026-07-15": "marcar no calendario os dias MK 12/08, Hollywood 15/08 e Epic 17/08 com endereco e horario.",
    "2026-07-16": "separar telefones uteis: seguro, hotel, locadora, pediatra e consulado.",
    "2026-07-17": "salvar endereco do hotel, parques e locadora em mapas offline nos dois celulares.",
    "2026-07-18": "baixar mapas offline da regiao do hotel, Disney, Universal e aeroporto MCO.",
    "2026-07-19": "salvar a apolice do seguro viagem e o passo a passo de acionamento offline.",
    "2026-07-20": "anotar restricoes da Luiza: remedios, alergias, comida, sono e contato do pediatra.",
    "2026-07-21": "criar regra simples de compras: foto da nota + categoria antes de guardar na bolsa.",
    "2026-07-22": "conferir reservas de restaurantes e colocar codigo/endereco no calendario.",
    "2026-07-23": "deixar eSIM/chip encaminhado e plano B de internet combinado.",
    "2026-07-24": "salvar PDFs dos ingressos em dois celulares e testar se abrem sem internet.",
    "2026-07-25": "separar uma lista curta de compras por pessoa para nao decidir tudo cansados no outlet.",
    "2026-07-26": "testar Wallet, ingressos e reservas abrindo sem internet.",
    "2026-07-27": "montar uma lista 'nao esquecer' de documentos, remedios e eletronicos.",
    "2026-07-28": "confirmar regras da locadora: cadeirinha, pedagio, seguro e retirada do carro.",
    "2026-07-29": "fixar no WhatsApp uma conversa com links importantes da viagem.",
    "2026-07-30": "salvar no calendario os horarios-chave dos parques e reservas com endereco.",
    "2026-07-31": "conferir regras de bagagem da companhia, ainda sem comecar mala.",
    "2026-08-01": "fazer a ultima revisao de documentos antes da fase das malas.",
    "2026-08-02": "comecar checklist de mala, sem transformar a sala em aeroporto.",
    "2026-08-04": "fazer pedidos Amazon/Target para hotel so do que ainda estiver faltando.",
    "2026-08-06": "fazer check-ins, eSIM e documentos offline.",
    "2026-08-08": "malas fechadas, documentos na mochila e powerbanks carregados."
  };
  if (tasks[date]) return tasks[date];
  if (date >= "2026-08-02" && date <= "2026-08-08") return slot === "19" ? "separar roupa do voo e revisar bolsa da Luiza." : "resolver um item pequeno da mala por vez.";
  if (date < "2026-08-02") return "fechar uma pendencia de documento, reserva ou app da viagem.";
  return "escolher uma pendencia pequena e fechar sem abrir dez abas novas.";
}

export function magicForDate(date, slot = "13") {
  const park = PARK_DAYS[date];
  if (park) {
    if (slot === "08") return park.morning;
    if (slot === "13") return park.attraction;
    return DURING_BEDTIME[date] || park.night;
  }

  const teaser = storyTeaserForDate(date);
  if (slot === "19" && teaser) return teaser.text;

  const before = [
    "Ariel saiu do mar por curiosidade; viajar tambem e descobrir um mundo novo com a familia.",
    "Minnie repara nos detalhes; cada lacinho pode virar pista de que a viagem esta chegando.",
    "no mundo do Pooh, uma aventura comeca devagar. Crianca pequena aproveita melhor sem pressa.",
    "Dumbo voa quando acredita nas proprias orelhas. Coragem tambem pode ser fofinha.",
    "Toy Story e sobre brinquedos que guardam memoria. Um brinquedinho da Luiza pode aparecer nas fotos.",
    "Cinderela ensina esperanca sem pressa: uma coisa de cada vez tambem leva ao castelo.",
    "Olaf lembra que alegria simples ajuda muito: agua, sombra, abraco e uma pausa boa."
  ];
  return before[Math.abs(daysBetween("2026-07-12", date)) % before.length];
}

export function storyTeaserForDate(date, siteUrl = SITE_URL) {
  const item = storyForDate(date);
  if (item) {
    const slug = episodeSlug(item);
    return {
      kind: "audio_story",
      character: item.name,
      text: `Historinha da Luiza hoje: ${item.name}, sobre ${item.lesson}.`,
      url: `${siteUrl.replace(/\/$/, "")}/disney-stories/${slug}`
    };
  }
  if (DURING_BEDTIME[date]) {
    return {
      kind: "mini_story",
      character: "Luiza",
      text: DURING_BEDTIME[date],
      url: ""
    };
  }
  return null;
}

export function floridaTipForDate(date) {
  return FLORIDA_TIPS[Math.abs(daysBetween("2026-07-12", date)) % FLORIDA_TIPS.length];
}

export function attractionSpotlightForDate(date) {
  const park = PARK_DAYS[date];
  return park ? { park: park.name, text: park.attraction, safety: park.safety } : null;
}

export function diaryPromptForDate(date) {
  const park = PARK_DAYS[date];
  if (park) return `qual foi o momento mais fofo da Luiza em ${park.name}?`;
  const prompts = {
    "2026-08-09": "qual foi a primeira carinha da Luiza ao chegar em Orlando?",
    "2026-08-10": "qual item simples deixou o dia mais facil?",
    "2026-08-11": "qual compra do Arthur deu mais sensacao de familia crescendo?",
    "2026-08-13": "qual pausa deixou todo mundo melhor?",
    "2026-08-14": "qual achado ou decisao salvou energia?",
    "2026-08-16": "qual lembranca merece voltar na mala?",
    "2026-08-18": "qual cena resume a viagem inteira?"
  };
  return prompts[date] || "qual foi o momentinho pequeno que merece virar memoria?";
}

export function normalizeBriefingSlot(slot) {
  const cleanSlot = clean(slot).replace(/\D/g, "").padStart(2, "0");
  return BRIEFING_SLOTS[cleanSlot] ? cleanSlot : "";
}

export function briefingSlotForDate(date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(date));
  if (hour >= 18) return "19";
  if (hour >= 12) return "13";
  return "08";
}

export function callMeBotRecipients() {
  const mapped = clean(process.env.CALLMEBOT_WHATSAPP_RECIPIENTS);
  if (mapped) {
    return mapped.split(/[,\n;]/)
      .map((entry) => {
        const [phone, apikey] = entry.split(":").map(clean);
        const normalizedPhone = normalizePhoneDigits(phone);
        return normalizedPhone && apikey ? { phone: normalizedPhone, apikey } : null;
      })
      .filter(Boolean);
  }

  const phone = normalizePhoneDigits(process.env.CALLMEBOT_WHATSAPP_PHONE);
  const apikey = clean(process.env.CALLMEBOT_WHATSAPP_APIKEY || process.env.CALLMEBOT_API_KEY);
  return phone && apikey ? [{ phone, apikey }] : [];
}

export function deliveryStatusForChannels(channels) {
  const rows = Array.isArray(channels) ? channels : [];
  if (!rows.length) return "failed";
  const sentCount = rows.filter((row) => row?.ok).length;
  if (sentCount === rows.length) return "sent";
  if (sentCount > 0) return "partial";
  return "failed";
}

export function maskPhone(phone) {
  const digits = clean(phone).replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}

function beforeMessage(ctx) {
  const dLabel = ctx.daysLeft > 0 ? `D-${ctx.daysLeft}` : "embarque";
  if (ctx.slot === "08") {
    return [
      `[ANTES] ${dLabel} - acao do dia`,
      `Agora: ${ctx.task}`,
      ctx.useful ? `Valor: ${ctx.useful}` : "",
      ctx.weather ? `Orlando hoje: ${ctx.weather.summary}.` : "",
      `Painel: ${SITE_URL}`
    ];
  }

  if (ctx.slot === "13") {
    const florida = ctx.florida || floridaTipForDate(ctx.todayBr);
    return [
      `[FLORIDA] ${dLabel} - dica de viagem`,
      `Curiosidade: ${florida.fact}`,
      `Dica: ${florida.tip}`,
      "Compras: o monitor das 13h so interrompe se houver oferta realmente acionavel."
    ];
  }

  const story = ctx.story || storyTeaserForDate(ctx.todayBr);
  return [
    `[LUIZA] Historinha de dormir - ${dLabel}`,
    story ? story.text : `Hoje: ${ctx.magic}`,
    story?.url ? `Abrir audio: ${story.url}` : "",
    `Pais: ${ctx.task}`,
    "Boa noite: uma pendencia a menos, uma memoria a mais."
  ];
}

function duringMessage(ctx) {
  const day = PARK_DAYS[ctx.todayBr] || DURING_DAYS[ctx.todayBr] || {};
  const title = day.name || day.title || ctx.itinerary || "Orlando";

  if (ctx.slot === "08") {
    return [
      `[HOJE] ${title}`,
      `Agora: ${ctx.task}`,
      ctx.weather ? `Clima: ${ctx.weather.summary}.` : "",
      ctx.magic ? `Luiza: ${ctx.magic}` : "",
      `Plano: ${SITE_URL}`
    ];
  }

  if (ctx.slot === "13") {
    const spotlight = ctx.attraction || attractionSpotlightForDate(ctx.todayBr);
    return [
      `[DURANTE] Ajuste das 13h - ${title}`,
      `Agora: ${ctx.task}`,
      spotlight ? `Atração: ${spotlight.text}` : `Florida: ${(ctx.florida || floridaTipForDate(ctx.todayBr)).tip}`,
      spotlight?.safety ? `Seguranca: ${spotlight.safety}` : "Ritmo: agua, sombra e corte sem culpa."
    ];
  }

  const story = ctx.story || storyTeaserForDate(ctx.todayBr);
  return [
    `[DIARIO] Fechamento do dia - ${title}`,
    `Pergunta: ${ctx.diaryPrompt || diaryPromptForDate(ctx.todayBr)}`,
    story ? `Mini-historia: ${story.text}` : "",
    ctx.tomorrow ? `Amanha: ${ctx.tomorrow}` : "",
    "Responder com foto, audio ou texto ja vira memoria da viagem."
  ];
}

function normalizeBriefingContext(context) {
  const todayBr = clean(context?.todayBr) || dateInZone(new Date(), "America/Sao_Paulo");
  const slot = normalizeBriefingSlot(context?.slot) || "08";
  const phase = clean(context?.phase) || (todayBr >= TRIP_START && todayBr <= TRIP_END ? "during" : "before");
  return {
    ...context,
    todayBr,
    phase,
    slot,
    daysLeft: Number.isFinite(Number(context?.daysLeft)) ? Number(context.daysLeft) : daysBetween(todayBr, TRIP_START),
    task: clean(context?.task) || taskForDate(todayBr, slot),
    useful: clean(context?.useful) || usefulTipForDate(todayBr),
    magic: clean(context?.magic) || magicForDate(todayBr, slot),
    florida: context?.florida || floridaTipForDate(todayBr),
    attraction: context?.attraction || attractionSpotlightForDate(todayBr),
    story: context?.story || storyTeaserForDate(todayBr),
    diaryPrompt: clean(context?.diaryPrompt) || diaryPromptForDate(todayBr),
    tomorrow: clean(context?.tomorrow) || tomorrowPreview(todayBr)
  };
}

function usefulTipForDate(date) {
  const dated = {
    "2026-07-12": "documento bom e documento achavel: celular, pasta offline e email.",
    "2026-07-13": "nomes simples nos arquivos reduzem caca a PDF quando a fila estiver andando.",
    "2026-07-14": "login que falha no sofa vira estresse na fila; teste app e senha agora.",
    "2026-07-15": "calendario com endereco economiza conversa, bateria e decisao.",
    "2026-07-16": "telefone de emergencia salvo como favorito ajuda quando internet falha.",
    "2026-07-17": "mapas offline evitam caca a Wi-Fi quando alguem so quer chegar.",
    "2026-07-18": "baixe mapas de hotel, Disney, Universal e MCO nos dois celulares.",
    "2026-07-19": "seguro viagem precisa de telefone, apolice e regras faceis de achar.",
    "2026-07-20": "rotina da Luiza escrita vale ouro: sono, remedio, lanche e o que acalma.",
    "2026-07-21": "foto da nota no caixa evita arqueologia de recibos na volta.",
    "2026-07-22": "reserva boa tem codigo, endereco, horario e deslocamento juntos.",
    "2026-07-23": "internet e item de seguranca: combinar eSIM e plano B.",
    "2026-07-24": "PDF salvo so no WhatsApp nao conta; precisa abrir offline.",
    "2026-07-25": "lista curta por pessoa deixa outlet mais leve.",
    "2026-07-26": "testar ingressos no sofa e melhor que testar na catraca.",
    "2026-07-27": "lista unica vence memoria heroica.",
    "2026-07-28": "cadeirinha, pedagio e seguro do carro travam chegada se ficarem para o balcao.",
    "2026-07-29": "conversa fixada com links vira central de comando.",
    "2026-07-30": "horario + endereco no calendario transforma deslocamento em toque no Maps.",
    "2026-07-31": "regra de bagagem antes da mala evita surpresa no aeroporto.",
    "2026-08-01": "amanha comeca mala; hoje e fechar documento e dormir com menos abas."
  };
  if (dated[date]) return dated[date];
  const tips = [
    "uma loja principal por dia protege energia da familia.",
    "cooling towel, agua e sombra ajudam mais que coragem em fila quente.",
    "guardar notas no mesmo lugar evita confusao na volta.",
    "plano bom tem corte previsto, nao heroismo."
  ];
  return tips[Math.abs(daysBetween("2026-07-11", date)) % tips.length];
}

function tomorrowPreview(date) {
  const next = addDays(date, 1);
  const day = PARK_DAYS[next] || DURING_DAYS[next];
  return day ? (day.name || day.title || day.morning || "") : "";
}

function dateInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function normalizePhoneDigits(value) {
  return clean(value).replace(/\D/g, "");
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000);
}

function clean(value) {
  return String(value ?? "").trim();
}
