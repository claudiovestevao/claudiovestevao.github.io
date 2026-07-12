import { cookies } from "next/headers";
import { ECONOMICS_ACCESS_COOKIE, verifyEconomicsAccessToken } from "@/lib/economics-session";
import { getEconomicsContext } from "@/lib/economics-db";

export async function requireEconomicsContext() {
  const cookieStore = await cookies();
  const session = verifyEconomicsAccessToken(cookieStore.get(ECONOMICS_ACCESS_COOKIE)?.value || "");
  if (!session.ok || !session.user) {
    return { ok: false, status: 401, message: "Sessao Economics ausente ou expirada." };
  }

  return getEconomicsContext(session.user);
}

export function economicsJson(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
