import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../src/data");
const OUTPUT_FILE = path.join(DATA_DIR, "conciergeDestinationImages.js");
const SQL_OUTPUT_FILE = path.resolve(__dirname, "../../../supabase/migrations/0016_seed_destination_images.sql");
const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";

const targets = [
  { key: "resort-interior-sp", destinationName: "Campinas", city: "Campinas", state: "Sao Paulo", country: "Brasil", category: "resort", context: "family travel" },
  { key: "atibaia", destinationName: "Atibaia", city: "Atibaia", state: "Sao Paulo", country: "Brasil", category: "natureza", context: "family travel" },
  { key: "hotel-fazenda-sp", destinationName: "Dourado", city: "Dourado", state: "Sao Paulo", country: "Brasil", category: "campo", context: "family travel" },
  { key: "campos-do-jordao", destinationName: "Campos do Jordao", city: "Campos do Jordao", state: "Sao Paulo", country: "Brasil", category: "montanha", context: "family travel" },
  { key: "sao-roque", destinationName: "Sao Roque", city: "Sao Roque", state: "Sao Paulo", country: "Brasil", category: "natureza", context: "family travel" },
  { key: "olimpia", destinationName: "Olimpia", city: "Olimpia", state: "Sao Paulo", country: "Brasil", category: "parque aquatico", context: "family travel" },
  { key: "litoral-norte-sp", destinationName: "Guaruja", city: "Guaruja", state: "Sao Paulo", country: "Brasil", category: "praia", context: "family travel" },
  { key: "praia-do-forte", destinationName: "Praia do Forte", city: "Mata de Sao Joao", state: "Bahia", country: "Brasil", category: "praia", context: "family travel" },
  { key: "porto-de-galinhas", destinationName: "Porto de Galinhas", city: "Ipojuca", state: "Pernambuco", country: "Brasil", category: "praia", context: "family travel" },
  { key: "maceio-maragogi", destinationName: "Maragogi", city: "Maragogi", state: "Alagoas", country: "Brasil", category: "praia", context: "family travel" },
  { key: "foz-do-iguacu", destinationName: "Foz do Iguacu", city: "Foz do Iguacu", state: "Parana", country: "Brasil", category: "natureza", context: "family travel" },
  { key: "gramado", destinationName: "Gramado", city: "Gramado", state: "Rio Grande do Sul", country: "Brasil", category: "montanha", context: "family travel" },
  { key: "beto-carrero-penha", destinationName: "Penha", city: "Penha", state: "Santa Catarina", country: "Brasil", category: "parque", context: "family travel" },
  { key: "buenos-aires", destinationName: "Buenos Aires", city: "Buenos Aires", state: "Buenos Aires", country: "Argentina", category: "cidade", context: "family travel" },
  { key: "orlando", destinationName: "Orlando", city: "Orlando", state: "Florida", country: "Estados Unidos", category: "parque", context: "family travel" }
];

const apiKey = process.env.PEXELS_API_KEY;

if (!apiKey) {
  console.error("PEXELS_API_KEY is required. Keep it in the environment, never in frontend code.");
  process.exit(1);
}

const existingCache = readExistingCache();
const approvedCache = new Map(
  existingCache
    .filter(isUsableApproved)
    .map(item => [cacheKey(item), item])
);

const results = [];

for (const target of targets) {
  const cached = approvedCache.get(cacheKey(target));
  if (cached) {
    results.push({ ...cached, cached: true });
    continue;
  }

  try {
    const image = await getDestinationImage(target);
    results.push(image || placeholderRecord(target));
  } catch (error) {
    console.error(`Image lookup failed for ${target.key}: ${error.message}`);
    results.push(placeholderRecord(target));
  }
}

writeImageBank(results);
console.log(`Wrote ${results.length} destination image records to ${OUTPUT_FILE}`);

export async function getDestinationImage(input) {
  const queries = buildQueries(input);
  let best = null;

  for (const query of queries) {
    const photos = await searchPexels(query);
    for (const photo of photos) {
      const candidate = normalizePhoto(photo, input, query);
      if (!candidate) continue;
      if (!best || candidate.confidenceScore > best.confidenceScore) best = candidate;
      if (candidate.status === "auto_approved") return candidate;
    }
  }

  if (best?.confidenceScore >= 50) return best;
  return null;
}

