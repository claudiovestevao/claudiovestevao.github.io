import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePrivateAccess } from "../_lib/security";
import { readDiaryEntries } from "../_lib/diary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "diary:read" });
  if (!auth.ok) return auth.response;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json(
      { ok: false, message: "Supabase privado nao configurado para o diario." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const entries = await readDiaryEntries(client, { limit: 160 });
  return NextResponse.json(
    {
      ok: true,
      entries
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
