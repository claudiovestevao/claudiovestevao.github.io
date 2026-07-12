import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "orlando-trip-media";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
const MEDIA_TYPES = new Set([...IMAGE_TYPES, ...VIDEO_TYPES]);

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "media:read" });
  if (!auth.ok) return auth.response;

  const path = cleanPath(new URL(request.url).searchParams.get("path") || "");
  if (!path) {
    return NextResponse.json({ ok: false, message: "Arquivo invalido." }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, message: "Storage privado nao configurado." }, { status: 503 });
  }

  const { data, error } = await client.storage.from(BUCKET).download(path);
  if (error) {
    return NextResponse.json({ ok: false, message: `Arquivo nao encontrado: ${error.message}` }, { status: 404 });
  }

  return new Response(await data.arrayBuffer(), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": data.type || mimeFromPath(path)
    }
  });
}

export async function POST(request) {
  const auth = await ensurePrivateAccess(request, { action: "media:write", csrf: true });
  if (!auth.ok) return auth.response;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json(
      { ok: false, message: "Storage privado nao configurado. Configure SUPABASE_SERVICE_ROLE_KEY para salvar midias." },
      { status: 503 }
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ ok: false, message: "Envie uma foto ou video valido." }, { status: 400 });
  }

  const type = cleanMime(file.type || "application/octet-stream");
  const mediaType = mediaKind(type);
  if (!mediaType) {
    return NextResponse.json({ ok: false, message: "Formato de midia nao suportado." }, { status: 400 });
  }

  const maxBytes = mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (Number(file.size || 0) > maxBytes) {
    return NextResponse.json(
      { ok: false, message: mediaType === "video" ? "Video muito grande. Use ate 50 MB." : "Foto muito grande. Use ate 8 MB." },
      { status: 413 }
    );
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) {
    return NextResponse.json({ ok: false, message: bucket.message }, { status: 503 });
  }

  const kind = cleanSegment(form.get("kind") || "diary") || "diary";
  const date = cleanSegment(form.get("date") || new Date().toISOString().slice(0, 10)) || "sem-data";
  const ext = extensionFor(file.name || "", type);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${kind}/${date}/${id}.${ext}`;

  const { error } = await client.storage.from(BUCKET).upload(
    path,
    Buffer.from(await file.arrayBuffer()),
    {
      contentType: type,
      upsert: false
    }
  );

  if (error) {
    return NextResponse.json({ ok: false, message: `Falha ao salvar foto: ${error.message}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    path,
    url: `/minha-viagem/api/media?path=${encodeURIComponent(path)}`,
    mediaType,
    mime: type
  });
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: `Falha ao listar buckets: ${listError.message}` };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) {
    if (typeof client.storage.updateBucket === "function") {
      const { error } = await client.storage.updateBucket(BUCKET, {
        public: false,
        allowedMimeTypes: [...MEDIA_TYPES],
        fileSizeLimit: String(MAX_VIDEO_BYTES)
      });
      if (error) return { ok: false, message: `Falha ao atualizar bucket de midia: ${error.message}` };
    }
    return { ok: true };
  }

  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: [...MEDIA_TYPES],
    fileSizeLimit: String(MAX_VIDEO_BYTES)
  });

  if (error) return { ok: false, message: `Falha ao criar bucket de midia: ${error.message}` };
  return { ok: true };
}

function cleanPath(value) {
  const path = String(value || "").trim();
  if (!path || path.includes("..") || path.startsWith("/") || path.length > 220) return "";
  return /^[a-zA-Z0-9_./:-]+$/.test(path) ? path : "";
}

function cleanSegment(value) {
  return String(value || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function cleanMime(value) {
  return String(value || "").trim().toLowerCase();
}

function extensionFor(name, type) {
  const ext = String(name || "").split(".").pop()?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "mp4", "webm"].includes(ext)) return ext;
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  if (type === "image/heic") return "heic";
  if (type === "image/heif") return "heif";
  if (type === "video/mp4") return "mp4";
  if (type === "video/webm") return "webm";
  return "jpg";
}

function mimeFromPath(path) {
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".heic")) return "image/heic";
  if (path.endsWith(".heif")) return "image/heif";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".webm")) return "video/webm";
  return "image/jpeg";
}

function mediaKind(type) {
  if (IMAGE_TYPES.has(type)) return "image";
  if (VIDEO_TYPES.has(type)) return "video";
  return "";
}
