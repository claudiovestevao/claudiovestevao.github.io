import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { saveDiaryEntry, uploadDiaryImage, uploadDiaryVideo } from "../../_lib/diary";
import { saveCheckin } from "../../_lib/checkins";
import { searchGooglePlacesNearby, hasGoogleMaps } from "@/lib/integrations/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GRAPH_VERSION = clean(process.env.WHATSAPP_GRAPH_VERSION) || "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const MAX_WEBHOOK_BODY_BYTES = 1024 * 1024;
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_TRANSCRIBE_MODEL =
  clean(process.env.WHATSAPP_TRANSCRIBE_MODEL) || clean(process.env.OPENAI_TRANSCRIBE_MODEL) || "gpt-4o-transcribe";

const rateStore = globalThis.__orlandoWhatsAppWebhookRateLimit || new Map();
globalThis.__orlandoWhatsAppWebhookRateLimit = rateStore;

export async function GET(request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";

  if (mode === "subscribe" && challenge && expected && token === expected) {
    return new Response(challenge, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain"
      }
    });
  }

  return json({ ok: false, message: "Webhook nao verificado." }, 403);
}

export async function POST(request) {
  const body = Buffer.from(await request.arrayBuffer());

  if (body.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    return json({ ok: false, message: "Payload muito grande." }, 413);
  }

  if (!verifyMetaSignature(body, request.headers.get("x-hub-signature-256") || "")) {
    return json({ ok: false, message: "Assinatura invalida." }, 401);
  }

  const limited = rateLimit(request);
  if (limited) return limited;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return json({ ok: false, message: "Supabase privado nao configurado." }, 503);
  }

  const payload = parseJson(body);
  if (!payload) return json({ ok: false, message: "JSON invalido." }, 400);

  const messages = extractMessages(payload);
  console.info("whatsapp_webhook_received", JSON.stringify(describeWebhookPayload(payload, messages.length)));
  const results = [];

  for (const item of messages) {
    try {
      results.push(await processWhatsAppMessage(client, item));
    } catch (error) {
      console.error("whatsapp_diary_error", {
        messageId: item.message?.id,
        type: item.message?.type,
        error: error?.message || String(error)
      });
      results.push({ ok: false, id: item.message?.id || "", error: error?.message || "falha" });
    }
  }

  return json({ ok: true, received: messages.length, results }, 200);
}

