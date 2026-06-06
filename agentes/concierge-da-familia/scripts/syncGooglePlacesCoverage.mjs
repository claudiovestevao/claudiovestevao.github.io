import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { conciergeDestinations } from "../src/data/conciergeFamilyDestinations.js";
import { conciergeHotels } from "../src/data/conciergeFamilyHotels.js";
import { conciergeHotelAdditions } from "../src/data/conciergeFamilyHotelAdditions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const cachePath = path.join(root, ".cache", "google-places-coverage.json");
const outputPath = path.join(root, "src", "data", "conciergeGooglePlacesCoverage.js");
const apiKey = process.env.GOOGLE_MAPS_API_KEY;

if (!apiKey) {
  console.error("GOOGLE_MAPS_API_KEY is required. Keep it in the environment, never in frontend code.");
  process.exit(1);
}

const hotels = [...conciergeHotels, ...conciergeHotelAdditions];
const destinationOverrides = {
  "resort-interior-sp": { query: "Atibaia SP Brasil", coverageType: "curated_area", includedType: "locality" },
  "hotel-fazenda-sp": { query: "Dourado SP Brasil", coverageType: "curated_area", includedType: "locality" },
  "campos-do-jordao": { query: "Campos do Jordao SP Brasil", coverageType: "city", includedType: "locality" },
  "sao-roque": { query: "Sao Roque SP Brasil", coverageType: "city", includedType: "locality" },
  "atibaia": { query: "Atibaia SP Brasil", coverageType: "city", includedType: "locality" },
  "olimpia": { query: "Olimpia SP Brasil", coverageType: "city", includedType: "locality" },
  "litoral-norte-sp": { query: "Guaruja SP Brasil", coverageType: "curated_area", includedType: "locality" },
  "praia-do-forte": { query: "Praia do Forte Bahia Brasil", coverageType: "city", includedType: "locality" },
  "porto-de-galinhas": { query: "Porto de Galinhas PE Brasil", coverageType: "city", includedType: "locality" },
  "maceio-maragogi": { query: "Maragogi AL Brasil", coverageType: "curated_area", includedType: "locality" },
  "foz-do-iguacu": { query: "Foz do Iguacu PR Brasil", coverageType: "city", includedType: "locality" },
  "gramado": { query: "Gramado RS Brasil", coverageType: "city", includedType: "locality" },
  "beto-carrero-penha": { query: "Penha SC Brasil", coverageType: "city", includedType: "locality" },
  "buenos-aires": { query: "Buenos Aires Argentina", coverageType: "city", includedType: "locality" },
  "orlando": { query: "Orlando Florida United States", coverageType: "city", includedType: "locality" }
};

const editorialDestinationTargets = conciergeDestinations.map(destination => {
  const override = destinationOverrides[destination.id] || {};
  return {
    entityType: "destination",
    id: destination.id,
    name: destination.name,
    query: override.query || `${destination.name} Brasil turismo familia`,
    coverageType: override.coverageType || "destination",
    includedType: override.includedType || null
  };
});

const hotelDestinationTargets = uniqueBy(
  hotels
    .filter(hotel => hotel.destination)
    .map(hotel => ({
      entityType: "destination",
      id: slugForId(hotel.destination),
      name: hotel.destination,
      query: destinationQueryFromHotel(hotel.destination),
      coverageType: "hotel_city",
      includedType: "locality"
    })),
  target => target.id
);

const destinationTargets = uniqueBy([...editorialDestinationTargets, ...hotelDestinationTargets], target => target.id);

const hotelTargets = hotels.map(hotel => ({
  entityType: "hotel",
  id: hotel.id,
  name: hotel.name,
  destination: hotel.destination,
  query: `${hotel.name} ${hotel.destination || ""}`,
  coverageType: "establishment"
}));

const targets = [...destinationTargets, ...hotelTargets];
const cache = await readJson(cachePath, {});
const results = [];
const failures = [];

