import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKETS = {
  disney: {
    file: "orlando-disney-2-day-base-ticket.pdf",
    name: "orlando-disney-2-day-base-ticket.pdf"
  },
  epic: {
    file: "orlando-epic-universe-2026-08-17.pdf",
    name: "orlando-epic-universe-2026-08-17.pdf"
  }
};

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "tickets:read" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "disney";
  const ticket = TICKETS[id];
  if (!ticket) {
    return NextResponse.json(
      { ok: false, message: "Ingresso nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const download = url.searchParams.get("download") === "1";
  const filePath = join(process.cwd(), "app", "minha-viagem", "_private", ticket.file);

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ticket.name}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/pdf"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "PDF de ingresso nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
