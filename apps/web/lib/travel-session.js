import { createHmac, randomUUID } from "node:crypto";

export const TRAVEL_ACCESS_COOKIE = "cc_trip_access";
export const TRAVEL_CSRF_COOKIE = "cc_trip_csrf";
export const TRAVEL_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function travelCookieOptions() {
  return {
    httpOnly: true,
    maxAge: TRAVEL_SESSION_MAX_AGE_SECONDS,
    path: "/minha-viagem",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  };
}

export function createTravelCsrfToken() {
  return randomUUID();
}

export function createTravelAccessToken(user = {}) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + TRAVEL_SESSION_MAX_AGE_SECONDS,
    email: clean(user.email).toLowerCase(),
    name: clean(user.name) || "Família",
    role: clean(user.role) || "admin",
    avatar: clean(user.avatar) || "✨"
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `v2.${payloadPart}.${signTravelPayload(`v2.${payloadPart}`)}`;
}

export function verifyTravelAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts[0] === "v2") return verifyV2(parts);
  if (parts[0] === "v1") return verifyV1(parts);
  return { ok: false, user: null };
}

export function travelProfileForEmail(email) {
  const normalized = clean(email).toLowerCase();
  if (!normalized) return null;

  const papaiEmail = clean(process.env.TRAVEL_PAPAI_EMAIL).toLowerCase();
  const mamaeEmail = clean(process.env.TRAVEL_MAMAE_EMAIL).toLowerCase();

  if (papaiEmail && normalized === papaiEmail) {
    return { email: normalized, name: "Papai", role: "admin", avatar: "👨‍👧" };
  }

  if (mamaeEmail && normalized === mamaeEmail) {
    return { email: normalized, name: "Mamãe", role: "admin", avatar: "🤰" };
  }

  const custom = parseTravelAdminUsers().find((user) => user.email === normalized);
  if (custom) return custom;

  const adminEmails = new Set(
    String(process.env.TRAVEL_ADMIN_EMAILS || "")
      .split(",")
      .map((item) => clean(item).toLowerCase())
      .filter(Boolean)
  );

  if (adminEmails.has(normalized)) {
    return { email: normalized, name: displayNameFromEmail(normalized), role: "admin", avatar: "✨" };
  }

  return null;
}

export function hasTravelGoogleConfig() {
  return Boolean((process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export function hasTravelAdminConfig() {
  return Boolean(
    clean(process.env.TRAVEL_PAPAI_EMAIL) ||
      clean(process.env.TRAVEL_MAMAE_EMAIL) ||
      clean(process.env.TRAVEL_ADMIN_EMAILS) ||
      clean(process.env.TRAVEL_ADMIN_USERS)
  );
}

function verifyV2(parts) {
  const [, payloadPart, signature] = parts;
  if (!payloadPart || !signature || !constantTimeEqual(signature, signTravelPayload(`v2.${payloadPart}`))) {
    return { ok: false, user: null };
  }

  const payload = parseJson(base64UrlDecode(payloadPart));
  if (!payload || Number(payload.exp) <= Math.floor(Date.now() / 1000)) {
    return { ok: false, user: null };
  }

  return {
    ok: true,
    user: {
      email: clean(payload.email).toLowerCase(),
      name: clean(payload.name) || "Família",
      role: clean(payload.role) || "admin",
      avatar: clean(payload.avatar) || "✨"
    }
  };
}

function verifyV1(parts) {
  const [, expiresAt, signature] = parts;
  const expiresAtNumber = Number(expiresAt);
  if (!signature || !Number.isFinite(expiresAtNumber) || expiresAtNumber <= Math.floor(Date.now() / 1000)) {
    return { ok: false, user: null };
  }

  return {
    ok: constantTimeEqual(signature, signTravelPayload(`v1.${expiresAt}`)),
    user: null
  };
}

function signTravelPayload(payload) {
  const secret = process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD || "";
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function parseTravelAdminUsers() {
  const raw = clean(process.env.TRAVEL_ADMIN_USERS);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        email: clean(item?.email).toLowerCase(),
        name: clean(item?.name) || displayNameFromEmail(item?.email),
        role: "admin",
        avatar: clean(item?.avatar) || "✨"
      }))
      .filter((item) => item.email);
  } catch {
    return [];
  }
}

function displayNameFromEmail(email) {
  const local = clean(email).split("@")[0] || "Família";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function constantTimeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function clean(value) {
  return String(value ?? "").trim();
}
