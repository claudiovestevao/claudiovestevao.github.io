import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  BRIEFING_SLOTS,
  attractionSpotlightForDate,
  briefingSlotForDate,
  buildDeterministicBriefing,
  callMeBotRecipients,
  deliveryStatusForChannels,
  diaryPromptForDate,
  floridaTipForDate,
  magicForDate,
  maskPhone,
  normalizeBriefingSlot,
  storyTeaserForDate,
  taskForDate
} from "./orlando-briefing-utils.js";

export {
  briefingSlotForDate,
  buildDeterministicBriefing,
  callMeBotRecipients,
  deliveryStatusForChannels,
  attractionSpotlightForDate,
  diaryPromptForDate,
  floridaTipForDate,
  magicForDate,
  normalizeBriefingSlot,
  storyTeaserForDate,
  taskForDate
} from "./orlando-briefing-utils.js";

const BUCKET = "orlando-trip-private";
const STATE_PATH = "proactive/v1.json";
const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const CALLMEBOT_WHATSAPP_URL = "https://api.callmebot.com/whatsapp.php";

export const ORLANDO_RECIPIENTS = {
  emails: ["nathalierbonomi@gmail.com", "cvitorestevao@gmail.com"],
  whatsappPhones: ["5511973528122", "5511998802974"]
};