async function processWhatsAppMessage(client, item) {
  const message = item.message || {};
  const type = clean(message.type);
  const from = digits(message.from);
  const allowed = allowedSenders();

  if (!from || !message.id) return { ok: true, ignored: true, reason: "mensagem sem remetente/id" };
  if (allowed.length && !allowed.includes(from)) {
    console.info("whatsapp_message_ignored", { id: message.id, type, reason: "sender_not_allowed" });
    return { ok: true, ignored: true, id: message.id, reason: "remetente fora da lista permitida" };
  }

  if (type === "location") {
    return handleLocationCheckin({ message, from, item });
  }

  if (!["text", "audio", "image", "video"].includes(type)) {
    console.info("whatsapp_message_ignored", { id: message.id, type, reason: "unsupported_type" });
    await sendWhatsAppReply(
      from,
      "Recebi sua mensagem, mas por enquanto o diario aceita texto, audio, foto, video MP4/WebM e localizacao (clipe > Localizacao).",
      item.phoneNumberId
    );
    return { ok: true, ignored: true, id: message.id, reason: `tipo nao suportado: ${type}` };
  }

  const dataLocal = localDateFromTimestamp(message.timestamp);
  let textoOriginal = "";
  let fotoPath = "";
  let tipo = "texto";

  if (type === "text") {
    tipo = "texto";
    textoOriginal = clean(message.text?.body).slice(0, 20000);
  }

  if (type === "audio") {
    tipo = "audio";
    const mediaId = clean(message.audio?.id);
    if (!mediaId) throw new Error("Audio sem media id.");
    const media = await downloadWhatsAppMedia(mediaId, MAX_AUDIO_BYTES);
    textoOriginal = await transcribeAudio(media.bytes, media.mime, audioFileName(message.id, media.mime));
  }

  if (type === "image") {
    tipo = "foto";
    textoOriginal = clean(message.image?.caption).slice(0, 20000);
    const mediaId = clean(message.image?.id);
    if (!mediaId) throw new Error("Foto sem media id.");
    const media = await downloadWhatsAppMedia(mediaId, MAX_IMAGE_BYTES);
    fotoPath = await uploadDiaryImage(client, {
      bytes: media.bytes,
      mime: media.mime,
      dataLocal,
      messageId: message.id
    });
  }

  if (type === "video") {
    tipo = "video";
    textoOriginal = clean(message.video?.caption).slice(0, 20000);
    const mediaId = clean(message.video?.id);
    if (!mediaId) throw new Error("Video sem media id.");
    const media = await downloadWhatsAppMedia(mediaId, MAX_VIDEO_BYTES);
    fotoPath = await uploadDiaryVideo(client, {
      bytes: media.bytes,
      mime: media.mime,
      dataLocal,
      messageId: message.id
    });
  }

  if (!textoOriginal && !fotoPath) {
    console.info("whatsapp_message_ignored", { id: message.id, type, reason: "empty_content" });
    return { ok: true, ignored: true, id: message.id, reason: "sem conteudo para registrar" };
  }

  const author = whatsappAuthor(from);
  const resumo = textoOriginal ? await summarizeDiaryText(textoOriginal) : "";
  const saved = await saveDiaryEntry(client, {
    trip_id: clean(process.env.DEFAULT_TRIP_ID) || null,
    autor_phone: from,
    autor_nome: author.name,
    tipo,
    texto_original: textoOriginal,
    resumo_ia: resumo,
    foto_url: fotoPath,
    data_local: dataLocal,
    wa_message_id: message.id,
    metadata: {
      source: "whatsapp",
      whatsapp_type: type,
      whatsapp_timestamp: message.timestamp || "",
      author_key: author.key,
      author_avatar: author.avatar,
      storage: savedStorageLabel(fotoPath)
    }
  });

  if (!saved.duplicate) {
    console.info("whatsapp_message_saved", { id: message.id, type, source: saved.source || "", willReply: true });
    await sendWhatsAppReply(from, `\u2705 Anotado no seu diario de Orlando! (dia ${dataLocal})`, item.phoneNumberId);
  } else {
    console.info("whatsapp_message_saved", { id: message.id, type, source: saved.source || "", duplicate: true });
  }

  return { ok: true, id: message.id, type, duplicate: Boolean(saved.duplicate), source: saved.source || "" };
}

async function handleLocationCheckin({ message, from, item }) {
  const location = message.location || {};
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    console.info("whatsapp_location_ignored", { id: message.id, reason: "coordenadas_invalidas" });
    return { ok: true, ignored: true, id: message.id, reason: "localizacao sem coordenadas validas" };
  }

  const author = whatsappAuthor(from);
  const manualName = clean(location.name);
  const address = clean(location.address);
  const place = await resolvePlaceFromCoordinates({ latitude, longitude, manualName, address });
  const observedAt = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString();

  const saved = await saveCheckin({
    observedAt,
    place,
    manualPlace: place.name || manualName || address,
    author: { name: author.name, role: author.key },
    note: "",
    source: "whatsapp",
    confidence: "confirmed",
    evidence: [{ type: "whatsapp_location", messageId: message.id }]
  });

  const placeLabel = saved.checkin?.place?.name || saved.checkin?.manualPlace || "local sem nome";
  const timeLabel = saved.checkin?.localTime || "";
  console.info("whatsapp_checkin_saved", { id: message.id, place: placeLabel, source: saved.source });
  await sendWhatsAppReply(
    from,
    `📍 Check-in registrado: ${placeLabel}${timeLabel ? ` as ${timeLabel}` : ""}. Vou usar isso no diario de hoje!`,
    item.phoneNumberId
  );

  return { ok: true, id: message.id, type: "location", checkin: true, place: placeLabel };
}

