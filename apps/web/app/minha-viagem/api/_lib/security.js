import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import {
  TRAVEL_ACCESS_COOKIE,
  TRAVEL_CSRF_COOKIE,
  verifyTravelAccessToken
} from "@/lib/travel-session";

const WINDOW_MS = 60 * 1000;
const DEFAULT_LIMIT = 120;
const LIMITS = {
  "state:write": 90,
  "challenge:write": 90,
  "checkins:write": 90,
  "checkins:places": 40,
  "checkins:draft": 25,
  "media:write": 45,
  transcribe: 12
};

const rateStore = globalThis.__orlandoPrivateRateLimit || new Map();
globalThis.__orlandoPrivateRateLimit = rateStore;

export async function ensurePrivateAccess(request, options = {}) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const unlocked =
    headerStore.get("x-trip-access") === "1" ||
    verifyTravelAccessToken(cookieStore.get(TRAVEL_ACCESS_COOKIE)?.value || "").ok;

  if (!unlocked) {
    return {
      ok: false,
      response: jsonError("Acesso privado necessario.", 401)
    };
  }

  const limited = rateLimit(headerStore, options.action || "private");
  if (limited) {
    return {
      ok: false,
      response: limited
    };
  }

  if (options.csrf && !validMutationRequest(request, cookieStore)) {
    return {
      ok: false,
      response: jsonError("Validacao de seguranca expirada. Recarregue a pagina e tente de novo.", 403)
    };
  }

  return { ok: true };
}

function validMutationRequest(request, cookieStore) {
  if (!request || !sameOrigin(request)) return false;

  const cookieToken = cookieStore.get(TRAVEL_CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get("x-trip-csrf") || "";
  return cookieToken.length >= 16 && constantTimeEqual(cookieToken, headerToken);
}

function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
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

function rateLimit(headerStore, action) {
  const now = Date.now();
  const max = LIMITS[action] || DEFAULT_LIMIT;
  const key = `${action}:${clientIp(headerStore)}`;
  const current = rateStore.get(key);

  if (!current || current.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
    cleanupRates(now);
    return null;
  }

  current.count += 1;
  if (current.count <= max) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return jsonError("Muitas tentativas em pouco tempo. Aguarde um instante.", 429, {
    "Retry-After": String(retryAfter)
  });
}

function cleanupRates(now) {
  if (rateStore.size < 1000) return;
  for (const [key, value] of rateStore.entries()) {
    if (value.resetAt <= now) rateStore.delete(key);
  }
}

function clientIp(headerStore) {
  const forwarded = headerStore.get("x-forwarded-for") || "";
  const firstForwarded = forwarded.split(",")[0]?.trim();
  return firstForwarded || headerStore.get("x-real-ip") || "local";
}

function jsonError(message, status, headers = {}) {
  return NextResponse.json(
    { ok: false, message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers
      }
    }
  );
}
