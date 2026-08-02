import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { rateLimitRequest, rejectCrossOrigin, rejectLargeBody } from "@/lib/server-security";
import {
  ECONOMICS_ACCESS_COOKIE,
  ECONOMICS_CSRF_COOKIE,
  createEconomicsAccessToken,
  createEconomicsCsrfToken,
  economicsCookieOptions,
  economicsProfileForEmail
} from "@/lib/economics-session";
import { getEconomicsContext } from "@/lib/economics-db";
import { saveGoogleCalendarConnection } from "@/lib/kanban-google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const originGuard = rejectCrossOrigin(request);
  if (originGuard) return originGuard;

  const sizeGuard = rejectLargeBody(request, 64 * 1024);
  if (sizeGuard) return sizeGuard;

  const limited = rateLimitRequest(request, {
    bucket: "economics-google-session",
    limit: 30,
    windowMs: 60 * 1000
  });
  if (limited) return limited;

  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return json({ ok: false, message: "Login do Google ainda não configurado." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const accessToken = String(body?.access_token || "").trim();
  if (!accessToken) return json({ ok: false, message: "Token do Google ausente." }, 400);

  const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.getUser(accessToken);
  const user = data?.user;
  const email = String(user?.email || "").trim().toLowerCase();
  const profile = economicsProfileForEmail(email);

  if (error || !user || !email) {
    return json({ ok: false, message: "Sessão do Google inválida." }, 401);
  }

  if (!profile) {
    return json({ ok: false, message: "Este e-mail ainda não está liberado no Economics." }, 403);
  }

  if (body?.calendar_connect) {
    const context = await getEconomicsContext(profile);
    if (context.ok) {
      await saveGoogleCalendarConnection(context, {
        providerToken: body.provider_token,
        providerRefreshToken: body.provider_refresh_token,
        supabaseRefreshToken: body.refresh_token,
        expiresAt: body.provider_expires_at
      });
    }
  }

  const response = NextResponse.json(
    {
      ok: true,
      user: {
        email: profile.email,
        name: profile.name,
        role: profile.role,
        avatar: profile.avatar
      }
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );

  const baseCookie = economicsCookieOptions();
  response.cookies.set(ECONOMICS_ACCESS_COOKIE, createEconomicsAccessToken(profile), baseCookie);
  response.cookies.set(ECONOMICS_CSRF_COOKIE, createEconomicsCsrfToken(), {
    ...baseCookie,
    httpOnly: false
  });

  return response;
}

function json(payload, status) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
