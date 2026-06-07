import { createHash } from "node:crypto";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY sao obrigatorios.");
}
if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY e obrigatoria.");
}

const requiredDestinations = [
  {
    slug: "japaratinga",
    name: "Japaratinga",
    state: "AL",
    country: "Brasil",
    latitude: -9.0898,
    longitude: -35.2579,
    macro_region: "Litoral de Alagoas",
    destination_scope: "city",
    destination_types: ["praia", "resort", "familia"],
    short_description: "Praia alagoana mais tranquila, boa para familias que buscam mar calmo e resort sem ritmo de cidade grande.",
    family_summary: "Funciona muito bem para familias quando a hospedagem resolve piscina, refeicoes e praia sem grandes deslocamentos."
  },
  {
    slug: "ibiuna",
    name: "Ibiuna",
    state: "SP",
    country: "Brasil",
    latitude: -23.6564,
    longitude: -47.2225,
    macro_region: "Interior de Sao Paulo",
    destination_scope: "city",
    destination_types: ["resort", "natureza", "fim_de_semana"],
    short_description: "Destino de carro perto de Sao Paulo, forte para descanso, natureza e resort com rotina facil para criancas.",
    family_summary: "Boa opcao para familias que querem estrutura completa sem aeroporto e com deslocamento previsivel."
  }
];

const requiredHotels = [
  {
    key: "japaratinga-lounge-resort",
    destinationSlug: "japaratinga",
    query: "Japaratinga Lounge Resort",
    fallbackName: "Japaratinga Lounge Resort"
  },
  {
    key: "rio-quente-resort-hotel-turismo",
    destinationSlug: "rio-quente",
    query: "Rio Quente Resorts Hotel Turismo",
    fallbackName: "Rio Quente Resorts - Refugio Grand Premium - Antigo Hotel Turismo"
  },
  {
    key: "bendito-cacao-aguas-lindoia",
    destinationSlug: "aguas-de-lindoia",
    query: "Bendito Cacao Resort Spa Aguas de Lindoia",
    fallbackName: "Bendito Cacao Family Resort"
  },
  {
    key: "iberostar-selection-praia-do-forte",
    destinationSlug: "praia-do-forte",
    query: "Iberostar Selection Praia do Forte",
    fallbackName: "Iberostar Selection Praia do Forte"
  },
  {
    key: "casa-grande-guaruja",
    destinationSlug: "guaruja",
    query: "Casa Grande Hotel Resort Spa Guaruja",
    fallbackName: "Casa Grande Hotel Resort & Spa"
  },
  {
    key: "clara-ibiuna",
    destinationSlug: "ibiuna",
    query: "Clara Resort Ibiuna",
    fallbackName: "Clara Ibiuna Resort"
  },
  {
    key: "taua-atibaia",
    destinationSlug: "atibaia",
    query: "Taua Resort Atibaia",
    fallbackName: "Taua Resort & Convention Atibaia"
  },
  {
    key: "hotel-villa-rossa",
    destinationSlug: "sao-roque",
    query: "Hotel Vila Rossa Sao Roque",
    fallbackName: "Hotel Villa Rossa"
  }
];

const stats = {
  dryRun: DRY_RUN,
  createdDestinations: 0,
  createdHotels: 0,
  updatedHotels: 0,
  notFound: [],
  verified: []
};

let destinations = await fetchAll("destinations", "id,slug,name,city,state,country,is_active,latitude,longitude");
for (const destination of requiredDestinations) {
  const existing = destinations.find((item) => item.slug === destination.slug);
  if (!existing) {
    const created = await insertRow("destinations", {
      ...destination,
      is_active: true,
      is_mvp_priority: true,
      mvp_priority: 1,
      is_placeholder: false
    });
    destinations.push(created);
    stats.createdDestinations += 1;
  }
}

const hotels = await fetchAll("destination_hotels", "id,destination_id,liteapi_id,name,address,city,country,source");
const existingLiteApiIds = new Set(hotels.map((hotel) => hotel.liteapi_id).filter(Boolean));

