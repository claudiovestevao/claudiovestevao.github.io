import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, context) {
  const params = await context.params;
  const slug = String(params?.slug || "").trim();
  const { searchParams } = new URL(request.url);
  const tripMoment = String(searchParams.get("moment") || "");
  const limit = Math.max(1, Math.min(6, Number.parseInt(searchParams.get("limit") || "3", 10) || 3));

  if (!slug) {
    return NextResponse.json({ ok: false, message: "Informe o destino." }, { status: 400 });
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return NextResponse.json({ ok: false, message: "Supabase nao configurado." }, { status: 503 });
  }

  const { data: destination, error: destinationError } = await client
    .from("destinations")
    .select("id,slug,name,city,state,country")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (destinationError || !destination) {
    return NextResponse.json({ ok: false, message: "Destino nao encontrado." }, { status: 404 });
  }

  const [accommodationsResult, localHotelsResult, hotelCardsResult] = await Promise.all([
    client
      .from("accommodations")
      .select(`
        id,slug,name,property_type,price_tier,official_site_url,booking_url,address,neighborhood,latitude,longitude,
        departure_mode,drive_time_from_sao_paulo_minutes,recommended_airport,transfer_minutes,direct_flight_from_sao_paulo,
        has_family_rooms,has_connecting_rooms,has_crib,has_kids_club,has_kids_pool,has_heated_pool,has_pool,
        has_kitchenette,babysitting_available,kids_eat_free,baby_meals_available,stroller_friendly,laundry_available,
        parking_available,has_copa_baby,has_copa_baby_24h,all_inclusive,calm_beach,recreation_available,works_on_rainy_day,
        min_child_age_months,ideal_age,family_score,family_notes,main_strength,attention_point,source_urls,source_highlights,
        confidence_level,is_placeholder,last_verified_at,place_id,google_rating,google_ratings_total,google_website,google_phone,
        minimum_family_requirements_passed,api_data,curated_data,ai_calculated_data
      `)
      .eq("destination_id", destination.id)
      .limit(50),
    client
      .from("destination_hotels")
      .select("id,destination_id,name,address,city,country,latitude,longitude,liteapi_id,liteapi_rating,review_count,source,description")
      .eq("destination_id", destination.id)
      .limit(80),
    client
      .from("destination_hotel_cards")
      .select("destination_slug,destination_name,liteapi_id,hotel_name,stars,liteapi_rating,review_count,address,main_photo,thumbnail,latitude,longitude,description")
      .or(`destination_slug.eq.${destination.slug},destination_name.ilike.${escapeIlike(destination.city || destination.name)}`)
      .limit(80)
  ]);

  const hotelCards = hotelCardsResult.data || [];
  const cardByLiteApi = new Map(hotelCards.filter((card) => card.liteapi_id).map((card) => [String(card.liteapi_id), card]));
  const candidates = [
    ...(accommodationsResult.data || []).map((row) => normalizeAccommodation(row, destination, tripMoment)),
    ...(localHotelsResult.data || []).map((row) => normalizeLocalHotel(row, destination, cardByLiteApi, tripMoment)),
    ...hotelCards.map((row) => normalizeHotelCard(row, destination, tripMoment))
  ];

  const hotels = dedupeHotels(candidates)
    .filter((hotel) => hotel.name)
    .sort((a, b) => hotelRankingScore(b) - hotelRankingScore(a) || String(a.name).localeCompare(String(b.name), "pt-BR"))
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    source: "supabase_family_hotels",
    destination: {
      slug: destination.slug,
      name: destination.city || destination.name,
      state: destination.state,
      country: destination.country || "Brasil"
    },
    tripMoment,
    hotels,
    warnings: [
      accommodationsResult.error ? `accommodations: ${accommodationsResult.error.message}` : "",
      localHotelsResult.error ? `destination_hotels: ${localHotelsResult.error.message}` : "",
      hotelCardsResult.error ? `destination_hotel_cards: ${hotelCardsResult.error.message}` : ""
    ].filter(Boolean)
  }, {
    headers: { "Cache-Control": "private, no-store" }
  });
}

