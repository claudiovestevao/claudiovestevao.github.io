import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!appConfig.supabaseUrl || !appConfig.supabaseAnonKey) {
    return NextResponse.redirect(new URL("/minha-viagem?erro=google_config", appConfig.siteUrl));
  }

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
      redirectTo: `${appConfig.siteUrl}/minha-viagem/auth/callback`,
      skipBrowserRedirect: true
    }
  });

  if (error || !data?.url) {
    return NextResponse.redirect(new URL("/minha-viagem?erro=google", appConfig.siteUrl));
  }

  return NextResponse.redirect(data.url);
}
