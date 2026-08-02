import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeCronRequest } from "@/lib/server-security";
import { runDailyBriefing } from "../../_lib/orlando-proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const guard = authorizeCron(request);
  if (guard) return guard;
  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "1";
  const slot = url.searchParams.get("slot") || "";
  const result = await runDailyBriefing({ force, slot, mode: force ? "cron_force" : "cron" });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  return GET(request);
}

function authorizeCron(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  return auth.ok ? null : auth.response;
}
