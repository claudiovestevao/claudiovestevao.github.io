import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  computeGoogleRouteFromSp,
  getGooglePlaceDetails,
  hasGoogleMaps,
  hydrateGooglePlaceMedia,
  searchGooglePlacesText
} from "@/lib/integrations/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") || "";
  if (!slug) {
    return NextResponse.json({ ok: false, message: "Informe slug do destino." }, { status: 400 });
  }
  if (!hasGoogleMaps()) {
    return NextResponse.json({ ok: false, message: "Google Maps API não configurada no servidor." }, { status: 503 });
  }

  try {
    const client = getSupabaseServerClient();
    const { data: destination, error } = await client
      .from("destinations")
      .select("id,slug,name,city,state,country,latitude,longitude")
      .eq("slug", slug)
      .eq("is_active", true)
      .single();

    if (error || !destination) {
      return NextResponse.json({ ok: false, message: "Destino não encontrado." }, { status: 404 });
    }

    const existing = await client
      .from("destination_google_places")
      .select("google_place_id,place_name,is_primary")
      .eq("destination_id", destination.id)
      .eq("is_primary", true)
      .limit(1);

    const placeId = existing.data?.[0]?.google_place_id;
    const query = [destination.city || destination.name, destination.state, destination.country].filter(Boolean).join(", ");
    const place = placeId
      ? await getGooglePlaceDetails(placeId)
      : (await searchGooglePlacesText({ query, pageSize: 1 }))[0];

    if (!place?.placeId) {
      return NextResponse.json({
        ok: true,
        source: "google_live",
        destination,
        place: null,
        route: null,
        warning: "Google não retornou local verificável para este destino."
      });
    }

    const [placeWithMedia, route] = await Promise.all([
      hydrateGooglePlaceMedia(place),
      computeGoogleRouteFromSp({
        latitude: destination.latitude || place.latitude,
        longitude: destination.longitude || place.longitude
      }).catch((routeError) => ({ status: "UNAVAILABLE", message: routeError.message }))
    ]);

    return NextResponse.json({
      ok: true,
      source: "google_live",
      destination: {
        slug: destination.slug,
        name: destination.name,
        state: destination.state,
        country: destination.country
      },
      place: publicPlace(placeWithMedia),
      route,
      fetchedAt: new Date().toISOString()
    }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      source: "google_live",
      message: error.message || "Falha ao consultar Google em tempo real."
    }, { status: Number(error.status || 502) });
  }
}

function publicPlace(place) {
  return {
    placeId: place.placeId,
    name: place.name,
    formattedAddress: place.formattedAddress,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    categories: place.categories,
    latitude: place.latitude,
    longitude: place.longitude,
    googleMapsUri: place.googleMapsUri,
    websiteUri: place.websiteUri,
    phoneNumber: place.phoneNumber,
    photos: (place.photos || []).slice(0, 3).map((photo) => ({
      photoUri: photo.photoUri || "",
      width: photo.width,
      height: photo.height,
      attributions: photo.attributions || []
    })),
    reviews: (place.reviews || [])
      .filter((review) => review.text)
      .slice(0, 5)
      .map((review) => ({
        authorName: review.authorName,
        authorUri: review.authorUri,
        rating: review.rating,
        relativeTime: review.relativeTime,
        text: trimReview(review.text),
        googleMapsUri: review.googleMapsUri
      }))
  };
}

function trimReview(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > 280 ? `${clean.slice(0, 277)}...` : clean;
}
