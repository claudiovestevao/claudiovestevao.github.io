import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = numberArg("--limit", 0);
const MIN_HOTELS = numberArg("--min-hotels", 3);
const PER_DESTINATION = numberArg("--per-destination", 3);
const SLEEP_MS = numberArg("--sleep-ms", 140);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
}
if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY e obrigatoria.");
}

const stats = {
  dryRun: DRY_RUN,
  minHotels: MIN_HOTELS,
  destinations: 0,
  targetsBelowMinimum: 0,
  processed: 0,
  insertedHotels: 0,
  skippedExisting: 0,
  notFound: 0,
  errors: []
};

const destinations = await fetchAll("destinations", "id,slug,name,city,state,country,is_active", { is_active: "eq.true" });
const existingHotels = await fetchAll("destination_hotels", "id,destination_id,name,city,country,liteapi_id");
const counts = new Map();
const existingKeys = new Set();
const existingLiteApiIds = new Set();

for (const destination of destinations) counts.set(destination.id, 0);
for (const hotel of existingHotels) {
  if (!hotel.destination_id) continue;
  counts.set(hotel.destination_id, (counts.get(hotel.destination_id) || 0) + 1);
  existingKeys.add(hotelKey(hotel.destination_id, hotel.name));
  if (hotel.liteapi_id) existingLiteApiIds.add(hotel.liteapi_id);
}

const targetDestinations = destinations
  .filter((destination) => (counts.get(destination.id) || 0) < MIN_HOTELS)
  .sort((a, b) => destinationPriority(a) - destinationPriority(b));

stats.destinations = destinations.length;
stats.targetsBelowMinimum = targetDestinations.length;

const batch = LIMIT ? targetDestinations.slice(0, LIMIT) : targetDestinations;
for (const destination of batch) {
  stats.processed += 1;
  try {
    const needed = Math.max(0, MIN_HOTELS - (counts.get(destination.id) || 0));
    const places = await findLodgingPlaces(destination, Math.max(needed, PER_DESTINATION));
    const rows = [];
    for (const place of places) {
      if (rows.length >= needed) break;
      const key = hotelKey(destination.id, place.name);
      if (existingKeys.has(key)) {
        stats.skippedExisting += 1;
        continue;
      }
      rows.push(hotelRow(destination, place));
      existingKeys.add(key);
    }
    if (!rows.length) {
      stats.notFound += 1;
    } else {
      await insertRows("destination_hotels", rows);
      stats.insertedHotels += rows.length;
      counts.set(destination.id, (counts.get(destination.id) || 0) + rows.length);
    }
    await sleep(SLEEP_MS);
  } catch (error) {
    stats.errors.push({ slug: destination.slug, name: destination.city || destination.name, message: error.message });
  }
}

const afterCounts = await hotelCoverage();
console.log(JSON.stringify({ ...stats, coverageAfter: afterCounts }, null, 2));

async function findLodgingPlaces(destination, limit) {
  const label = placeLabel(destination);
  const queries = [
    `best family hotels ${label}`,
    `hotel family ${label}`,
    `family friendly resort ${label}`,
    `melhores hoteis para familia em ${label}`,
    `resort para criancas ${label}`,
    `pousada familia ${label}`,
    `lodging family hotel resort ${label}`
  ];
  const found = [];
  const seen = new Set();
  for (const query of queries) {
    const results = await googleTextSearch(query, Math.min(20, Math.max(10, limit + 4)));
    for (const place of results) {
      if (!place.id || seen.has(place.id)) continue;
      if (!looksLikeLodging(place)) continue;
      seen.add(place.id);
      found.push(place);
      if (found.length >= limit) return found;
    }
    await sleep(Math.max(50, Math.round(SLEEP_MS / 2)));
  }
  return found;
}

