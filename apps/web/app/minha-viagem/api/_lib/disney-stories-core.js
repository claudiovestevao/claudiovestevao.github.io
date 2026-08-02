export const DISNEY_STORY_CALENDAR = [
  story("2026-07-12", "Minnie", "preparar uma aventura com carinho", "storybook cheerful mouse bow travel"),
  story("2026-07-13", "Dumbo", "coragem para tentar", "storybook flying elephant courage"),
  story("2026-07-14", "Pooh", "calma e amizade", "storybook honey bear gentle forest"),
  story("2026-07-15", "Stitch", "família e pertencimento", "storybook blue alien family island"),
  story("2026-07-16", "Olaf", "alegria nas pequenas coisas", "storybook snowman warm hug"),
  story("2026-07-17", "Tinker Bell", "imaginação e brilho próprio", "storybook tiny fairy glowing forest"),
  story("2026-07-18", "Mulan", "coragem e verdade", "storybook brave warrior flower"),
  story("2026-07-19", "Peter Pan", "imaginação antes da viagem", "storybook flying boy night stars"),
  story("2026-07-20", "Cinderela", "gentileza e coragem", "storybook glass slipper ballroom"),
  story("2026-07-21", "Ariel", "curiosidade e escolhas", "storybook mermaid ocean curiosity"),
  story("2026-07-22", "Elsa", "emoções grandes", "storybook ice queen snowy castle"),
  story("2026-07-23", "Anna", "família e persistência", "storybook sisters winter adventure"),
  story("2026-07-24", "Moana", "coragem para explorar", "storybook ocean voyager island"),
  story("2026-07-25", "Rapunzel", "criatividade e paciência", "storybook tower lanterns princess"),
  story("2026-07-26", "Merida", "coragem e escuta", "storybook brave archer forest"),
  story("2026-07-27", "Bela", "curiosidade e leitura", "storybook library rose castle"),
  story("2026-07-28", "Jasmine", "liberdade e voz própria", "storybook desert palace princess"),
  story("2026-07-29", "Branca de Neve", "cuidado e amizade", "storybook forest cottage kindness"),
  story("2026-07-30", "Aurora", "calma e imaginação", "storybook sleeping princess forest"),
  story("2026-07-31", "Tiana", "trabalho e sonho", "storybook bayou princess cooking"),
  story("2026-08-01", "Mickey", "alegria e amizade", "storybook cheerful mouse adventure"),
  story("2026-08-02", "Minnie", "detalhes e carinho", "storybook bow cheerful mouse"),
  story("2026-08-03", "Donald", "paciência com emoções", "storybook funny duck sailor"),
  story("2026-08-04", "Goofy", "tentar de novo", "storybook clumsy tall friend"),
  story("2026-08-05", "Buzz Lightyear", "coragem e imaginação", "storybook space toy astronaut"),
  story("2026-08-06", "Woody", "lealdade e liderança", "storybook cowboy toy friendship"),
  story("2026-08-07", "Simba", "crescer com coragem", "storybook lion cub savanna"),
  story("2026-08-08", "Nala", "amizade e verdade", "storybook lioness cub savanna"),
  story("2026-08-09", "Surpresa", "começar a própria aventura", "storybook family airport adventure")
];

export const DISNEY_STORIES_SHOW = {
  title: "Histórias da Luiza para Orlando",
  description: "Histórias curtas, carinhosas e calmas para apresentar personagens queridos antes da viagem da Luiza a Orlando.",
  author: "Família Estevão",
  language: "pt-BR",
  category: "Kids & Family",
  explicit: "false"
};

export const DISNEY_STORIES_DISCLAIMER =
  "Projeto familiar independente. Histórias originais inspiradas em personagens conhecidos, sem afiliação, patrocínio ou endosso da Disney.";

export function storyForDate(date) {
  return DISNEY_STORY_CALENDAR.find((item) => item.date === date) || null;
}

