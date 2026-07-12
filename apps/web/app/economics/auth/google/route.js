import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return NextResponse.redirect(new URL("/economics?erro=google_config", appConfig.siteUrl));
  }

  const nextPath = safeNextPath(new URL(request.url).searchParams.get("next"));

  const supabase = createClient(appConfig.supabaseUrl, appConfig.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: false,
      flowType: "implicit",
      persistSession: false
    }
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appConfig.siteUrl}/economics/auth/callback?next=${encodeURIComponent(nextPath)}`,
      skipBrowserRedirect: true
    }
  });

  if (error || !data?.url) {
    return NextResponse.redirect(new URL("/economics?erro=google", appConfig.siteUrl));
  }

  return NextResponse.redirect(data.url);
}

function safeNextPath(value) {
  const nextPath = String(value || "/economics").trim();
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) return "/economics";
  if (nextPath.startsWith("/kanban")) return "/kanban";
  if (nextPath.startsWith("/economics")) return "/economics";
  return "/economics";
}
