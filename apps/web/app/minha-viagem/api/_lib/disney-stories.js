import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { callMeBotRecipients } from "./orlando-briefing-utils.js";
import {
  DISNEY_STORIES_DISCLAIMER,
  DISNEY_STORIES_SHOW,
  dateInSaoPaulo,
  deterministicStoryScript,
  episodeSlug,
  episodeTitle,
  renderPodcastRss,
  spotifyEpisodeEmbedUrl,
  storyWhatsAppPreview,
  storyForDate
} from "./disney-stories-core.js";

const BUCKET = "orlando-disney-stories";
const STATE_PATH = "state/v1.json";
const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const CALLMEBOT_WHATSAPP_URL = "https://api.callmebot.com/whatsapp.php";

const memoryStore = globalThis.__disneyStoriesStore || { state: defaultState() };
globalThis.__disneyStoriesStore = memoryStore;

export async function runDisneyStoryGeneration({ now = new Date(), force = false } = {}) {
  const date = dateInSaoPaulo(now);
  const item = storyForDate(date);
  const prebuilt = readPrebuiltEpisodeByDate(date);
  if (prebuilt) {
    return { ok: true, prebuilt: true, episode: prebuilt, state: normalizeState(readPrebuiltCatalog()) };
  }

  const current = await readDisneyStoriesState();
  const state = normalizeState(current.state);

  if (!item) return { ok: true, skipped: true, reason: "outside_calendar", date, state };

  const existing = state.episodes.find((episode) => episode.date === date && episode.status === "ready");
  if (existing && !force) return { ok: true, duplicate: true, episode: existing, state };

  const script = await step("generate_script", () => generateScript(item));
  const audio = await step("synthesize_audio", () => synthesizeAudio(script.text));
  const image = await step("fetch_cover_image", () => fetchCoverImage(item));
  const uploaded = await step("save_episode_assets", () => saveEpisodeAssets({ item, script, audio, image }));

  const episode = {
    id: episodeSlug(item),
    date: item.date,
    character: item.name,
    lesson: item.lesson,
    title: episodeTitle(item),
    description: `Uma história curta para a Luiza sobre ${item.lesson}.`,
    originNote: "",
    disclaimer: DISNEY_STORIES_DISCLAIMER,
    script: script.text,
    scriptProvider: script.provider,
    audioUrl: uploaded.audioUrl,
    audioBytes: audio.bytes.length,
    imageUrl: uploaded.imageUrl,
    pageUrl: `${appConfig.siteUrl}/minha-viagem/disney-stories/${episodeSlug(item)}`,
    spotifyEpisodeUrl: "",
    spotifyEpisodeId: "",
    spotifyEmbedUrl: "",
    guid: `${appConfig.siteUrl}/minha-viagem/disney-stories/${episodeSlug(item)}`,
    status: "ready",
    generatedAt: new Date().toISOString(),
    notifiedAt: "",
    errors: [...script.errors, ...audio.errors, ...image.errors, ...uploaded.errors]
  };

  state.episodes = state.episodes.filter((row) => row.date !== item.date);
  state.episodes.push(episode);
  state.updatedAt = new Date().toISOString();
  await step("write_state", () => writeDisneyStoriesState(state));

  return { ok: true, episode, state };
}

async function step(label, fn) {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`${label}: ${error?.message || "falha"}`);
  }
}

export async function runDisneyStoryNotification({ now = new Date(), force = false } = {}) {
  const date = dateInSaoPaulo(now);
  const item = storyForDate(date);
  const current = await readDisneyStoriesState();
  const state = normalizeState(current.state);
  if (!item) return { ok: true, skipped: true, reason: "outside_calendar", date, state };

  let episode = state.episodes.find((row) => row.date === date && row.status === "ready");
  if (!episode) {
    const generated = await runDisneyStoryGeneration({ now, force: true });
    episode = generated.episode;
    if (!episode) return generated;
  }

  if (episode.notifiedAt && !force) return { ok: true, duplicate: true, episode, state };

  const delivery = await sendStoryWhatsApp(episode);
  episode.notifiedAt = delivery.ok ? new Date().toISOString() : episode.notifiedAt || "";
  episode.lastNotification = delivery;
  state.episodes = state.episodes.filter((row) => row.date !== episode.date);
  state.episodes.push(episode);
  state.updatedAt = new Date().toISOString();
  await writeDisneyStoriesState(state);
  return { ok: delivery.ok, episode, delivery, state };
}

