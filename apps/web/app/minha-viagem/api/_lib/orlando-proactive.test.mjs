import assert from "node:assert/strict";
import test from "node:test";
import {
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

test("briefing slots normalize to the three scheduled alert times", () => {
  assert.equal(normalizeBriefingSlot("8"), "08");
  assert.equal(normalizeBriefingSlot("13h"), "13");
  assert.equal(normalizeBriefingSlot("19"), "19");
  assert.equal(normalizeBriefingSlot("17:30"), "");
});

test("packing reminders only start seven days before boarding", () => {
  assert.equal(taskForDate("2026-07-12").includes("mala"), false);
  assert.equal(taskForDate("2026-08-02").includes("mala"), true);
});

test("today's prep task is concrete instead of generic", () => {
  const task = taskForDate("2026-07-12", "19");
  assert.match(task, /passaportes|vistos/i);
  assert.match(task, /foto|celular/i);
  assert.equal(task.includes("mala"), false);
});

test("travel-day briefing remembers the shared album and airport margin", () => {
  assert.match(taskForDate("2026-08-09", "08"), /album Orlando 2026/i);
  assert.match(taskForDate("2026-08-09", "08"), /Android|iPhone/i);
  assert.match(taskForDate("2026-08-18", "13"), /13h45/);
  assert.match(taskForDate("2026-08-18", "13"), /14h15/);
});

test("deterministic briefing stays short and keeps the Luiza/story layer", () => {
  const message = buildDeterministicBriefing({
    todayBr: "2026-08-12",
    daysLeft: -3,
    slot: "13",
    dollar: { summary: "R$ 5,40" },
    magic: magicForDate("2026-08-12", "13")
  });

  assert.equal(message.length <= 620, true);
  assert.match(message, /Luiza|Mickey|castelo/i);
});

test("before-trip evening alert points to Luiza bedtime story", () => {
  const story = storyTeaserForDate("2026-07-17");
  const message = buildDeterministicBriefing({
    todayBr: "2026-07-17",
    daysLeft: 23,
    slot: "19",
    phase: "before",
    story
  });

  assert.match(message, /^\[LUIZA\]/);
  assert.match(message, /Historinha da Luiza/i);
  assert.match(message, /disney-stories\/2026-07-17-tinker-bell/);
});

test("during-trip midday alert becomes tactical park guidance", () => {
  const message = buildDeterministicBriefing({
    todayBr: "2026-08-12",
    daysLeft: -3,
    slot: "13",
    phase: "during",
    attraction: attractionSpotlightForDate("2026-08-12")
  });

  assert.match(message, /^\[DURANTE\]/);
  assert.match(message, /Magic Kingdom|Peter Pan|Nathalie|Luiza/i);
});

test("Florida tips and diary prompts are available for the WhatsApp copilot", () => {
  const florida = floridaTipForDate("2026-07-18");
  assert.equal(Boolean(florida.fact && florida.tip), true);
  assert.match(`${florida.fact} ${florida.tip}`, /Luiza|crianca|Orlando|familia|calor|turismo|manhã|manha|parque|loja|show/i);
  assert.match(diaryPromptForDate("2026-08-12"), /Luiza|Magic Kingdom/i);
});

test("daily briefing avoids billing and payment language", () => {
  for (const slot of ["08", "13", "19"]) {
    const message = buildDeterministicBriefing({
      todayBr: "2026-07-14",
      daysLeft: 26,
      slot,
      weather: { summary: "24-34°C, chuva 40%" },
      task: taskForDate("2026-07-14", slot),
      useful: "apps testados antes viram menos fila e mais parque.",
      magic: magicForDate("2026-07-14", slot)
    });
    const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    assert.doesNotMatch(normalized, /\b(cobranca|fatura|pagamento|pagar|cartao|cartoes|dolar|cotacao|preco|gasto|taxa)\b/);
  }
});

test("CallMeBot recipient list supports one key per phone", () => {
  const previous = process.env.CALLMEBOT_WHATSAPP_RECIPIENTS;
  process.env.CALLMEBOT_WHATSAPP_RECIPIENTS = "+55 (11) 11111-1111:key-a,5511222222222:key-b";
  try {
    assert.deepEqual(callMeBotRecipients(), [
      { phone: "5511111111111", apikey: "key-a" },
      { phone: "5511222222222", apikey: "key-b" }
    ]);
  } finally {
    if (previous === undefined) delete process.env.CALLMEBOT_WHATSAPP_RECIPIENTS;
    else process.env.CALLMEBOT_WHATSAPP_RECIPIENTS = previous;
  }
});

test("delivery status preserves partial channel success", () => {
  assert.equal(deliveryStatusForChannels([
    { channel: "email", ok: true },
    { channel: "whatsapp_callmebot", ok: false, status: "partial_or_failed" }
  ]), "partial");

  assert.equal(deliveryStatusForChannels([
    { channel: "email", ok: true },
    { channel: "whatsapp_callmebot", ok: true }
  ]), "sent");

  assert.equal(deliveryStatusForChannels([
    { channel: "email", ok: false },
    { channel: "whatsapp_callmebot", ok: false }
  ]), "failed");
});