export function dateInSaoPaulo(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function deterministicStoryScript(item) {
  const name = item?.name || "Surpresa";
  const lesson = item?.lesson || "começar uma aventura";
  return [
    `Luiza, respira bem devagar. Hoje a historinha é sobre ${name}.`,
    "",
    `Imagine ${name} chegando em silêncio, com um sorriso pequeno e uma vontade bonita de aprender sobre ${lesson}. A aventura começa sem pressa, como uma luz acendendo no quarto.`,
    "",
    `${name} percebe uma estrelinha escondida no caminho. Ela não precisa brilhar forte. Precisa só de carinho, coragem e uma pausa para respirar.`,
    "",
    "A Luiza entra na história segurando a mão da família. Quando alguma coisa parece grande demais, ela pode pedir ajuda, descansar um pouquinho e tentar de novo amanhã.",
    "",
    "Agora a estrelinha fica quietinha, a aventura vira sonho, e o coração pode descansar.",
    "",
    "Boa noite, Luiza. Amanhã tem mais uma história esperando por você."
  ].join("\n");
}

export function episodeTitle(item) {
  return `${formatDateBr(item.date)} - ${item.name}: ${item.lesson}`;
}

export function episodeSlug(item) {
  return `${item.date}-${slugify(item.name)}`;
}

export function spotifyEpisodeEmbedUrl(episode) {
  const direct = String(episode?.spotifyEmbedUrl || "").trim();
  if (direct) return direct;
  const id = String(episode?.spotifyEpisodeId || "").trim();
  if (id) return `https://open.spotify.com/embed/episode/${encodeURIComponent(id)}`;
  const url = String(episode?.spotifyEpisodeUrl || "").trim();
  const match = url.match(/open\.spotify\.com\/episode\/([A-Za-z0-9]+)/);
  return match ? `https://open.spotify.com/embed/episode/${match[1]}` : "";
}

export function storyWhatsAppPreview(episode, siteUrl = "https://claudiocode.dev") {
  const listenUrl = episode.pageUrl || `${siteUrl.replace(/\/$/, "")}/minha-viagem/disney-stories/${episode.id}`;
  return [
    `🌙 Veja hoje a historinha da ${displayCharacterForInvite(episode.character)}!`,
    "",
    `✨ Tema: ${episode.lesson}. Uma história fofinha, com curiosidade do personagem e narração calma para a Luiza dormir.`,
    "",
    `🎧 Abrir no Claudio Code: ${listenUrl}`
  ].join("\n");
}

export function renderPodcastRss({ episodes = [], siteUrl, feedUrl, imageUrl, spotifyShowUrl = "" }) {
  const sorted = [...episodes].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const items = sorted.map((episode) => renderEpisodeItem(episode)).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(DISNEY_STORIES_SHOW.title)}</title>
    <description>${xml(DISNEY_STORIES_SHOW.description)}</description>
    <link>${xml(spotifyShowUrl || siteUrl)}</link>
    <atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml"/>
    <language>${DISNEY_STORIES_SHOW.language}</language>
    <itunes:author>${xml(DISNEY_STORIES_SHOW.author)}</itunes:author>
    <itunes:summary>${xml(DISNEY_STORIES_SHOW.description)}</itunes:summary>
    <itunes:explicit>${DISNEY_STORIES_SHOW.explicit}</itunes:explicit>
    <itunes:category text="${xml(DISNEY_STORIES_SHOW.category)}"/>
    <itunes:image href="${xml(imageUrl)}"/>
    <image>
      <url>${xml(imageUrl)}</url>
      <title>${xml(DISNEY_STORIES_SHOW.title)}</title>
      <link>${xml(siteUrl)}</link>
    </image>
${items}
  </channel>
</rss>`;
}

function renderEpisodeItem(episode) {
  const summary = [episode.description, episode.originNote, episode.disclaimer].filter(Boolean).join(" ");
  return `    <item>
      <title>${xml(episode.title)}</title>
      <description>${xml(summary)}</description>
      <itunes:summary>${xml(summary)}</itunes:summary>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
      <itunes:image href="${xml(episode.imageUrl || "")}"/>
      <pubDate>${new Date(`${episode.date}T12:00:00-03:00`).toUTCString()}</pubDate>
      <guid isPermaLink="false">${xml(episode.guid || episode.audioUrl)}</guid>
      <enclosure url="${xml(episode.audioUrl)}" length="${Number(episode.audioBytes || 0)}" type="audio/mpeg"/>
    </item>`;
}

function story(date, name, lesson, imageQuery) {
  return { date, name, lesson, imageQuery };
}

function formatDateBr(iso) {
  const [year, month, day] = String(iso).split("-");
  return `${day}/${month}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function displayCharacterForInvite(character) {
  const special = {
    "Branca de Neve": "Branca de Neve e os sete anões",
    "Tinker Bell": "Sininho e o brilho da imaginação",
    "Goofy": "Pateta",
    "Surpresa": "surpresa de embarque da Luiza"
  };
  return special[character] || character;
}

function xml(value) {
  return String(value || "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  })[char]);
}