export async function readDisneyStoriesState() {
  const prebuilt = readPrebuiltCatalog();
  if (prebuilt?.episodes?.length) {
    return { source: "prebuilt_static", state: normalizeState(prebuilt) };
  }

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state) };
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: bucket.message };

  const { data, error } = await client.storage.from(BUCKET).download(STATE_PATH);
  if (error) {
    const seeded = defaultState();
    await writeDisneyStoriesState(seeded);
    return { source: "supabase_storage", state: seeded };
  }

  try {
    return { source: "supabase_storage", state: normalizeState(JSON.parse(await data.text())) };
  } catch {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: "Estado Disney Stories invalido." };
  }
}

export async function writeDisneyStoriesState(state) {
  if (readPrebuiltCatalog()?.episodes?.length) {
    memoryStore.state = normalizeState(state);
    return { source: "prebuilt_static" };
  }

  const normalized = normalizeState(state);
  memoryStore.state = normalized;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) return { source: "memory_fallback" };

  const bucket = await ensureBucket(client);
  if (!bucket.ok) return { source: "memory_fallback", warning: bucket.message };

  const { error } = await client.storage.from(BUCKET).upload(
    STATE_PATH,
    Buffer.from(JSON.stringify(normalized, null, 2), "utf8"),
    { contentType: "application/json", upsert: true }
  );
  return error ? { source: "memory_fallback", warning: error.message } : { source: "supabase_storage" };
}

export async function renderDisneyStoriesRss() {
  const current = await readDisneyStoriesState();
  const state = normalizeState(current.state);
  const siteUrl = appConfig.siteUrl || "https://claudiocode.dev";
  const feedUrl = `${siteUrl}/minha-viagem/disney-stories/rss.xml`;
  const imageUrl = state.showImageUrl || `${siteUrl}/icons/orlando-icon.svg`;
  return renderPodcastRss({
    episodes: state.episodes.filter((episode) => episode.status === "ready"),
    siteUrl,
    feedUrl,
    imageUrl,
    spotifyShowUrl: clean(process.env.DISNEY_STORIES_SPOTIFY_SHOW_URL)
  });
}

export async function readDisneyStoryEpisode(slug) {
  const prebuilt = readPrebuiltCatalog();
  const staticEpisode = prebuilt?.episodes?.find((row) => row.id === clean(slug) && row.status === "ready") || null;
  if (staticEpisode) return { ok: true, episode: normalizeEpisode(staticEpisode), state: normalizeState(prebuilt) };

  const current = await readDisneyStoriesState();
  const state = normalizeState(current.state);
  const episode = state.episodes.find((row) => row.id === clean(slug) && row.status === "ready") || null;
  return { ok: Boolean(episode), episode, state };
}

