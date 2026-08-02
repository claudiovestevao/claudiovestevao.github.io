import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  DISNEY_STORIES_DISCLAIMER,
  DISNEY_STORY_CALENDAR,
  deterministicStoryScript,
  episodeSlug,
  episodeTitle
} from "../apps/web/app/minha-viagem/api/_lib/disney-stories-core.js";

const ROOT = process.cwd();
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://claudiocode.dev").replace(/\/$/, "");
const SOURCE_MD = process.env.DISNEY_STORIES_SOURCE_MD || join(homedir(), "Downloads", "28_noites_historias_luiza.md");
const PUBLIC_DIR = join(ROOT, "apps", "web", "public", "minha-viagem", "disney-stories", "generated");
const DATA_DIR = join(ROOT, "apps", "web", "app", "minha-viagem", "api", "_data");
const CATALOG_PATH = join(DATA_DIR, "disney-stories-catalog.json");
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const FORCE_REBUILD = process.env.FORCE_REBUILD_DISNEY_STORIES === "1";

const characterOrigins = {
  Minnie: "Minnie apareceu junto de Mickey no curta Steamboat Willie, em 1928. Ela ficou conhecida pelo laço, pelo carinho com os amigos e pelo jeito alegre de transformar coisas simples em momentos especiais.",
  Dumbo: "Dumbo ficou famoso no filme de animação da Disney de 1941. A história apresenta um elefantinho que aprende a olhar para suas diferenças com mais carinho.",
  Pooh: "O Ursinho Pooh nasceu nos livros de A. A. Milne e depois ganhou versões animadas da Disney. Ele mora no Bosque dos Cem Acres e ensina calma, amizade e doçura.",
  Stitch: "Stitch vem do filme Lilo & Stitch, de 2002. Ele começa como uma criaturinha bagunceira, mas aprende, com Lilo, que família também é cuidado e presença.",
  Olaf: "Olaf apareceu em Frozen, de 2013. Ele é um boneco de neve criado pela magia de Elsa e ficou querido por falar de amor, alegria e abraços.",
  "Tinker Bell": "Sininho, ou Tinker Bell, ficou famosa nas histórias de Peter Pan. Ela é uma fada pequena, criativa e cheia de brilho próprio.",
  Mulan: "Mulan ficou conhecida na animação da Disney inspirada em uma antiga lenda chinesa. Sua história fala de coragem, família e verdade.",
  "Peter Pan": "Peter Pan vem da peça e do livro de J. M. Barrie e depois virou clássico da Disney. Ele representa imaginação, brincadeira e a Terra do Nunca.",
  Cinderela: "Cinderela é uma personagem de conto de fadas que ganhou uma versão clássica da Disney em 1950. Sua história fala de esperança, gentileza e paciência.",
  Ariel: "Ariel é a sereia curiosa de A Pequena Sereia, animação da Disney de 1989 inspirada em um conto de Hans Christian Andersen.",
  Elsa: "Elsa apareceu em Frozen, de 2013. Ela é uma rainha com poderes de gelo e sua história ajuda a conversar sobre sentimentos grandes.",
  Anna: "Anna também vem de Frozen. Ela é lembrada pelo coração aberto, pela coragem de procurar a irmã e por não desistir de quem ama.",
  Moana: "Moana, da animação de 2016, é uma menina de Motunui que ama o mar e aprende a navegar com coragem e responsabilidade.",
  Rapunzel: "Rapunzel vem de um conto de fadas antigo e ganhou uma versão Disney em Enrolados, de 2010. Ela é curiosa, criativa e ama lanternas.",
  Merida: "Merida é a princesa de Valente, da Pixar, lançado em 2012. Ela vive na Escócia, gosta de cavalgar e aprende a ouvir o coração.",
  Bela: "Bela é a leitora curiosa de A Bela e a Fera, clássico da Disney de 1991 inspirado em um conto francês antigo.",
  Jasmine: "Jasmine é a princesa de Agrabah em Aladdin, animação da Disney de 1992. Ela é lembrada por querer escolher o próprio caminho e usar a própria voz.",
  "Branca de Neve": "Branca de Neve é a primeira princesa de um longa animado da Disney, de 1937. Sua história ficou famosa pela doçura, pelos animais da floresta e pelos sete anões.",
  Aurora: "Aurora é a princesa de A Bela Adormecida, animação da Disney de 1959 inspirada em contos de fadas. Ela é ligada ao bosque, à música e à delicadeza.",
  Tiana: "Tiana apareceu em A Princesa e o Sapo, de 2009. Ela vive em Nova Orleans, ama cozinhar e mostra que sonho também combina com esforço e ajuda.",
  Mickey: "Mickey nasceu nos estúdios Disney e estreou para o público em Steamboat Willie, em 18 de novembro de 1928. Ele virou símbolo de alegria, amizade e imaginação.",
  Donald: "Pato Donald apareceu em curtas da Disney nos anos 1930 e ficou conhecido pelo uniforme de marinheiro, pela voz engraçada e pelas emoções bem intensas.",
  Goofy: "Pateta, chamado Goofy em inglês, é um dos grandes amigos de Mickey. Ele é atrapalhado, gentil e quase sempre transforma tentativa em risada.",
  "Buzz Lightyear": "Buzz Lightyear vem de Toy Story, da Pixar, lançado em 1995. Ele é um brinquedo astronauta que aprende que ser herói também é cuidar dos amigos.",
  Woody: "Woody também vem de Toy Story. Ele é um brinquedo cowboy leal, muito ligado aos amigos e ao cuidado com o quarto das crianças.",
  Simba: "Simba é o leão de O Rei Leão, animação da Disney de 1994. Sua jornada fala de crescimento, coragem e responsabilidade.",
  Nala: "Nala, de O Rei Leão, é amiga de Simba desde pequena. Ela é corajosa, sincera e ajuda a proteger quem ama.",
  Surpresa: "Na última noite, a personagem principal é a própria Luiza, pronta para começar a aventura da família em Orlando."
};

