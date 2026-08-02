import { NextResponse } from "next/server";

const ACCESS_COOKIE = "cc_trip_access";
const ECONOMICS_ACCESS_COOKIE = "cc_economics_access";
const ECONOMICS_ALLOWED_EMAILS = new Set(["cvitorestevao@gmail.com", "nathalierbonomi@gmail.com"]);

export async function middleware(request) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-trip-access");
  requestHeaders.delete("x-economics-access");

  if (await isValidAccessToken(request.cookies.get(ACCESS_COOKIE)?.value || "")) {
    requestHeaders.set("x-trip-access", "1");
  }

  if (await isValidEconomicsAccessToken(request.cookies.get(ECONOMICS_ACCESS_COOKIE)?.value || "")) {
    requestHeaders.set("x-economics-access", "1");
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  applySecurityHeaders(response);
  return response;
}

async function isValidEconomicsAccessToken(token) {
  const [version, payloadPart, signature] = String(token || "").split(".");
  if (version !== "v1" || !payloadPart || !signature) return false;

  const expected = await signEconomicsPayload(`v1.${payloadPart}`);
  if (!constantTimeEqual(signature, expected)) return false;

  const payload = parseJson(base64UrlDecode(payloadPart));
  const email = String(payload?.email || "").trim().toLowerCase();
  return Number(payload?.exp) > Math.floor(Date.now() / 1000) && isAllowedEconomicsEmail(email);
}

async function isValidAccessToken(token) {
  const parts = String(token || "").split(".");
  if (parts[0] === "v2") return isValidV2Token(parts);
  if (parts[0] === "v1") return isValidV1Token(parts);
  return false;
}

async function isValidV1Token(parts) {
  const [version, expiresAt, signature] = parts;
  const expiresAtNumber = Number(expiresAt);
  const secret = process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD || "";

  if (version !== "v1" || !signature || !secret || !Number.isFinite(expiresAtNumber)) return false;
  if (expiresAtNumber <= Math.floor(Date.now() / 1000)) return false;

  const expected = await signAccessPayload(`${version}.${expiresAt}`, secret);
  return constantTimeEqual(signature, expected);
}

async function isValidV2Token(parts) {
  const [, payloadPart, signature] = parts;
  const secret = process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD || "";

  if (!payloadPart || !signature || !secret) return false;

  const expected = await signAccessPayload(`v2.${payloadPart}`, secret);
  if (!constantTimeEqual(signature, expected)) return false;

  const payload = parseJson(base64UrlDecode(payloadPart));
  return Number(payload?.exp) > Math.floor(Date.now() / 1000);
}

async function signAccessPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64Url(new Uint8Array(signature));
}

async function signEconomicsPayload(payload) {
  const secret = process.env.ECONOMICS_SESSION_SECRET || process.env.TRAVEL_SESSION_SECRET || process.env.TRAVEL_PASSWORD || "";
  if (!secret) return "";
  return signAccessPayload(payload, secret);
}

function isAllowedEconomicsEmail(email) {
  const configured = String(process.env.ECONOMICS_ALLOWED_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowed = configured.length ? new Set(configured) : ECONOMICS_ALLOWED_EMAILS;
  return allowed.has(email);
}

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  try {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function applySecurityHeaders(response) {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(self), payment=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' blob: https://unpkg.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://*.supabase.co https://api.themeparks.wiki https://queue-times.com https://api.open-meteo.com https://economia.awesomeapi.com.br https://open.er-api.com https://api.elevenlabs.io https://elevenlabs.io https://*.elevenlabs.io wss://api.elevenlabs.io wss://*.elevenlabs.io",
      "media-src 'self' data: blob: https://api.elevenlabs.io https://*.elevenlabs.io",
      "worker-src 'self' blob: https://unpkg.com https://elevenlabs.io https://*.elevenlabs.io",
      "worklet-src 'self' blob: https://unpkg.com https://elevenlabs.io https://*.elevenlabs.io",
      "frame-src 'self' https://elevenlabs.io https://*.elevenlabs.io",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'"
    ].join("; ")
  );

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
}

export const config = {
  matcher: ["/minha-viagem/:path*", "/economics/:path*", "/kanban/:path*"]
};
