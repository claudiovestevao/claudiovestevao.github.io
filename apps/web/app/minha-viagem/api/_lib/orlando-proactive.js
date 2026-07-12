import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const BUCKET = "orlando-trip-private";
const STATE_PATH = "proactive/v1.json";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const CALLMEBOT_WHATSAPP_URL = "https://api.callmebot.com/whatsapp.php";

export const ORLANDO_RECIPIENTS = {
  emails: ["nathalierbonomi@gmail.com", "cvitorestevao@gmail.com"]
};

export const PRICE_WATCH_SEEDS = [
  { item: "Babá eletrônica", loja: "amazon", target: 80, url: "" },
  { item: "Mamadeiras Dr. Brown's / Avent", loja: "target", target: 25, url: "" },
  { item: "Chupetas Philips Avent newborn", loja: "target", target: 8, url: "" },
  { item: "Swaddles / cueiros Aden+Anais", loja: "amazon", target: 32, url: "" },
  { item: "Saco de dormir leve TOG 0.5-1.0", loja: "amazon", target: 24, url: "" },
  { item: "Bodies manga curta NB / 0-3M", loja: "carters", target: 18, url: "" },
  { item: "Bodies manga curta 3-6M e 6-9M", loja: "carters", target: 18, url: "" },
  { item: "Pijamas / sleepers leves", loja: "carters", target: 22, url: "" },
  { item: "Pomada Aquaphor / Desitin", loja: "walmart", target: 12, url: "" },
  { item: "Lenços umedecidos Water Wipes/Huggies", loja: "target", target: 18, url: "" },
  { item: "Termômetro digital", loja: "amazon", target: 16, url: "" },
  { item: "Trocador portátil", loja: "amazon", target: 25, url: "" },
  { item: "Tapete / móbile de atividades", loja: "target", target: 35, url: "" },
  { item: "Mantas leves", loja: "carters", target: 20, url: "" },
  { item: "Primeiros brinquedos / mordedor", loja: "target", target: 10, url: "" }
];

const memoryStore = globalThis.__orlandoProactiveStore || { state: defaultState("memory_boot") };
globalThis.__orlandoProactiveStore = memoryStore;

export async function readProactiveState() {
  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state) };
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: bucket.message };

  const { data, error } = await client.storage.from(BUCKET).download(STATE_PATH);
  if (error) {
    const msg = String(error.message || "");
    if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("does not exist")) {
      const seeded = defaultState("supabase_seed");
      await writeProactiveState(seeded);
      return { source: "supabase_storage", state: seeded };
    }
    return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: msg };
  }

  try {
    return { source: "supabase_storage", state: normalizeState(JSON.parse(await data.text())) };
  } catch {
    return { source: "memory_fallback", state: normalizeState(memoryStore.state), warning: "Estado proativo invalido." };
  }
}