const extraStoriesByDate = {
  "2026-08-02": [
    "Luiza, hoje a Minnie voltou para uma historinha bem calminha.",
    "",
    "Minnie encontrou um mapa pequeno em cima da mesa. No mapa havia um castelo, uma estrela, um barquinho e um caminho cheio de pontinhos.",
    "",
    "Mickey chegou devagar e perguntou:",
    "",
    "— Para onde esse mapa vai levar?",
    "",
    "Minnie sorriu e ajeitou o laço.",
    "",
    "— Ele não leva só para um lugar. Ele leva para lembranças.",
    "",
    "Então Minnie colou três adesivos no mapa. Um adesivo era de coração, para lembrar dos abraços. Outro era de estrela, para lembrar da imaginação. O último era uma flor, para lembrar de falar com delicadeza.",
    "",
    "Mickey queria correr e ver tudo depressa, mas Minnie colocou a mão no ombro dele.",
    "",
    "— Uma aventura fica mais bonita quando a gente olha com calma.",
    "",
    "Os dois caminharam devagar. Encontraram Donald, Margarida, Pateta e Pluto. Cada amigo escolheu um pontinho do mapa para visitar.",
    "",
    "Quando a noite chegou, Minnie guardou o mapa dentro de uma caixinha e disse:",
    "",
    "— Amanhã a gente continua. Hoje o corpo descansa e o coração sonha.",
    "",
    "Pergunte:",
    "",
    "— Luiza, qual adesivo você colocaria no mapa da nossa viagem?",
    "",
    "Boa noite, Minnie. Boa noite, Luiza. Que seu sonho tenha um mapa macio, cheio de caminhos felizes."
  ].join("\n")
};

await mkdir(PUBLIC_DIR, { recursive: true });
await mkdir(DATA_DIR, { recursive: true });

const markdownStories = await readMarkdownStories(SOURCE_MD);
const episodes = [];

