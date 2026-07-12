import { createHmac, randomUUID } from "node:crypto";

export const ECONOMICS_ACCESS_COOKIE = "cc_economics_access";
export const ECONOMICS_CSRF_COOKIE = "cc_economics_csrf";
export const ECONOMICS_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const DEFAULT_ALLOWED_EMAILS = ["cvitorestevao@gmail.com", "nathalierbonomi@gmail.com"];

export function economicsCookieOptions() {
  return {
    httpOnly: true,
    maxAge: ECONOMICS_SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  };
}

export function createEconomicsCsrfToken() {
  return randomUUID();
}

export function createEconomicsAccessToken(user = {}) {
  const profile = economicsProfileForEmail(user.email);
  const payload = {
    exp: Math.floor(Date.now() / 1000) + ECONOMICS_SESSION_MAX_AGE_SECONDS,
    email: clean(profile?.email || user.email).toLowerCase(),
    name: clean(user.name) || profile?.name || displayNameFromEmail(user.email),
    role: profile?.role || "owner",
    avatar: profile?.avatar || "E"
  };
  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  return `v1.${payloadPart}.${signEconomicsPayload(`v1.${payloadPart}`)}`;
}

export function verifyEconomicsAccessToken(token) {
  const [version, payloadPart, signature] = String(token || "").split(".");
  if (version !== "v1" || !payloadPart || !signature) return { ok: false, user: null };
  if (!constantTimeEqual(signature, signEconomicsPayload(`v1.${payloadPart}`))) return { ok: false, user: null };

  const payload = parseJson(base64UrlDecode(payloadPart));
  if (!payload || Number(payload.exp) <= Math.floor(Date.now() / 1000)) return { ok: false, user: null };

  const profile = economicsProfileForEmail(payload.email);
  if (!profile) return { ok: false, user: null };

  return {
    ok: true,
    user: {
      email: profile.email,
      name: clean(payload.name) || profile.name,
      role: profile.role,
      avatar: profile.avatar
    }
  };
}

export function economicsProfileForEmail(email) {
  const normalized = clean(email).toLowerCase();
  if (!normalized) return null;

  const customProfiles = parseEconomicsAllowedUsers();
  const custom = customProfiles.find((user) => user.email === normalized);
  if (custom) return custom;

  if (!allowedEconomicsEmails().has(normalized)) return null;

  if (normalized === "cvitorestevao@gmail.com") {
    return { email: normalized, name: "Vitor", role: "owner", avatar: "V" };
  }

  if (normalized === "nathalierbonomi@gmail.com") {
    return { email: normalized, name: "Nathalie", role: "owner", avatar: "N" };
  }

  return { email: normalized, name: displayNameFromEmail(normalized), role: "owner", avatar: "E" };
}

export function hasEconomicsGoogleConfig() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function allowedEconomicsEmails() {
  const configured = String(process.env.ECONOMICS_ALLOWED_EMAILS || "")
    .split(",")
    .map((item) => clean(item).toLowerCase())
    .filter(Boolean);

  return new Set(configured.length ? configured : DEFAULT_ALLOWED_EMAILS);
}

function parseEconomicsAllowedUsers() {
  const raw = clean(process.env.ECONOMICS_ALLOWED_USERS);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        email: clean(item?.email).toLowerCase(),
        name: clean(item?.name) || displayNameFromEmail(item?.email),
        role: clean(item?.role) || "owner",
        avatar: clean(item?.avatar) || "E"
      }))
      .filter((item) => item.email);
  } catch {
    return [];
  }
}

function signEconomicsPayload(payload) {
  const secret = process.env.ECONOMICS_SESSION_SECRET || process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD || "";
  if (!secret) return "";
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function displayNameFromEmail(email) {
  const local = clean(email).split("@")[0] || "Economics";
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
