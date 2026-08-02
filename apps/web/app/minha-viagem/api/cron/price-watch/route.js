import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeCronRequest } from "@/lib/server-security";
import { runPriceWatch } from "../../_lib/orlando-proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const guard = authorizeCron(request);
  if (guard) return guard;
  const digest = new URL(request.url).searchParams.get("digest") === "1";
  const result = await runPriceWatch({ digest, notify: true });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  return GET(request);
}

function authorizeCron(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  return auth.ok ? null : auth.response;
}
