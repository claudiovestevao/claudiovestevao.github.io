import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { ECONOMICS_ACCESS_COOKIE, verifyEconomicsAccessToken } from "@/lib/economics-session";
import {
  createGoogleCalendarAuthUrl,
  createGoogleCalendarOAuthState,
  hasGoogleCalendarOAuthConfig
} from "@/lib/kanban-google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const session = verifyEconomicsAccessToken(cookieStore.get(ECONOMICS_ACCESS_COOKIE)?.value || "");

  if (!session.ok || !session.user) {
    return NextResponse.redirect(new URL("/kanban?erro=session", appConfig.siteUrl));
  }

  if (!hasGoogleCalendarOAuthConfig()) {
    return NextResponse.redirect(new URL("/kanban?calendar=missing_google_oauth", appConfig.siteUrl));
  }

  const state = createGoogleCalendarOAuthState(session.user);
  const authUrl = createGoogleCalendarAuthUrl({
    loginHint: session.user.email,
    state
  });

  if (!state || !authUrl) {
    return NextResponse.redirect(new URL("/kanban?calendar=google_error", appConfig.siteUrl));
  }

  return NextResponse.redirect(authUrl);
}
