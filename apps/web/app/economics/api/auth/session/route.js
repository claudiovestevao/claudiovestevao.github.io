import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
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

export async function POST(request) {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return json({ ok: false, message: "Login Google ainda nao configurado." }, 503);
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
    return json({ ok: false, message: "Sessao do Google invalida." }, 401);
  }

  if (!profile) {
    return json({ ok: false, message: "Este e-mail ainda nao esta liberado no Economics." }, 403);
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