for (const item of DISNEY_STORY_CALENDAR) {
  const slug = episodeSlug(item);
  const story = storyScript(item, markdownStories);
  const audioPath = join(PUBLIC_DIR, `${slug}.mp3`);
  const textPath = join(PUBLIC_DIR, `${slug}.txt`);
  const image = await fetchImage(item, slug);

  if (FORCE_REBUILD || !existsSync(audioPath)) {
    const audio = await synthesizeAudio(story.ssml);
    await writeFile(audioPath, audio);
  }
  await writeFile(textPath, story.text, "utf8");

  const publicBase = `${SITE_URL}/minha-viagem/disney-stories/generated`;
  const audioBytes = existsSync(audioPath) ? await (await import("node:fs/promises")).stat(audioPath).then((s) => s.size) : 0;
  episodes.push({
    id: slug,
    date: item.date,
    character: item.name,
    lesson: item.lesson,
    title: episodeTitle(item),
    description: `Uma história curta e calma para a Luiza conhecer ${displayName(item.name)} e dormir com carinho.`,
    originNote: story.originNote,
    disclaimer: DISNEY_STORIES_DISCLAIMER,
    script: story.text,
    scriptProvider: story.provider,
    audioUrl: `${publicBase}/${slug}.mp3`,
    audioBytes,
    imageUrl: `${publicBase}/${slug}.${image.ext}`,
    imageSource: image.source,
    imageCredit: image.credit,
    imageSearch: item.imageQuery,
    pageUrl: `${SITE_URL}/minha-viagem/disney-stories/${slug}`,
    spotifyEpisodeUrl: "",
    spotifyEpisodeId: "",
    spotifyEmbedUrl: "",
    guid: `${SITE_URL}/minha-viagem/disney-stories/${slug}`,
    status: "ready",
    generatedAt: new Date().toISOString(),
    notifiedAt: "",
    errors: image.error ? [image.error] : []
  });

  console.log(`${item.date} ${item.name}: ready`);
}

const catalog = {
  version: 2,
  mode: "prebuilt-static-md",
  source: SOURCE_MD,
  updatedAt: new Date().toISOString(),
  showImageUrl: episodes[0]?.imageUrl || `${SITE_URL}/icons/orlando-icon.svg`,
  disclaimer: DISNEY_STORIES_DISCLAIMER,
  episodes
};
await writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");
console.log(`catalog: ${CATALOG_PATH}`);

