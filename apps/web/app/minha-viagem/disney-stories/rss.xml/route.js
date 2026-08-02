import { NextResponse } from "next/server";
import { renderDisneyStoriesRss } from "../../api/_lib/disney-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const xml = await renderDisneyStoriesRss();
  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}