function buildQueries(input) {
  const destination = input.destinationName;
  const city = input.city || input.destinationName;
  const state = input.state || "";
  const country = input.country || "";
  const unaccentedDestination = removeAccents(destination);
  const unaccentedCity = removeAccents(city);
  const unaccentedState = removeAccents(state);
  const queries = [
    `${destination} ${country}`,
    `${unaccentedDestination} ${country}`,
    `${city} ${state} ${country}`,
    `${unaccentedCity} ${unaccentedState} ${country}`,
    `${destination} tourism`,
    `${destination} travel`,
    `${destination} family travel`,
    `${destination} landscape`,
    `${destination} city`,
    `${destination} landmark`
  ];

  if (country.toLowerCase().includes("brasil")) {
    queries.push(
      `${destination} Brasil`,
      `${city} turismo`,
      `${city} viagem`,
      `${city} paisagem`,
      `${city} centro historico`,
      `${city} ponto turistico`
    );
  }

  if (input.key === "campos-do-jordao") {
    queries.push(
      "Campos do Jordao Brazil",
      "Campos do Jordao Brasil",
      "Campos do Jordao Sao Paulo Brazil",
      "Campos do Jordao mountains",
      "Campos do Jordao winter",
      "Campos do Jordao architecture",
      "Vila Capivari Campos do Jordao",
      "Serra da Mantiqueira Brazil",
      "Mantiqueira mountains Brazil",
      "Brazil mountain town"
    );
  }

  if (["praia", "coast", "beach"].some(term => input.category.toLowerCase().includes(term))) {
    queries.push(`${destination} beach`, `${destination} coast`, `${destination} ocean`, `${city} praia`, `${city} litoral`);
  }

  if (["montanha", "mountain"].some(term => input.category.toLowerCase().includes(term))) {
    queries.push(`${destination} mountains`, `${destination} winter`, `${destination} nature`, `${destination} landscape`);
  }

  if (["historico", "historic", "cidade"].some(term => input.category.toLowerCase().includes(term))) {
    queries.push(`${destination} historic center`, `${destination} old town`, `${destination} architecture`, `${destination} church`, `${city} centro historico`);
  }

  return unique(queries.map(query => query.replace(/\s+/g, " ").trim()).filter(Boolean));
}

