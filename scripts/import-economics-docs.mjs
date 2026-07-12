import { readFile, readdir, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const sourceDir = process.argv[2] || "C:\\Users\\cvito\\Downloads\\docs";
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = "economics-documents";
const householdSlug = "familia-estevao-bonomi";
const ownerEmail = process.env.ECONOMICS_IMPORT_OWNER_EMAIL || "cvitorestevao@gmail.com";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const { data: household, error: householdError } = await supabase
  .from("economics_households")
  .select("id")
  .eq("slug", householdSlug)
  .single();

if (householdError || !household?.id) {
  console.error("Economics household not found. Run migration 0038 first.");
  process.exit(1);
}

const entries = await readdir(sourceDir, { withFileTypes: true });
let imported = 0;
let skipped = 0;

for (const entry of entries) {
  if (!entry.isFile()) continue;
  const filePath = join(sourceDir, entry.name);
  const info = await stat(filePath);

  if (info.size <= 0) {
    console.log(`skip empty: ${entry.name}`);
    skipped += 1;
    continue;
  }

  const originalName = basename(entry.name);
  const safeName = sanitizeFileName(originalName);
  const storagePath = `${household.id}/local-import/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
  const bytes = await readFile(filePath);
  const mimeType = mimeFromName(originalName);

  const upload = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType: mimeType,
    upsert: false
  });

  if (upload.error) {
    console.error(`upload failed: ${entry.name}: ${upload.error.message}`);
    skipped += 1;
    continue;
  }

  const { data: document, error: insertError } = await supabase
    .from("economics_documents")
    .insert({
      household_id: household.id,
      owner_email: ownerEmail,
      original_name: originalName,
      storage_path: storagePath,
      mime_type: mimeType,
      size_bytes: info.size,
      category: inferCategory(originalName),
      notes: "Importado de Downloads/docs."
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(`insert failed: ${entry.name}: ${insertError.message}`);
    await supabase.storage.from(bucket).remove([storagePath]);
    skipped += 1;
    continue;
  }

  await supabase.from("economics_audit_events").insert({
    household_id: household.id,
    actor_email: ownerEmail,
    event_type: "document.imported",
    entity_type: "economics_documents",
    entity_id: document.id,
    metadata: {
      source: sourceDir,
      original_name: originalName,
      size_bytes: info.size
    }
  });

  console.log(`imported: ${entry.name}`);
  imported += 1;
}

console.log(`Done. imported=${imported} skipped=${skipped}`);

function sanitizeFileName(name) {
  return String(name || "documento.pdf")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140) || "documento.pdf";
}

function mimeFromName(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  return "application/octet-stream";
}

function inferCategory(name) {
  const lower = name.toLowerCase();
  if (lower.includes("fatura")) return "fatura";
  if (lower.includes("boleto")) return "boleto";
  if (lower.includes("informe")) return "investimento";
  if (lower.includes("prev")) return "previdencia";
  if (lower.includes("consorcio")) return "consorcio";
  if (lower.includes("ades")) return "contrato";
  return "triagem";
}