export async function writeProactiveState(state) {
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

export async function runDailyBriefing({ now = new Date(), force = false, mode = "" } = {}) {
  const current = await readProactiveState();
  const state = normalizeState(current.state);
  const todayBr = dateInZone(now, "America/Sao_Paulo");
  const phase = todayBr >= "2026-08-09" && todayBr <= "2026-08-18" ? "during" : "before";

  if (todayBr > "2026-08-18") {
    await appendOutbox(state, {
      kind: "daily_briefing",
      date: todayBr,
      status: "skipped",
      message: "Robô encerrado após o último dia da viagem.",
      channels: []
    });
    await writeProactiveState(state);
    return { ok: true, skipped: true, reason: "after_trip", state };
  }

  if (state.settings.paused && !force) {
    await appendOutbox(state, {
      kind: "daily_briefing",
      date: todayBr,
      status: "skipped",
      message: "Robô pausado no site.",
      channels: []
    });
    await writeProactiveState(state);
    return { ok: true, skipped: true, reason: "paused", state };
  }

  const existing = state.outbox.find((row) => row.kind === "daily_briefing" && row.date === todayBr && row.status !== "failed");
  if (existing && !force) return { ok: true, duplicate: true, message: existing.message, state };

  const context = await collectBriefingContext({ now, phase });
  const message = await generateBriefingMessage({ context, state, phase });
  const outbox = await appendOutbox(state, {
    kind: "daily_briefing",
    phase,
    date: todayBr,
    status: "pending",
    message,
    context,
    channels: []
  });

  await deliverOutboxItem(state, outbox);
  await writeProactiveState(state);
  return { ok: true, message, outbox, source: current.source, mode, state };
}

export async function runPriceWatch({ now = new Date(), digest = false } = {}) {
  const current = await readProactiveState();
  const state = normalizeState(current.state);
  const todayBr = dateInZone(now, "America/Sao_Paulo");

  if (todayBr > "2026-08-07") {
    state.priceWatch.lastRunAt = now.toISOString();
    state.priceWatch.lastStatus = "stopped_after_cutoff";
    await writeProactiveState(state);
    return { ok: true, stopped: true, state };
  }

  const active = state.priceWatch.items.filter((item) => item.active && item.url);
  const alerts = [];
  const checked = [];

  for (const item of active.slice(0, 30)) {
    const result = await checkPriceItem(item);
    const nowIso = now.toISOString();
    item.checkedAt = nowIso;
    item.lastStatus = result.ok ? "ok" : "manual_check";
    if (!result.ok) {
      item.failures = (item.failures || 0) + 1;
      item.lastError = result.error || "Falha ao ler preço.";
      if (item.failures >= 3) item.manualCheck = true;
      checked.push({ item: item.item, ok: false, error: item.lastError });
      continue;
    }

    const previous = Number(item.lastPrice || 0);
    item.failures = 0;
    item.lastError = "";
    item.lastPrice = result.price;
    item.lowestPrice = item.lowestPrice ? Math.min(Number(item.lowestPrice), result.price) : result.price;
    item.currency = result.currency || "USD";

    const targetHit = Number(item.target || 0) > 0 && result.price <= Number(item.target);
    const dropHit = previous > 0 && result.price <= previous * 0.9;
    const lastAlertKey = `${item.id}:${result.price}:${todayBr}`;
    if ((targetHit || dropHit) && item.lastAlertKey !== lastAlertKey) {
      item.lastAlertKey = lastAlertKey;
      alerts.push({ ...item, reason: targetHit ? "target" : "drop" });
    }
    checked.push({ item: item.item, ok: true, price: result.price });
  }

  if (alerts.length) await sendPriceAlertEmail(alerts);
  if (digest || isMondayInSaoPaulo(now)) await sendPriceDigestEmail(state.priceWatch.items);

  state.priceWatch.lastRunAt = now.toISOString();
  state.priceWatch.lastStatus = `${checked.length} verificados, ${alerts.length} alertas`;
  await writeProactiveState(state);
  return { ok: true, checked, alerts, state };
}

export async function deliverOutboxItem(state, item) {
  item.channels = item.channels || [];
  item.attempts = (item.attempts || 0) + 1;

  const [email, whatsapp] = await Promise.all([
    sendEmail({
      to: ORLANDO_RECIPIENTS.emails,
      subject: emailSubjectFor(item),
      html: briefingHtml(item.message),
      text: item.message
    }),
    sendWhatsAppCallMeBot(item.message)
  ]);
  item.channels.push({ channel: "email", at: new Date().toISOString(), ...email });
  item.channels.push({ channel: "whatsapp_callmebot", at: new Date().toISOString(), ...whatsapp });

  item.status = item.channels.some((ch) => ch.ok) ? "sent" : "failed";
  item.sentAt = item.status === "sent" ? new Date().toISOString() : "";
  state.lastDelivery = {
    at: new Date().toISOString(),
    status: item.status,
    summary: item.channels.map((ch) => `${ch.channel}:${ch.ok ? "ok" : ch.status || "fail"}`).join(", ")
  };
  return item;
}

export function normalizeState(input) {
  const base = defaultState("normalize");
  const state = input && typeof input === "object" ? input : {};
  return {
    ...base,
    version: 1,
    updatedAt: clean(state.updatedAt) || base.updatedAt,
    settings: {
      ...base.settings,
      ...(state.settings || {}),
      deliveryMode: "email_whatsapp",
      recipients: ORLANDO_RECIPIENTS
    },
    outbox: Array.isArray(state.outbox) ? state.outbox.slice(-80).map(normalizeOutbox) : [],
    jokeHashes: Array.isArray(state.jokeHashes) ? state.jokeHashes.slice(-120).map(clean).filter(Boolean) : [],
    lastDelivery: state.lastDelivery && typeof state.lastDelivery === "object" ? state.lastDelivery : base.lastDelivery,
    priceWatch: normalizePriceWatch(state.priceWatch)
  };
}

function defaultState(reason = "seed") {
  return {
    version: 1,
    reason,
    updatedAt: new Date().toISOString(),
    settings: {
      paused: false,
      deliveryMode: "email_whatsapp",
      recipients: ORLANDO_RECIPIENTS
    },
    outbox: [],
    jokeHashes: [],
    lastDelivery: { at: "", status: "never", summary: "" },
    priceWatch: {
      lastRunAt: "",
      lastStatus: "Aguardando primeira checagem.",
      items: PRICE_WATCH_SEEDS.map((item, index) => ({
        id: `arthur-${index + 1}`,
        ...item,
        target: item.target,
        active: true,
        lastPrice: null,
        lowestPrice: null,
        checkedAt: "",
        failures: 0,
        manualCheck: false
      }))
    }
  };
}

function normalizePriceWatch(input) {
  const seeded = defaultState().priceWatch;
  const byId = new Map(seeded.items.map((item) => [item.id, item]));
  const currentItems = Array.isArray(input?.items) ? input.items : [];
  for (const raw of currentItems) {
    const id = clean(raw.id) || `custom-${byId.size + 1}`;
    byId.set(id, {
      id,
      item: clean(raw.item).slice(0, 120) || "Item",
      loja: clean(raw.loja).slice(0, 40) || "loja",
      url: clean(raw.url).slice(0, 1200),
      target: Number(raw.target || 0),
      active: raw.active !== false,
      lastPrice: raw.lastPrice == null ? null : Number(raw.lastPrice),
      lowestPrice: raw.lowestPrice == null ? null : Number(raw.lowestPrice),
      checkedAt: clean(raw.checkedAt),
      failures: Number(raw.failures || 0),
      manualCheck: Boolean(raw.manualCheck),
      lastStatus: clean(raw.lastStatus),
      lastError: clean(raw.lastError),
      lastAlertKey: clean(raw.lastAlertKey)
    });
  }
  return {
    lastRunAt: clean(input?.lastRunAt),
    lastStatus: clean(input?.lastStatus) || seeded.lastStatus,
    items: Array.from(byId.values()).slice(0, 80)
  };
}

async function appendOutbox(state, item) {
  const row = normalizeOutbox({
    id: `${item.kind || "msg"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...item
  });
  state.outbox.push(row);
  state.outbox = state.outbox.slice(-80);
  state.updatedAt = new Date().toISOString();
  return row;
}

function normalizeOutbox(row) {
  return {
    id: clean(row.id),
    kind: clean(row.kind) || "message",
    phase: clean(row.phase),
    date: clean(row.date),
    status: clean(row.status) || "pending",
    attempts: Number(row.attempts || 0),
    message: clean(row.message).slice(0, 3000),
    context: row.context && typeof row.context === "object" ? row.context : {},
    channels: Array.isArray(row.channels) ? row.channels.slice(-12) : [],
    createdAt: clean(row.createdAt) || new Date().toISOString(),
    sentAt: clean(row.sentAt)
  };
}

async function collectBriefingContext({ now, phase }) {
  const [weather, fx, nhc] = await Promise.allSettled([fetchWeather(), fetchDollar(), fetchHurricane()]);
  const todayBr = dateInZone(now, "America/Sao_Paulo");
  return {
    todayBr,
    phase,
    daysLeft: daysBetween(todayBr, "2026-08-09"),
    weather: weather.status === "fulfilled" ? weather.value : null,
    dollar: fx.status === "fulfilled" ? fx.value : null,
    hurricane: nhc.status === "fulfilled" ? nhc.value : null,
    task: taskForDate(todayBr),
    itinerary: itineraryForDate(todayBr),
    useful: usefulTipForDate(todayBr)
  };
}

async function generateBriefingMessage({ context, state, phase }) {
  const deterministic = buildDeterministicBriefing(context, phase);
  if (!process.env.OPENAI_API_KEY) return deterministic;

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.ORLANDO_BRIEFING_MODEL || "gpt-4o-mini",
        temperature: 0.75,
        max_tokens: 360,
        messages: [
          {
            role: "system",
            content:
              "Voce escreve briefings curtos em pt-BR para uma familia paulistana indo a Orlando. Tom leve, util, com humor moderado. Proibido politica, religiao, peso/aparencia. Maximo 800 caracteres. Sempre inclua countdown ou dia da viagem, tarefa/clima/info util e um humor do dia. Nao repita piadas."
          },
          {
            role: "user",
            content: JSON.stringify({ context, jokeHashes: state.jokeHashes.slice(-30) })
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return deterministic;
    const text = clean(data?.choices?.[0]?.message?.content).slice(0, 900);
    if (!text) return deterministic;
    const hash = simpleHash(text);
    state.jokeHashes.push(hash);
    state.jokeHashes = state.jokeHashes.slice(-120);
    return text;
  } catch {
    return deterministic;
  }
}

function buildDeterministicBriefing(context) {
  const lines = [];
  if (context.hurricane?.active) lines.push(`⚠️ Radar NHC: ${context.hurricane.summary}`);
  if (context.daysLeft > 0) lines.push(`✈️ Faltam ${context.daysLeft} dias para Orlando!`);
  else lines.push(`✈️ Orlando 2026: briefing do dia ${formatDateBr(context.todayBr)}.`);
  if (context.task) lines.push(`📋 Hoje: ${context.task}`);
  if (context.weather) lines.push(`🌤️ Orlando: ${context.weather.summary}`);
  if (context.dollar) lines.push(`💵 Dólar: ${context.dollar.summary}`);
  if (context.itinerary) lines.push(`🗺️ Plano: ${context.itinerary}`);
  lines.push(`😂 Humor do dia: a mala ainda está vazia, mas o enxoval do Arthur já está fazendo check-in emocional.`);
  return lines.join("\n").slice(0, 900);
}

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=28.54&longitude=-81.38&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York";
  const data = await fetchJson(url, 5000);
  const max = Math.round(Number(data?.daily?.temperature_2m_max?.[0] || 0));
  const min = Math.round(Number(data?.daily?.temperature_2m_min?.[0] || 0));
  const rain = Math.round(Number(data?.daily?.precipitation_probability_max?.[0] || 0));
  return { max, min, rain, summary: `${min}-${max}°C, chuva ${rain}%` };
}

async function fetchDollar() {
  const now = await fetchJson("https://economia.awesomeapi.com.br/last/USD-BRL", 5000);
  const daily = await fetchJson("https://economia.awesomeapi.com.br/json/daily/USD-BRL/15", 5000).catch(() => []);
  const bid = Number(now?.USDBRL?.bid || 0);
  const vals = Array.isArray(daily) ? daily.map((row) => Number(row.bid || row.high || 0)).filter(Boolean) : [];
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : bid;
  const mood = bid && avg ? (bid <= avg * 0.99 ? "abaixo da média da quinzena" : bid >= avg * 1.01 ? "acima da média" : "perto da média") : "";
  return { bid, avg, summary: `R$ ${bid.toFixed(2).replace(".", ",")} (${mood})` };
}

async function fetchHurricane() {
  const data = await fetchJson("https://www.nhc.noaa.gov/CurrentStorms.json", 5000).catch(() => null);
  const storms = Array.isArray(data?.activeStorms) ? data.activeStorms : [];
  if (!storms.length) return { active: false, summary: "" };
  const names = storms.map((s) => clean(s.name || s.id || "sistema")).slice(0, 3).join(", ");
  return { active: true, summary: `${names}. Ver NHC: https://www.nhc.noaa.gov/` };
}

async function checkPriceItem(item) {
  try {
    const html = await fetchText(item.url, 9000);
    const price = extractPrice(html);
    if (!price) return { ok: false, error: "Preço não encontrado automaticamente." };
    return { ok: true, price, currency: "USD" };
  } catch (error) {
    return { ok: false, error: error?.message || "Falha no fetch." };
  }
}

function extractPrice(html) {
  const text = String(html || "").slice(0, 250000);
  const patterns = [
    /"price"\s*:\s*"?(\d{1,4}(?:\.\d{2})?)"?/i,
    /"salePrice"\s*:\s*"?(\d{1,4}(?:\.\d{2})?)"?/i,
    /\$\s*(\d{1,4}(?:\.\d{2})?)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (value > 0 && value < 5000) return value;
    }
  }
  return 0;
}

async function sendPriceAlertEmail(alerts) {
  const rows = alerts.map((item) => `<li><b>${escapeHtml(item.item)}</b>: US$ ${Number(item.lastPrice).toFixed(2)} alvo US$ ${Number(item.target || 0).toFixed(2)} - <a href="${escapeHtml(item.url)}">abrir produto</a></li>`).join("");
  return sendEmail({
    to: ORLANDO_RECIPIENTS.emails,
    subject: `🔻 [Enxoval] ${alerts.length} item(ns) caíram de preço`,
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>Monitor de preços do Arthur</h2><ul>${rows}</ul><p>Revise antes de comprar; Amazon/lojas podem mudar preço no checkout.</p></div>`,
    text: alerts.map((item) => `${item.item}: US$ ${item.lastPrice} - ${item.url}`).join("\n")
  });
}

async function sendPriceDigestEmail(items) {
  const rows = items.filter((item) => item.active).map((item) => `<tr><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.loja)}</td><td>US$ ${Number(item.target || 0).toFixed(2)}</td><td>${item.lastPrice ? `US$ ${Number(item.lastPrice).toFixed(2)}` : "-"}</td><td>${escapeHtml(item.lastStatus || "")}</td></tr>`).join("");
  return sendEmail({
    to: ORLANDO_RECIPIENTS.emails,
    subject: "Resumo semanal - monitor de preços do enxoval",
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>Monitor de preços do Arthur</h2><table cellpadding="6" cellspacing="0" border="1">${rows}</table></div>`,
    text: "Resumo semanal do monitor de preços do enxoval."
  });
}

