import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { rateLimitRequest, rejectCrossOrigin, rejectLargeBody } from "@/lib/server-security";
import {
  ECONOMICS_ACCESS_COOKIE,
  ECONOMICS_CSRF_COOKIE,
  createEconomicsAccessToken,
  createEconomicsCsrfToken,
  economicsCookieOptions,
  economicsProfileForEmail
} from "@/lib/economics-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Login por senha para agentes (Kanban + Economics).
// Liga quando ECONOMICS_AGENT_PASSWORD (min. 16 caracteres) existe no servidor.
// A sessao entra como o dono (ECONOMICS_AGENT_EMAIL, padrao Vitor), com nome "Agente" e validade curta.
const MIN_PASSWORD_LENGTH = 16;
const AGENT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ALLOWED_NEXT = new Set(["/kanban", "/economics"]);

export async function POST(request) {
  const originGuard = rejectCrossOrigin(request);
  if (originGuard) return originGuard;

  const sizeGuard = rejectLargeBody(request, 8 * 1024);
  if (sizeGuard) return sizeGuard;

  const limited = rateLimitRequest(request, {
    bucket: "economics-password-login",
    limit: 5,
    windowMs: 10 * 60 * 1000
  });
  if (limited) return limited;

  const form = await request.formData().catch(() => null);
  const next = safeNext(form?.get("next"));
  const password = String(form?.get("password") || "");
  const expected = String(process.env.ECONOMICS_AGENT_PASSWORD || "");

  if (expected.length < MIN_PASSWORD_LENGTH) return redirectTo(request, next, "senha-desativada");

  if (!password || !samePassword(password, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    return redirectTo(request, next, "senha-invalida");
  }

  const email = String(process.env.ECONOMICS_AGENT_EMAIL || "cvitorestevao@gmail.com").trim().toLowerCase();
  const profile = economicsProfileForEmail(email);
  if (!profile) return redirectTo(request, next, "senha-desativada");

  console.info(`[auth] login por senha (agente) -> ${next}`);

  const response = redirectTo(request, next);
  const baseCookie = { ...economicsCookieOptions(), maxAge: AGENT_SESSION_MAX_AGE_SECONDS };
  response.cookies.set(
    ECONOMICS_ACCESS_COOKIE,
    createEconomicsAccessToken({ ...profile, name: "Agente" }, AGENT_SESSION_MAX_AGE_SECONDS),
    baseCookie
  );
  response.cookies.set(ECONOMICS_CSRF_COOKIE, createEconomicsCsrfToken(), { ...baseCookie, httpOnly: false });
  return response;
}

function samePassword(received, expected) {
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function safeNext(value) {
  const next = String(value || "").trim();
  return ALLOWED_NEXT.has(next) ? next : "/kanban";
}

function redirectTo(request, next, error = "") {
  const url = new URL(next, request.url);
  if (error) url.searchParams.set("erro", error);
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
