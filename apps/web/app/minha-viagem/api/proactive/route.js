import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";
import {
  normalizeState,
  readProactiveState,
  runDailyBriefing,
  runPriceWatch,
  writeProactiveState
} from "../_lib/orlando-proactive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "proactive:read" });
  if (!auth.ok) return auth.response;

  const result = await readProactiveState();
  return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request) {
  const auth = await ensurePrivateAccess(request, { action: "proactive:write", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const current = await readProactiveState();
  const state = normalizeState(current.state);

  if (body.settings && typeof body.settings === "object") {
    if ("paused" in body.settings) state.settings.paused = Boolean(body.settings.paused);
    if ("deliveryMode" in body.settings) {
      const value = String(body.settings.deliveryMode || "").trim();
      if (value === "so_email" || value === "email_whatsapp") {
        state.settings.deliveryMode = value;
      }
    }
  }

  if (body.priceWatch && Array.isArray(body.priceWatch.items)) {
    state.priceWatch.items = body.priceWatch.items;
  }

  state.updatedAt = new Date().toISOString();
  const saved = await writeProactiveState(state);
  return NextResponse.json({ ok: true, source: saved.source, state: normalizeState(state), warning: saved.warning || "" }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "proactive:write", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  if (body.action === "send_today") {
    const result = await runDailyBriefing({ force: true, mode: "manual_site" });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }
  if (body.action === "check_prices") {
    const result = await runPriceWatch({ digest: Boolean(body.digest) });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: false, message: "Acao desconhecida." }, { status: 400 });
}