async function sendEmail({ to, subject, html, text }) {
  if (!process.env.RESEND_API_KEY) {
    return {
      ok: false,
      status: "missing_resend",
      error: "RESEND_API_KEY ausente no ambiente de producao."
    };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.TRANSACTIONAL_EMAIL_FROM || "Minha Viagem Orlando <noreply@claudiocode.dev>",
      to,
      subject,
      html,
      text
    })
  });
  const data = await response.json().catch(() => ({}));
  return response.ok ? { ok: true, provider: "resend", id: data.id || "" } : { ok: false, provider: "resend", status: response.status, error: data.message || data.error || "" };
}

async function sendWhatsAppCallMeBot(text) {
  const phone = clean(process.env.CALLMEBOT_WHATSAPP_PHONE);
  const apikey = clean(process.env.CALLMEBOT_WHATSAPP_APIKEY || process.env.CALLMEBOT_API_KEY);
  if (!phone || !apikey) {
    return {
      ok: false,
      provider: "callmebot",
      status: "missing_callmebot",
      error: "CALLMEBOT_WHATSAPP_PHONE/CALLMEBOT_WHATSAPP_APIKEY ausentes no ambiente de producao."
    };
  }

  const url = new URL(CALLMEBOT_WHATSAPP_URL);
  url.searchParams.set("phone", phone);
  url.searchParams.set("text", String(text || "").slice(0, 3500));
  url.searchParams.set("apikey", apikey);

  try {
    const response = await fetch(url, { method: "GET", cache: "no-store" });
    const body = await response.text().catch(() => "");
    const failedByBody = /error|invalid|not authorized|not authorised|apikey|phone number/i.test(body);
    return response.ok && !failedByBody
      ? { ok: true, provider: "callmebot", status: response.status, response: body.slice(0, 160) }
      : { ok: false, provider: "callmebot", status: response.status, error: body.slice(0, 240) || "Falha no CallMeBot." };
  } catch (error) {
    return { ok: false, provider: "callmebot", status: "network_error", error: error?.message || "Falha de rede no CallMeBot." };
  }
}