for (const target of targets) {
  const cacheKey = `${target.entityType}:${target.id}:${target.query}`;
  const cached = cache[cacheKey];
  if (cached?.placeId && cached?.syncedAt) {
    results.push({ ...cached, cached: true });
    continue;
  }
  try {
    const place = await searchPlace(target);
    const normalized = normalizePlace(target, place);
    cache[cacheKey] = normalized;
    results.push(normalized);
    await sleep(120);
  } catch (error) {
    const failed = {
      entityType: target.entityType,
      id: target.id,
      name: target.name,
      query: target.query,
      coverageType: target.coverageType,
      includedType: target.includedType || null,
      coverageStatus: "missing",
      error: error.message,
      syncedAt: new Date().toISOString()
    };
    cache[cacheKey] = failed;
    results.push(failed);
    failures.push(failed);
  }
}

await mkdir(path.dirname(cachePath), { recursive: true });
await writeFile(cachePath, JSON.stringify(cache, null, 2), "utf8");

const coverage = {
  generatedAt: new Date().toISOString(),
  source: "google_places_api",
  total: results.length,
  covered: results.filter(item => item.coverageStatus === "covered").length,
  missing: results.filter(item => item.coverageStatus !== "covered").length,
  destinations: results.filter(item => item.entityType === "destination"),
  hotels: results.filter(item => item.entityType === "hotel")
};

await writeFile(outputPath, `export const conciergeGooglePlacesCoverage = ${JSON.stringify(coverage, null, 2)};\n`, "utf8");

console.log(JSON.stringify({
  total: coverage.total,
  covered: coverage.covered,
  missing: coverage.missing,
  destinationCoverage: `${coverage.destinations.filter(item => item.coverageStatus === "covered").length}/${coverage.destinations.length}`,
  hotelCoverage: `${coverage.hotels.filter(item => item.coverageStatus === "covered").length}/${coverage.hotels.length}`,
  failures: failures.map(item => ({ id: item.id, name: item.name, error: item.error }))
}, null, 2));

async function searchPlace(target) {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id",
        "places.name",
        "places.displayName",
        "places.formattedAddress",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "places.location",
        "places.websiteUri",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.photos"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: target.query,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize: 3,
      ...(target.includedType ? { includedType: target.includedType } : {})
    })
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error?.message || `Google Places ${response.status}`);
  const places = json.places || [];
  if (!places.length) throw new Error("Nenhum place retornado");
  return chooseBestPlace(target, places);
}

function chooseBestPlace(target, places) {
  const targetName = normalizeText(target.name);
  return places
    .map(place => {
      const display = place.displayName?.text || "";
      const normalizedDisplay = normalizeText(display);
      const ratingCount = Number(place.userRatingCount || 0);
      let score = ratingCount / 1000;
      if (normalizedDisplay.includes(targetName) || targetName.includes(normalizedDisplay)) score += 8;
      if (target.entityType === "hotel" && (place.types || []).some(type => ["lodging", "hotel"].includes(type))) score += 4;
      if (target.entityType === "destination" && (place.types || []).some(type => ["locality", "tourist_attraction", "administrative_area_level_2"].includes(type))) score += 2;
      return { place, score };
    })
    .sort((a, b) => b.score - a.score)[0].place;
}

function normalizePlace(target, place) {
  const photos = (place.photos || []).slice(0, 5).map(photo => ({
    name: photo.name,
    width: photo.widthPx || null,
    height: photo.heightPx || null
  }));
  return {
    entityType: target.entityType,
    id: target.id,
    name: target.name,
    destination: target.destination || null,
    query: target.query,
    coverageType: target.coverageType,
    includedType: target.includedType || null,
    coverageStatus: "covered",
    placeId: place.id,
    googleResourceName: place.name,
    googleName: place.displayName?.text || "",
    formattedAddress: place.formattedAddress || "",
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    categories: place.types || [],
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    websiteUri: place.websiteUri || null,
    phoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    photos,
    syncedAt: new Date().toISOString()
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  items.forEach(item => {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  });
  return [...map.values()];
}

function destinationQueryFromHotel(destination) {
  const value = String(destination || "").trim();
  if (/argentina/i.test(value)) return value;
  if (/,\s*FL\b/i.test(value)) return `${value} United States`;
  return `${value} Brasil`;
}

function slugForId(value) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
