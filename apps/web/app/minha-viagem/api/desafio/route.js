import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { ensurePrivateAccess } from "../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "orlando-trip-private";
const OBJECT_PATH = "desafio/pre-trip-v1.json";
const PLAYERS = new Set(["vitor", "nath"]);
const EXERCISES = new Set(["none", "move", "gym"]);

const memoryStore = globalThis.__orlandoChallengeStore || {
  state: defaultState("memory_boot")
};
globalThis.__orlandoChallengeStore = memoryStore;

export async function GET(request) {
  const auth = await ensurePrivateAccess(request, { action: "challenge:read" });
  if (!auth.ok) return auth.response;

  const result = await readState();
  return NextResponse.json({
    ok: true,
    source: result.source,
    state: result.state,
    warning: result.warning || ""
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function PATCH(request) {
  const auth = await ensurePrivateAccess(request, { action: "challenge:write", csrf: true });
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Payload invalido." }, { status: 400 });
  }

  const current = await readState();
  const state = normalizeState(current.state);
  const updatedBy = clean(body.updatedBy || body.actor || "casal").slice(0, 32);

  if (body.settings && typeof body.settings === "object") {
    state.settings = {
      ...state.settings,
      finalPrize: clean(body.settings.finalPrize).slice(0, 180)
    };
  }

  if (body.entry && typeof body.entry === "object") {
    const date = clean(body.entry.date);
    const player = clean(body.entry.player);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ ok: false, message: "Data invalida." }, { status: 400 });
    }

    if (!PLAYERS.has(player)) {
      return NextResponse.json({ ok: false, message: "Pessoa invalida." }, { status: 400 });
    }

    const patch = sanitizePersonPatch(body.entry.values || {});
    const dateEntry = state.entries[date] || {};
    dateEntry[player] = {
      ...defaultPerson(),
      ...(dateEntry[player] || {}),
      ...patch,
      updatedAt: new Date().toISOString(),
      updatedBy
    };
    state.entries[date] = dateEntry;
  }

  state.updatedAt = new Date().toISOString();
  state.updatedBy = updatedBy;

  const saved = await writeState(state);
  return NextResponse.json({
    ok: true,
    source: saved.source,
    state,
    warning: saved.warning || ""
  }, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
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
      warning: `Falha ao ler desafio: ${message}`
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
      warning: "Arquivo do desafio esta invalido; usando fallback temporario."
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
      warning: `Falha ao salvar no Supabase: ${error.message}`
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
    settings: {
      finalPrize: ""
    },
    entries: {}
  };
}

function normalizeState(input) {
  const base = defaultState("normalize");
  const state = input && typeof input === "object" ? input : {};
  const entries = {};

  for (const [date, entry] of Object.entries(state.entries || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== "object") continue;
    const cleanEntry = {};
    for (const player of PLAYERS) {
      if (entry[player]) {
        cleanEntry[player] = {
          ...defaultPerson(),
          ...sanitizePersonPatch(entry[player]),
          updatedAt: clean(entry[player].updatedAt),
          updatedBy: clean(entry[player].updatedBy).slice(0, 32)
        };
      }
    }
    if (Object.keys(cleanEntry).length) entries[date] = cleanEntry;
  }

  return {
    ...base,
    version: 1,
    updatedAt: clean(state.updatedAt) || base.updatedAt,
    updatedBy: clean(state.updatedBy).slice(0, 32),
    settings: {
      finalPrize: clean(state.settings?.finalPrize).slice(0, 180)
    },
    entries
  };
}

function defaultPerson() {
  return {
    noSoda: false,
    noSweet: false,
    fruit: false,
    water: false,
    exercise: "none",
    freeDay: false,
    note: "",
    updatedAt: "",
    updatedBy: ""
  };
}

function sanitizePersonPatch(values) {
  const patch = {};
  if ("noSoda" in values) patch.noSoda = Boolean(values.noSoda);
  if ("noSweet" in values) patch.noSweet = Boolean(values.noSweet);
  if ("fruit" in values) patch.fruit = Boolean(values.fruit);
  if ("water" in values) patch.water = Boolean(values.water);
  if ("freeDay" in values) patch.freeDay = Boolean(values.freeDay);
  if ("exercise" in values) {
    const exercise = clean(values.exercise);
    patch.exercise = EXERCISES.has(exercise) ? exercise : "none";
  }
  if ("note" in values) patch.note = clean(values.note).slice(0, 220);
  return patch;
}

function clean(value) {
  return String(value ?? "").trim();
}