function emailSubjectFor(item) {
  return item.phase === "during"
    ? `Orlando 2026: briefing do dia - ${formatDateBr(item.date)}`
    : `✈️ Faltam ${Math.max(0, daysBetween(item.date, "2026-08-09"))} dias - briefing Orlando`;
}

function briefingHtml(message) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;white-space:pre-line"><h2>Minha Viagem Orlando 2026</h2>${escapeHtml(message)}<p style="font-size:12px;color:#64748b;margin-top:18px">Gerado pelo robô da viagem. O painel continua sendo a fonte principal.</p></div>`;
}

function taskForDate(date) {
  const tasks = {
    "2026-07-12": "Conferir validade dos passaportes e vistos.",
    "2026-07-19": "Contratar/confirmar seguro viagem.",
    "2026-07-26": "Avisar cartões e habilitar uso internacional.",
    "2026-07-30": "Comprar dólar/carregar cartão internacional se cotação ajudar.",
    "2026-08-02": "Começar malas e pesar.",
    "2026-08-04": "Fazer pedidos Amazon/Target para hotel.",
    "2026-08-06": "Check-ins, eSIM e documentos offline.",
    "2026-08-08": "Malas fechadas, documentos na mochila e powerbanks carregados."
  };
  return tasks[date] || "Escolher uma pendência pequena e fechar sem abrir dez abas novas.";
}

