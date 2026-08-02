import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { ECONOMICS_STORAGE_BUCKET } from "@/lib/economics-db";

const CONNECTION_DIR = "kanban/google-calendar";
const TOKEN_REFRESH_SKEW_MS = 90 * 1000;
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const GOOGLE_CALENDAR_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly"
];

export function hasGoogleCalendarOAuthConfig() {
  return getGoogleCalendarOAuthConfig().configured;
}

export function getGoogleCalendarOAuthConfig() {
  const clientId = clean(process.env.KANBAN_GOOGLE_CLIENT_ID || process.env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret = clean(process.env.KANBAN_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CALENDAR_CLIENT_SECRET);
  const siteUrl = clean(appConfig.siteUrl).replace(/\/$/, "") || "https://claudiocode.dev";

  return {
    clientId,
    clientSecret,
    redirectUri: `${siteUrl}/kanban/auth/google-calendar/callback`,
    scopes: GOOGLE_CALENDAR_SCOPES,
    configured: Boolean(clientId && clientSecret && encryptionSecret())
  };
}

export function createGoogleCalendarAuthUrl({ loginHint, state }) {
  const config = getGoogleCalendarOAuthConfig();
  if (!config.configured) return null;

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  if (clean(loginHint)) url.searchParams.set("login_hint", clean(loginHint));
  return url;
}

export function createGoogleCalendarOAuthState(user) {
  const email = clean(user?.email).toLowerCase();
  const secret = encryptionSecret();
  if (!email || !secret) return "";

  const payloadPart = base64UrlEncode(JSON.stringify({
    email,
    iat: Date.now(),
    nonce: randomBytes(16).toString("base64url")
  }));
  const unsigned = `v1.${payloadPart}`;
  return `${unsigned}.${signOAuthState(unsigned, secret)}`;
}

export function verifyGoogleCalendarOAuthState(value) {
  const [version, payloadPart, signature] = clean(value).split(".");
  const secret = encryptionSecret();
  if (version !== "v1" || !payloadPart || !signature || !secret) return { ok: false };

  const unsigned = `${version}.${payloadPart}`;
  if (!safeEqual(signature, signOAuthState(unsigned, secret))) return { ok: false };

  const payload = parseJson(base64UrlDecode(payloadPart));
  const issuedAt = Number(payload?.iat || 0);
  if (
    !payload?.email ||
    !Number.isFinite(issuedAt) ||
    issuedAt > Date.now() + 60 * 1000 ||
    Date.now() - issuedAt > OAUTH_STATE_MAX_AGE_MS
  ) {
    return { ok: false };
  }

  return { ok: true, email: clean(payload.email).toLowerCase() };
}

export async function exchangeGoogleCalendarCode(code) {
  const config = getGoogleCalendarOAuthConfig();
  if (!config.configured || !clean(code)) return { ok: false, message: "Google Calendar nao configurado." };

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: clean(code),
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    return { ok: false, message: payload?.error_description || payload?.error || "Falha ao conectar Google Calendar." };
  }

  return {
    ok: true,
    accessToken: clean(payload.access_token),
    refreshToken: clean(payload.refresh_token),
    idToken: clean(payload.id_token),
    expiresAt: expiresAtFromSeconds(payload.expires_in),
    scope: clean(payload.scope)
  };
}

export async function getGoogleCalendarUser(accessToken, idToken = "") {
  if (accessToken) {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).catch(() => null);
    const payload = await response?.json?.().catch(() => ({}));
    if (response?.ok && payload?.email) {
      return {
        email: clean(payload.email).toLowerCase(),
        name: clean(payload.name),
        picture: clean(payload.picture)
      };
    }
  }

  const decoded = decodeJwtPayload(idToken);
  return {
    email: clean(decoded?.email).toLowerCase(),
    name: clean(decoded?.name),
    picture: clean(decoded?.picture)
  };
}

