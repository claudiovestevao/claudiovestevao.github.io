import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../../_lib/security";
import { approveDiaryDraft, generateDiaryDraft, listCheckinsForDate, updateDiaryDraft } from "../../_lib/checkins";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      draft: result.draft
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "checkins:draft", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const action = clean(body.action || "generate");
  const date = clean(body.date);

  if (action === "save") {
    const result = await updateDiaryDraft({ date, text: body.text, actor: body.actor });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "approve") {
    const result = await approveDiaryDraft({ date, text: body.text, actor: body.actor });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  const result = await generateDiaryDraft({
    date,
    force: body.force !== false,
    extraNote: body.extraNote || "",
    mode: action === "complement" ? "complement" : "manual"
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}

function clean(value) {
  return String(value ?? "").trim();
}
