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

const SOURCE_LABEL = "Melhores Destinos editorial audit";

const candidates = [
  ["japaratinga", "Japaratinga", "AL", "Japaratinga Lounge Resort", "ranking_resorts_2025_2026"],
  ["maragogi", "Maragogi", "AL", "Salinas Maragogi All Inclusive Resort", "ranking_resorts_2025_2026"],
  ["porto-de-galinhas", "Porto de Galinhas", "PE", "Nannai Resort & Spa Muro Alto", "ranking_resorts_2025_2026"],
  ["maceio", "Maceio", "AL", "Salinas Maceio All Inclusive Resort", "ranking_resorts_2025_2026"],
  ["cesario-lange", "Cesario Lange", "SP", "Mavsa Resort Cesario Lange", "ranking_resorts_2025_2026"],
  ["buzios", "Armacao dos Buzios", "RJ", "Zendaya Resort Beach Sport & Spa Buzios", "ranking_resorts_2025_2026"],
  ["aquiraz", "Aquiraz", "CE", "Carmel Charme Resort Aquiraz", "ranking_resorts_2025_2026"],
  ["porto-de-galinhas", "Porto de Galinhas", "PE", "Viva Porto de Galinhas Resort", "ranking_resorts_2025_2026"],
  ["una-comandatuba", "Una", "BA", "Transamerica Comandatuba All Inclusive Resort Una Bahia", "ranking_resorts_2025_2026"],
  ["trancoso", "Trancoso", "BA", "Club Med Trancoso", "ranking_resorts_2025_2026"],
  ["porto-de-galinhas", "Porto de Galinhas", "PE", "Summerville All Inclusive Resort Porto de Galinhas", "ranking_resorts_2025_2026"],
  ["iretama", "Iretama", "PR", "Jurema Aguas Quentes Resort Iretama", "ranking_resorts_2025_2026"],
  ["gramado", "Gramado", "RS", "Buona Vitta Gramado Resort & Spa", "ranking_resorts_2025_2026"],
  ["mangaratiba", "Mangaratiba", "RJ", "Club Med Rio das Pedras Mangaratiba", "ranking_resorts_2025_2026"],
  ["gramado", "Gramado", "RS", "Laghetto Resort Golden Gramado", "ranking_resorts_2025_2026"],
  ["campos-do-jordao", "Campos do Jordao", "SP", "Bendito Cacao Resort & Spa Campos do Jordao", "hoteis_tematicos_criancas"],
  ["gramado", "Gramado", "RS", "Mundo Criamigos Gramado", "hoteis_tematicos_criancas"],
  ["gramado", "Gramado", "RS", "Chocoland Hotel Gramado", "hoteis_tematicos_criancas"],
  ["gramado", "Gramado", "RS", "Hotel Laghetto Acampamento do Sr Laghettinho Gramado", "hoteis_tematicos_criancas"],
  ["foz-do-iguacu", "Foz do Iguacu", "PR", "Bourbon Thermas Eco Resort Cataratas do Iguacu", "hoteis_tematicos_criancas"],
  ["florianopolis", "Florianopolis", "SC", "Costao do Santinho Resort All Inclusive Florianopolis", "all_inclusive_2026"],
  ["mata-de-sao-joao", "Mata de Sao Joao", "BA", "Sauipe Grand Premium Brisa All Inclusive", "all_inclusive_2026"],
  ["imbassai", "Imbassai", "BA", "Grand Palladium Imbassai Resort & Spa", "all_inclusive_2026"],
  ["porto-de-galinhas", "Porto de Galinhas", "PE", "The Westin Porto de Galinhas All-Inclusive Resort", "all_inclusive_2026"],
  ["cumbuco", "Cumbuco", "CE", "Vila Gale Cumbuco Resort All Inclusive", "all_inclusive_2026"],
  ["touros", "Touros", "RN", "Vila Gale Touros Resort All Inclusive", "all_inclusive_2026"],
  ["porto-seguro", "Porto Seguro", "BA", "La Torre Resort All Inclusive Porto Seguro", "all_inclusive_2026"],
  ["chapada-dos-guimaraes", "Chapada dos Guimaraes", "MT", "Malai Manso Resort Chapada dos Guimaraes", "all_inclusive_2026"],
  ["angra-dos-reis", "Angra dos Reis", "RJ", "Vila Gale Eco Resort de Angra", "all_inclusive_2026"],
  ["barra-de-santo-antonio", "Barra de Santo Antonio", "AL", "Vila Gale Alagoas Barra de Santo Antonio", "all_inclusive_2026"],
  ["maragogi", "Maragogi", "AL", "Grand Oca Maragogi All Inclusive Resort", "all_inclusive_2026"],
  ["mogi-das-cruzes", "Mogi das Cruzes", "SP", "Club Med Lake Paradise Mogi das Cruzes", "all_inclusive_2026"],
  ["maceio", "Maceio", "AL", "Maceio Mar Resort", "all_inclusive_2026"],
  ["porto-seguro", "Porto Seguro", "BA", "Nauticomar Resort All Inclusive & Beach Club Porto Seguro", "porto_seguro_all_inclusive"],
  ["porto-seguro", "Porto Seguro", "BA", "Coroa Vermelha Beach All Inclusive Porto Seguro", "porto_seguro_all_inclusive"],
  ["porto-seguro", "Porto Seguro", "BA", "Ondas Praia Resort by WAM Experience Porto Seguro", "porto_seguro_all_inclusive"]
].map(([destinationSlug, destinationName, state, query, source]) => ({
  destinationSlug,
  destinationName,
  state,
  query,
  source
}));