function normalizeAccommodation(row, destination, tripMoment) {
  const rating = Number(row.google_rating || row.api_data?.rating || 0) || null;
  const reviewCount = Number(row.google_ratings_total || row.api_data?.userRatingCount || 0) || null;
  const bookingUrl = row.booking_url || bookingSearchUrl(row.name, destination);
  const directUrl = row.official_site_url || row.google_website || row.source_urls?.[0] || "";
  return {
    id: row.id,
    source: "curated_accommodation",
    name: row.name,
    propertyType: stayLabel(row.property_type),
    priceTier: row.price_tier || "mid",
    priceRange: priceRangeFor(row.price_tier || "mid", tripMoment, row.all_inclusive),
    priceNote: priceNoteFor(row.price_tier || "mid", tripMoment, row.all_inclusive),
    rating,
    reviewCount,
    familyScore: Number(row.family_score || 0) ? Math.round(Number(row.family_score) * 10) : null,
    confidenceLevel: row.confidence_level || "medium",
    address: row.address || "",
    image: row.api_data?.photoUri || row.curated_data?.image || "",
    bookingUrl,
    directUrl,
    availabilityUrl: bookingUrl || directUrl,
    availabilityLabel: "Ver disponibilidade e preço",
    familyAmenities: familyAmenitiesFromAccommodation(row),
    babyStructure: babyStructureLabel(row),
    kidsStructure: kidsStructureLabel(row),
    mainStrength: row.main_strength || row.family_notes || "Boa opção quando a estrutura do hotel combina com a rotina da família.",
    attentionPoint: row.attention_point || "Confirmar política para crianças, refeições e disponibilidade antes de reservar.",
    verified: ["verified", "high"].includes(row.confidence_level),
    allInclusive: Boolean(row.all_inclusive),
    minimumFamilyRequirementsPassed: Boolean(row.minimum_family_requirements_passed || row.family_score >= 7.3),
    lastVerifiedAt: row.last_verified_at || null
  };
}

function normalizeLocalHotel(row, destination, cardByLiteApi, tripMoment) {
  const card = cardByLiteApi.get(String(row.liteapi_id || "")) || null;
  const description = [row.description, card?.description].filter(Boolean).join(" ");
  const inferredTier = inferPriceTier(description, row.name);
  return {
    id: row.id,
    source: row.source || "destination_hotels",
    name: row.name || card?.hotel_name || "",
    propertyType: inferPropertyType(row.name, description),
    priceTier: inferredTier,
    priceRange: priceRangeFor(inferredTier, tripMoment, /all inclusive/i.test(description)),
    priceNote: priceNoteFor(inferredTier, tripMoment, /all inclusive/i.test(description)),
    rating: row.liteapi_rating ?? card?.liteapi_rating ?? null,
    reviewCount: row.review_count ?? card?.review_count ?? null,
    familyScore: null,
    confidenceLevel: "medium",
    address: row.address || card?.address || "",
    image: card?.thumbnail || card?.main_photo || "",
    bookingUrl: bookingSearchUrl(row.name || card?.hotel_name, destination),
    directUrl: extractFirstUrl(description, /Site:\s*(https?:\/\/\S+)/i),
    availabilityUrl: bookingSearchUrl(row.name || card?.hotel_name, destination),
    availabilityLabel: "Ver disponibilidade e preço",
    familyAmenities: familyAmenitiesFromText(description),
    babyStructure: babyStructureFromText(description),
    kidsStructure: kidsStructureFromText(description),
    mainStrength: shortHotelStrength(description, row.name),
    attentionPoint: "Estrutura infantil, tarifa e disponibilidade precisam ser confirmadas no momento da reserva.",
    verified: false,
    allInclusive: /all inclusive/i.test(description),
    minimumFamilyRequirementsPassed: true,
    lastVerifiedAt: null
  };
}

function normalizeHotelCard(row, destination, tripMoment) {
  const inferredTier = inferPriceTier(row.description, row.hotel_name);
  return {
    id: `card:${row.liteapi_id || slugify(row.hotel_name)}`,
    source: "destination_hotel_cards",
    name: row.hotel_name,
    propertyType: inferPropertyType(row.hotel_name, row.description),
    priceTier: inferredTier,
    priceRange: priceRangeFor(inferredTier, tripMoment, /all inclusive/i.test(row.description || "")),
    priceNote: priceNoteFor(inferredTier, tripMoment, /all inclusive/i.test(row.description || "")),
    rating: row.liteapi_rating ?? null,
    reviewCount: row.review_count ?? null,
    familyScore: null,
    confidenceLevel: "medium",
    address: row.address || "",
    image: row.thumbnail || row.main_photo || "",
    bookingUrl: bookingSearchUrl(row.hotel_name, destination),
    directUrl: "",
    availabilityUrl: bookingSearchUrl(row.hotel_name, destination),
    availabilityLabel: "Ver disponibilidade e preço",
    familyAmenities: familyAmenitiesFromText(row.description || ""),
    babyStructure: babyStructureFromText(row.description || ""),
    kidsStructure: kidsStructureFromText(row.description || ""),
    mainStrength: shortHotelStrength(row.description, row.hotel_name),
    attentionPoint: "Hotel elegível para comparação; confirme estrutura infantil diretamente antes de reservar.",
    verified: false,
    allInclusive: /all inclusive/i.test(row.description || ""),
    minimumFamilyRequirementsPassed: true,
    lastVerifiedAt: null
  };
}

