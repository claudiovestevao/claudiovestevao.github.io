import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeCronRequest } from "@/lib/server-security";
import { generateDiaryDraft } from "../../_lib/checkins";
import { callMeBotRecipients } from "../../_lib/orlando-briefing-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CALLMEBOT_WHATSAPP_URL = "https://api.callmebot.com/whatsapp.php";

export async function GET(request) {
  const guard = authorizeCron(request);
  if (guard) return guard;

  const url = new URL(request.url);
  const result = await generateDiaryDraft({
    date: url.searchParams.get("date") || "",
    force: url.searchParams.get("force") !== "0",
    mode: "cron_23h"
  });
  const delivery = result.ok && result.draft ? await sendNightlyDraftNotice(result.draft) : { ok: false, status: "skipped" };
  return NextResponse.json({ ...result, delivery }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  return GET(request);
}

function authorizeCron(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  return auth.ok ? null : auth.response;
}

async function sendNightlyDraftNotice(draft) {
  const recipients = callMeBotRecipients();
  if (!recipients.length) return { ok: false, status: "missing_callmebot" };

  const url = `${(appConfig.siteUrl || "https://claudiocode.dev").replace(/\/$/, "")}/minha-viagem#diario`;
  const text = [
    "[DIARIO] Rascunho do diario do dia pronto.",
    "A IA montou a memoria com base nos check-ins.",
    `Dia ${draft.date}: ${summaryLine(draft.text)}`,
    "Entre no site para confirmar ou aperfeicoar por audio/texto:",
    url
  ].join("\n").slice(0, 900);

  const results = [];
  for (const recipient of recipients) {
    const endpoint = new URL(CALLMEBOT_WHATSAPP_URL);
    endpoint.searchParams.set("phone", recipient.phone);
    endpoint.searchParams.set("apikey", recipient.apikey);
    endpoint.searchParams.set("text", text);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.text().catch(() => "");
      results.push({ ok: response.ok && /queued/i.test(body), status: response.status, phone: maskPhone(recipient.phone) });
    } catch (error) {
      results.push({ ok: false, status: "network_error", error: error?.message || "falha", phone: maskPhone(recipient.phone) });
    }
  }

  return { ok: results.some((row) => row.ok), results };
}

function summaryLine(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180) || "tem uma proposta esperando voces.";
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}
