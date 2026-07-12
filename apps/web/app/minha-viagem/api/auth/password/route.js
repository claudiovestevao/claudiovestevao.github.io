import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { isTravelEmailInvited, resolveTravelMemberForAuthUser } from "@/lib/travel-members";
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
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return json({ ok: false, message: "Login por e-mail ainda nao configurado." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const mode = clean(body.mode);
  const email = cleanEmail(body.email);
  const password = String(body.password || "");

  if (!["login", "register"].includes(mode)) {
    return json({ ok: false, message: "Acao invalida." }, 400);
  }

  const invalid = validateCredentials(email, password);
  if (invalid) return json({ ok: false, message: invalid }, 400);

  if (!(await isTravelEmailInvited(email))) {
    return json({ ok: false, message: "Este e-mail ainda nao esta convidado para a viagem." }, 403);
  }

  const supabase = createAuthClient();

  if (mode === "register") {
    return registerWithPassword(supabase, { email, password });
  }

  return loginWithPassword(supabase, { email, password });
}

async function registerWithPassword(supabase, { email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appConfig.siteUrl}/minha-viagem`,
      data: {
        app: "minha-viagem-orlando"
      }
    }
  });

  if (error) {
    return json({ ok: false, message: authErrorMessage(error.message, "register") }, 400);
  }

  if (!data?.session) {
    return json({
      ok: true,
      needsEmailConfirmation: true,
      message: "Cadastro criado. Confirme o e-mail e depois entre com sua senha."
    });
  }

  return issueTravelSession(data.user);
}

async function loginWithPassword(supabase, { email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data?.user) {
    return json({ ok: false, message: authErrorMessage(error?.message, "login") }, 401);
  }

  return issueTravelSession(data.user);
}

async function issueTravelSession(user) {
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

function createAuthClient() {
  return createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });
}

function authErrorMessage(message = "", mode = "login") {
  const lower = String(message).toLowerCase();
  if (lower.includes("email not confirmed")) return "Confirme o e-mail antes de entrar.";
  if (lower.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (lower.includes("already registered") || lower.includes("user already")) {
    return "Esse e-mail ja tem cadastro. Use Entrar ou Criar/trocar senha por e-mail.";
  }
  if (lower.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  return mode === "register"
    ? "Nao consegui criar o cadastro agora."
    : "Nao consegui fazer login agora.";
}

function validateCredentials(email, password) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Informe um e-mail valido.";
  if (password.length < 8) return "A senha precisa ter pelo menos 8 caracteres.";
  return "";
}

function cleanEmail(value) {
  return clean(value).toLowerCase();
}

function clean(value) {
  return String(value ?? "").trim();
}

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
