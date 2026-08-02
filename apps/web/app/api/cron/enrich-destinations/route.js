import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeCronRequest } from "@/lib/server-security";
import { enqueueDestinationEnrichment } from "@/lib/destinations/enrichmentQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = authorizeCronRequest(request, appConfig.cronSecret);
  if (!auth.ok) return auth.response;

  const result = await enqueueDestinationEnrichment();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
