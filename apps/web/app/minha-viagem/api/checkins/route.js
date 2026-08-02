import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";
import { listCheckinsForDate, saveCheckin } from "../_lib/checkins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "checkins:read" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const result = await listCheckinsForDate(url.searchParams.get("date") || "");
  return NextResponse.json(
    {
      ok: true,
      source: result.source,
      warning: result.warning || "",
      date: result.date,
      checkins: result.checkins,
      draft: result.draft
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "checkins:write", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const result = await saveCheckin(body);
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