export async function saveGoogleCalendarConnection(context, tokens = {}) {
  if (!context?.supabase || !context?.householdId || !context?.member?.email) return { ok: false };

  const existing = await readStoredConnection(context);
  const now = new Date().toISOString();
  const selectedCalendarIds = normalizeCalendarIds(existing?.selectedCalendarIds).length
    ? normalizeCalendarIds(existing.selectedCalendarIds)
    : ["primary"];
  const syncCalendarId = clean(existing?.syncCalendarId) || selectedCalendarIds[0] || "primary";

  const connection = {
    version: 1,
    email: context.member.email,
    connectedAt: clean(existing?.connectedAt) || now,
    updatedAt: now,
    selectedCalendarIds,
    syncCalendarId,
    tokens: {
      refreshMode: clean(tokens.refreshMode) || existing?.tokens?.refreshMode || (tokens.supabaseRefreshToken ? "supabase" : "google"),
      accessToken: maybeProtect(tokens.providerToken) || existing?.tokens?.accessToken || "",
      providerRefreshToken: maybeProtect(tokens.providerRefreshToken) || existing?.tokens?.providerRefreshToken || "",
      supabaseRefreshToken: maybeProtect(tokens.supabaseRefreshToken) || existing?.tokens?.supabaseRefreshToken || "",
      expiresAt: normalizeExpiresAt(tokens.expiresAt) || existing?.tokens?.expiresAt || ""
    }
  };

  const upload = await writeStoredConnection(context, connection);
  if (upload?.error) return { ok: false, error: upload.error };
  return { ok: true };
}

export async function getCalendarConnection(context) {
  const stored = await readStoredConnection(context);
  if (!stored?.tokens?.accessToken) return { connected: false };

  return {
    connected: true,
    email: stored.email || context?.member?.email || "",
    selectionMode: clean(stored.selectionMode),
    selectedCalendarIds: normalizeCalendarIds(stored.selectedCalendarIds),
    syncCalendarId: clean(stored.syncCalendarId) || "primary",
    expiresAt: clean(stored.tokens.expiresAt)
  };
}

export async function updateCalendarSelection(context, { selectedCalendarIds, syncCalendarId }) {
  const stored = await readStoredConnection(context);
  if (!stored?.tokens?.accessToken) return { ok: false, status: 404, message: "Google Calendar ainda nao conectado." };

  const selected = normalizeCalendarIds(selectedCalendarIds);
  const nextSelected = selected.length ? selected : ["primary"];
  const nextSyncCalendarId = clean(syncCalendarId) || stored.syncCalendarId || nextSelected[0] || "primary";

  await writeStoredConnection(context, {
    ...stored,
    selectionMode: "manual",
    selectedCalendarIds: nextSelected,
    syncCalendarId: nextSyncCalendarId,
    updatedAt: new Date().toISOString()
  });

  return { ok: true, selectedCalendarIds: nextSelected, syncCalendarId: nextSyncCalendarId };
}

export async function getGoogleCalendarAccessToken(context) {
  const stored = await readStoredConnection(context);
  if (!stored?.tokens?.accessToken) {
    return { ok: false, connected: false, message: "Google Calendar ainda nao conectado." };
  }

  const accessToken = maybeReveal(stored.tokens.accessToken);
  const expiresAt = Date.parse(stored.tokens.expiresAt || "");
  if (accessToken && (!Number.isFinite(expiresAt) || expiresAt - Date.now() > TOKEN_REFRESH_SKEW_MS)) {
    return { ok: true, accessToken, connection: publicConnection(stored, context) };
  }

  const refreshed = await refreshStoredGoogleCalendarToken(stored);
  if (!refreshed.ok) {
    return { ok: false, connected: true, needsReconnect: true, message: "Reconecte o Google Calendar para renovar a permissao." };
  }

  const nextStored = {
    ...stored,
    updatedAt: new Date().toISOString(),
    tokens: {
      ...stored.tokens,
      accessToken: maybeProtect(refreshed.providerToken),
      refreshMode: clean(refreshed.refreshMode) || stored.tokens.refreshMode || "",
      providerRefreshToken: maybeProtect(refreshed.providerRefreshToken) || stored.tokens.providerRefreshToken || "",
      supabaseRefreshToken: maybeProtect(refreshed.supabaseRefreshToken) || stored.tokens.supabaseRefreshToken || "",
      expiresAt: normalizeExpiresAt(refreshed.expiresAt)
    }
  };
  await writeStoredConnection(context, nextStored);

  return { ok: true, accessToken: refreshed.providerToken, connection: publicConnection(nextStored, context) };
}

export async function googleCalendarRequest(accessToken, path, options = {}) {
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload?.error?.message || "Falha ao acessar Google Calendar.",
      payload
    };
  }
  return { ok: true, payload };
}

export function normalizeCalendarIds(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(new Set(list.map((item) => clean(item)).filter(Boolean))).slice(0, 10);
}

