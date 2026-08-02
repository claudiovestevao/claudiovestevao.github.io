import { NextResponse } from "next/server";
import { appConfig } from "@/lib/config";
import { authorizeBearerSecret, rateLimitRequest } from "@/lib/server-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { hasGoogleMaps, searchGooglePlacesText } from "@/lib/integrations/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limited = rateLimitRequest(request, { bucket: "family-curation-hotels", limit: 60, windowMs: 60 * 1000 });
  if (limited) return limited;

  const auth = authorizeBearerSecret(request, appConfig.familyCurationAdminPassword, {
    headerName: "x-admin-password",
    serviceName: "Admin"
  });
  if (!auth.ok) return auth.response;

  const destinationId = String(searchParams.get("destinationId") || "").trim();
  if (!destinationId) {
    return NextResponse.json({ ok: false, message: "Informe destinationId." }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  if (!client || !appConfig.supabaseServiceRoleKey) {
    return NextResponse.json({ ok: false, message: "Supabase service role nao configurado no servidor." }, { status: 503 });
  }

  const { data: destination, error: destinationError } = await client
    .from("destinations")
    .select("id,slug,name,city,state,country")
    .eq("id", destinationId)
    .single();

  if (destinationError || !destination) {
    return NextResponse.json({ ok: false, message: "Destino nao encontrado." }, { status: 404 });
  }

  const [localHotels, hotelCards] = await Promise.all([
    client
      .from("destination_hotels")
      .select("id,destination_id,name,address,city,country,latitude,longitude,liteapi_id,liteapi_rating,review_count,source,description")
      .eq("destination_id", destinationId)
      .limit(100),
    client
      .from("destination_hotel_cards")
      .select("destination_slug,destination_name,liteapi_id,hotel_name,stars,liteapi_rating,review_count,address,main_photo,thumbnail,latitude,longitude,description")
      .or(`destination_slug.eq.${destination.slug},destination_name.ilike.${escapeIlike(destination.city || destination.name)}`)
      .limit(100)
  ]);

  const cardByLiteApi = new Map((hotelCards.data || [])
    .filter((card) => card.liteapi_id)
    .map((card) => [String(card.liteapi_id), card]));
  const merged = [];
  for (const hotel of localHotels.data || []) {
    const card = cardByLiteApi.get(String(hotel.liteapi_id || "")) || null;
    merged.push({
      id: hotel.id,
      source: "supabase",
      destinationId,
      liteapiId: hotel.liteapi_id || "",
      name: hotel.name,
      address: hotel.address || card?.address || "",
      city: hotel.city || destination.city || destination.name,
      country: hotel.country || destination.country || "Brasil",
      latitude: hotel.latitude || card?.latitude || null,
      longitude: hotel.longitude || card?.longitude || null,
      stars: card?.stars ?? null,
      rating: hotel.liteapi_rating ?? card?.liteapi_rating ?? null,
      reviewCount: hotel.review_count ?? card?.review_count ?? null,
      source: hotel.source || "supabase",
      description: hotel.description || card?.description || "",
      image: card?.thumbnail || card?.main_photo || ""
    });
  }

  for (const card of hotelCards.data || []) {
    if (merged.some((hotel) => normalizeKey(hotel.name) === normalizeKey(card.hotel_name))) continue;
    merged.push({
      id: `card:${card.liteapi_id || normalizeKey(card.hotel_name)}`,
      source: "supabase_card",
      destinationId,
      liteapiId: card.liteapi_id || "",
      name: card.hotel_name,
      address: card.address || "",
      city: destination.city || destination.name,
      country: destination.country || "Brasil",
      latitude: card.latitude || null,
      longitude: card.longitude || null,
      stars: card.stars ?? null,
      rating: card.liteapi_rating ?? null,
      reviewCount: card.review_count ?? null,
      description: card.description || "",
      image: card.thumbnail || card.main_photo || ""
    });
  }

  let googleHotels = [];
  let googleWarning = "";
  if (hasGoogleMaps()) {
    try {
      const query = `${destination.city || destination.name}, ${destination.state}, ${destination.country || "Brasil"} hotel resort pousada familia criancas`;
      const places = await searchGooglePlacesText({ query, pageSize: 10, includedType: "lodging" });
      googleHotels = places
        .filter((place) => place.placeId && !merged.some((hotel) => normalizeKey(hotel.name) === normalizeKey(place.name)))
        .slice(0, 10)
        .map((place) => ({
          id: `google:${place.placeId}`,
          source: "google_places_live",
          destinationId,
          googlePlaceId: place.placeId,
          name: place.name,
          address: place.formattedAddress || "",
          city: destination.city || destination.name,
          country: destination.country || "Brasil",
          latitude: place.latitude,
          longitude: place.longitude,
          stars: null,
          rating: place.rating,
          reviewCount: place.userRatingCount,
          description: "Hotel retornado ao vivo pelo Google Places para curadoria interna.",
          image: "",
          googleMapsUri: place.googleMapsUri,
          websiteUri: place.websiteUri
        }));
    } catch (error) {
      googleWarning = error.message || "Google Places indisponivel.";
    }
  }

  const hotels = [...merged, ...googleHotels]
    .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0) || String(a.name).localeCompare(String(b.name), "pt-BR"));

  return NextResponse.json({
    ok: true,
    destination: {
      id: destination.id,
      slug: destination.slug,
      name: destination.city || destination.name,
      state: destination.state,
      country: destination.country || "Brasil"
    },
    hotels,
    warnings: [
      localHotels.error ? `destination_hotels: ${localHotels.error.message}` : "",
      hotelCards.error ? `destination_hotel_cards: ${hotelCards.error.message}` : "",
      googleWarning
    ].filter(Boolean)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}

function escapeIlike(value) {
  return `%${String(value || "").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