async function resolvePlaceFromCoordinates({ latitude, longitude, manualName, address }) {
  const base = {
    placeId: "",
    name: manualName || "",
    formattedAddress: address || "",
    latitude,
    longitude,
    googleMapsUri: `https://maps.google.com/?q=${latitude},${longitude}`,
    categories: []
  };

  if (manualName || !hasGoogleMaps()) return base;

  try {
    const [nearest] = await searchGooglePlacesNearby({ latitude, longitude, radiusMeters: 120, maxResultCount: 1 });
    if (!nearest) return base;
    return {
      placeId: nearest.placeId || "",
      name: nearest.name || base.name,
      formattedAddress: nearest.formattedAddress || base.formattedAddress,
      latitude,
      longitude,
      googleMapsUri: nearest.googleMapsUri || base.googleMapsUri,
      categories: nearest.categories || []
    };
  } catch (error) {
    console.warn("whatsapp_location_reverse_geocode_failed", error?.message || String(error));
    return base;
  }
}

function extractMessages(payload) {
  const out = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      const eventPhoneId = clean(value?.metadata?.phone_number_id);

      const contacts = new Map(
        (value.contacts || []).map((contact) => [digits(contact?.wa_id), clean(contact?.profile?.name)])
      );

      for (const message of value.messages || []) {
        out.push({
          message,
          phoneNumberId: eventPhoneId,
          contactName: contacts.get(digits(message?.from)) || ""
        });
      }
    }
  }
  return out;
}

function describeWebhookPayload(payload, messageCount) {
  const changes = [];
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};
      changes.push({
        field: clean(change?.field),
        phoneNumberId: clean(value?.metadata?.phone_number_id),
        messageTypes: (value.messages || []).map((message) => clean(message?.type)).filter(Boolean),
        statuses: (value.statuses || []).length
      });
    }
  }

  return {
    object: clean(payload?.object),
    entries: (payload?.entry || []).length,
    messages: messageCount,
    changes
  };
}

async function downloadWhatsAppMedia(mediaId, maxBytes) {
  const metadata = await graphJson(`/${encodeURIComponent(mediaId)}`);
  const mediaUrl = clean(metadata.url);
  if (!mediaUrl) throw new Error("Meta nao retornou URL da midia.");

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${whatsappToken()}`
    }
  });

  if (!response.ok) {
    throw new Error(`Falha ao baixar midia do WhatsApp: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Midia maior que o limite permitido.");

  return {
    bytes,
    mime: cleanMime(response.headers.get("content-type") || metadata.mime_type || "application/octet-stream")
  };
}

async function transcribeAudio(bytes, mime, filename) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY nao configurada.");
  if (!bytes?.byteLength || bytes.byteLength > MAX_AUDIO_BYTES) throw new Error("Audio vazio ou grande demais.");

  const form = new FormData();
  form.append("model", OPENAI_TRANSCRIBE_MODEL);
  form.append("language", "pt");
  form.append(
    "prompt",
    "Transcreva em portugues brasileiro. Contexto: diario da viagem de Orlando de Vitor, Nathalie, Luiza e Arthur."
  );
  form.append("file", new Blob([bytes], { type: mime || "audio/ogg" }), filename);

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: form
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI transcricao ${response.status}`);
  return clean(data.text).slice(0, 20000);
}

async function summarizeDiaryText(text) {
  const cleanText = clean(text);
  if (!cleanText || !process.env.OPENAI_API_KEY) return "";

  const response = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_DIARY_SUMMARY_MODEL || "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "Voce e um diario de viagem. Escreva em pt-BR, em primeira pessoa, com tom carinhoso, fiel aos fatos e sem inventar nada."
        },
        {
          role: "user",
          content:
            "A partir do relato abaixo, escreva um registro curto destacando momentos com a familia (Luiza, Nathalie) e a viagem a Orlando. Guarde o sentido original e nao acrescente fatos.\n\nRelato:\n" +
            cleanText.slice(0, 12000)
        }
      ]
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("whatsapp_diary_summary_error", data?.error?.message || response.status);
    return "";
  }

  return clean(data?.choices?.[0]?.message?.content).slice(0, 8000);
}

async function sendWhatsAppReply(to, body, eventPhoneNumberId = "") {
  const phoneNumberId = clean(eventPhoneNumberId) || clean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const token = whatsappToken();
  if (!phoneNumberId || !token) {
    console.warn("whatsapp_reply_skipped", {
      missingPhoneNumberId: !phoneNumberId,
      missingToken: !token
    });
    return;
  }

  const response = await fetch(`${GRAPH_BASE}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    console.error("whatsapp_reply_error", data?.error?.message || response.status);
  } else {
    console.info("whatsapp_reply_sent", { toSuffix: String(to).slice(-4) });
  }
}

