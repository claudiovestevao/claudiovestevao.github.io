import { randomUUID } from "node:crypto";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { readDiaryEntries, saveDiaryEntry } from "./diary";

const BUCKET = "diario";
const STATE_PATH = "checkins/v1.json";
const MAX_CHECKINS = 900;
const MAX_DRAFTS = 80;
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_PARTICIPANTS = ["vitor", "nathalie", "luiza", "arthur"];

const memoryStore = globalThis.__orlandoCheckinsStore || { state: defaultState() };
globalThis.__orlandoCheckinsStore = memoryStore;

export async function readCheckinState() {
  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state) };
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: bucket.message };

  const { data, error } = await client.storage.from(BUCKET).download(STATE_PATH);
  if (error) {
    const seeded = defaultState();
    await writeCheckinState(seeded);
    return { source: "supabase_storage", state: seeded };
  }

  try {
    const parsed = JSON.parse(await data.text());
    const state = normalizeState(parsed);
    memoryStore.state = state;
    return { source: "supabase_storage", state };
  } catch {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: "Estado de check-ins invalido." };
  }
}

export async function writeCheckinState(state) {
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

export async function listCheckinsForDate(date) {
  const current = await readCheckinState();
  const day = cleanDate(date) || todayInTripZone();
  return {
    ...current,
    date: day,
    checkins: current.state.checkins.filter((checkin) => checkin.date === day),
    draft: current.state.drafts.find((draft) => draft.date === day) || null
  };
}

export async function saveCheckin(input) {
  const current = await readCheckinState();
  const checkin = normalizeCheckin(input);
  const state = current.state;
  const index = state.checkins.findIndex((item) => item.id === checkin.id);

  if (index >= 0) {
    state.checkins[index] = normalizeCheckin({ ...state.checkins[index], ...checkin, updatedAt: new Date().toISOString() });
  } else {
    state.checkins.push(checkin);
  }

  state.checkins = state.checkins
    .sort((a, b) => String(b.observedAt || b.createdAt).localeCompare(String(a.observedAt || a.createdAt)))
    .slice(0, MAX_CHECKINS);
  state.updatedAt = new Date().toISOString();
  const write = await writeCheckinState(state);
  return { ok: true, source: write.source, warning: write.warning || "", checkin };
}

export async function generateDiaryDraft({ date, force = false, extraNote = "", mode = "manual" } = {}) {
  const current = await readCheckinState();
  const day = cleanDate(date) || todayInTripZone();
  const existing = current.state.drafts.find((draft) => draft.date === day && draft.status !== "approved");
  if (existing && !force && !extraNote) return { ok: true, duplicate: true, source: current.source, draft: existing };

  const checkins = current.state.checkins
    .filter((checkin) => checkin.date === day && checkin.confidence === "confirmed")
    .sort((a, b) => String(a.observedAt || a.createdAt).localeCompare(String(b.observedAt || b.createdAt)));
  const diaryEntries = await readServerDiaryEntries(day);
  const fallback = deterministicDraft({ date: day, checkins, diaryEntries, extraNote });
  const generated = await generateAiDraft({ date: day, checkins, diaryEntries, extraNote, fallback });
  const draft = normalizeDraft({
    id: existing?.id || `draft_${day}`,
    date: day,
    status: "draft",
    text: generated.text,
    provider: generated.provider,
    mode,
    checkinIds: checkins.map((checkin) => checkin.id),
    diaryEntryIds: diaryEntries.map((entry) => entry.id).filter(Boolean),
    extraNotes: [existing?.extraNotes || [], extraNote ? [{ text: clean(extraNote), at: new Date().toISOString() }] : []].flat().filter(Boolean),
    generatedAt: existing?.generatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    errors: generated.errors
  });

  const state = current.state;
  state.drafts = [draft, ...state.drafts.filter((item) => item.id !== draft.id && item.date !== day)].slice(0, MAX_DRAFTS);
  state.updatedAt = new Date().toISOString();
  const write = await writeCheckinState(state);
  return { ok: true, source: write.source, warning: write.warning || "", draft };
}

export async function updateDiaryDraft({ date, text, status = "draft", actor = null } = {}) {
  const current = await readCheckinState();
  const day = cleanDate(date) || todayInTripZone();
  const existing = current.state.drafts.find((draft) => draft.date === day) || normalizeDraft({ id: `draft_${day}`, date: day });
  const draft = normalizeDraft({
    ...existing,
    text: clean(text).slice(0, 12000) || existing.text,
    status,
    updatedAt: new Date().toISOString(),
    approvedAt: status === "approved" ? new Date().toISOString() : existing.approvedAt,
    approvedBy: status === "approved" ? normalizeActor(actor) : existing.approvedBy
  });

  current.state.drafts = [draft, ...current.state.drafts.filter((item) => item.id !== draft.id && item.date !== day)].slice(0, MAX_DRAFTS);
  current.state.updatedAt = new Date().toISOString();
  const write = await writeCheckinState(current.state);
  return { ok: true, source: write.source, warning: write.warning || "", draft };
}

export async function approveDiaryDraft({ date, text, actor = null } = {}) {
  const savedDraft = await updateDiaryDraft({ date, text, status: "approved", actor });
  const client = getSupabaseServerClient();
  let diaryResult = null;
  if (client && appConfig.supabaseServiceRoleKey) {
    const draft = savedDraft.draft;
    diaryResult = await saveDiaryEntry(client, {
      autor_phone: "",
      autor_nome: savedDraft.draft.approvedBy?.name || "Família",
      tipo: "texto",
      texto_original: draft.text,
      resumo_ia: draft.text,
      data_local: draft.date,
      wa_message_id: `nightly-diary-${draft.date}`,
      metadata: {
        source: "nightly_checkin_draft",
        draftId: draft.id,
        checkinIds: draft.checkinIds,
        approvedBy: draft.approvedBy
      }
    }).catch((error) => ({ ok: false, error: error?.message || "falha ao salvar diario" }));
  }

  return { ...savedDraft, diaryResult };
}

async function readServerDiaryEntries(date) {
  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) return [];
  const entries = await readDiaryEntries(client, { limit: 180 }).catch(() => []);
  return entries.filter((entry) => entry.data_local === date);
}