function itineraryForDate(date) {
  const rows = {
    "2026-08-09": "Chegada, carro, hotel e mercado leve.",
    "2026-08-10": "Kit calor + clearance adulto.",
    "2026-08-11": "MacroBaby + Vineland + T-REX.",
    "2026-08-12": "Magic Kingdom + almoço no castelo.",
    "2026-08-15": "Hollywood Studios cedo, Pixar, Frozen e shows.",
    "2026-08-17": "Epic Universe + aniversário de casamento.",
    "2026-08-18": "Volta: malas, carro, MCO."
  };
  return rows[date] || "";
}

function usefulTipForDate(date) {
  const tips = ["Baixar/entrar nos apps Target Circle, Nike, Carter's e CVS.", "Guardar notas das compras para orçamento e Receita.", "Cooling towel e garrafa ajudam mais que coragem em fila quente.", "Comparar preço online antes do caixa nos itens caros."];
  return tips[Math.abs(daysBetween("2026-07-11", date)) % tips.length];
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: listError.message };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) return { ok: true };
  const { error } = await client.storage.createBucket(BUCKET, { public: false, allowedMimeTypes: ["application/json"], fileSizeLimit: String(1024 * 1024 * 2) });
  return error ? { ok: false, message: error.message } : { ok: true };
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0 OrlandoPriceWatch/1.0" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function isMondayInSaoPaulo(date) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" }).format(date) === "Mon";
}

function dateInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function daysBetween(start, end) {
  return Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${start}T12:00:00Z`)) / 86400000);
}

function formatDateBr(iso) {
  const [y, m, d] = String(iso).split("-");
  return `${d}/${m}/${y}`;
}

function simpleHash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(31, h) + text.charCodeAt(i) | 0;
  return String(h);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
}

function clean(value) {
  return String(value ?? "").trim();
}
