import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESERVATIONS = {
  bubba: {
    file: "bubba-gump-hollywood-2026-07-11.pdf",
    name: "bubba-gump-hollywood-2026-07-11.pdf"
  }
};

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "reservations:read" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "bubba";
  const reservation = RESERVATIONS[id];
  if (!reservation) {
    return NextResponse.json(
      { ok: false, message: "Reserva nao encontrada." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const download = url.searchParams.get("download") === "1";
  const filePath = join(process.cwd(), "app", "minha-viagem", "_private", reservation.file);

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${reservation.name}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/pdf"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "PDF de reserva nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