async function graphJson(path) {
  const token = whatsappToken();
  if (!token) throw new Error("Token do WhatsApp nao configurado.");

  const response = await fetch(`${GRAPH_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Graph API ${response.status}`);
  return data;
}

function verifyMetaSignature(body, signature) {
  const secret = metaAppSecret();
  if (!secret || !signature.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  return safeEqual(signature, expected);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

function rateLimit(request) {
  const now = Date.now();
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "local";
  const key = `wa:${ip}`;
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + 60_000 });
    return null;
  }

  current.count += 1;
  if (current.count <= 60) return null;

  return json({ ok: false, message: "Muitas chamadas em pouco tempo." }, 429, {
    "Retry-After": String(Math.ceil((current.resetAt - now) / 1000))
  });
}

function allowedSenders() {
  return String(process.env.WHATSAPP_ALLOWED_SENDERS || "")
    .split(",")
    .map(digits)
    .filter(Boolean);
}

function localDateFromTimestamp(timestamp) {
  const seconds = Number(timestamp);
  const date = Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.TZ_DISPLAY || "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString("utf8"));
  } catch {
    return null;
  }
}

function savedStorageLabel(path) {
  return path ? "supabase_storage_diario" : "";
}

function audioFileName(messageId, mime) {
  const base = cleanFileBase(messageId) || `whatsapp-audio-${Date.now()}`;
  return `${base}.${audioExtensionFor(mime)}`;
}

function audioExtensionFor(mime) {
  const type = cleanMime(mime);
  if (type === "audio/mpeg" || type === "audio/mp3") return "mp3";
  if (type === "audio/mp4" || type === "audio/x-m4a" || type === "audio/m4a") return "m4a";
  if (type === "audio/aac" || type === "audio/aacp") return "aac";
  if (type === "audio/amr") return "amr";
  if (type === "audio/wav" || type === "audio/x-wav") return "wav";
  if (type === "audio/webm") return "webm";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  return "ogg";
}

function cleanFileBase(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function whatsappAuthor(phone) {
  const normalized = digits(phone);
  const authors = [
    { phone: "5511998802974", key: "papai", name: "Papai (Vitor)", avatar: "👨‍👧" },
    { phone: "5511973528122", key: "mamae", name: "Mamãe (Nathalie)", avatar: "🤰" }
  ];

  return authors.find((author) => author.phone === normalized) || {
    key: "unknown",
    name: "Número desconhecido",
    avatar: "?"
  };
}

function whatsappToken() {
  return (
    clean(process.env.WHATSAPP_PERMANENT_TOKEN) ||
    clean(process.env.WHATSAPP_API_TOKEN) ||
    clean(process.env.WHATSAPP_ACCESS_TOKEN) ||
    clean(process.env.WHATSAPP_TOKEN)
  );
}

function metaAppSecret() {
  return (
    clean(process.env.META_APP_SECRET) ||
    clean(process.env.WHATSAPP_APP_SECRET) ||
    clean(process.env.META_WEBHOOK_APP_SECRET) ||
    clean(process.env.FACEBOOK_APP_SECRET)
  );
}

function clean(value) {
  return String(value ?? "").trim();
}

function cleanMime(value) {
  return String(value || "").trim().toLowerCase().split(";")[0];
}

function digits(value) {
  return String(value || "").replace(/\D+/g, "");
}

function json(payload, status, headers = {}) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}