export async function getExpressiveStoryAudio(slug) {
  const id = clean(slug);
  const source = findStoryEpisodeSource(id);
  if (!source) return { ok: false, status: 404, message: "Historinha nao encontrada." };

  const cachedPath = `expressive-audio/v1/${id}.mp3`;
  const fallbackUrl = clean(source.staticAudioUrl || source.audioUrl);
  const client = getSupabaseServerClient();
  const canUseStorage = Boolean(client);

  if (canUseStorage) {
    await ensureBucket(client).catch(() => ({ ok: false }));
    const { data } = await client.storage.from(BUCKET).download(cachedPath);
    if (data) {
      return {
        ok: true,
        bytes: Buffer.from(await data.arrayBuffer()),
        contentType: "audio/mpeg",
        source: "supabase-cache"
      };
    }
  }

  const tmpPath = localExpressiveAudioPath(id);
  if (existsSync(tmpPath)) {
    return {
      ok: true,
      bytes: await readFile(tmpPath),
      contentType: "audio/mpeg",
      source: "tmp-cache"
    };
  }

  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    return fallbackUrl
      ? { ok: true, redirectUrl: fallbackUrl, source: "static-fallback", warning: "OPENAI_API_KEY ausente." }
      : { ok: false, status: 500, message: "OPENAI_API_KEY ausente." };
  }

  const bytes = await synthesizeOpenAiSpeech(source.script || deterministicStoryScript(source));
  await writeLocalExpressiveAudio(tmpPath, bytes).catch(() => null);
  if (canUseStorage) {
    const { error } = await client.storage.from(BUCKET).upload(cachedPath, bytes, {
      contentType: "audio/mpeg",
      upsert: true
    });
    if (!error) return { ok: true, bytes, contentType: "audio/mpeg", source: "openai-generated-cache" };
  }

  return {
    ok: true,
    bytes,
    contentType: "audio/mpeg",
    source: "openai-generated"
  };
}

async function generateScript(item) {
  const fallback = deterministicStoryScript(item);
  const apiKey = clean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
  if (!apiKey) return generateScriptWithOpenAI(item, fallback);

  try {
    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_STORIES_MODEL || "claude-3-5-haiku-20241022",
        max_tokens: 520,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content:
              `Escreva uma história narrada em pt-BR para Luiza, 3 anos, sobre ${item.name}. ` +
              `Tema pedagógico: ${item.lesson}. Duração aproximada: 3 minutos. ` +
              "Use linguagem simples, acolhedora e original. Não diga que é conteúdo oficial Disney. " +
              "Evite sustos, conflitos intensos e moralismo. Termine com uma frase de boa noite."
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    const text = clean(data?.content?.map((part) => part.text || "").join("\n"));
    if (!response.ok || !text) return { provider: "deterministic", text: fallback, errors: [`Claude falhou: ${response.status}`] };
    return { provider: "claude", text: text.slice(0, 5000), errors: [] };
  } catch (error) {
    return { provider: "deterministic", text: fallback, errors: [`Claude erro: ${error?.message || "falha"}`] };
  }
}

async function generateScriptWithOpenAI(item, fallback) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) return { provider: "deterministic", text: fallback, errors: ["OPENAI_API_KEY ausente."] };

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.DISNEY_STORIES_OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Você escreve histórias originais, carinhosas e pedagógicas em pt-BR para uma criança de 3 anos. Linguagem simples, segura, sem sustos, sem moralismo pesado e sem afirmar que é conteúdo oficial Disney."
          },
          {
            role: "user",
            content:
              `Escreva uma história narrada para Luiza, 3 anos, inspirada em ${item.name}. ` +
              `Tema pedagógico: ${item.lesson}. Duração aproximada: 3 minutos. ` +
              "Inclua imagens mentais fáceis de entender, frases boas para ouvir antes de dormir e termine com uma frase de boa noite."
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    const text = clean(data?.choices?.[0]?.message?.content);
    if (!response.ok || !text) return { provider: "deterministic", text: fallback, errors: [`OpenAI falhou: ${response.status}`] };
    return { provider: "openai", text: text.slice(0, 2400), errors: [] };
  } catch (error) {
    return { provider: "deterministic", text: fallback, errors: [`OpenAI erro: ${error?.message || "falha"}`] };
  }
}

