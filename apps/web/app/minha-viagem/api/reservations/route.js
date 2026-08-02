import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "reservations:read" });
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    { ok: false, message: "Reserva nao encontrada." },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
