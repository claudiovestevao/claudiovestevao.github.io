import { randomUUID } from "node:crypto";

const DIARY_BUCKET = "diario";
const FALLBACK_INDEX_PATH = "entries/v1.json";
const MAX_FALLBACK_ENTRIES = 500;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MEDIA_TYPES = new Set(["application/json", ...IMAGE_TYPES, ...VIDEO_TYPES]);

export function diaryPhotoUrl(path) {
  return path ? `/minha-viagem/api/diario/media?path=${encodeURIComponent(path)}` : "";
}

export async function readDiaryEntries(client, { limit = 120 } = {}) {
  const fallback = await readFallbackEntries(client).catch(() => []);
  const table = await readTableEntries(client, { limit }).catch((error) => {
    if (isMissingTable(error)) return [];
    throw error;
  });

  return mergeEntries([...table, ...fallback])
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .slice(0, limit);
}

export async function saveDiaryEntry(client, row) {
  const entry = normalizeDiaryEntry(row);
  let result = await insertTableEntry(client, entry);

  if (result.ok) return result;

  if (result.retryWithoutTrip) {
    result = await insertTableEntry(client, { ...entry, trip_id: null });
    if (result.ok) return result;
  }

  if (result.duplicate) return result;
  if (!result.fallback) throw result.error;

  return appendFallbackEntry(client, entry);
}

export async function uploadDiaryImage(client, { bytes, mime, dataLocal, messageId }) {
  return uploadDiaryMedia(client, {
    bytes,
    mime,
    dataLocal,
    messageId,
    allowedTypes: IMAGE_TYPES,
    maxBytes: MAX_IMAGE_BYTES,
    emptyMessage: "Imagem vazia ou maior que 10 MB.",
    formatMessage: "Formato de imagem nao suportado.",
    failureMessage: "Falha ao salvar foto do WhatsApp"
  });
}

export async function uploadDiaryVideo(client, { bytes, mime, dataLocal, messageId }) {
  return uploadDiaryMedia(client, {
    bytes,
    mime,
    dataLocal,
    messageId,
    allowedTypes: VIDEO_TYPES,
    maxBytes: MAX_VIDEO_BYTES,
    emptyMessage: "Video vazio ou maior que 50 MB.",
    formatMessage: "Formato de video nao suportado.",
    failureMessage: "Falha ao salvar video do WhatsApp"
  });
}

async function uploadDiaryMedia(client, { bytes, mime, dataLocal, messageId, allowedTypes, maxBytes, emptyMessage, formatMessage, failureMessage }) {
  const contentType = cleanMime(mime) || "image/jpeg";
  if (!allowedTypes.has(contentType)) {
    throw new Error(formatMessage);
  }

  if (!bytes?.byteLength || bytes.byteLength > maxBytes) {
    throw new Error(emptyMessage);
  }

  const bucket = await ensureDiaryBucket(client);
  if (!bucket.ok) throw new Error(bucket.message);

  const ext = extensionFor(contentType);
  const safeDate = cleanSegment(dataLocal || new Date().toISOString().slice(0, 10)) || "sem-data";
  const safeId = cleanSegment(messageId || String(Date.now())) || String(Date.now());
  const path = `media/${safeDate}/${safeId}.${ext}`;

  const { error } = await client.storage.from(DIARY_BUCKET).upload(path, Buffer.from(bytes), {
    contentType,
    upsert: true
  });

  if (error) throw new Error(`${failureMessage}: ${error.message}`);
  return path;
}

export async function downloadDiaryMedia(client, path) {
  const clean = cleanStoragePath(path);
  if (!clean) return { ok: false, status: 400, message: "Arquivo invalido." };

  const { data, error } = await client.storage.from(DIARY_BUCKET).download(clean);
  if (error) return { ok: false, status: 404, message: `Arquivo nao encontrado: ${error.message}` };

  return {
    ok: true,
    bytes: await data.arrayBuffer(),
    contentType: data.type || mimeFromPath(clean)
  };
}

