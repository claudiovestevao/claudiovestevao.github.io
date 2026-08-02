import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { rateLimitRequest, rejectCrossOrigin, rejectLargeBody } from "@/lib/server-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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

  const sizeGuard = rejectLargeBody(request, 16 * 1024);
  if (sizeGuard) return sizeGuard;

  const limited = rateLimitRequest(request, {
    bucket: "travel-password-reset",
    limit: 8,
    windowMs: 10 * 60 * 1000
  });
  if (limited) return limited;

  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey || !appConfig.supabaseServiceRoleKey) {
    return json({ ok: false, message: "Troca de senha ainda nao configurada." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const accessToken = String(body.access_token || "").trim();
  const password = String(body.password || "");

  if (!accessToken) return json({ ok: false, message: "Link de senha invalido ou expirado." }, 400);
  if (password.length < 8) return json({ ok: false, message: "A senha precisa ter pelo menos 8 caracteres." }, 400);

  const authClient = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const { data, error } = await authClient.auth.getUser(accessToken);
  const user = data?.user;

  if (error || !user?.id) {
    return json({ ok: false, message: "Link de senha invalido ou expirado." }, 401);
  }

  const profile = await resolveTravelMemberForAuthUser(user);
  if (!profile) {
    return json({ ok: false, message: "Este e-mail ainda nao esta liberado para a viagem." }, 403);
  }

  const serviceClient = getSupabaseServerClient();
  const { error: updateError } = await serviceClient.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: {
      app: "minha-viagem-orlando",
      travel_name: profile.name,
      travel_role: profile.role
    }
  });

  if (updateError) {
    return json({ ok: false, message: "Nao consegui salvar a senha nova agora." }, 400);
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

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
