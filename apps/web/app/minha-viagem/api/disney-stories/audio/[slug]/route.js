import { NextResponse } from "next/server";
import { getExpressiveStoryAudio } from "../../../_lib/disney-stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request, { params }) {
  const { slug } = await params;
  try {
    const result = await getExpressiveStoryAudio(slug);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: result.message || "Audio indisponivel." },
        { status: result.status || 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (result.redirectUrl) {
      return NextResponse.redirect(result.redirectUrl, {
        headers: {
          "Cache-Control": "public, max-age=3600"
        }
      });
    }
    return new NextResponse(result.bytes, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=604800",
        "Vercel-CDN-Cache-Control": "public, s-maxage=31536000, stale-while-revalidate=604800",
        "Content-Type": result.contentType || "audio/mpeg",
        "Content-Length": String(result.bytes?.length || 0),
        "X-Disney-Story-Audio-Source": result.source || "unknown"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error?.message || "Falha ao gerar audio." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