function hotelRankingScore(hotel) {
  let score = 0;
  score += Number(hotel.familyScore || 0) * 2;
  score += Number(hotel.rating || 0) * 14;
  score += Math.min(28, Math.log10(Number(hotel.reviewCount || 0) + 1) * 10);
  score += hotel.verified ? 24 : 0;
  score += hotel.minimumFamilyRequirementsPassed ? 12 : -30;
  score += hotel.familyAmenities.length * 4;
  if (hotel.allInclusive) score += 5;
  return score;
}

function dedupeHotels(hotels) {
  const unique = [];
  for (const hotel of hotels.sort((a, b) => hotelRankingScore(b) - hotelRankingScore(a))) {
    const key = compactHotelKey(hotel.name);
    if (!key || unique.some((existing) => compactHotelKey(existing.name) === key || isSimilarHotel(existing.name, hotel.name))) continue;
    unique.push(hotel);
  }
  return unique;
}

function familyAmenitiesFromAccommodation(row) {
  const items = [
    row.has_crib ? "berço" : "",
    row.has_copa_baby || row.has_copa_baby_24h ? "copa baby" : "",
    row.baby_meals_available ? "papinha/menu infantil" : "",
    row.has_kids_club ? "kids club" : "",
    row.recreation_available ? "recreação" : "",
    row.has_kids_pool ? "piscina infantil" : "",
    row.has_heated_pool ? "piscina aquecida" : "",
    row.has_family_rooms ? "quarto família" : "",
    row.has_kitchenette ? "kitchenette" : "",
    row.stroller_friendly ? "carrinho ok" : "",
    row.works_on_rainy_day ? "bom na chuva" : "",
    row.all_inclusive ? "all inclusive" : ""
  ].filter(Boolean);
  return [...new Set(items)].slice(0, 6);
}

function familyAmenitiesFromText(text = "") {
  const normalized = normalizeText(text);
  const items = [
    hasAny(normalized, ["berco", "crib"]) ? "berço" : "",
    hasAny(normalized, ["copa baby", "baby copa", "papinha"]) ? "copa baby" : "",
    hasAny(normalized, ["kids club", "clubinho", "turma da monica"]) ? "kids club" : "",
    hasAny(normalized, ["recreacao", "monitoria"]) ? "recreação" : "",
    hasAny(normalized, ["piscina infantil", "kids pool", "acqua kids"]) ? "piscina infantil" : "",
    hasAny(normalized, ["all inclusive"]) ? "all inclusive" : ""
  ].filter(Boolean);
  return items.length ? [...new Set(items)].slice(0, 6) : ["estrutura a confirmar"];
}

function babyStructureLabel(row) {
  const items = [
    row.has_crib ? "berço" : "",
    row.has_copa_baby || row.has_copa_baby_24h ? "copa baby" : "",
    row.baby_meals_available ? "papinhas/menu infantil" : "",
    row.has_kitchenette ? "apoio para refeições" : ""
  ].filter(Boolean);
  return items.length ? items.join(", ") : "confirmar berço, copa baby e alimentação";
}

function kidsStructureLabel(row) {
  const items = [
    row.has_kids_club ? "kids club" : "",
    row.recreation_available ? "recreação" : "",
    row.has_kids_pool ? "piscina infantil" : "",
    row.works_on_rainy_day ? "plano B na chuva" : ""
  ].filter(Boolean);
  return items.length ? items.join(", ") : "confirmar recreação e piscina infantil";
}

function babyStructureFromText(text = "") {
  const amenities = familyAmenitiesFromText(text);
  const baby = amenities.filter((item) => ["berço", "copa baby", "papinha/menu infantil"].includes(item));
  return baby.length ? baby.join(", ") : "confirmar berço/copa baby";
}

function kidsStructureFromText(text = "") {
  const amenities = familyAmenitiesFromText(text);
  const kids = amenities.filter((item) => ["kids club", "recreação", "piscina infantil", "all inclusive"].includes(item));
  return kids.length ? kids.join(", ") : "confirmar recreação infantil";
}

