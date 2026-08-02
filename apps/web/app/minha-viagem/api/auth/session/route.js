import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { rateLimitRequest, rejectCrossOrigin, rejectLargeBody } from "@/lib/server-security";
import { resolveTravelMemberForAuthUser } from "@/lib/travel-members";
import {
  TRAVEL_ACCESS_COOKIE,
  TRAVEL_CSRF_COOKIE,
  createTravelAccessToken,
  createTravelCsrfToken,
  travelCookieOptions
} from "@/lib/travel-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  const originGuard = rejectCrossOrigin(request);
  if (originGuard) return originGuard;

  const sizeGuard = rejectLargeBody(request, 32 * 1024);
  if (sizeGuard) return sizeGuard;

  const limited = rateLimitRequest(request, {
    bucket: "travel-google-session",
    limit: 30,
    windowMs: 60 * 1000
  });
  if (limited) return limited;

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

  if (error || !user || !email) {
    return json({ ok: false, message: "Sessao do Google invalida." }, 401);
  }

  const profile = await resolveTravelMemberForAuthUser(user);
  if (!profile) {
    return json({ ok: false, message: "Este e-mail ainda nao esta liberado para a viagem." }, 403);
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

  const baseCookie = travelCookieOptions();
  response.cookies.set(TRAVEL_ACCESS_COOKIE, createTravelAccessToken(profile), baseCookie);
  response.cookies.set(TRAVEL_CSRF_COOKIE, createTravelCsrfToken(), {
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