async function generateAiDraft({ date, checkins, diaryEntries, extraNote, fallback }) {
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (!apiKey) return { provider: "deterministic", text: fallback, errors: ["OPENAI_API_KEY ausente."] };

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_DIARY_DRAFT_MODEL || process.env.OPENAI_DIARY_SUMMARY_MODEL || "gpt-4o-mini",
        temperature: 0.45,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "Voce escreve diarios de viagem em pt-BR para uma familia. Use primeira pessoa do plural, tom carinhoso, simples e fiel aos fatos. Nao invente lugares, sentimentos ou acontecimentos."
          },
          {
            role: "user",
            content: draftPrompt({ date, checkins, diaryEntries, extraNote })
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    const text = clean(data?.choices?.[0]?.message?.content);
    if (!response.ok || !text) return { provider: "deterministic", text: fallback, errors: [`OpenAI falhou: ${response.status}`] };
    return { provider: "openai", text: text.slice(0, 9000), errors: [] };
  } catch (error) {
    return { provider: "deterministic", text: fallback, errors: [`OpenAI erro: ${error?.message || "falha"}`] };
  }
}

function draftPrompt({ date, checkins, diaryEntries, extraNote }) {
  const checkinLines = checkins.length
    ? checkins.map((checkin) => {
        const place = checkin.place?.name || checkin.manualPlace || "lugar sem nome";
        const time = checkin.localTime || localTime(checkin.observedAt);
        const participants = participantNames(checkin.participants).join(", ");
        return `- ${time}: ${place} (${participants || "familia"}). Nota: ${checkin.note || "-"}. Confiança: ${checkin.confidence}.`;
      }).join("\n")
    : "- nenhum check-in confirmado";

  const diaryLines = diaryEntries.length
    ? diaryEntries.map((entry) => `- ${entry.autor_nome || "Familia"}: ${(entry.resumo_ia || entry.texto_original || "").slice(0, 900)}`).join("\n")
    : "- nenhum relato adicional";

  return [
    `Data: ${date}.`,
    "Check-ins confirmados ou sugeridos:",
    checkinLines,
    "Relatos, WhatsApp, audios ou midias do dia:",
    diaryLines,
    extraNote ? `Complemento manual: ${clean(extraNote).slice(0, 1500)}` : "",
    "Escreva uma proposta de diario com 2 a 4 paragrafos curtos. Se houver incerteza, diga de forma leve que precisa confirmar. Termine com uma frase curta de fechamento do dia."
  ].filter(Boolean).join("\n\n");
}