async function synthesizeAudio(text) {
  const apiKey = clean(process.env.GOOGLE_TTS_API_KEY || process.env.GOOGLE_TEXT_TO_SPEECH_API_KEY);
  if (!apiKey) throw new Error("GOOGLE_TTS_API_KEY ausente.");

  const response = await fetch(`${GOOGLE_TTS_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      input: { ssml: toSsml(text) },
      voice: { languageCode: "pt-BR", name: process.env.GOOGLE_TTS_VOICE || "pt-BR-Neural2-C" },
      audioConfig: { audioEncoding: "MP3", pitch: -0.4, speakingRate: 0.86 }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.audioContent) throw new Error(`Google TTS falhou: ${response.status}`);
  return { bytes: Buffer.from(data.audioContent, "base64"), errors: [] };
}

async function synthesizeOpenAiSpeech(text) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error("OPENAI_API_KEY ausente.");
  const response = await fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice: process.env.OPENAI_TTS_VOICE || "shimmer",
      input: narrationInput(text),
      instructions: bedtimeNarrationInstructions(),
      response_format: "mp3",
      speed: Number(process.env.OPENAI_TTS_SPEED || 0.88)
    })
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`OpenAI speech falhou: ${response.status} ${errorText.slice(0, 180)}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function fetchCoverImage(item) {
  if (process.env.DISNEY_STORIES_USE_PEXELS !== "1") {
    return { bytes: Buffer.from(fallbackSvg(item), "utf8"), contentType: "image/svg+xml", errors: [] };
  }
  const apiKey = clean(process.env.PEXELS_API_KEY);
  if (!apiKey) return { bytes: Buffer.from(fallbackSvg(item), "utf8"), contentType: "image/svg+xml", errors: ["PEXELS_API_KEY ausente."] };

  try {
    const url = new URL(PEXELS_SEARCH_URL);
    url.searchParams.set("query", item.imageQuery);
    url.searchParams.set("per_page", "1");
    url.searchParams.set("orientation", "square");
    const response = await fetch(url, { headers: { Authorization: apiKey }, cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const original = data?.photos?.[0]?.src?.large || data?.photos?.[0]?.src?.large2x || data?.photos?.[0]?.src?.original || "";
    if (!response.ok || !original) throw new Error(`Pexels HTTP ${response.status}`);
    const imageUrl = new URL(original);
    imageUrl.searchParams.set("auto", "compress");
    imageUrl.searchParams.set("cs", "tinysrgb");
    imageUrl.searchParams.set("fit", "crop");
    imageUrl.searchParams.set("w", "1200");
    imageUrl.searchParams.set("h", "1200");
    const imageResponse = await fetch(imageUrl, { cache: "no-store" });
    if (!imageResponse.ok) throw new Error(`Imagem HTTP ${imageResponse.status}`);
    const bytes = Buffer.from(await imageResponse.arrayBuffer());
    if (bytes.length > 1024 * 1024 * 1.5) {
      return { bytes: Buffer.from(fallbackSvg(item), "utf8"), contentType: "image/svg+xml", errors: [`Pexels grande demais: ${bytes.length} bytes`] };
    }
    return { bytes, contentType: imageResponse.headers.get("content-type") || "image/jpeg", errors: [] };
  } catch (error) {
    return { bytes: Buffer.from(fallbackSvg(item), "utf8"), contentType: "image/svg+xml", errors: [`Pexels falhou: ${error?.message || "falha"}`] };
  }
}

async function saveEpisodeAssets({ item, script, audio, image }) {
  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) throw new Error("Supabase service role ausente para publicar podcast.");
  const bucket = await ensureBucket(client);
  if (!bucket.ok) throw new Error(bucket.message);

  const slug = episodeSlug(item);
  const audioPath = `episodes/${slug}.mp3`;
  const imageExt = image.contentType === "image/svg+xml" ? "svg" : "jpg";
  const imagePath = `episodes/${slug}.${imageExt}`;
  const scriptPath = `episodes/${slug}.txt`;
  const errors = [];

  for (const upload of [
    { path: audioPath, bytes: audio.bytes, contentType: "audio/mpeg" },
    { path: imagePath, bytes: image.bytes, contentType: image.contentType },
    { path: scriptPath, bytes: Buffer.from(script.text, "utf8"), contentType: "text/plain; charset=utf-8" }
  ]) {
    try {
      const { error } = await client.storage.from(BUCKET).upload(upload.path, upload.bytes, {
        contentType: upload.contentType,
        upsert: true
      });
      if (error) errors.push(`${upload.path} (${upload.bytes.length} bytes): ${error.message}`);
    } catch (error) {
      errors.push(`${upload.path} (${upload.bytes.length} bytes): ${error?.message || "falha no upload"}`);
    }
  }

  return {
    audioUrl: publicStorageUrl(audioPath),
    imageUrl: publicStorageUrl(imagePath),
    errors
  };
}

async function sendStoryWhatsApp(episode) {
  const recipients = callMeBotRecipients();
  if (!recipients.length) return { ok: false, status: "missing_callmebot" };
  const spotify = clean(process.env.DISNEY_STORIES_SPOTIFY_SHOW_URL);
  const text = [
    storyWhatsAppPreview(episode),
    spotify ? "Também vai aparecer no Spotify assim que o app atualizar o feed." : "O Spotify entra depois que cadastrarmos o RSS uma vez."
  ].filter(Boolean).join("\n").slice(0, 900);

  const results = [];
  for (const recipient of recipients) {
    const url = new URL(CALLMEBOT_WHATSAPP_URL);
    url.searchParams.set("phone", recipient.phone);
    url.searchParams.set("apikey", recipient.apikey);
    url.searchParams.set("text", text);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.text().catch(() => "");
      results.push({ ok: response.ok && /queued/i.test(body), status: response.status, phone: maskPhone(recipient.phone) });
    } catch (error) {
      results.push({ ok: false, status: "network_error", error: error?.message || "falha", phone: maskPhone(recipient.phone) });
    }
  }
  return { ok: results.some((row) => row.ok), results };
}

function normalizeState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    updatedAt: clean(state.updatedAt) || new Date().toISOString(),
    show: DISNEY_STORIES_SHOW,
    showImageUrl: clean(state.showImageUrl),
    episodes: Array.isArray(state.episodes) ? state.episodes.map(normalizeEpisode).filter(Boolean).slice(-40) : []
  };
}

