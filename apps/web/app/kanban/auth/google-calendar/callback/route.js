import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { getEconomicsContext } from "@/lib/economics-db";
import { ECONOMICS_ACCESS_COOKIE, verifyEconomicsAccessToken } from "@/lib/economics-session";
import {
  exchangeGoogleCalendarCode,
  getGoogleCalendarUser,
  saveGoogleCalendarConnection,
  verifyGoogleCalendarOAuthState
} from "@/lib/kanban-google-calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const error = clean(url.searchParams.get("error"));
  if (error) {
    return redirect(error === "access_denied" ? "google_denied" : "google_error");
  }

  const state = verifyGoogleCalendarOAuthState(url.searchParams.get("state"));
  if (!state.ok) return redirect("state_error");

  const cookieStore = await cookies();
  const session = verifyEconomicsAccessToken(cookieStore.get(ECONOMICS_ACCESS_COOKIE)?.value || "");
  if (!session.ok || !session.user) {
    return NextResponse.redirect(new URL("/kanban?erro=session", appConfig.siteUrl));
  }

  const sessionEmail = clean(session.user.email).toLowerCase();
  if (!sessionEmail || sessionEmail !== state.email) return redirect("state_error");

  const code = clean(url.searchParams.get("code"));
  if (!code) return redirect("google_error");

  const tokens = await exchangeGoogleCalendarCode(code).catch(() => ({ ok: false }));
  if (!tokens.ok || !tokens.accessToken) return redirect("google_error");
  if (!hasCalendarScopes(tokens.scope)) return redirect("google_denied");

  const googleUser = await getGoogleCalendarUser(tokens.accessToken, tokens.idToken).catch(() => null);
  const googleEmail = clean(googleUser?.email).toLowerCase();
  if (googleEmail && googleEmail !== sessionEmail) return redirect("email_mismatch");

  const context = await getEconomicsContext(session.user);
  if (!context.ok) return redirect("session_error");

  const saved = await saveGoogleCalendarConnection(context, {
    providerToken: tokens.accessToken,
    providerRefreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    refreshMode: "google"
  }).catch(() => ({ ok: false }));

  if (!saved.ok) return redirect("storage_error");
  return redirect("connected");
}

function redirect(code) {
  return NextResponse.redirect(new URL(`/kanban?calendar=${encodeURIComponent(code)}`, appConfig.siteUrl));
}

function hasCalendarScopes(scope) {
  const granted = new Set(clean(scope).split(/\s+/).filter(Boolean));
  return (
    granted.has("https://www.googleapis.com/auth/calendar.events") &&
    granted.has("https://www.googleapis.com/auth/calendar.readonly")
  );
}

function clean(value) {
  return String(value ?? "").trim();
}
