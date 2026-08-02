import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeCronRequest } from "@/lib/server-security";
import { runDisneyStoryGeneration } from "../../_lib/disney-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const guard = authorizeCron(request);
  if (guard) return guard;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") || "generate";
  const force = url.searchParams.get("force") === "1";
  try {
    if (mode === "notify") {
      return NextResponse.json(
        {
          ok: true,
          archived: true,
          message: "Envio de historinha da Luiza por CallMeBot arquivado. Use o diario noturno em /minha-viagem/api/cron/diary-nightly."
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const result = await runDisneyStoryGeneration({ force });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || "Falha no Disney Stories." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function POST(request) {
  return GET(request);
}

function authorizeCron(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  return auth.ok ? null : auth.response;
}