function readPrebuiltEpisodeByDate(date) {
  const catalog = readPrebuiltCatalog();
  const episode = catalog?.episodes?.find((row) => row.date === date && row.status === "ready") || null;
  return episode ? normalizeEpisode(episode) : null;
}

function readPrebuiltCatalog() {
  const candidates = [
    join(process.cwd(), "app", "minha-viagem", "api", "_data", "disney-stories-catalog.json"),
    join(process.cwd(), "apps", "web", "app", "minha-viagem", "api", "_data", "disney-stories-catalog.json")
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      return JSON.parse(readFileSync(file, "utf8"));
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeEpisode(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: clean(row.id),
    date: clean(row.date),
    character: clean(row.character),
    lesson: clean(row.lesson),
    title: clean(row.title),
    description: clean(row.description),
    originNote: clean(row.originNote),
    disclaimer: clean(row.disclaimer),
    script: clean(row.script),
    scriptProvider: clean(row.scriptProvider),
    staticAudioUrl: clean(row.staticAudioUrl || row.audioUrl),
    audioUrl: expressiveAudioUrl(clean(row.id)) || clean(row.audioUrl),
    audioBytes: Number(row.audioBytes || 0),
    imageUrl: clean(row.imageUrl),
    pageUrl: clean(row.pageUrl),
    spotifyEpisodeUrl: clean(row.spotifyEpisodeUrl),
    spotifyEpisodeId: clean(row.spotifyEpisodeId),
    spotifyEmbedUrl: spotifyEpisodeEmbedUrl(row),
    guid: clean(row.guid),
    status: clean(row.status) || "ready",
    generatedAt: clean(row.generatedAt),
    notifiedAt: clean(row.notifiedAt),
    lastNotification: row.lastNotification || null,
    errors: Array.isArray(row.errors) ? row.errors.map(clean).filter(Boolean).slice(-20) : []
  };
}

function defaultState() {
  return normalizeState({ episodes: [] });
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };
  const options = {
    public: true,
    allowedMimeTypes: ["application/json", "audio/mpeg", "image/jpeg", "image/png", "image/svg+xml", "text/plain"],
    fileSizeLimit: 1024 * 1024 * 80
  };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) {
    const { error } = await client.storage.updateBucket(BUCKET, options);
    return error ? { ok: false, message: error.message } : { ok: true };
  }
  const { error } = await client.storage.createBucket(BUCKET, options);
  return error ? { ok: false, message: error.message } : { ok: true };
}

