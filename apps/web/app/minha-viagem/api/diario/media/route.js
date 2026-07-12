import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePrivateAccess } from "../../_lib/security";
import { downloadDiaryMedia } from "../../_lib/diary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "diary:media" });
  if (!auth.ok) return auth.response;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, message: "Storage privado nao configurado." }, { status: 503 });
  }

  const path = new URL(request.url).searchParams.get("path") || "";
  const media = await downloadDiaryMedia(client, path);
  if (!media.ok) {
    return NextResponse.json({ ok: false, message: media.message }, { status: media.status });
  }

  return new Response(media.bytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": media.contentType
    }
  });
}
