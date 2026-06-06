import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { enqueueDestinationEnrichment } from "@/lib/destinations/enrichmentQueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (appConfig.cronSecret) {
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token !== appConfig.cronSecret) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await enqueueDestinationEnrichment();
  return NextResponse.json(result, {
    status: result.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