const stats = {
  dryRun: DRY_RUN,
  candidates: candidates.length,
  createdDestinations: 0,
  createdHotels: 0,
  updatedHotels: 0,
  skippedNoGoogleMatch: [],
  processed: []
};

let destinations = await fetchAll("destinations", "id,slug,name,city,state,country,is_active,latitude,longitude");
let hotels = await fetchAll("destination_hotels", "id,destination_id,liteapi_id,name,address,city,country,source,description");
const existingLiteApiIds = new Set(hotels.map((hotel) => hotel.liteapi_id).filter(Boolean));

for (const candidate of candidates) {
  let destination = destinations.find((item) => item.slug === candidate.destinationSlug);
  if (!destination) {
    const created = await insertRow("destinations", {
      slug: candidate.destinationSlug,
      name: candidate.destinationName,
      city: null,
      state: candidate.state,
      country: "Brasil",
      macro_region: regionalLabel(candidate.state),
      destination_scope: "city",
      destination_types: ["resort", "familia"],
      short_description: `Destino priorizado por auditoria editorial de resorts familiares: ${candidate.destinationName}.`,
      family_summary: "Entrada criada para hospedar curadoria de resorts familiares com validacao via Google Places.",
      is_active: true,
      is_mvp_priority: true,
      mvp_priority: 1,
      is_placeholder: false
    });
    destinations.push(created);
    destination = created;
    stats.createdDestinations += 1;
  }

  const place = await googleHotel(candidate);
  if (!place) {
    stats.skippedNoGoogleMatch.push(candidate.query);
    continue;
  }

  const existing = hotels.find(
    (hotel) =>
      hotel.destination_id === destination.id &&
      (normalizeKey(hotel.name) === normalizeKey(place.name) ||
        normalizeKey(hotel.name).includes(normalizeKey(place.name).slice(0, 18)) ||
        normalizeKey(place.name).includes(normalizeKey(hotel.name).slice(0, 18)))
  );
  const row = hotelRow(destination, place, candidate);

  if (existing) {
    await updateRow("destination_hotels", existing.id, row);
    stats.updatedHotels += 1;
    stats.processed.push({ status: "updated", destination: destination.slug, hotel: place.name });
  } else {
    const created = await insertRow("destination_hotels", row);
    hotels.push(created);
    stats.createdHotels += 1;
    stats.processed.push({ status: "created", destination: destination.slug, hotel: place.name });
  }
}

console.log(JSON.stringify(stats, null, 2));

async function googleHotel(candidate) {
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
      textQuery: candidate.query,
      languageCode: "pt-BR",
      pageSize: 5,
      includedType: "lodging"
    })
  });
  const json = await response.json();
  if (!response.ok || json.error) {
    throw new Error(json.error?.message || `Google Places retornou ${response.status}`);
  }
  const place = (json.places || [])
    .filter((item) => looksLikeLodging(item))
    .sort((a, b) => placeScore(b, candidate) - placeScore(a, candidate))[0];
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

function placeScore(place, candidate) {
  const text = `${place.displayName?.text || ""} ${place.formattedAddress || ""} ${place.websiteUri || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  let score = Number(place.userRatingCount || 0) / 1000 + Number(place.rating || 0);
  if (text.includes(candidate.state.toLowerCase())) score += 10;
  for (const part of candidate.destinationName.toLowerCase().split(/\s+/)) {
    if (part.length > 3 && text.includes(part.normalize("NFD").replace(/[\u0300-\u036f]/g, ""))) score += 4;
  }
  if (text.includes("reservas") && !text.includes(candidate.destinationName.toLowerCase())) score -= 20;
  return score;
}

function hotelRow(destination, place, candidate) {
  return {
    destination_id: destination.id,
    liteapi_id: uniqueLiteApiId(destination, place, candidate.query),
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
    source: "google_places_melhores_destinos_audit",
    last_synced_at: new Date().toISOString(),
    description: [
      `${SOURCE_LABEL}: ${candidate.source}.`,
      "Dado operacional validado via Google Places; nao usar esta nota como garantia de disponibilidade ou preco.",
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
  if (DRY_RUN) return { id: `dry-run-${table}-${Date.now()}-${Math.random()}`, ...row };
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

function regionalLabel(state) {
  if (["SP", "RJ", "MG", "ES"].includes(state)) return "Sudeste";
  if (["AL", "BA", "CE", "PE", "RN"].includes(state)) return "Nordeste";
  if (["PR", "SC", "RS"].includes(state)) return "Sul";
  if (["GO", "MT", "MS"].includes(state)) return "Centro-Oeste";
  return "Brasil";
}
