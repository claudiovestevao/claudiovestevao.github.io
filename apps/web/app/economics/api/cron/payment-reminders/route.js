import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import {
  ECONOMICS_HOUSEHOLD_SLUG,
  ECONOMICS_STORAGE_BUCKET,
  getEconomicsClient,
  writeEconomicsAudit
} from "@/lib/economics-db";
import {
  formatPaymentReminderMessage,
  saoPauloDateKey,
  selectManualPaymentReminders
} from "@/lib/economics-payment-reminders";
import { applyKnownPlanUpdates } from "@/lib/economics-plan-updates";
import { authorizeCronRequest } from "@/lib/server-security";
import { callMeBotRecipients, maskPhone } from "@/app/minha-viagem/api/_lib/orlando-briefing-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CALLMEBOT_URL = "https://api.callmebot.com/whatsapp.php";
const PLAN_FILE = "planning/monthly-plan.json";
const DELIVERY_FILE = "planning/payment-reminders.json";

export async function GET(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  if (!auth.ok) return auth.response;

  const supabase = getEconomicsClient();
  if (!supabase) return json({ ok: false, status: "missing_supabase" }, 503);

  const householdId = await findHouseholdId(supabase);
  if (!householdId) return json({ ok: false, status: "missing_household" }, 404);

  const rawPlan = await readJson(supabase, `${householdId}/${PLAN_FILE}`) || initialPlan();
  if (!rawPlan) return json({ ok: false, status: "missing_plan" }, 404);
  const plan = applyKnownPlanUpdates(rawPlan);

  const now = new Date();
  const dateKey = saoPauloDateKey(now);
  const reminders = selectManualPaymentReminders(plan, now);
  if (!reminders.length) return json({ ok: true, status: "nothing_due", date: dateKey, reminders: 0 });

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const force = url.searchParams.get("force") === "1";
  const statePath = `${householdId}/${DELIVERY_FILE}`;
  const state = await readJson(supabase, statePath) || { version: 1, deliveries: {} };
  if (!force && state.deliveries?.[dateKey]?.status === "sent_all") {
    return json({ ok: true, status: "already_sent", date: dateKey, reminders: reminders.length });
  }

  const message = formatPaymentReminderMessage(reminders, appConfig.siteUrl);
  if (dryRun) return json({ ok: true, status: "dry_run", date: dateKey, reminders: reminders.length, paymentIds: reminders.map((item) => item.id) });

  const delivery = await sendCallMeBot(message);
  state.version = 1;
  state.deliveries = { ...(state.deliveries || {}), [dateKey]: {
    status: delivery.ok ? "sent_all" : delivery.status,
    sentAt: new Date().toISOString(),
    paymentIds: reminders.map((item) => item.id),
    recipients: delivery.recipients?.map((item) => ({ phone: item.phone, ok: item.ok })) || []
  } };
  state.deliveries = Object.fromEntries(Object.entries(state.deliveries).slice(-45));
  await writeJson(supabase, statePath, state);

  await writeEconomicsAudit(supabase, {
    householdId,
    eventType: "payment_reminders.sent",
    entityType: "economics_monthly_plan",
    entityId: plan.month || dateKey.slice(0, 7),
    metadata: { date: dateKey, reminders: reminders.length, deliveryStatus: delivery.status }
  });

  return json({ ok: delivery.ok, status: delivery.status, date: dateKey, reminders: reminders.length, recipients: delivery.recipients });
}

export async function POST(request) {
  return GET(request);
}

async function findHouseholdId(supabase) {
  const { data } = await supabase.from("economics_households").select("id").eq("slug", ECONOMICS_HOUSEHOLD_SLUG).maybeSingle();
  return data?.id || "";
}

async function readJson(supabase, path) {
  const { data, error } = await supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(path);
  if (error || !data) return null;
  try {
    return JSON.parse(await data.text());
  } catch {
    return null;
  }
}

async function writeJson(supabase, path, value) {
  const { error } = await supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(path, JSON.stringify(value, null, 2), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: true
  });
  return !error;
}

function initialPlan() {
  const raw = String(process.env.ECONOMICS_INITIAL_PLAN_JSON || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function sendCallMeBot(text) {
  const recipients = callMeBotRecipients();
  if (!recipients.length) return { ok: false, status: "missing_callmebot", recipients: [] };

  const results = [];
  for (const recipient of recipients) {
    const endpoint = new URL(CALLMEBOT_URL);
    endpoint.searchParams.set("phone", recipient.phone);
    endpoint.searchParams.set("apikey", recipient.apikey);
    endpoint.searchParams.set("text", text);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.text().catch(() => "");
      const failedByBody = /error|invalid|not authorized|not authorised|apikey|phone number/i.test(body);
      results.push({ ok: response.ok && !failedByBody, status: response.status, phone: maskPhone(recipient.phone) });
    } catch (error) {
      results.push({ ok: false, status: "network_error", error: error?.message || "Falha de rede.", phone: maskPhone(recipient.phone) });
    }
  }

  const sent = results.filter((item) => item.ok).length;
  return {
    ok: sent === results.length,
    status: sent === results.length ? "sent_all" : (sent ? "partial" : "failed"),
    recipients: results
  };
}

function json(payload, status = 200) {
  return NextResponse.json(payload, { status, headers: { "Cache-Control": "no-store" } });
}
