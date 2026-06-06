import { NextResponse } from "next/server";
import { parseDestinationSearchParams } from "@/lib/destinations/search";
import { searchDestinations } from "@/lib/destinations/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const search = parseDestinationSearchParams(params);
  const result = await searchDestinations(search);

  return NextResponse.json(
    {
      ...result,
      filters: search
    },
    {
      headers: {
        "Cache-Control": result.source === "static_catalog_1001"
          ? "public, s-maxage=300, stale-while-revalidate=3600"
          : "private, no-store"
      }
    }
  );
}