function publicStorageUrl(path) {
  const base = clean(appConfig.supabaseUrl).replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${BUCKET}/${encodeURI(path)}`;
}

function findStoryEpisodeSource(id) {
  const catalog = readPrebuiltCatalog();
  const prebuilt = catalog?.episodes?.find((row) => clean(row.id) === id && clean(row.status) === "ready");
  if (prebuilt) return prebuilt;
  const memory = normalizeState(memoryStore.state).episodes.find((row) => clean(row.id) === id && clean(row.status) === "ready");
  return memory || null;
}

function expressiveAudioUrl(id) {
  const cleanId = clean(id);
  if (!cleanId) return "";
  const base = clean(appConfig.siteUrl) || "https://claudiocode.dev";
  return `${base.replace(/\/$/, "")}/minha-viagem/api/disney-stories/audio/${encodeURIComponent(cleanId)}`;
}

function localExpressiveAudioPath(id) {
  const safe = clean(id).replace(/[^a-z0-9-]/gi, "");
  return join(tmpdir(), "claudiocode-disney-stories-audio", `${safe}.mp3`);
}

async function writeLocalExpressiveAudio(path, bytes) {
  await mkdir(join(tmpdir(), "claudiocode-disney-stories-audio"), { recursive: true });
  await writeFile(path, bytes);
}

function narrationInput(text) {
  return clean(text)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[“”]/g, "\"")
    .replace(/[‘’]/g, "'")
    .slice(0, 4096);
}

function bedtimeNarrationInstructions() {
  return [
    "Narre em portugues do Brasil como uma contadora de historias carinhosa para uma crianca de 3 anos dormir.",
    "A voz deve soar humana, natural, fofa e emocional, como uma mae ou tia lendo baixinho ao lado da cama.",
    "Use ritmo lento, pausas suaves entre frases, sorriso leve na voz e calor afetivo.",
    "Nas falas dos personagens, mude um pouco a intencao, sem caricatura exagerada.",
    "Em perguntas para a Luiza, soe curiosa e acolhedora, esperando mentalmente uma resposta.",
    "Evite tom de locucao, propaganda, robo, audiobook formal ou leitura apressada.",
    "Mantenha tudo calmo e seguro, com energia diminuindo no final para induzir sono."
  ].join(" ");
}

function fallbackSvg(item) {
  const title = `${item.name}\n${item.lesson}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1400" viewBox="0 0 1400 1400"><rect width="1400" height="1400" fill="#6d5dfc"/><circle cx="1080" cy="240" r="210" fill="#ffd166"/><circle cx="260" cy="1040" r="260" fill="#06d6a0"/><text x="120" y="620" font-family="Arial,sans-serif" font-size="92" fill="white" font-weight="700">Histórias da Luiza</text><text x="120" y="760" font-family="Arial,sans-serif" font-size="76" fill="white">${escapeSvg(title)}</text></svg>`;
}

function toSsml(text) {
  const paragraphs = String(text || "")
    .slice(0, 4300)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeSsml(paragraph.replace(/\n/g, " "))}</p><break time="650ms"/>`);
  return `<speak><prosody rate="slow" pitch="-1st">${paragraphs.join("")}</prosody></speak>`;
}

function clean(value) {
  return String(value ?? "").trim();
}

function maskPhone(phone) {
  const digits = clean(phone).replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}

function escapeSvg(value) {
  return clean(value).replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char]);
}

function escapeSsml(value) {
  return clean(value).replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "\"": "&quot;" })[char]);
}
