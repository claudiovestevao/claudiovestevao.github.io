import { NextResponse } from "next/server";
import { ensurePrivateAccess } from "../../_lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRAPH_VERSION = clean(process.env.WHATSAPP_GRAPH_VERSION) || "v25.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export async function GET(request) {
  const health = await collectHealth();
  console.info("whatsapp_health_check", JSON.stringify(health));
  const auth = await ensurePrivateAccess(request, { action: "whatsapp:health" });
  if (!auth.ok) return auth.response;

  return NextResponse.json(health, { headers: { "Cache-Control": "no-store" } });
}

async function collectHealth() {
  const token = whatsappToken();
  const phoneNumberId = clean(process.env.WHATSAPP_PHONE_NUMBER_ID);
  const wabaId = clean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID);
  const appSecret = metaAppSecret();
  const verifyToken = clean(process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL) || "https://claudiocode.dev";
  const callbackUrl = `${siteUrl.replace(/\/+$/, "")}/minha-viagem/api/whatsapp/webhook`;

  const checks = {
    env: {
      graphVersion: GRAPH_VERSION,
      hasToken: Boolean(token),
      hasPhoneNumberId: Boolean(phoneNumberId),
      hasBusinessAccountId: Boolean(wabaId),
      hasAppSecret: Boolean(appSecret),
      hasVerifyToken: Boolean(verifyToken),
      callbackUrl
    },
    phone: null,
    subscribedApps: null
  };

  if (token && phoneNumberId) {
    checks.phone = await graphCheck(
      `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,quality_rating`
    );
  }

  if (token && wabaId) {
    checks.subscribedApps = await graphCheck(`/${encodeURIComponent(wabaId)}/subscribed_apps`);
  }

  return {
    ok: true,
    checks,
    hint: healthHint(checks)
  };
}

async function graphCheck(path) {
  try {
    const response = await fetch(`${GRAPH_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${whatsappToken()}`
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    return {
      ok: response.ok,
      status: response.status,
      data: sanitizeGraphData(data)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error?.message || String(error)
    };
  }
}

function sanitizeGraphData(data) {
  if (!data || typeof data !== "object") return data;
  if (data.error) {
    return {
      error: {
        message: clean(data.error.message),
        type: clean(data.error.type),
        code: data.error.code || null,
        fbtrace_id: clean(data.error.fbtrace_id)
      }
    };
  }
  if (Array.isArray(data.data)) {
    return {
      data: data.data.map((item) => ({
        id: clean(item?.id),
        name: clean(item?.name),
        subscribed_fields: Array.isArray(item?.subscribed_fields) ? item.subscribed_fields.map(clean) : []
      }))
    };
  }
  return {
    id: clean(data.id),
    display_phone_number: clean(data.display_phone_number),
    verified_name: clean(data.verified_name),
    quality_rating: clean(data.quality_rating)
  };
}

function healthHint(checks) {
  if (!checks.env.hasToken || !checks.env.hasPhoneNumberId || !checks.env.hasBusinessAccountId) {
    return "Variaveis essenciais do WhatsApp ausentes no runtime.";
  }
  if (!checks.env.hasAppSecret || !checks.env.hasVerifyToken) {
    return "Webhook nao consegue validar assinatura/verificacao sem app secret e verify token.";
  }
  if (checks.subscribedApps?.ok) {
    const fields = checks.subscribedApps.data?.data?.flatMap((item) => item.subscribed_fields || []) || [];
    if (!fields.includes("messages")) return "A WABA respondeu, mas nao parece inscrita no campo messages.";
  }
  if (checks.phone?.ok && checks.subscribedApps?.ok) {
    return "Runtime do WhatsApp parece configurado; se nao ha POST nos logs, confira a URL/campo messages no painel da Meta.";
  }
  return "Graph API nao confirmou toda a configuracao; veja os status retornados.";
}

function whatsappToken() {
  return (
    clean(process.env.WHATSAPP_PERMANENT_TOKEN) ||
    clean(process.env.WHATSAPP_API_TOKEN) ||
    clean(process.env.WHATSAPP_ACCESS_TOKEN) ||
    clean(process.env.WHATSAPP_TOKEN)
  );
}

function metaAppSecret() {
  return (
    clean(process.env.META_APP_SECRET) ||
    clean(process.env.WHATSAPP_APP_SECRET) ||
    clean(process.env.META_WEBHOOK_APP_SECRET) ||
    clean(process.env.FACEBOOK_APP_SECRET)
  );
}

function clean(value) {
  return String(value ?? "").trim();
}