for (const requiredHotel of requiredHotels) {
  const destination = destinations.find((item) => item.slug === requiredHotel.destinationSlug);
  if (!destination) throw new Error(`Destino nao encontrado: ${requiredHotel.destinationSlug}`);

  const place = await googleHotel(requiredHotel.query);
  if (!place) {
    stats.notFound.push(requiredHotel.query);
    continue;
  }

  const existing = hotels.find(
    (hotel) =>
      hotel.destination_id === destination.id &&
      (normalizeKey(hotel.name) === normalizeKey(place.name) ||
        normalizeKey(hotel.name) === normalizeKey(requiredHotel.fallbackName) ||
        normalizeKey(hotel.name).includes(normalizeKey(requiredHotel.fallbackName).slice(0, 18)))
  );
  const row = hotelRow(destination, place, requiredHotel);

  if (existing) {
    await updateRow("destination_hotels", existing.id, row);
    stats.updatedHotels += 1;
    stats.verified.push({ status: "updated", destination: destination.slug, hotel: place.name });
  } else {
    const created = await insertRow("destination_hotels", row);
    hotels.push(created);
    stats.createdHotels += 1;
    stats.verified.push({ status: "created", destination: destination.slug, hotel: place.name });
  }
}

console.log(JSON.stringify(stats, null, 2));

async function googleHotel(query) {
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
    "places.internationalPhoneNumber",
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
      pageSize: 3,
      includedType: "lodging"
    })
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Google Places retornou ${response.status}`);
  }
  const place = (json.places || []).find((item) => looksLikeLodging(item));
  if (!place) return null;
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
    phone: place.internationalPhoneNumber || "",
    photoName: place.photos?.[0]?.name || ""
  };
}

function hotelRow(destination, place, requiredHotel) {
  return {
    destination_id: destination.id,
    liteapi_id: uniqueLiteApiId(destination, place, requiredHotel.key),
    name: place.name,
    stars: null,
    liteapi_rating: place.rating,
    review_count: place.reviewCount,
    address: place.address,
    city: destination.name,
    country: destination.country || "Brasil",
    latitude: place.latitude,
    longitude: place.longitude,
    main_photo: "",
    thumbnail: "",
    chain: null,
    source: "google_places_internal_curation",
    last_synced_at: new Date().toISOString(),
    description: [
      "Curadoria interna: hotel/resort informado como visitado pela familia fundadora.",
      "Fonte operacional: Google Places.",
      `Google place_id: ${place.id}.`,
      place.googleMapsUri ? `Google Maps: ${place.googleMapsUri}` : "",
      place.websiteUri ? `Site: ${place.websiteUri}` : "",
      place.phone ? `Telefone: ${place.phone}` : "",
      place.photoName ? `Google photo reference: ${place.photoName}` : ""
    ]
      .filter(Boolean)
      .join(" ")
  };
}

function uniqueLiteApiId(destination, place, stableKey) {
  const hash = createHash("sha1").update(`${place.id}:${destination.id}:${stableKey}`).digest("hex").slice(0, 18);
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
  const text = `${place.displayName?.text || ""} ${place.types?.join(" ") || ""}`.toLowerCase();
  return /hotel|lodging|resort|pousada|inn|hostel|apart|flat|villa|accommodation/.test(text);
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

async function insertRow(table, row) {
  if (DRY_RUN) return { id: `dry-run-${table}-${Date.now()}`, ...row };
  const response = await fetch(restUrl(table), {
    method: "POST",
    headers: { ...restHeaders(), Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  if (!response.ok) throw new Error(`Supabase insert ${table} retornou ${response.status}: ${await response.text()}`);
  const [created] = await response.json();
  return created;
}

async function updateRow(table, id, row) {
  if (DRY_RUN) return;
  const response = await fetch(restUrl(table, { id: `eq.${id}` }), {
    method: "PATCH",
    headers: { ...restHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
  if (!response.ok) throw new Error(`Supabase update ${table} retornou ${response.status}: ${await response.text()}`);
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

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
