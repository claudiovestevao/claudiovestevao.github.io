import {
  computeGoogleRouteFromSp,
  getGooglePlaceDetails,
  searchGooglePlacesText
} from "../apps/web/lib/integrations/google.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = numberArg("--limit", 0);
const HOTEL_LIMIT = numberArg("--hotel-limit", 0);
const SLEEP_MS = numberArg("--sleep-ms", 120);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
}
if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY e obrigatoria.");
}

const stats = {
  dryRun: DRY_RUN,
  destinations: 0,
  destinationPlacesInserted: 0,
  destinationPlacesSkippedExisting: 0,
  destinationPlacesNotFound: 0,
  routesInserted: 0,
  routesSkippedExisting: 0,
  routesNotApplicable: 0,
  hotels: 0,
  hotelPlacesInserted: 0,
  hotelPlacesSkippedExisting: 0,
  hotelPlacesNotFound: 0,
  destinationCoordinatesUpdated: 0,
  errors: []
};

const destinations = await fetchAll("destinations", "id,slug,name,city,state,country,latitude,longitude,is_active,is_placeholder", { is_active: "eq.true" });
const existingGooglePlaces = await fetchAll("destination_google_places", "destination_id,google_place_id,place_type,is_primary");
const existingRoutes = await fetchAll("destination_sp_route", "destination_id,google_status");
const hotels = await fetchAll("destination_hotels", "id,destination_id,name,address,city,country,latitude,longitude,liteapi_id");

const existingPlaceIds = new Set(existingGooglePlaces.map((row) => row.google_place_id).filter(Boolean));
const destinationsWithPrimary = new Set(existingGooglePlaces.filter((row) => row.is_primary).map((row) => row.destination_id));
const destinationsWithRoute = new Set(existingRoutes.map((row) => row.destination_id));

const destinationBatch = LIMIT ? destinations.slice(0, LIMIT) : destinations;
for (const destination of destinationBatch) {
  stats.destinations += 1;
  try {
    if (destinationsWithPrimary.has(destination.id)) {
      stats.destinationPlacesSkippedExisting += 1;
    } else {
      const place = await findDestinationPlace(destination);
      if (!place?.placeId) {
        stats.destinationPlacesNotFound += 1;
      } else if (existingPlaceIds.has(place.placeId)) {
        stats.destinationPlacesSkippedExisting += 1;
      } else {
        await insertGooglePlace(destination, place, { placeType: "destination", isPrimary: true });
        existingPlaceIds.add(place.placeId);
        stats.destinationPlacesInserted += 1;
        if (shouldUpdateDestinationCoordinates(destination, place)) {
          await updateDestinationCoordinates(destination, place);
          stats.destinationCoordinatesUpdated += 1;
          destination.latitude = place.latitude;
          destination.longitude = place.longitude;
        }
      }
      await sleep(SLEEP_MS);
    }

    if (destinationsWithRoute.has(destination.id)) {
      stats.routesSkippedExisting += 1;
    } else {
      const routeRow = await routeRowForDestination(destination);
      await insertRows("destination_sp_route", [routeRow]);
      stats.routesInserted += 1;
      if (routeRow.google_status !== "OK") stats.routesNotApplicable += 1;
      await sleep(SLEEP_MS);
    }
  } catch (error) {
    stats.errors.push({ entity: "destination", slug: destination.slug, message: error.message });
  }
}

const hotelBatch = HOTEL_LIMIT ? hotels.slice(0, HOTEL_LIMIT) : hotels;
for (const hotel of hotelBatch) {
  stats.hotels += 1;
  try {
    const query = [hotel.name, hotel.city || hotel.address, hotel.country || "Brasil"].filter(Boolean).join(", ");
    const place = await findBestPlace(query, "lodging");
    if (!place?.placeId) {
      stats.hotelPlacesNotFound += 1;
    } else if (existingPlaceIds.has(place.placeId)) {
      stats.hotelPlacesSkippedExisting += 1;
    } else {
      await insertGooglePlace({ id: hotel.destination_id }, place, { placeType: "lodging", isPrimary: false });
      existingPlaceIds.add(place.placeId);
      stats.hotelPlacesInserted += 1;
    }
    await sleep(SLEEP_MS);
  } catch (error) {
    stats.errors.push({ entity: "hotel", name: hotel.name, message: error.message });
  }
}

console.log(JSON.stringify(stats, null, 2));

async function findDestinationPlace(destination) {
  const query = [destination.city || destination.name, destination.state, destination.country].filter(Boolean).join(", ");
  return findBestPlace(query);
}

async function findBestPlace(query, includedType = "") {
  const results = await searchGooglePlacesText({ query, pageSize: 1, includedType });
  const first = results[0];
  if (!first?.placeId) return null;
  return getGooglePlaceDetails(first.placeId);
}

