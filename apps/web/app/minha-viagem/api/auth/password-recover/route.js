import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";
import { isTravelEmailInvited } from "@/lib/travel-members";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return json({ ok: false, message: "Recuperacao de senha ainda nao configurada." }, 503);
  }

  const body = await request.json().catch(() => ({}));
  const email = cleanEmail(body.email);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, message: "Informe um e-mail valido." }, 400);
  }

  if (!(await isTravelEmailInvited(email))) {
    return json({ ok: false, message: "Este e-mail ainda nao esta convidado para a viagem." }, 403);
  }

  const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appConfig.siteUrl}/minha-viagem/auth/reset`
  });

  if (error) {
    return json({ ok: false, message: "Nao consegui enviar o link de senha agora." }, 400);
  }

  return json({
    ok: true,
    message: "Enviamos um link para criar ou trocar sua senha."
  });
}

function cleanEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
