import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENTS = {
  claudio: {
    file: "chubb-seguro-claudio-vitor-bzica0012238312.pdf",
    name: "chubb-seguro-claudio-vitor-bzica0012238312.pdf"
  },
  nathalie: {
    file: "chubb-seguro-nathalie-bonomi-bzica0012238310.pdf",
    name: "chubb-seguro-nathalie-bonomi-bzica0012238310.pdf"
  },
  luiza: {
    file: "chubb-seguro-luiza-bonomi-bzica0012238311.pdf",
    name: "chubb-seguro-luiza-bonomi-bzica0012238311.pdf"
  },
  condicoes: {
    file: "chubb-condicoes-seguro-viagem-apolice-coletiva-a-partir-2024-06-06.pdf",
    name: "chubb-condicoes-seguro-viagem-apolice-coletiva-a-partir-2024-06-06.pdf"
  },
  condicoes2023: {
    file: "chubb-condicoes-seguro-viagem-apolice-coletiva-vigencia-2023-08-22-a-2024-06-05.pdf",
    name: "chubb-condicoes-seguro-viagem-apolice-coletiva-vigencia-2023-08-22-a-2024-06-05.pdf"
  }
};

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "insurance:read" });
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "claudio";
  const document = DOCUMENTS[id];
  if (!document) {
    return NextResponse.json(
      { ok: false, message: "Documento de seguro nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  const download = url.searchParams.get("download") === "1";
  const filePath = join(process.cwd(), "app", "minha-viagem", "_private", document.file);

  try {
    const file = await readFile(filePath);
    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${document.name}"`,
        "Content-Length": String(file.byteLength),
        "Content-Type": "application/pdf"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "PDF de seguro nao encontrado." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
