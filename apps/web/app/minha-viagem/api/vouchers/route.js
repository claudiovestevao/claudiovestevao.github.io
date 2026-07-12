import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PDF_FILE = join(process.cwd(), "app", "minha-viagem", "_private", "orlando-vouchers.pdf");
const PDF_NAME = "orlando-vouchers.pdf";

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "vouchers:read" });
  if (!auth.ok) return auth.response;

  const download = new URL(request.url).searchParams.get("download") === "1";

  try {
    const file = await readFile(PDF_FILE);
    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${PDF_NAME}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/pdf"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "PDF de vouchers nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