async function readMarkdownStories(path) {
  if (!existsSync(path)) return { byNumber: new Map(), byCharacter: new Map() };
  const raw = await readFile(path, "utf8");
  const text = repairMojibake(raw).replace(/\r\n/g, "\n");
  const matches = [...text.matchAll(/^## Noite\s+(\d+)\s+[—-]\s+(.+)$/gm)];
  const byNumber = new Map();
  const byCharacter = new Map();

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const number = Number(current[1]);
    const title = current[2].trim();
    const start = current.index + current[0].length;
    const end = next ? next.index : text.length;
    const body = text.slice(start, end).replace(/^-{3,}\s*$/gm, "").trim();
    const story = { number, title, body };
    byNumber.set(number, story);
    for (const character of charactersForTitle(title)) {
      if (!byCharacter.has(character)) byCharacter.set(character, story);
    }
  }

  return { byNumber, byCharacter };
}

function storyScript(item, markdownStories) {
  const originNote = characterOrigins[item.name] || `Hoje a Luiza conhece ${displayName(item.name)} em uma história original, calma e familiar.`;
  const sourceStory = storyFromMarkdown(item, markdownStories);
  const provider = sourceStory ? "markdown-family-story" : "deterministic";
  const body = sourceStory || deterministicStoryScript(item);
  const text = [
    `Luiza, respira bem devagar. Hoje a gente vai conhecer ${displayName(item.name)}.`,
    "",
    `Curiosidade Disney: ${originNote}`,
    "",
    "Agora a luz fica baixinha, a voz fica macia, e a história começa.",
    "",
    body,
    "",
    "Prontinho. A aventura de hoje pode descansar no travesseiro. Boa noite, Luiza. Que seus sonhos sejam calmos, fofos e cheios de carinho."
  ].join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return { text: text.slice(0, 4200), ssml: toSsml(text), provider, originNote };
}

function storyFromMarkdown(item, markdownStories) {
  if (extraStoriesByDate[item.date]) return extraStoriesByDate[item.date];
  const aliases = {
    Goofy: "Pateta",
    "Tinker Bell": "Tinker Bell",
    "Branca de Neve": "Branca de Neve"
  };
  const key = aliases[item.name] || item.name;
  const byCharacter = markdownStories.byCharacter.get(key);
  if (byCharacter) return byCharacter.body;
  const index = DISNEY_STORY_CALENDAR.findIndex((row) => row.date === item.date);
  return markdownStories.byNumber.get(index + 1)?.body || "";
}

async function synthesizeAudio(ssml) {
  const apiKey = process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY ausente.");
  const response = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      input: { ssml },
      voice: { languageCode: "pt-BR", name: process.env.GOOGLE_TTS_VOICE || "pt-BR-Neural2-C" },
      audioConfig: { audioEncoding: "MP3", pitch: -0.4, speakingRate: 0.86 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.audioContent) throw new Error(`Google TTS falhou: ${response.status} ${JSON.stringify(data).slice(0, 220)}`);
  return Buffer.from(data.audioContent, "base64");
}

async function fetchImage(item, slug) {
  const apiKey = process.env.PEXELS_API_KEY;
  const fallbackPath = join(PUBLIC_DIR, `${slug}.svg`);
  if (!apiKey) {
    await writeFile(fallbackPath, fallbackSvg(item), "utf8");
    return { ext: "svg", source: "fallback-svg", credit: "", error: "PEXELS_API_KEY ausente" };
  }
  try {
    const url = new URL(PEXELS_SEARCH_URL);
    url.searchParams.set("query", item.imageQuery);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "square");
    const response = await fetch(url, { headers: { Authorization: apiKey } });
    const data = await response.json();
    const photo = data?.photos?.[0];
    const src = photo?.src?.large || photo?.src?.medium || "";
    if (!response.ok || !src) throw new Error(`Pexels HTTP ${response.status}`);
    const imageResponse = await fetch(src);
    if (!imageResponse.ok) throw new Error(`Imagem HTTP ${imageResponse.status}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    const imagePath = join(PUBLIC_DIR, `${slug}.jpg`);
    await writeFile(imagePath, bytes);
    return {
      ext: "jpg",
      source: "pexels",
      credit: photo?.photographer ? `${photo.photographer} / Pexels` : "Pexels",
      error: ""
    };
  } catch (error) {
    await writeFile(fallbackPath, fallbackSvg(item), "utf8");
    return { ext: "svg", source: "fallback-svg", credit: "", error: `Pexels falhou: ${error?.message || "erro"}` };
  }
}

function toSsml(text) {
  const paragraphs = String(text || "")
    .slice(0, 4300)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeXml(paragraph.replace(/\n/g, " "))}</p><break time="650ms"/>`);
  return `<speak><prosody rate="slow" pitch="-1st">${paragraphs.join("")}</prosody></speak>`;
}

function charactersForTitle(title) {
  const normalized = title.toLowerCase();
  const names = [
    "Minnie", "Dumbo", "Pooh", "Stitch", "Olaf", "Tinker Bell", "Sininho", "Mulan", "Peter Pan",
    "Cinderela", "Ariel", "Elsa", "Anna", "Moana", "Rapunzel", "Merida", "Bela", "Jasmine",
    "Branca de Neve", "Aurora", "Tiana", "Mickey", "Donald", "Pateta", "Buzz Lightyear",
    "Woody", "Simba", "Nala", "Surpresa"
  ];
  return names.filter((name) => normalized.includes(name.toLowerCase()));
}

function displayName(name) {
  return name === "Goofy" ? "Pateta" : name === "Tinker Bell" ? "Sininho" : name;
}

function repairMojibake(value) {
  const text = String(value || "");
  if (!/[ÃÂð]/.test(text)) return text;
  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}

function fallbackSvg(item) {
  const label = `${displayName(item.name)} - ${item.lesson}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400"><rect width="1400" height="1400" fill="#36506c"/><circle cx="1050" cy="240" r="220" fill="#ffd166"/><circle cx="240" cy="1040" r="260" fill="#7bdcb5"/><text x="110" y="560" font-family="Arial,sans-serif" font-size="84" font-weight="700" fill="#fff">Histórias da Luiza</text><text x="110" y="690" font-family="Arial,sans-serif" font-size="62" fill="#fff">${escapeXml(label)}</text></svg>`;
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char]);
}