async function readTableEntries(client, { limit }) {
  const tripId = configuredTripId();
  const query = client
    .from("diario_entries")
    .select("id,trip_id,autor_phone,autor_nome,tipo,texto_original,resumo_ia,foto_url,data_local,wa_message_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (tripId) query.or(`trip_id.eq.${tripId},trip_id.is.null`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeDiaryEntry);
}

async function insertTableEntry(client, entry) {
  const payload = { ...entry };
  if (!payload.id) delete payload.id;

  const { data, error } = await client
    .from("diario_entries")
    .insert(payload)
    .select("id,trip_id,autor_phone,autor_nome,tipo,texto_original,resumo_ia,foto_url,data_local,wa_message_id,metadata,created_at")
    .single();

  if (!error) return { ok: true, duplicate: false, source: "diario_entries", entry: normalizeDiaryEntry(data) };
  if (error.code === "23505") return { ok: true, duplicate: true, source: "diario_entries" };
  if (error.code === "23503" && entry.trip_id) return { ok: false, retryWithoutTrip: true, error };
  if (isUnsupportedVideoTypeConstraint(error, entry)) return { ok: false, fallback: true, error };
  if (isMissingTable(error)) return { ok: false, fallback: true, error };
  return { ok: false, error };
}

async function appendFallbackEntry(client, entry) {
  const bucket = await ensureDiaryBucket(client);
  if (!bucket.ok) throw new Error(bucket.message);

  const entries = await readFallbackEntries(client).catch(() => []);
  if (entry.wa_message_id && entries.some((item) => item.wa_message_id === entry.wa_message_id)) {
    return { ok: true, duplicate: true, source: "storage_fallback" };
  }

  const next = mergeEntries([normalizeDiaryEntry({ ...entry, id: entry.id || randomUUID() }), ...entries]).slice(
    0,
    MAX_FALLBACK_ENTRIES
  );

  const { error } = await client.storage.from(DIARY_BUCKET).upload(
    FALLBACK_INDEX_PATH,
    Buffer.from(JSON.stringify({ version: 1, entries: next }, null, 2), "utf8"),
    {
      contentType: "application/json",
      upsert: true
    }
  );

  if (error) throw new Error(`Falha ao salvar indice do diario: ${error.message}`);
  return { ok: true, duplicate: false, source: "storage_fallback", entry };
}

async function readFallbackEntries(client) {
  const bucket = await ensureDiaryBucket(client);
  if (!bucket.ok) return [];

  const { data, error } = await client.storage.from(DIARY_BUCKET).download(FALLBACK_INDEX_PATH);
  if (error) return [];

  const parsed = JSON.parse(await data.text());
  return Array.isArray(parsed?.entries) ? parsed.entries.map(normalizeDiaryEntry) : [];
}

async function ensureDiaryBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: `Falha ao listar buckets: ${listError.message}` };
  if ((buckets || []).some((bucket) => bucket.name === DIARY_BUCKET)) {
    if (typeof client.storage.updateBucket === "function") {
      const { error } = await client.storage.updateBucket(DIARY_BUCKET, {
        public: false,
        allowedMimeTypes: [...MEDIA_TYPES],
        fileSizeLimit: String(MAX_VIDEO_BYTES)
      });
      if (error) return { ok: false, message: `Falha ao atualizar bucket diario: ${error.message}` };
    }
    return { ok: true };
  }

  const { error } = await client.storage.createBucket(DIARY_BUCKET, {
    public: false,
    allowedMimeTypes: [...MEDIA_TYPES],
    fileSizeLimit: String(MAX_VIDEO_BYTES)
  });

  if (error) return { ok: false, message: `Falha ao criar bucket diario: ${error.message}` };
  return { ok: true };
}

function mergeEntries(entries) {
  const seen = new Set();
  const merged = [];

  for (const entry of entries) {
    const key = entry.wa_message_id || entry.id;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
  }

  return merged;
}

function normalizeDiaryEntry(row) {
  const fotoUrl = clean(row?.foto_url);
  const tripId = clean(row?.trip_id);
  return {
    id: clean(row?.id),
    trip_id: isUuid(tripId) ? tripId : null,
    autor_phone: clean(row?.autor_phone),
    autor_nome: clean(row?.autor_nome),
    tipo: ["texto", "audio", "foto", "video"].includes(clean(row?.tipo)) ? clean(row?.tipo) : "texto",
    texto_original: clean(row?.texto_original).slice(0, 20000),
    resumo_ia: clean(row?.resumo_ia).slice(0, 8000),
    foto_url: fotoUrl,
    foto_proxy_url: fotoUrl && !/^https?:\/\//i.test(fotoUrl) ? diaryPhotoUrl(fotoUrl) : fotoUrl,
    data_local: /^\d{4}-\d{2}-\d{2}$/.test(clean(row?.data_local)) ? clean(row?.data_local) : todayInOrlando(),
    wa_message_id: clean(row?.wa_message_id),
    metadata: row?.metadata && typeof row.metadata === "object" ? row.metadata : {},
    created_at: clean(row?.created_at) || new Date().toISOString()
  };
}

function todayInOrlando() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ_DISPLAY || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function configuredTripId() {
  const tripId = clean(process.env.DEFAULT_TRIP_ID);
  return isUuid(tripId) ? tripId : "";
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "")
  );
}

function isMissingTable(error) {
  const message = String(error?.message || "").toLowerCase();
  return error?.code === "42P01" || message.includes("diario_entries") || message.includes("does not exist");
}

function isUnsupportedVideoTypeConstraint(error, entry) {
  return entry?.tipo === "video" && error?.code === "23514";
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanMime(value) {
  return String(value || "").trim().toLowerCase().split(";")[0];
}

function cleanSegment(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanStoragePath(value) {
  const path = String(value || "").trim();
  if (!path || path.includes("..") || path.startsWith("/") || path.length > 240) return "";
  return /^[a-zA-Z0-9_./:-]+$/.test(path) ? path : "";
}

function extensionFor(type) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  return "jpg";
}

function mimeFromPath(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".heic")) return "image/heic";
  if (path.endsWith(".heif")) return "image/heif";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  return "image/jpeg";
}