function publicConnection(stored, context) {
  return {
    connected: true,
    email: stored.email || context?.member?.email || "",
    selectionMode: clean(stored.selectionMode),
    selectedCalendarIds: normalizeCalendarIds(stored.selectedCalendarIds),
    syncCalendarId: clean(stored.syncCalendarId) || "primary",
    expiresAt: clean(stored.tokens?.expiresAt)
  };
}

async function refreshStoredGoogleCalendarToken(stored) {
  const mode = clean(stored?.tokens?.refreshMode);
  if (mode === "google") return refreshViaGoogle(stored);
  if (mode === "supabase") return refreshViaSupabase(stored);

  const google = await refreshViaGoogle(stored);
  if (google.ok) return google;
  return refreshViaSupabase(stored);
}

async function refreshViaGoogle(stored) {
  const refreshToken = maybeReveal(stored?.tokens?.providerRefreshToken);
  const config = getGoogleCalendarOAuthConfig();
  if (!refreshToken || !config.configured) return { ok: false };

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  }).catch(() => null);

  const payload = await response?.json?.().catch(() => ({}));
  if (!response?.ok || !payload?.access_token) return { ok: false };

  return {
    ok: true,
    refreshMode: "google",
    providerToken: clean(payload.access_token),
    providerRefreshToken: refreshToken,
    expiresAt: expiresAtFromSeconds(payload.expires_in)
  };
}

async function refreshViaSupabase(stored) {
  const refreshToken = maybeReveal(stored?.tokens?.supabaseRefreshToken);
  if (!refreshToken || !appConfig.supabaseUrl || !appConfig.supabaseAnonKey) return { ok: false };

  const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  const session = data?.session;
  const providerToken = clean(session?.provider_token);
  if (error || !providerToken) return { ok: false };

  return {
    ok: true,
    refreshMode: "supabase",
    providerToken,
    providerRefreshToken: clean(session?.provider_refresh_token),
    supabaseRefreshToken: clean(session?.refresh_token),
    expiresAt: session?.expires_at ? new Date(Number(session.expires_at) * 1000).toISOString() : new Date(Date.now() + 50 * 60 * 1000).toISOString()
  };
}

async function readStoredConnection(context) {
  if (!context?.supabase || !context?.householdId || !context?.member?.email) return null;
  const { data, error } = await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(connectionPath(context));
  if (error || !data) return null;
  const text = await data.text().catch(() => "");
  return parseJson(text);
}

async function writeStoredConnection(context, connection) {
  const path = connectionPath(context);
  await context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).remove([path]);
  return context.supabase.storage.from(ECONOMICS_STORAGE_BUCKET).upload(path, JSON.stringify(connection, null, 2), {
    cacheControl: "0",
    contentType: "application/json",
    upsert: true
  });
}

function connectionPath(context) {
  const emailKey = clean(context.member.email).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  return `${context.householdId}/${CONNECTION_DIR}/${emailKey}.json`;
}

function maybeProtect(value) {
  const text = clean(value);
  if (!text) return "";
  const secret = encryptionSecret();
  if (!secret) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function maybeReveal(value) {
  const text = clean(value);
  if (!text) return "";
  if (!text.startsWith("v1.")) return text;
  const secret = encryptionSecret();
  if (!secret) return "";

  try {
    const [, ivPart, tagPart, encryptedPart] = text.split(".");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(encryptedPart, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function encryptionKey(secret) {
  return createHash("sha256").update(secret).digest();
}

function encryptionSecret() {
  return clean(process.env.KANBAN_GOOGLE_TOKEN_SECRET || process.env.ECONOMICS_SESSION_SECRET || process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD);
}

function signOAuthState(unsigned, secret) {
  return createHmac("sha256", secret).update(unsigned).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(clean(a));
  const right = Buffer.from(clean(b));
  if (!left.length || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function expiresAtFromSeconds(value) {
  const seconds = Number(value || 0);
  const fallbackMs = 50 * 60 * 1000;
  return new Date(Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : fallbackMs)).toISOString();
}

function normalizeExpiresAt(value) {
  const text = clean(value);
  if (!text) return "";
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  try {
    return Buffer.from(value, "base64url").toString("utf8");
  } catch {
    return "";
  }
}

function decodeJwtPayload(token) {
  const [, payloadPart] = clean(token).split(".");
  if (!payloadPart) return null;
  return parseJson(base64UrlDecode(payloadPart));
}

function parseJson(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return null;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}
