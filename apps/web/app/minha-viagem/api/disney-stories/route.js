import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";
import {
  readDisneyStoriesState,
  runDisneyStoryGeneration,
  runDisneyStoryNotification
} from "../_lib/disney-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "disney-stories:read" });
  if (!auth.ok) return auth.response;
  const result = await readDisneyStoriesState();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "disney-stories:write", csrf: true });
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const force = Boolean(body.force);
  const result = body.action === "notify"
    ? await runDisneyStoryNotification({ force })
    : await runDisneyStoryGeneration({ force });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