async function googleTextSearch(query, pageSize) {
  const fieldMask = [
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.types",
    "places.location",
    "places.googleMapsUri",
    "places.websiteUri",
    "places.photos"
  ].join(",");
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY.trim(),
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "pt-BR",
      pageSize,
      includedType: "lodging"
    })
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Google Places retornou ${response.status}`);
  }
  return (json.places || []).map(normalizePlace);
}

function normalizePlace(place) {
  return {
    id: place.id,
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    types: place.types || [],
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    googleMapsUri: place.googleMapsUri || "",
    websiteUri: place.websiteUri || "",
    photoName: place.photos?.[0]?.name || ""
  };
}

function hotelRow(destination, place) {
  return {
    destination_id: destination.id,
    liteapi_id: uniqueLiteApiId(destination, place),
    name: place.name,
    stars: null,
    liteapi_rating: place.rating,
    review_count: place.reviewCount,
    address: place.address,
    city: destination.city || destination.name,
    country: destination.country || "Brasil",
    latitude: place.latitude,
    longitude: place.longitude,
    main_photo: "",
    thumbnail: "",
    description: [
      "Fonte: Google Places live enrichment.",
      place.googleMapsUri ? `Google Maps: ${place.googleMapsUri}` : "",
      place.websiteUri ? `Site: ${place.websiteUri}` : "",
      place.photoName ? `Google photo reference: ${place.photoName}` : ""
    ].filter(Boolean).join(" ")
  };
}

function uniqueLiteApiId(destination, place) {
  const hash = createHash("sha1").update(`${place.id}:${destination.id}`).digest("hex").slice(0, 18);
  const base = `google:${hash}`;
  if (!existingLiteApiIds.has(base)) {
    existingLiteApiIds.add(base);
    return base;
  }
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}:${index}`;
    if (!existingLiteApiIds.has(candidate)) {
      existingLiteApiIds.add(candidate);
      return candidate;
    }
  }
  throw new Error(`Nao foi possivel gerar liteapi_id unico para ${place.name}`);
}

function looksLikeLodging(place) {
  const text = `${place.name} ${place.types?.join(" ")}`.toLowerCase();
  return /hotel|lodging|resort|pousada|inn|hostel|apart|flat|villa|chal[eé]|accommodation/.test(text);
}

async function hotelCoverage() {
  const [activeDestinations, hotels] = await Promise.all([
    fetchAll("destinations", "id,slug,city,name,state,country,is_active", { is_active: "eq.true" }),
    fetchAll("destination_hotels", "destination_id")
  ]);
  const grouped = new Map(activeDestinations.map((destination) => [destination.id, 0]));
  for (const hotel of hotels) {
    if (grouped.has(hotel.destination_id)) grouped.set(hotel.destination_id, grouped.get(hotel.destination_id) + 1);
  }
  const buckets = { zero: 0, one: 0, two: 0, three: 0, moreThanThree: 0 };
  for (const count of grouped.values()) {
    if (count === 0) buckets.zero += 1;
    else if (count === 1) buckets.one += 1;
    else if (count === 2) buckets.two += 1;
    else if (count === 3) buckets.three += 1;
    else buckets.moreThanThree += 1;
  }
  return buckets;
}

async function fetchAll(table, select = "*", filters = {}) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const url = restUrl(table, { select, ...filters, limit: pageSize, offset: from });
    const response = await fetch(url, { headers: restHeaders() });
    if (!response.ok) throw new Error(`Supabase ${table} retornou ${response.status}: ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function insertRows(table, rows) {
  if (DRY_RUN || !rows.length) return;
  const response = await fetch(restUrl(table), {
    method: "POST",
    headers: { ...restHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!response.ok) throw new Error(`Supabase insert ${table} retornou ${response.status}: ${await response.text()}`);
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

function placeLabel(destination) {
  return [destination.city || destination.name, destination.state, destination.country].filter(Boolean).join(", ");
}

function hotelKey(destinationId, name) {
  return `${destinationId}|${normalizeKey(name)}`;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function destinationPriority(destination) {
  if (destination.country && !/brasil|brazil|br/i.test(destination.country)) return 4;
  if (destination.state === "SP") return 1;
  if (["RJ", "MG", "PR", "SC", "RS", "GO", "MS", "BA", "AL", "PE", "CE", "RN"].includes(destination.state)) return 2;
  return 3;
}

function numberArg(name, fallback) {
  const value = process.argv.find((arg) => arg.startsWith(`${name}=`))?.split("=")[1];
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
