import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { ECONOMICS_STORAGE_BUCKET, sanitizeFileName, writeEconomicsAudit } from "@/lib/economics-db";
import { ECONOMICS_CSRF_COOKIE } from "@/lib/economics-session";
import { economicsJson, requireEconomicsContext } from "../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv", "application/json"]);

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const { data, error } = await context.supabase
    .from("economics_documents")
    .select("id, original_name, mime_type, size_bytes, category, status, notes, created_at, owner_email")
    .eq("household_id", context.householdId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return economicsJson({ ok: false, message: "Falha ao listar documentos." }, 500);
  return economicsJson({ ok: true, documents: data || [] });
}

export async function POST(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);
  if (!(await hasValidCsrf(request))) return economicsJson({ ok: false, message: "CSRF invalido." }, 403);

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const category = normalizeCategory(formData?.get("category"));
  const notes = String(formData?.get("notes") || "").trim().slice(0, 1000);

  if (!file || typeof file === "string") {
    return economicsJson({ ok: false, message: "Arquivo ausente." }, 400);
  }

  if (file.size > MAX_FILE_SIZE) {
    return economicsJson({ ok: false, message: "Arquivo acima de 50 MB." }, 413);
  }

  const mimeType = String(file.type || "application/octet-stream");
  if (!ALLOWED_TYPES.has(mimeType)) {
    return economicsJson({ ok: false, message: "Tipo de arquivo nao permitido." }, 415);
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${context.householdId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false
  });

  if (upload.error) {
    return economicsJson({ ok: false, message: "Falha ao subir arquivo no cofre." }, 500);
  }

  const { data, error } = await context.supabase
    .from("economics_documents")
    .insert({
      household_id: context.householdId,
      owner_email: context.member.email,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: file.size,
      category,
      notes
    })
    .select("id, original_name, mime_type, size_bytes, category, status, notes, created_at, owner_email")
    .single();

  if (error) {
    await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).remove([storagePath]);
    return economicsJson({ ok: false, message: "Falha ao registrar documento." }, 500);
  }

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: context.member.email,
    eventType: "document.uploaded",
    entityType: "economics_documents",
    entityId: data.id,
    metadata: {
      original_name: file.name,
      mime_type: mimeType,
      size_bytes: file.size,
      category
    }
  });

  return economicsJson({ ok: true, document: data }, 201);
}

async function hasValidCsrf(request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get("x-economics-csrf") || "";
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

function normalizeCategory(value) {
  const category = String(value || "triagem").trim();
  const allowed = new Set(["triagem", "fatura", "boleto", "investimento", "previdencia", "consorcio", "contrato", "comprovante", "outro"]);
  return allowed.has(category) ? category : "triagem";
}