function deterministicDraft({ date, checkins, diaryEntries, extraNote }) {
  const places = checkins.map((checkin) => checkin.place?.name || checkin.manualPlace).filter(Boolean);
  const uniquePlaces = [...new Set(places)];
  const snippets = diaryEntries
    .map((entry) => clean(entry.resumo_ia || entry.texto_original))
    .filter(Boolean)
    .slice(0, 3);

  const intro = uniquePlaces.length
    ? `Hoje registramos ${uniquePlaces.length} parada(s): ${joinNatural(uniquePlaces)}.`
    : "Hoje ainda nao temos check-ins confirmados, entao este rascunho precisa de uma revisao com calma.";
  const details = checkins.length
    ? checkins.map((checkin) => `${checkin.localTime || localTime(checkin.observedAt)} - ${checkin.place?.name || checkin.manualPlace || "lugar"}`).join("; ")
    : "Sem lugares confirmados por enquanto.";
  const memory = snippets.length ? `Tambem apareceu no diario: ${snippets.join(" ")}` : "";
  const complement = extraNote ? `Complemento anotado: ${clean(extraNote)}.` : "";

  return [
    `${intro} A linha do tempo do dia ficou assim: ${details}.`,
    memory,
    complement,
    "Antes de salvar como memoria final, vale conferir horarios, lugares e algum momento especial da Luiza."
  ].filter(Boolean).join("\n\n").slice(0, 9000);
}

function normalizeState(input) {
  const state = input && typeof input === "object" ? input : {};
  return {
    version: 1,
    updatedAt: clean(state.updatedAt) || new Date().toISOString(),
    checkins: Array.isArray(state.checkins) ? state.checkins.map(normalizeCheckin).filter(Boolean).slice(0, MAX_CHECKINS) : [],
    drafts: Array.isArray(state.drafts) ? state.drafts.map(normalizeDraft).filter(Boolean).slice(0, MAX_DRAFTS) : []
  };
}

function normalizeCheckin(row) {
  const now = new Date().toISOString();
  const observedAt = clean(row?.observedAt) || now;
  const place = normalizePlace(row?.place || row);
  const date = cleanDate(row?.date) || dateInTripZone(observedAt);
  return {
    id: clean(row?.id) || randomUUID(),
    date,
    observedAt,
    localTime: clean(row?.localTime) || localTime(observedAt),
    endedAt: clean(row?.endedAt),
    place,
    manualPlace: clean(row?.manualPlace || place.name).slice(0, 180),
    participants: normalizeParticipants(row?.participants),
    author: normalizeActor(row?.author),
    note: clean(row?.note).slice(0, 2000),
    mood: clean(row?.mood).slice(0, 80),
    source: oneOf(row?.source, ["manual", "gps", "google_places", "whatsapp", "imported"], "manual"),
    confidence: oneOf(row?.confidence, ["confirmed", "probable", "suggested", "divergent"], "confirmed"),
    evidence: Array.isArray(row?.evidence) ? row.evidence.slice(0, 8) : [],
    createdAt: clean(row?.createdAt) || now,
    updatedAt: clean(row?.updatedAt) || now
  };
}

