import { NextResponse } from "next/server";
import { searchGooglePlacesNearby, searchGooglePlacesText } from "@/lib/integrations/google";
import { ensurePrivateAccess } from "../../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "checkins:places", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));

  try {
    const query = clean(body.query);
    const places = query
      ? await searchGooglePlacesText({ query, pageSize: 8 })
      : await searchGooglePlacesNearby({
          latitude: body.latitude,
          longitude: body.longitude,
          radiusMeters: body.radiusMeters || 320,
          maxResultCount: body.maxResultCount || 8
        });

    return NextResponse.json({ ok: true, places }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || "Nao consegui buscar lugares agora." },
      { status: error?.status || 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}

function clean(value) {
  return String(value ?? "").trim();
}