function priceRangeFor(priceTier = "mid", tripMoment = "", allInclusive = false) {
  const base = {
    budget: [650, 1100],
    mid: [950, 1700],
    upscale: [1500, 2800],
    luxury: [2400, 4600]
  }[priceTier] || [950, 1700];
  const multiplier = seasonalMultiplier(tripMoment);
  const inclusiveBump = allInclusive ? 1.12 : 1;
  return `~${formatMoney(base[0] * multiplier * inclusiveBump)}-${formatMoney(base[1] * multiplier * inclusiveBump)}/noite`;
}

function priceNoteFor(priceTier = "mid", tripMoment = "", allInclusive = false) {
  const season = {
    carnival: "Carnaval costuma pressionar tarifas.",
    june_festivals: "Junho pode variar bastante por evento local.",
    winter: "Inverno/férias de julho costuma subir em destinos de serra.",
    christmas_lights: "Natal e eventos de luz costumam ter alta demanda.",
    long_vacation: "Férias longas pedem checagem de pacote e aéreo."
  }[tripMoment] || "Faixa estimada sem consulta real de disponibilidade.";
  return `${season}${allInclusive ? " All inclusive reduz custo variável com refeições." : ""}`;
}

function seasonalMultiplier(tripMoment) {
  if (["carnival", "christmas_lights"].includes(tripMoment)) return 1.35;
  if (["winter", "long_vacation"].includes(tripMoment)) return 1.25;
  if (["long_weekend", "june_festivals"].includes(tripMoment)) return 1.15;
  return 1;
}

function inferPriceTier(description = "", name = "") {
  const text = normalizeText(`${name} ${description}`);
  if (hasAny(text, ["luxury", "premium", "seleccion", "ecoresort", "casagrande", "clara"])) return "luxury";
  if (hasAny(text, ["resort", "all inclusive", "spa", "bourbon", "taua", "iberostar", "salinas", "club med"])) return "upscale";
  if (hasAny(text, ["pousada", "apart", "flat", "chale"])) return "mid";
  return "mid";
}

function inferPropertyType(name = "", description = "") {
  const text = normalizeText(`${name} ${description}`);
  if (text.includes("resort")) return "Resort";
  if (text.includes("pousada")) return "Pousada";
  if (hasAny(text, ["chale", "cabana"])) return "Chalé";
  if (hasAny(text, ["apart", "flat"])) return "Apart-hotel";
  return "Hotel";
}

function shortHotelStrength(description = "", name = "") {
  const text = String(description || "").replace(/\s+/g, " ").trim();
  if (text && text.length > 60) return text.slice(0, 180);
  if (/resort/i.test(name)) return "Boa opção para comparar quando a família quer lazer concentrado e estrutura no próprio hotel.";
  return "Boa opção para comparar com base em avaliação pública, localização e aderência familiar.";
}

function bookingSearchUrl(hotelName, destination) {
  const ss = [hotelName, destination.city || destination.name, destination.state, destination.country || "Brasil"].filter(Boolean).join(", ");
  return `https://www.booking.com/searchresults.pt-br.html?ss=${encodeURIComponent(ss)}`;
}

function extractFirstUrl(text = "", pattern) {
  return String(text || "").match(pattern)?.[1]?.replace(/[),.;]+$/, "") || "";
}

function escapeIlike(value) {
  return `%${String(value || "").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
}

function stayLabel(type = "") {
  const labels = {
    hotel: "Hotel",
    resort: "Resort",
    hotel_fazenda: "Hotel fazenda",
    pousada: "Pousada",
    apart_hotel: "Apart-hotel",
    flat: "Flat",
    chale: "Chalé",
    cabana: "Cabana",
    casa_temporada: "Casa de temporada"
  };
  return labels[type] || type || "Hospedagem";
}

function formatMoney(value) {
  const rounded = Math.round(Number(value || 0) / 100) / 10;
  return `R$ ${rounded.toLocaleString("pt-BR", { minimumFractionDigits: rounded % 1 ? 1 : 0, maximumFractionDigits: 1 })}k`;
}

function compactHotelKey(value) {
  return normalizeText(value)
    .replace(/\b(hotel|resort|pousada|spa|all|inclusive|beach|lounge|suites?|apart|flat|fazenda)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "");
}

function isSimilarHotel(a, b) {
  const left = compactHotelKey(a);
  const right = compactHotelKey(b);
  return left && right && (left.includes(right) || right.includes(left));
}

function slugify(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAny(text, terms) {
  return terms.some((term) => text.includes(term));
}