function normalizeDraft(row) {
  if (!row || typeof row !== "object") return null;
  const date = cleanDate(row.date) || todayInTripZone();
  return {
    id: clean(row.id) || `draft_${date}`,
    date,
    status: oneOf(row.status, ["draft", "approved", "archived"], "draft"),
    text: clean(row.text).slice(0, 12000),
    provider: clean(row.provider || "deterministic"),
    mode: clean(row.mode || "manual"),
    checkinIds: Array.isArray(row.checkinIds) ? row.checkinIds.map(clean).filter(Boolean).slice(0, 80) : [],
    diaryEntryIds: Array.isArray(row.diaryEntryIds) ? row.diaryEntryIds.map(clean).filter(Boolean).slice(0, 80) : [],
    extraNotes: Array.isArray(row.extraNotes) ? row.extraNotes.map(normalizeExtraNote).filter(Boolean).slice(-20) : [],
    generatedAt: clean(row.generatedAt) || new Date().toISOString(),
    updatedAt: clean(row.updatedAt) || new Date().toISOString(),
    approvedAt: clean(row.approvedAt),
    approvedBy: row.approvedBy ? normalizeActor(row.approvedBy) : null,
    errors: Array.isArray(row.errors) ? row.errors.map(clean).filter(Boolean).slice(-10) : []
  };
}

function normalizePlace(row) {
  return {
    placeId: clean(row?.placeId || row?.id).slice(0, 180),
    name: clean(row?.name || row?.displayName || row?.manualPlace).slice(0, 180),
    formattedAddress: clean(row?.formattedAddress || row?.address).slice(0, 260),
    latitude: finiteOrNull(row?.latitude),
    longitude: finiteOrNull(row?.longitude),
    googleMapsUri: clean(row?.googleMapsUri).slice(0, 500),
    categories: Array.isArray(row?.categories || row?.types) ? (row.categories || row.types).map(clean).filter(Boolean).slice(0, 12) : []
  };
}

function normalizeParticipants(value) {
  const input = Array.isArray(value) ? value : [];
  const cleanParticipants = input.map(clean).filter((item) => DEFAULT_PARTICIPANTS.includes(item));
  return cleanParticipants.length ? [...new Set(cleanParticipants)] : DEFAULT_PARTICIPANTS;
}

function normalizeActor(value) {
  const actor = value && typeof value === "object" ? value : {};
  return {
    name: clean(actor.name || "Família").slice(0, 80),
    email: clean(actor.email).slice(0, 160),
    role: clean(actor.role || "admin").slice(0, 60)
  };
}

function normalizeExtraNote(value) {
  const note = value && typeof value === "object" ? value : { text: value };
  const text = clean(note.text).slice(0, 1500);
  return text ? { text, at: clean(note.at) || new Date().toISOString() } : null;
}

function defaultState() {
  return normalizeState({ checkins: [], drafts: [] });
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };
  const options = {
    public: false,
    allowedMimeTypes: ["application/json", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "video/mp4", "video/webm"],
    fileSizeLimit: String(50 * 1024 * 1024)
  };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) {
    if (typeof client.storage.updateBucket === "function") {
      const { error } = await client.storage.updateBucket(BUCKET, options);
      return error ? { ok: false, message: error.message } : { ok: true };
    }
    return { ok: true };
  }
  const { error } = await client.storage.createBucket(BUCKET, options);
  return error ? { ok: false, message: error.message } : { ok: true };
}

function todayInTripZone() {
  return dateInTripZone(new Date().toISOString());
}

function dateInTripZone(value) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ_DISPLAY || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value || Date.now()));
}

function localTime(value) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: process.env.TZ_DISPLAY || "America/New_York",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value || Date.now()));
}

function participantNames(participants) {
  const labels = { vitor: "Vitor", nathalie: "Nathalie", luiza: "Luiza", arthur: "Arthur" };
  return normalizeParticipants(participants).map((item) => labels[item] || item);
}

function joinNatural(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} e ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function cleanDate(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function oneOf(value, allowed, fallback) {
  const text = clean(value);
  return allowed.includes(text) ? text : fallback;
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clean(value) {
  return String(value ?? "").trim();
}