async function insertGooglePlace(destination, place, { placeType, isPrimary }) {
  const familyReviews = familyRelevantReviews(place.reviews || []);
  const row = {
    destination_id: destination.id,
    google_place_id: place.placeId,
    place_name: place.name,
    place_type: placeType,
    formatted_address: place.formattedAddress,
    google_rating: place.rating,
    google_ratings_total: place.userRatingCount,
    latitude: place.latitude,
    longitude: place.longitude,
    is_primary: isPrimary,
    family_reviews_summary: familyReviewSummary(familyReviews),
    family_review_count: familyReviews.length,
    latest_reviews: (place.reviews || []).slice(0, 5).map((review) => ({
      author_name: review.authorName,
      author_url: review.authorUri,
      rating: review.rating,
      relative_time_description: review.relativeTime,
      publish_time: review.publishTime,
      text: review.text,
      google_maps_uri: review.googleMapsUri,
      language: review.languageCode
    })),
    review_language: "pt-BR",
    source: "google-places-live",
    last_synced_at: new Date().toISOString(),
    family_editorial_summary: editorialSummary(place, familyReviews)
  };
  await insertRows("destination_google_places", [row]);
}

async function routeRowForDestination(destination) {
  if (!isBrazil(destination.country) || !Number.isFinite(Number(destination.latitude)) || !Number.isFinite(Number(destination.longitude))) {
    return {
      destination_id: destination.id,
      origin_label: "São Paulo (capital)",
      google_status: "NOT_APPLICABLE",
      source: "google-routes-live",
      last_synced_at: new Date().toISOString()
    };
  }
  const route = await computeGoogleRouteFromSp(destination).catch((error) => ({ status: "ERROR", message: error.message }));
  if (route.status !== "OK") {
    return {
      destination_id: destination.id,
      origin_label: "São Paulo (capital)",
      google_status: route.status || "ZERO_RESULTS",
      source: "google-routes-live",
      last_synced_at: new Date().toISOString()
    };
  }
  return {
    destination_id: destination.id,
    origin_label: "São Paulo (capital)",
    distance_km: route.distanceKm,
    distance_text: `${route.distanceKm.toLocaleString("pt-BR")} km`,
    drive_minutes: route.driveMinutes,
    drive_text: route.driveText,
    drive_minutes_traffic: route.driveMinutes,
    drive_text_traffic: route.driveText,
    google_status: "OK",
    source: "google-routes-live",
    last_synced_at: new Date().toISOString()
  };
}

function familyRelevantReviews(reviews) {
  return reviews
    .filter((review) => /fam[ií]lia|crian[cç]a|filh|beb[eê]|kids|recrea|piscina|restaurante|aliment/i.test(review.text || ""))
    .slice(0, 5);
}

function familyReviewSummary(reviews) {
  if (!reviews.length) return "Sem comentários familiares textuais recentes retornados pelo Google no momento da consulta.";
  const positive = reviews.filter((review) => Number(review.rating || 0) >= 4).length;
  const warning = reviews.find((review) => Number(review.rating || 0) <= 2);
  const tone = positive >= Math.ceil(reviews.length / 2)
    ? "A maioria dos comentários familiares textuais recentes é positiva."
    : "Os comentários familiares recentes pedem leitura cuidadosa antes de reservar.";
  return warning
    ? `${tone} Há pelo menos um alerta recente de família que merece atenção.`
    : tone;
}

function editorialSummary(place, reviews) {
  const rating = place.rating ? `nota Google ${place.rating}` : "nota Google indisponível";
  const total = place.userRatingCount ? `${place.userRatingCount.toLocaleString("pt-BR")} avaliações` : "volume de avaliações indisponível";
  const familySignal = reviews.length ? `${reviews.length} comentário(s) textual(is) com sinal familiar` : "sem comentário textual familiar recente retornado";
  return `${place.name} tem ${rating}, ${total} e ${familySignal}. Fonte: Google Places em tempo real.`;
}

function shouldUpdateDestinationCoordinates(destination, place) {
  if (!Number.isFinite(Number(place.latitude)) || !Number.isFinite(Number(place.longitude))) return false;
  if (!destination.city) return !Number.isFinite(Number(destination.latitude)) || !Number.isFinite(Number(destination.longitude));
  if (!Number.isFinite(Number(destination.latitude)) || !Number.isFinite(Number(destination.longitude))) return true;
  return haversineKm(destination.latitude, destination.longitude, place.latitude, place.longitude) > 80;
}

async function updateDestinationCoordinates(destination, place) {
  await patchRows("destinations", {
    latitude: place.latitude,
    longitude: place.longitude,
    updated_at: new Date().toISOString()
  }, { id: `eq.${destination.id}` });
}

async function fetchAll(table, select = "*", filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = { select, ...filters };
    const url = restUrl(table, query);
    const response = await fetch(`${url}&limit=${pageSize}&offset=${from}`, { headers: restHeaders() });
    if (!response.ok) throw new Error(`Supabase ${table} retornou ${response.status}: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function insertRows(table, rows) {
  if (DRY_RUN || !rows.length) return null;
  const response = await fetch(restUrl(table), {
    method: "POST",
    headers: { ...restHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Supabase insert ${table} retornou ${response.status}: ${await response.text()}`);
  return null;
}

async function patchRows(table, values, filters) {
  if (DRY_RUN) return null;
  const response = await fetch(restUrl(table, filters), {
    method: "PATCH",
    headers: { ...restHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(values)
  });
  if (!response.ok) throw new Error(`Supabase patch ${table} retornou ${response.status}: ${await response.text()}`);
  return null;
}

function restUrl(table, query = {}) {
  const url = new URL(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}

function restHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json"
  };
}

function numberArg(name, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function isBrazil(country = "") {
  return /brasil|brazil|br/i.test(String(country));
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (value) => Number(value) * Math.PI / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2) - toRad(lat1);
  const dLon = toRad(lon2) - toRad(lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(a));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
