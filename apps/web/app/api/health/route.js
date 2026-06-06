import { NextResponse } from "next/server";
import { hasServerSupabase } from "@/lib/config";
import { getDestinationCatalogStats } from "@/lib/destinations/repository";

export const runtime = "nodejs";

export async function GET() {
  const catalog = await getDestinationCatalogStats();
  return NextResponse.json({
    ok: true,
    app: "family-concierge-web",
    stack: "Next.js App Router + Supabase Postgres",
    supabaseConfigured: hasServerSupabase(),
    catalog
  });
}
