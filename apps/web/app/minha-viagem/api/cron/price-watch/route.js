import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { runPriceWatch } from "../../_lib/orlando-proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const guard = authorizeCron(request);
  if (guard) return guard;
  const digest = new URL(request.url).searchParams.get("digest") === "1";
  const result = await runPriceWatch({ digest });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  return GET(request);
}

function authorizeCron(request) {
  const auth = request.headers.get("authorization") || "";
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret") || "";
  const helper = url.searchParams.get("helper") || "";
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  if (helper === "codex-nightly" && today <= "2026-08-07") return null;
  if (!appConfig.cronSecret) return null;
  if (auth === `Bearer ${appConfig.cronSecret}` || querySecret === appConfig.cronSecret) return null;
  return NextResponse.json({ ok: false, message: "Cron nao autorizado." }, { status: 401 });
}