async function searchPexels(query) {
  const url = new URL(PEXELS_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "large");
  url.searchParams.set("per_page", "15");
  url.searchParams.set("page", "1");
  url.searchParams.set("locale", "pt-BR");

  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) throw new Error(`Pexels returned ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.photos) ? payload.photos : [];
}

function normalizePhoto(photo, input, query) {
  if (!photo?.src) return null;
  if (photo.width < 1200 || photo.width <= photo.height) return null;

  const alt = photo.alt || "";
  const sourceText = `${alt} ${photo.url || ""}`;
  const imageUrl = photo.src.large2x || photo.src.large || photo.src.original;
  const thumbnailUrl = photo.src.medium || photo.src.small || imageUrl;
  const confidenceScore = scorePhoto({ photo, input, query, alt });
  const status = imageStatus({ input, query, alt: sourceText, confidenceScore });

  return {
    key: input.key,
    destinationName: input.destinationName,
    city: input.city,
    state: input.state,
    country: input.country,
    category: input.category,
    context: input.context,
    queryUsed: query,
    imageUrl,
    thumbnailUrl,
    source: "pexels",
    authorName: photo.photographer,
    authorUrl: photo.photographer_url,
    originalUrl: photo.url,
    license: "Pexels License",
    attributionRequired: false,
    attributionText: `Foto por ${photo.photographer} via Pexels`,
    width: photo.width,
    height: photo.height,
    alt,
    confidenceScore,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function scorePhoto({ photo, input, query, alt }) {
  const normalizedQuery = removeAccents(query.toLowerCase());
  const normalizedAlt = removeAccents(`${alt} ${photo.url || ""}`.toLowerCase());
  const destination = removeAccents(input.destinationName.toLowerCase());
  const city = removeAccents((input.city || "").toLowerCase());
  const country = removeAccents((input.country || "").toLowerCase());
  const category = removeAccents((input.category || "").toLowerCase());
  let score = 0;

  if (normalizedQuery.includes(destination)) score += 25;
  if (city && normalizedQuery.includes(city)) score += 20;
  if (country && normalizedQuery.includes(country)) score += 15;
  if (photo.width >= 1600) score += 15;
  if (photo.width > photo.height) score += 10;
  if (alt) score += 10;
  if (["beach", "praia", "mountain", "montanha", "historic", "tourism", "travel", "nature", "landscape"].some(term => normalizedQuery.includes(term))) score += 5;
  if (alt && looksLikeDifferentPlace(normalizedAlt, input)) score -= 30;
  if (alt && looksGeneric(normalizedAlt, category)) score -= 20;
  if (alt && hasMisleadingTerms(normalizedAlt, category)) score -= 40;

  return Math.max(0, Math.min(100, score));
}

function looksLikeDifferentPlace(alt, input) {
  const country = removeAccents((input.country || "").toLowerCase());
  const city = removeAccents((input.city || "").toLowerCase());
  const destination = removeAccents((input.destinationName || "").toLowerCase());
  const knownOtherPlaces = [
    "italy", "france", "spain", "greece", "portugal", "mexico", "california", "new york", "paris", "rome", "venice", "lisbon",
    "brasilia", "curitiba", "porto seguro", "arraial d'ajuda", "arraial da ajuda", "arraial do cabo", "sao paulo", "rio de janeiro", "florianopolis", "ubatuba",
    "america do norte", "north america",
    "estadio olimpico metropolitano"
  ];
  const allowedSpecific = [city, destination].filter(Boolean);
  if (knownOtherPlaces.some(place => alt.includes(place)) && !allowedSpecific.some(place => alt.includes(place))) return true;
  if (allowedSpecific.some(place => alt.includes(place))) return false;
  return false;
}

function looksGeneric(alt, category) {
  const generic = ["person", "woman", "man", "people", "model", "food", "table", "bedroom", "office", "casa de repouso", "nursing home"];
  if (generic.some(term => alt.includes(term))) return true;
  if (category.includes("praia") && !strongBeachTerms().some(term => alt.includes(term))) return true;
  return false;
}

function imageStatus({ input, query, alt, confidenceScore }) {
  const normalizedAlt = removeAccents(String(alt || "").toLowerCase());
  if (looksLikeDifferentPlace(normalizedAlt, input)) return "rejected";
  if (hasMisleadingTerms(normalizedAlt, removeAccents((input.category || "").toLowerCase()))) return "rejected";
  if (confidenceScore >= 65 && hasApprovalEvidence({ input, query, alt })) return "auto_approved";
  if (confidenceScore >= 50) return "pending_review";
  return "rejected";
}

function isUsableApproved(item) {
  if (!["approved", "auto_approved"].includes(item.status)) return false;
  return imageStatus({
    input: item,
    query: item.queryUsed || "",
    alt: `${item.alt || ""} ${item.originalUrl || ""}`,
    confidenceScore: item.confidenceScore || 0
  }) === "auto_approved";
}

function hasApprovalEvidence({ input, query, alt }) {
  const normalizedAlt = removeAccents(String(alt || "").toLowerCase());
  const normalizedQuery = removeAccents(String(query || "").toLowerCase());
  const destination = removeAccents((input.destinationName || "").toLowerCase());
  const city = removeAccents((input.city || "").toLowerCase());
  const category = removeAccents((input.category || "").toLowerCase());
  const exactQuery = [destination, city].filter(Boolean).some(term => normalizedQuery.includes(term));
  const exactAlt = [destination, city].filter(Boolean).some(term => normalizedAlt.includes(term));
  if (exactAlt) return true;
  if (!exactQuery) return false;
  return hasCategoryEvidence(normalizedAlt, category, input);
}

function hasCategoryEvidence(alt, category, input = {}) {
  if (!alt) return false;
  if (category.includes("praia")) return strongBeachTerms().some(term => alt.includes(term));
  if (category.includes("montanha")) return ["mountain", "montanha", "colina", "horizonte", "paisagem", "natureza", "arvores", "verde", "aldeia", "ao ar livre", "serra"].some(term => alt.includes(term));
  if (category.includes("natureza") || category.includes("campo")) {
    if (hasMismatchedCategoryTerms(alt, category)) return false;
    return ["natureza", "paisagem", "montanha", "colina", "agricultura", "vegetacao", "arvores", "verde", "rochas", "agua", "arco-iris", "ao ar livre"].some(term => alt.includes(term));
  }
  if (category.includes("cidade")) return ["cidade", "urbano", "arquitetura", "predios", "edificios", "rua", "centro", "skyline", "horizonte"].some(term => alt.includes(term));
  if (category.includes("resort")) return ["hotel", "resort", "piscina", "jardim", "cidade", "urbano", "predios", "edificios", "arquitetura", "vegetacao"].some(term => alt.includes(term));
  if (category.includes("parque aquatico")) return ["parque aquatico", "piscina", "toboga", "aquatico", "resort"].some(term => alt.includes(term));
  if (category.includes("parque")) {
    const parkTerms = ["parque", "theme park", "amusement", "atracao", "roda gigante", "castelo"];
    if (parkTerms.some(term => alt.includes(term))) return true;
    if (input.key === "orlando") return ["cidade", "skyline", "lago", "horizonte"].some(term => alt.includes(term));
    return false;
  }
  return ["paisagem", "turismo", "viagem", "ao ar livre"].some(term => alt.includes(term));
}

function hasMisleadingTerms(alt, category) {
  if (category.includes("parque aquatico") && ["estadio", "futebol", "metropolitano"].some(term => alt.includes(term))) return true;
  if (["casa de repouso", "nursing home"].some(term => alt.includes(term))) return true;
  return hasMismatchedCategoryTerms(alt, category);
}

function hasMismatchedCategoryTerms(alt, category) {
  if ((category.includes("campo") || category.includes("montanha")) && ["mar", "praia", "litoral", "costa", "oceano"].some(term => alt.includes(term))) return true;
  return false;
}

function beachTerms() {
  return ["beach", "praia", "ocean", "oceano", "sea", "mar", "water", "agua", "sand", "areia", "coast", "costa", "litoral", "aquatico", "beira-mar", "azul-turquesa"];
}

function strongBeachTerms() {
  return ["beach", "praia", "ocean", "oceano", "sea", "mar", "sand", "areia", "coast", "costa", "litoral", "beira-mar", "azul-turquesa"];
}

function placeholderRecord(input) {
  return {
    key: input.key,
    destinationName: input.destinationName,
    city: input.city,
    state: input.state,
    country: input.country,
    category: input.category,
    context: input.context,
    imageUrl: null,
    thumbnailUrl: null,
    source: "placeholder",
    authorName: null,
    authorUrl: null,
    originalUrl: null,
    license: null,
    attributionRequired: false,
    attributionText: "Imagem do destino pendente de revisão",
    width: null,
    height: null,
    alt: `Imagem de ${input.destinationName} pendente de revisão`,
    queryUsed: null,
    confidenceScore: 0,
    status: "rejected",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function readExistingCache() {
  if (!fs.existsSync(OUTPUT_FILE)) return [];
  const source = fs.readFileSync(OUTPUT_FILE, "utf8");
  const match = source.match(/export const conciergeDestinationImages = (\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

function writeImageBank(items) {
  const source = `export const conciergeDestinationImages = ${JSON.stringify(items, null, 2)};\n`;
  fs.writeFileSync(OUTPUT_FILE, source, "utf8");
  fs.writeFileSync(SQL_OUTPUT_FILE, buildSqlSeed(items), "utf8");
}

function buildSqlSeed(items) {
  const rows = items.map(item => ({
    destination_slug: item.key,
    destination_name: item.destinationName,
    city: item.city,
    state: item.state,
    country: item.country,
    category: item.category,
    context: item.context,
    query_used: item.queryUsed,
    image_url: item.imageUrl,
    thumbnail_url: item.thumbnailUrl,
    source: item.source,
    author_name: item.authorName,
    author_url: item.authorUrl,
    original_url: item.originalUrl,
    license: item.license,
    attribution_required: item.attributionRequired,
    attribution_text: item.attributionText,
    width: item.width,
    height: item.height,
    alt: item.alt,
    confidence_score: item.confidenceScore,
    status: item.status
  }));

  return `begin;

with image_rows as (
  select *
  from jsonb_to_recordset($json$
${JSON.stringify(rows, null, 2)}
$json$) as row(
    destination_slug text,
    destination_name text,
    city text,
    state text,
    country text,
    category text,
    context text,
    query_used text,
    image_url text,
    thumbnail_url text,
    source text,
    author_name text,
    author_url text,
    original_url text,
    license text,
    attribution_required boolean,
    attribution_text text,
    width int,
    height int,
    alt text,
    confidence_score int,
    status text
  )
)
insert into public.destination_images (
  destination_slug,
  destination_name,
  city,
  state,
  country,
  category,
  context,
  query_used,
  image_url,
  thumbnail_url,
  source,
  author_name,
  author_url,
  original_url,
  license,
  attribution_required,
  attribution_text,
  width,
  height,
  alt,
  confidence_score,
  status
)
select
  destination_slug,
  destination_name,
  city,
  state,
  country,
  category,
  context,
  query_used,
  image_url,
  thumbnail_url,
  source,
  author_name,
  author_url,
  original_url,
  license,
  attribution_required,
  attribution_text,
  width,
  height,
  alt,
  confidence_score,
  status
from image_rows
on conflict (destination_slug, source) do update set
  destination_name = excluded.destination_name,
  city = excluded.city,
  state = excluded.state,
  country = excluded.country,
  category = excluded.category,
  context = excluded.context,
  query_used = excluded.query_used,
  image_url = excluded.image_url,
  thumbnail_url = excluded.thumbnail_url,
  author_name = excluded.author_name,
  author_url = excluded.author_url,
  original_url = excluded.original_url,
  license = excluded.license,
  attribution_required = excluded.attribution_required,
  attribution_text = excluded.attribution_text,
  width = excluded.width,
  height = excluded.height,
  alt = excluded.alt,
  confidence_score = excluded.confidence_score,
  status = excluded.status,
  updated_at = now();

commit;
`;
}

function cacheKey(item) {
  return [item.destinationName, item.city, item.state, item.country, item.category].map(value => removeAccents(String(value || "").toLowerCase())).join("|");
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unique(items) {
  return [...new Set(items)];
}