export const PRICE_WATCH_SEEDS = [
  {
    id: "arthur-nanit",
    item: "Nanit Pro Smart Baby Monitor (babÃ¡ eletrÃ´nica Nanit Pro)",
    person: "Arthur",
    priority: "Tem que comprar",
    loja: "Amazon",
    target: 249,
    url: "https://www.amazon.com/s?k=Nanit+Pro+Smart+Baby+Monitor",
    reason: "BabÃ¡ eletrÃ´nica premium do enxoval."
  },
  {
    id: "arthur-bottles",
    item: "Dr. Brown's newborn bottle set (kit de mamadeiras para recÃ©m-nascido)",
    person: "Arthur",
    priority: "Tem que comprar",
    loja: "Target/Amazon",
    target: 24,
    url: "https://www.target.com/s?searchTerm=Dr+Brown+newborn+bottle+set",
    reason: "Mamadeiras e fluxo anti-cÃ³lica costumam variar bastante."
  },
  {
    id: "arthur-swaddles",
    item: "Aden + Anais muslin swaddle 4 pack (kit com 4 cueiros de musselina)",
    person: "Arthur",
    priority: "Tem que comprar",
    loja: "Amazon/Target",
    target: 34,
    url: "https://www.amazon.com/s?k=Aden+Anais+muslin+swaddle+4+pack",
    reason: "Cueiros leves para bebÃª de verÃ£o."
  },
  {
    id: "arthur-aquaphor",
    item: "Aquaphor Baby Healing Ointment 14 oz (pomada reparadora Aquaphor bebÃª)",
    person: "Arthur",
    priority: "Talvez comprar",
    loja: "Walmart/Target",
    target: 14,
    url: "https://www.walmart.com/search?q=Aquaphor+Baby+Healing+Ointment+14+oz",
    reason: "Item de farmÃ¡cia fÃ¡cil de comprar online se cair preÃ§o."
  },
  {
    id: "luiza-stroller-fan",
    item: "Portable stroller fan (ventilador portÃ¡til para carrinho)",
    person: "Luiza",
    priority: "Tem que comprar",
    loja: "Amazon/Walmart",
    target: 18,
    url: "https://www.amazon.com/s?k=portable+stroller+fan",
    reason: "Ajuda muito no calor de agosto."
  },
  {
    id: "luiza-cooling-towel",
    item: "Cooling towel kids 4 pack (kit com 4 toalhas refrescantes infantis)",
    person: "Luiza",
    priority: "Tem que comprar",
    loja: "Amazon/Walmart",
    target: 10,
    url: "https://www.amazon.com/s?k=kids+cooling+towel+4+pack",
    reason: "Barato, leve e Ãºtil para parques."
  },
  {
    id: "family-ponchos",
    item: "Frogg Toggs poncho / kids rain gear (poncho/capa de chuva infantil)",
    person: "FamÃ­lia",
    priority: "Tem que comprar",
    loja: "Amazon/Walmart",
    target: 9,
    url: "https://www.amazon.com/s?k=Frogg+Toggs+kids+poncho",
    reason: "Chuva de tarde em Orlando sem depender de guarda-chuva."
  },
  {
    id: "family-airtag",
    item: "Apple AirTag 4 Pack (kit com 4 rastreadores AirTag)",
    person: "FamÃ­lia",
    priority: "Talvez comprar",
    loja: "Amazon/Best Buy",
    target: 74,
    url: "https://www.amazon.com/s?k=Apple+AirTag+4+Pack",
    reason: "Ãštil para malas e carrinho se aparecer oferta boa."
  },
  {
    id: "nathalie-compression-socks",
    item: "Maternity compression socks (meias de compressÃ£o para gestante)",
    person: "Nathalie",
    priority: "Tem que comprar",
    loja: "Amazon/Target",
    target: 15,
    url: "https://www.amazon.com/s?k=maternity+compression+socks",
    reason: "Conforto no voo e nos dias longos."
  },
  {
    id: "vitor-ck-boxers",
    item: "Calvin Klein men's boxer briefs pack (kit de cuecas boxer Calvin Klein)",
    person: "Vitor",
    priority: "Tem que comprar",
    loja: "Amazon/Calvin Klein",
    target: 29,
    url: "https://www.amazon.com/s?k=Calvin+Klein+mens+boxer+briefs+pack",
    reason: "SÃ³ vale comprar fora se ficar bem abaixo do preÃ§o BR."
  }
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

export async function runDailyBriefing({ now = new Date(), force = false, mode = "", slot = "" } = {}) {
  const current = await readProactiveState();
  const state = normalizeState(current.state);
  const todayBr = dateInZone(now, "America/Sao_Paulo");
  const briefingSlot = normalizeBriefingSlot(slot) || briefingSlotForDate(now);
  const phase = todayBr >= "2026-08-09" && todayBr <= "2026-08-18" ? "during" : "before";

  if (todayBr > "2026-08-18") {
    await appendOutbox(state, {
      kind: "daily_briefing",
      date: todayBr,
      status: "skipped",
      message: "RobÃ´ encerrado apÃ³s o Ãºltimo dia da viagem.",
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
      message: "RobÃ´ pausado no site.",
      channels: []
    });
    await writeProactiveState(state);
    return { ok: true, skipped: true, reason: "paused", state };
  }

  const existing = state.outbox.find((row) => row.kind === "daily_briefing" && row.date === todayBr && (row.context?.slot || "08") === briefingSlot && row.status !== "failed");
  if (existing && !force) return { ok: true, duplicate: true, message: existing.message, state };

  const context = await collectBriefingContext({ now, phase, slot: briefingSlot });
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

export async function runPriceWatch({ now = new Date(), digest = false, notify = false } = {}) {
  const current = await readProactiveState();
  const state = normalizeState(current.state);
  const todayBr = dateInZone(now, "America/Sao_Paulo");

  if (todayBr > "2026-08-18") {
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
      item.lastError = result.error || "Falha ao ler preÃ§o.";
      if (item.failures >= 3) item.manualCheck = true;
      checked.push({ item: item.item, ok: false, error: item.lastError });
      continue;
    }

    const previous = Number(item.lastPrice || 0);
    const target = Number(item.target || 0);
    if (target >= 40 && result.price < target * 0.15) {
      item.lastStatus = "manual_check";
      item.manualCheck = true;
      item.lastError = "PreÃ§o lido parece de anÃºncio/acessÃ³rio, nÃ£o do item monitorado.";
      checked.push({ item: item.item, ok: false, error: item.lastError });
      continue;
    }
    item.failures = 0;
    item.lastError = "";
    item.lastPrice = result.price;
    item.lowestPrice = item.lowestPrice ? Math.min(Number(item.lowestPrice), result.price) : result.price;
    item.currency = result.currency || "USD";

    const targetHit = target > 0 && result.price <= target;
    const dropHit = previous > 0 && result.price <= previous * 0.9;
    const lastAlertKey = `${item.id}:${result.price}:${todayBr}`;
    if ((targetHit || dropHit) && item.lastAlertKey !== lastAlertKey) {
      item.lastAlertKey = lastAlertKey;
      alerts.push({ ...item, reason: targetHit ? "target" : "drop" });
    }
    checked.push({ item: item.item, ok: true, price: result.price });
  }

  let whatsapp = null;
  if (alerts.length) await sendPriceAlertEmail(alerts);
  if (notify && alerts.length) {
    whatsapp = await sendPriceWatchWhatsApp({ alerts, checked, items: state.priceWatch.items, now });
    state.priceWatch.lastWhatsApp = {
      at: now.toISOString(),
      ok: Boolean(whatsapp.ok),
      status: whatsapp.status || "",
      summary: whatsapp.ok ? "WhatsApp enviado pelo CallMeBot." : (whatsapp.error || whatsapp.status || "Falha no CallMeBot.")
    };
  } else if (notify) {
    state.priceWatch.lastWhatsApp = {
      at: now.toISOString(),
      ok: true,
      status: "skipped_no_alerts",
      summary: "Sem WhatsApp: nenhum item bateu preço-alvo ou queda relevante."
    };
  }
  if (digest || isMondayInSaoPaulo(now)) await sendPriceDigestEmail(state.priceWatch.items);

  const whatsStatus = notify
    ? (alerts.length ? `, WhatsApp ${whatsapp?.ok ? "ok" : "pendente"}` : ", WhatsApp pulado sem alerta")
    : "";
  state.priceWatch.lastRunAt = now.toISOString();
  state.priceWatch.lastStatus = `${checked.length} verificados, ${alerts.length} alertas${whatsStatus}`;
  await writeProactiveState(state);
  return { ok: true, checked, alerts, whatsapp, state };
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

  item.status = deliveryStatusForChannels(item.channels);
  item.sentAt = item.status !== "failed" ? new Date().toISOString() : "";
  state.lastDelivery = {
    at: new Date().toISOString(),
    status: item.status,
    summary: item.channels.map((ch) => `${ch.channel}:${ch.ok ? "ok" : ch.status || "fail"}`).join(", ")
  };
  console.info("orlando_daily_delivery", JSON.stringify({
    date: item.date,
    status: item.status,
    summary: state.lastDelivery.summary,
    channels: item.channels.map(safeChannelSummary)
  }));
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
      lastWhatsApp: { at: "", ok: false, status: "never", summary: "" },
      items: PRICE_WATCH_SEEDS.map((item, index) => ({
        id: item.id || `watch-${index + 1}`,
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
  const allowedIds = new Set(byId.keys());
  const currentItems = Array.isArray(input?.items) ? input.items : [];
  for (const raw of currentItems) {
    const id = clean(raw.id);
    if (!id || (!allowedIds.has(id) && !id.startsWith("custom-"))) continue;
    const base = byId.get(id) || {};
    const rawItem = clean(raw.item).slice(0, 120);
    byId.set(id, {
      ...base,
      id,
      item: rawItem && (rawItem.includes("(") || !base.item) ? rawItem : base.item || rawItem || "Item",
      person: clean(raw.person).slice(0, 40) || base.person || "",
      priority: clean(raw.priority).slice(0, 40) || base.priority || "",
      reason: clean(raw.reason).slice(0, 180) || base.reason || "",
      loja: clean(raw.loja).slice(0, 40) || base.loja || "loja",
      url: clean(raw.url).slice(0, 1200) || base.url || "",
      target: Number(raw.target || base.target || 0),
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
    lastWhatsApp: input?.lastWhatsApp && typeof input.lastWhatsApp === "object" ? {
      at: clean(input.lastWhatsApp.at),
      ok: Boolean(input.lastWhatsApp.ok),
      status: clean(input.lastWhatsApp.status),
      summary: clean(input.lastWhatsApp.summary)
    } : seeded.lastWhatsApp,
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

async function collectBriefingContext({ now, phase, slot }) {
  const [weather, nhc] = await Promise.allSettled([fetchWeather(), fetchHurricane()]);
  const todayBr = dateInZone(now, "America/Sao_Paulo");
  return {
    todayBr,
    phase,
    slot,
    slotLabel: BRIEFING_SLOTS[slot]?.label || "08h",
    slotTheme: BRIEFING_SLOTS[slot]?.theme || "manhÃ£",
    daysLeft: daysBetween(todayBr, "2026-08-09"),
    weather: weather.status === "fulfilled" ? weather.value : null,
    hurricane: nhc.status === "fulfilled" ? nhc.value : null,
    task: taskForDate(todayBr, slot),
    itinerary: itineraryForDate(todayBr),
    useful: usefulTipForDate(todayBr),
    magic: magicForDate(todayBr, slot),
    florida: floridaTipForDate(todayBr),
    attraction: attractionSpotlightForDate(todayBr),
    story: storyTeaserForDate(todayBr),
    diaryPrompt: diaryPromptForDate(todayBr),
    tomorrow: itineraryForDate(addDays(todayBr, 1))
  };
}

async function generateBriefingMessage({ context, state, phase }) {
  const deterministic = buildDeterministicBriefing(context, phase);
  const alertRules = "Alertas curtos, padronizados, amigaveis e uteis. Proibido falar de cobranca, fatura, pagamento, cartao, dolar, cotacao, preco, gasto, custo, limite, taxa ou qualquer assunto financeiro. Use o horario: 08h briefing/acao; 13h decisao util, Florida ou parque; 19h fechamento, historinha da Luiza e diario. Sempre comece com um marcador entre colchetes como [ANTES], [HOJE], [DURANTE], [LUIZA], [DIARIO] ou [FLORIDA].";
  if (!process.env.OPENAI_API_KEY) return deterministic;

  try {
    const response = await fetch(OPENAI_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.ORLANDO_BRIEFING_MODEL || "gpt-4o-mini",
        temperature: 0.75,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Voce escreve alertas curtissimos em pt-BR para Nathalie, Vitor e Luiza (3 anos) na viagem Orlando 2026. Use 2-5 emojis, no maximo 520 caracteres, e comece com marcador padronizado entre colchetes. Seja pratico: inclua uma acao concreta, um risco evitado ou uma decisao de 10 minutos. Nada generico. Nunca fale de bagagem antes de 02/08/2026. Slot 08h = briefing/acao; 13h = decisao util, Florida ou parque; 19h = fechamento, historinha da Luiza e diario."
          },
          {
            role: "user",
            content: JSON.stringify({ context, alertRules, jokeHashes: state.jokeHashes.slice(-30) })
          }
        ]
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return deterministic;
    const text = clean(data?.choices?.[0]?.message?.content).slice(0, 620);
    if (!text) return deterministic;
    if (hasBillingTone(text)) return deterministic;
    const hash = simpleHash(text);
    state.jokeHashes.push(hash);
    state.jokeHashes = state.jokeHashes.slice(-120);
    return text;
  } catch {
    return deterministic;
  }
}

async function fetchWeather() {
  const url = "https://api.open-meteo.com/v1/forecast?latitude=28.54&longitude=-81.38&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FNew_York";
  const data = await fetchJson(url, 5000);
  const max = Math.round(Number(data?.daily?.temperature_2m_max?.[0] || 0));
  const min = Math.round(Number(data?.daily?.temperature_2m_min?.[0] || 0));
  const rain = Math.round(Number(data?.daily?.precipitation_probability_max?.[0] || 0));
  return { max, min, rain, summary: `${min}-${max}Â°C, chuva ${rain}%` };
}

async function fetchDollar() {
  const now = await fetchJson("https://economia.awesomeapi.com.br/last/USD-BRL", 5000);
  const daily = await fetchJson("https://economia.awesomeapi.com.br/json/daily/USD-BRL/15", 5000).catch(() => []);
  const bid = Number(now?.USDBRL?.bid || 0);
  const vals = Array.isArray(daily) ? daily.map((row) => Number(row.bid || row.high || 0)).filter(Boolean) : [];
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : bid;
  const mood = bid && avg ? (bid <= avg * 0.99 ? "abaixo da mÃ©dia da quinzena" : bid >= avg * 1.01 ? "acima da mÃ©dia" : "perto da mÃ©dia") : "";
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
    if (!price) return { ok: false, error: "PreÃ§o nÃ£o encontrado automaticamente." };
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
  const rows = alerts.map((item) => `<li><b>${escapeHtml(item.item)}</b>${item.person ? ` (${escapeHtml(item.person)})` : ""}: US$ ${Number(item.lastPrice).toFixed(2)} alvo US$ ${Number(item.target || 0).toFixed(2)} - <a href="${escapeHtml(item.url)}">abrir produto</a></li>`).join("");
  return sendEmail({
    to: ORLANDO_RECIPIENTS.emails,
    subject: `ðŸ”» [Monitor geral] ${alerts.length} item(ns) caÃ­ram de preÃ§o`,
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>Monitor de PreÃ§os Geral</h2><ul>${rows}</ul><p>Revise antes de comprar; Amazon/lojas podem mudar preÃ§o no checkout.</p></div>`,
    text: alerts.map((item) => `${item.item}: US$ ${item.lastPrice} - ${item.url}`).join("\n")
  });
}

async function sendPriceDigestEmail(items) {
  const rows = items.filter((item) => item.active).map((item) => `<tr><td>${escapeHtml(item.person || "")}</td><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.loja)}</td><td>US$ ${Number(item.target || 0).toFixed(2)}</td><td>${item.lastPrice ? `US$ ${Number(item.lastPrice).toFixed(2)}` : "-"}</td><td>${escapeHtml(item.lastStatus || "")}</td></tr>`).join("");
  return sendEmail({
    to: ORLANDO_RECIPIENTS.emails,
    subject: "Resumo semanal - Monitor de PreÃ§os Geral",
    html: `<div style="font-family:Arial,sans-serif;color:#0f172a"><h2>Monitor de PreÃ§os Geral</h2><table cellpadding="6" cellspacing="0" border="1">${rows}</table></div>`,
    text: "Resumo semanal do Monitor de PreÃ§os Geral."
  });
}

async function sendPriceWatchWhatsApp({ alerts, checked, items, now }) {
  const message = priceWatchWhatsAppMessage({ alerts, checked, items, now });
  const result = await sendWhatsAppCallMeBot(message);
  return { ...result, message };
}

function priceWatchWhatsAppMessage({ alerts, checked, items, now }) {
  const today = formatDateBr(dateInZone(now, "America/Sao_Paulo"));
  if (alerts.length) {
    const sorted = [...alerts].sort((a, b) => Number(a.lastPrice || 0) - Number(b.lastPrice || 0));
    const first = sorted[0];
    const more = sorted.length > 1 ? ` +${sorted.length - 1} outro(s) alerta(s).` : "";
    return `Monitor 13h (${today}): oferta no alvo. ${first.person ? `${first.person}: ` : ""}${first.item} por ${formatUsd(first.lastPrice)} (alvo ${formatUsd(first.target)}). ${first.url}${more}`;
  }

  const best = bestPriceCandidate(items);
  if (best) {
    const gap = Number(best.lastPrice || 0) - Number(best.target || 0);
    const gapText = gap > 0 ? `faltam ${formatUsd(gap)} para o alvo` : "no alvo";
    return `Monitor 13h (${today}): nenhum item novo bateu oferta hoje. Mais perto: ${best.person ? `${best.person}: ` : ""}${best.item} por ${formatUsd(best.lastPrice)} (${gapText}). ${best.url}`;
  }

  const failures = (checked || []).filter((row) => !row.ok).slice(0, 2).map((row) => row.item).join(", ");
  return `Monitor 13h (${today}): nao consegui ler preco confiavel automaticamente hoje${failures ? ` (${failures})` : ""}. Deixei os itens no painel para checagem manual antes de comprar.`;
}

function bestPriceCandidate(items) {
  return (items || [])
    .filter((item) => item.active !== false && Number(item.lastPrice || 0) > 0 && Number(item.target || 0) > 0)
    .sort((a, b) => ((Number(a.lastPrice) - Number(a.target)) / Number(a.target)) - ((Number(b.lastPrice) - Number(b.target)) / Number(b.target)))[0] || null;
}

function formatUsd(value) {
  return `US$ ${Number(value || 0).toFixed(2)}`;
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
  const recipients = callMeBotRecipients();
  if (!recipients.length) {
    return {
      ok: false,
      provider: "callmebot",
      status: "missing_callmebot",
      error: "CALLMEBOT_WHATSAPP_RECIPIENTS ou CALLMEBOT_WHATSAPP_PHONE/CALLMEBOT_WHATSAPP_APIKEY ausentes no ambiente de producao."
    };
  }

  const results = [];
  for (const recipient of recipients) {
    const url = new URL(CALLMEBOT_WHATSAPP_URL);
    url.searchParams.set("phone", recipient.phone);
    url.searchParams.set("text", String(text || "").slice(0, 620));
    url.searchParams.set("apikey", recipient.apikey);

    try {
      const response = await fetch(url, { method: "GET", cache: "no-store" });
      const body = await response.text().catch(() => "");
      const failedByBody = /error|invalid|not authorized|not authorised|apikey|phone number/i.test(body);
      results.push(response.ok && !failedByBody
        ? { ok: true, phone: maskPhone(recipient.phone), status: response.status, response: body.slice(0, 120) }
        : { ok: false, phone: maskPhone(recipient.phone), status: response.status, error: body.slice(0, 180) || "Falha no CallMeBot." });
    } catch (error) {
      results.push({ ok: false, phone: maskPhone(recipient.phone), status: "network_error", error: error?.message || "Falha de rede no CallMeBot." });
    }
  }

  return {
    ok: results.length > 0 && results.every((row) => row.ok),
    provider: "callmebot",
    status: results.every((row) => row.ok) ? "sent_all" : "partial_or_failed",
    recipients: results
  };
}

function emailSubjectFor(item) {
  return item.phase === "during"
    ? `Orlando 2026: briefing do dia - ${formatDateBr(item.date)}`
    : `âœˆï¸ Faltam ${Math.max(0, daysBetween(item.date, "2026-08-09"))} dias - briefing Orlando`;
}

function briefingHtml(message) {
  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;white-space:pre-line"><h2>Minha Viagem Orlando 2026</h2>${escapeHtml(message)}<p style="font-size:12px;color:#64748b;margin-top:18px">Gerado pelo robÃ´ da viagem. O painel continua sendo a fonte principal.</p></div>`;
}

function itineraryForDate(date) {
  const rows = {
    "2026-08-09": "Chegada, carro, hotel e Target Flamingo Crossings leve.",
    "2026-08-10": "Beauty Master + Carter's Clearance + mercado.",
    "2026-08-11": "Vineland curto + T-REX.",
    "2026-08-12": "Magic Kingdom + almoÃ§o no castelo.",
    "2026-08-15": "Hollywood Studios cedo, Pixar, Frozen e shows.",
    "2026-08-17": "Epic Universe + aniversÃ¡rio de casamento.",
    "2026-08-18": "Volta: malas, carro, MCO."
  };
  return rows[date] || "";
}

function usefulTipForDate(date) {
  const dated = {
    "2026-07-12": "documento bom Ã© documento achÃ¡vel: foto no celular + cÃ³pia em pasta offline + uma versÃ£o no email.",
    "2026-07-13": "nomeie arquivos com prefixo simples: 01-passaporte, 02-visto, 03-seguro, 04-ingressos.",
    "2026-07-14": "login que falha no sofÃ¡ vira estresse na fila; melhor testar app e senha agora.",
    "2026-07-15": "calendÃ¡rio com endereÃ§o economiza conversa, bateria e decisÃ£o quando todo mundo estiver cansado.",
    "2026-07-16": "telefone de emergÃªncia salvo como favorito ajuda quando internet, humor ou paciÃªncia falham.",
    "2026-07-17": "endereÃ§os salvos offline evitam caÃ§a ao Wi-Fi quando alguÃ©m sÃ³ quer chegar logo.",
    "2026-07-18": "mapa offline Ã© feio, mas salva quando o roaming resolve tirar fÃ©rias tambÃ©m.",
    "2026-07-19": "seguro viagem precisa de telefone, apÃ³lice e regras de acionamento fÃ¡ceis de achar.",
    "2026-07-20": "para a Luiza, rotina escrita vale ouro: sono, remÃ©dio, lanchinho seguro e o que acalma.",
    "2026-07-21": "foto da nota no caixa evita arqueologia de recibos amassados na volta.",
    "2026-07-22": "reserva boa tem cÃ³digo, endereÃ§o, horÃ¡rio e tempo de deslocamento no mesmo lugar.",
    "2026-07-23": "internet Ã© item de seguranÃ§a: combinar quem tem eSIM e quem tem plano B.",
    "2026-07-24": "PDF salvo sÃ³ no WhatsApp nÃ£o conta; salve em Arquivos/Drive para abrir offline.",
    "2026-07-25": "lista curta por pessoa deixa outlet mais leve e evita decidir tudo no cansaÃ§o.",
    "2026-07-26": "ingressos e reservas precisam abrir sem internet; testar no sofÃ¡ Ã© mais simpÃ¡tico que testar na fila.",
    "2026-07-27": "lista Ãºnica vence memÃ³ria heroica. Documento, remÃ©dio e eletrÃ´nico entram primeiro.",
    "2026-07-28": "cadeirinha, pedÃ¡gio e seguro do carro sÃ£o detalhes pequenos com poder de travar chegada.",
    "2026-07-29": "uma conversa fixada com links vira central de comando da famÃ­lia.",
    "2026-07-30": "calendÃ¡rio com endereÃ§o e horÃ¡rio transforma deslocamento em toque no Maps.",
    "2026-07-31": "regra de bagagem antes da mala evita descobrir no aeroporto que faltou espaÃ§o para o essencial.",
    "2026-08-01": "amanhÃ£ comeÃ§a mala; hoje Ã© fechar documento e dormir com menos abas abertas."
  };
  if (dated[date]) return dated[date];
  const tips = ["Baixar/entrar nos apps Target Circle, Nike, Carter's e CVS.", "Guardar notas em uma pasta simples para achar tudo sem caÃ§a ao papel.", "Cooling towel e garrafa ajudam mais que coragem em fila quente.", "Escolher uma loja principal por dia evita atravessar Orlando por impulso."];
  return tips[Math.abs(daysBetween("2026-07-11", date)) % tips.length];
}

function hasBillingTone(text) {
  const normalized = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return /\b(cobranca|cobrar|fatura|pagamento|pagar|cartao|cartoes|dolar|cotacao|spread|iof|limite|preco|gasto|custo|custos|taxa)\b/i.test(normalized);
}

function safeChannelSummary(channel) {
  return {
    channel: clean(channel?.channel),
    ok: Boolean(channel?.ok),
    status: clean(channel?.status),
    provider: clean(channel?.provider),
    recipients: Array.isArray(channel?.recipients)
      ? channel.recipients.map((row) => ({
          ok: Boolean(row?.ok),
          phone: clean(row?.phone),
          status: clean(row?.status),
          error: clean(row?.error).slice(0, 120)
        }))
      : []
  };
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

function addDays(iso, amount) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
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

