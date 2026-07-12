import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "orlando-trip-private";
const OBJECT_PATH = "site-state/v1.json";
const MAX_KEYS = 80;
const MAX_STRING = 60000;

const memoryStore = globalThis.__orlandoSharedStateStore || {
  state: defaultState("memory_boot")
};
globalThis.__orlandoSharedStateStore = memoryStore;

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "state:read" });
  if (!auth.ok) return auth.response;

  const result = await readState();
  return NextResponse.json(
    {
      ok: true,
      source: result.source,
      state: result.state,
      warning: result.warning || ""
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function PATCH(request) {
  const auth = await ensurePrivateAccess(request, { action: "state:write", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const current = await readState();
  const state = normalizeState(current.state);
  const updatedBy = clean(body.updatedBy || body.actor || "casal").slice(0, 32);
  const now = new Date().toISOString();

  if (body.patch && typeof body.patch === "object") {
    for (const [rawKey, rawValue] of Object.entries(body.patch).slice(0, MAX_KEYS)) {
      const key = cleanKey(rawKey);
      if (!key) continue;
      state.items[key] = {
        value: jsonSafe(rawValue),
        updatedAt: now,
        updatedBy
      };
    }
  }

  if (Array.isArray(body.remove)) {
    for (const rawKey of body.remove.slice(0, MAX_KEYS)) {
      const key = cleanKey(rawKey);
      if (key) delete state.items[key];
    }
  }

  state.updatedAt = now;
  state.updatedBy = updatedBy;

  const saved = await writeState(state);
  return NextResponse.json(
    {
      ok: true,
      source: saved.source,
      state,
      warning: saved.warning || ""
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function readState() {
  const client = getSupabaseServerClient();

  if (!client || !appConfig.supabaseServiceRoleKey) {
    return {
      source: "memory_fallback",
      state: normalizeState(memoryStore.state),
      warning: "Supabase service role nao configurado; sincronizacao real indisponivel neste ambiente."
    };
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) {
    return {
      source: "memory_fallback",
      state: normalizeState(memoryStore.state),
      warning: bucket.message
    };
  }

  const { data, error } = await client.storage.from(BUCKET).download(OBJECT_PATH);
  if (error) {
    const message = String(error.message || "");
    if (message.toLowerCase().includes("not found") || message.toLowerCase().includes("does not exist")) {
      const state = defaultState("supabase_seed");
      return { source: "supabase_storage", state };
    }
    return {
      source: "memory_fallback",
      state: normalizeState(memoryStore.state),
      warning: `Falha ao ler estado compartilhado: ${message}`
    };
  }

  const text = await data.text();
  try {
    return {
      source: "supabase_storage",
      state: normalizeState(JSON.parse(text))
    };
  } catch {
    return {
      source: "memory_fallback",
      state: normalizeState(memoryStore.state),
      warning: "Arquivo compartilhado invalido; usando fallback temporario."
    };
  }
}

async function writeState(state) {
  const normalized = normalizeState(state);
  memoryStore.state = normalized;

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return {
      source: "memory_fallback",
      warning: "Supabase service role nao configurado; alteracao ficou apenas neste servidor."
    };
  }

  const bucket = await ensureBucket(client);
  if (!bucket.ok) {
    return {
      source: "memory_fallback",
      warning: bucket.message
    };
  }

  const { error } = await client.storage.from(BUCKET).upload(
    OBJECT_PATH,
    Buffer.from(JSON.stringify(normalized, null, 2), "utf8"),
    {
      contentType: "application/json",
      upsert: true
    }
  );

  if (error) {
    return {
      source: "memory_fallback",
      warning: `Falha ao salvar estado compartilhado: ${error.message}`
    };
  }

  return { source: "supabase_storage" };
}

async function ensureBucket(client) {
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) return { ok: false, message: `Falha ao listar buckets: ${listError.message}` };
  if ((buckets || []).some((bucket) => bucket.name === BUCKET)) return { ok: true };

  const { error } = await client.storage.createBucket(BUCKET, {
    public: false,
    allowedMimeTypes: ["application/json"],
    fileSizeLimit: String(1024 * 1024)
  });

  if (error) return { ok: false, message: `Falha ao criar bucket privado: ${error.message}` };
  return { ok: true };
}

function defaultState(reason = "seed") {
  return {
    version: 1,
    reason,
    updatedAt: new Date().toISOString(),
    updatedBy: "",
    items: {}
  };
}

function normalizeState(input) {
  const base = defaultState("normalize");
  const state = input && typeof input === "object" ? input : {};
  const items = {};

  for (const [rawKey, item] of Object.entries(state.items || {}).slice(0, MAX_KEYS)) {
    const key = cleanKey(rawKey);
    if (!key || !item || typeof item !== "object") continue;
    items[key] = {
      value: jsonSafe(item.value),
      updatedAt: clean(item.updatedAt) || base.updatedAt,
      updatedBy: clean(item.updatedBy).slice(0, 32)
    };
  }

  return {
    ...base,
    version: 1,
    updatedAt: clean(state.updatedAt) || base.updatedAt,
    updatedBy: clean(state.updatedBy).slice(0, 32),
    items
  };
}

function jsonSafe(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, MAX_STRING);
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => jsonSafe(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 120)
        .map(([key, item]) => [clean(String(key)).slice(0, 80), jsonSafe(item, depth + 1)])
    );
  }
  return String(value).slice(0, MAX_STRING);
}

function cleanKey(value) {
  const key = clean(value).slice(0, 80);
  return /^[a-zA-Z0-9_.:-]+$/.test(key) ? key : "";
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}
