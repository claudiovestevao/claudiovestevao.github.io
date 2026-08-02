import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 60;
const MAX_RATE_KEYS = 5000;

const rateStore = globalThis.__claudioCodeRateLimit || new Map();
globalThis.__claudioCodeRateLimit = rateStore;

export function authorizeBearerSecret(request, expectedSecret, options = {}) {
  const serviceName = clean(options.serviceName || "Acesso");
  const headerName = clean(options.headerName || "");

  if (!expectedSecret) {
    return {
      ok: false,
      response: noStoreJson({ ok: false, message: `${serviceName} nao configurado.` }, 503)
    };
  }

  const provided =
    bearerToken(request.headers.get("authorization") || "") ||
    (headerName ? clean(request.headers.get(headerName) || "") : "");

  if (!secretMatches(provided, expectedSecret)) {
    return {
      ok: false,
      response: noStoreJson({ ok: false, message: `${serviceName} nao autorizado.` }, 401)
    };
  }

  return { ok: true };
}

export function authorizeCronRequest(request, cronSecret) {
  return authorizeBearerSecret(request, cronSecret, { serviceName: "Cron" });
}

export function secretMatches(provided, expected) {
  const left = Buffer.from(clean(provided));
  const right = Buffer.from(clean(expected));
  return Boolean(left.length && right.length && left.length === right.length && timingSafeEqual(left, right));
}

export function rejectCrossOrigin(request) {
  if (sameOriginRequest(request)) return null;
  return noStoreJson({ ok: false, message: "Origem da requisicao nao autorizada." }, 403);
}

export function sameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function rateLimitRequest(request, options = {}) {
  const bucket = clean(options.bucket || "default");
  const extraKey = clean(options.key || "").slice(0, 160);
  const key = [bucket, clientIp(request), extraKey].filter(Boolean).join(":");
  const limited = checkRateLimit(key, options);

  if (!limited) return null;

  return noStoreJson(
    { ok: false, message: "Muitas tentativas em pouco tempo. Aguarde um instante." },
    429,
    { "Retry-After": String(limited.retryAfter) }
  );
}

export function rejectLargeBody(request, maxBytes) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(contentLength) || contentLength <= maxBytes) return null;
  return noStoreJson({ ok: false, message: "Payload muito grande." }, 413);
}

export function noStoreJson(payload, status = 200, headers = {}) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function checkRateLimit(key, options = {}) {
  const now = Date.now();
  const limit = Number(options.limit || DEFAULT_LIMIT);
  const windowMs = Number(options.windowMs || DEFAULT_WINDOW_MS);
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    cleanupRates(now);
    return null;
  }

  current.count += 1;
  if (current.count <= limit) return null;

  return {
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

function cleanupRates(now) {
  if (rateStore.size < MAX_RATE_KEYS) return;
  for (const [key, value] of rateStore.entries()) {
    if (value.resetAt <= now) rateStore.delete(key);
  }
}

function bearerToken(value) {
  const auth = String(value || "").trim();
  return auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
}

function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
}

function clean(value) {
  return String(value ?? "").trim();
}
