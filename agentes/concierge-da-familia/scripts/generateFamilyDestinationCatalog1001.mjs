import { writeFile } from "node:fs/promises";

const MUNICIPIOS_CSV_URL = "https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/csv/municipios.csv";
const OUTPUT_JS = new URL("../src/data/familyDestinationCatalog1001.js", import.meta.url);
const OUTPUT_META_JS = new URL("../src/data/familyDestinationCatalog1001Meta.js", import.meta.url);
const OUTPUT_SQL = new URL("../../../supabase/migrations/0030_seed_family_destination_catalog_1001.sql", import.meta.url);

const statesByCode = {
  11: ["RO", "Rondônia", "Norte"],
  12: ["AC", "Acre", "Norte"],
  13: ["AM", "Amazonas", "Norte"],
  14: ["RR", "Roraima", "Norte"],
  15: ["PA", "Pará", "Norte"],
  16: ["AP", "Amapá", "Norte"],
  17: ["TO", "Tocantins", "Norte"],
  21: ["MA", "Maranhão", "Nordeste"],
  22: ["PI", "Piauí", "Nordeste"],
  23: ["CE", "Ceará", "Nordeste"],
  24: ["RN", "Rio Grande do Norte", "Nordeste"],
  25: ["PB", "Paraíba", "Nordeste"],
  26: ["PE", "Pernambuco", "Nordeste"],
  27: ["AL", "Alagoas", "Nordeste"],
  28: ["SE", "Sergipe", "Nordeste"],
  29: ["BA", "Bahia", "Nordeste"],
  31: ["MG", "Minas Gerais", "Sudeste"],
  32: ["ES", "Espírito Santo", "Sudeste"],
  33: ["RJ", "Rio de Janeiro", "Sudeste"],
  35: ["SP", "São Paulo", "Sudeste"],
  41: ["PR", "Paraná", "Sul"],
  42: ["SC", "Santa Catarina", "Sul"],
  43: ["RS", "Rio Grande do Sul", "Sul"],
  50: ["MS", "Mato Grosso do Sul", "Centro-Oeste"],
  51: ["MT", "Mato Grosso", "Centro-Oeste"],
  52: ["GO", "Goiás", "Centro-Oeste"],
  53: ["DF", "Distrito Federal", "Centro-Oeste"]
};

const knownFamilyTourism = new Map(Object.entries({
  "atibaia-sp": ["resort_interior", 96, ["resort", "perto de SP", "bebês"]],
  "campinas-sp": ["resort_interior", 94, ["resort", "estrutura médica", "fim de semana"]],
  "mogi-das-cruzes-sp": ["nature_short_break", 91, ["perto de SP", "natureza", "rota leve"]],
  "aguas-de-lindoia-sp": ["resort_interior", 94, ["circuito das águas", "resort", "pensão completa"]],
  "olimpia-sp": ["water_park", 90, ["parque aquático", "crianças maiores", "resort"]],
  "campos-do-jordao-sp": ["mountain_family", 88, ["serra", "gastronomia", "frio"]],
  "sao-roque-sp": ["short_break", 86, ["perto de SP", "gastronomia", "bate-volta"]],
  "guaruja-sp": ["beach_family", 86, ["praia", "carro", "estrutura urbana"]],
  "foz-do-iguacu-pr": ["nature_icon", 90, ["natureza", "atração icônica", "voo curto"]],
  "gramado-rs": ["mountain_family", 91, ["serra", "parques", "gastronomia"]],
  "canela-rs": ["mountain_family", 88, ["serra", "parques", "natureza"]],
  "penha-sc": ["theme_park", 89, ["parque", "praia", "crianças"]],
  "bonito-ms": ["nature_icon", 84, ["natureza", "passeios", "crianças maiores"]],
  "caldas-novas-go": ["water_park", 87, ["águas termais", "resort", "crianças"]],
  "rio-quente-go": ["water_park", 88, ["águas termais", "resort", "parque"]],
  "porto-seguro-ba": ["beach_family", 86, ["praia", "resorts", "voo curto"]],
  "mata-de-sao-joao-ba": ["beach_family", 87, ["Praia do Forte", "resort", "projeto Tamar"]],
  "ipojuca-pe": ["beach_family", 88, ["Porto de Galinhas", "praia calma", "resort"]],
  "maragogi-al": ["beach_family", 85, ["praia", "piscinas naturais", "famílias"]],
  "maceio-al": ["beach_family", 86, ["praia urbana", "estrutura", "gastronomia"]],
  "natal-rn": ["beach_family", 85, ["praia", "dunas", "voo curto"]],
  "fortaleza-ce": ["beach_family", 84, ["praia", "parques", "estrutura"]],
  "rio-de-janeiro-rj": ["urban_icon", 84, ["ícone turístico", "praia", "cultura"]],
  "florianopolis-sc": ["beach_family", 87, ["praias", "natureza", "estrutura"]],
  "curitiba-pr": ["urban_family", 84, ["parques", "cidade", "cultura"]],
  "brasilia-df": ["urban_family", 82, ["cidade", "cultura", "voo curto"]],
  "belo-horizonte-mg": ["urban_family", 82, ["gastronomia", "cidade", "bate-voltas"]],
  "sao-paulo-sp": ["urban_family", 80, ["museus", "parques", "gastronomia"]]
}));

const familyKeywords = [
  ["aguas", "water_resort", 14, "águas"],
  ["caldas", "water_resort", 14, "águas termais"],
  ["lindoia", "water_resort", 14, "circuito das águas"],
  ["praia", "beach_family", 13, "praia"],
  ["porto", "beach_family", 8, "litoral"],
  ["barra", "beach_family", 8, "litoral"],
  ["ilha", "beach_family", 9, "ilha"],
  ["cabo", "beach_family", 8, "litoral"],
  ["serra", "mountain_family", 11, "serra"],
  ["monte", "mountain_family", 6, "montanha"],
  ["campos", "mountain_family", 8, "serra"],
  ["chapada", "nature_icon", 14, "natureza"],
  ["bonito", "nature_icon", 12, "natureza"],
  ["foz", "nature_icon", 12, "natureza"],
  ["parque", "parks_family", 10, "parques"],
  ["jardim", "parks_family", 5, "áreas verdes"],
  ["sao pedro", "short_break", 6, "interior"]
];

const coastalStateCodes = new Set(["AL", "AP", "BA", "CE", "ES", "MA", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RS", "SC", "SE", "SP"]);
const shortBreakFromSpStates = new Set(["SP", "MG", "RJ", "PR"]);
const infrastructureStates = new Set(["SP", "RJ", "MG", "PR", "SC", "RS", "BA", "PE", "CE", "GO", "DF", "ES", "AL", "RN", "PB"]);

const sourceMeta = {
  municipalityRegistry: "IBGE Localidades / código IBGE",
  coordinatesDataset: "kelvins/Municipios-Brasileiros municipios.csv",
  coordinatesUrl: MUNICIPIOS_CSV_URL,
  generatedAt: "2026-06-06"
};

const response = await fetch(MUNICIPIOS_CSV_URL);
if (!response.ok) throw new Error(`Failed to fetch municipios.csv: ${response.status}`);
const csv = await response.text();
const rows = parseCsv(csv);
const destinations = selectBalancedDestinations(rows.map(toDestinationCandidate), 1001)
  .sort((a, b) => b.familyScore - a.familyScore || Number(b.isCapital) - Number(a.isCapital) || a.stateCode.localeCompare(b.stateCode) || a.name.localeCompare(b.name, "pt-BR"))
  .map((item, index) => ({ ...item, rank: index + 1 }));

if (destinations.length !== 1001) throw new Error(`Expected 1001 destinations, got ${destinations.length}`);
ensureUnique(destinations.map(item => item.slug));

await writeFile(OUTPUT_JS, renderJs(destinations), "utf8");
await writeFile(OUTPUT_META_JS, renderMetaJs(destinations), "utf8");
await writeFile(OUTPUT_SQL, renderSql(destinations), "utf8");
console.log(`Generated ${destinations.length} family destination candidates.`);

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.filter(Boolean).map(line => {
    const values = line.split(",");
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function toDestinationCandidate(row) {
  const [stateCode, stateName, macroRegion] = statesByCode[Number(row.codigo_uf)] || ["", "", ""];
  const slug = `${slugify(row.nome)}-${stateCode.toLowerCase()}`;
  const known = knownFamilyTourism.get(slug);
  const normalizedName = removeAccents(row.nome).toLowerCase();
  const keywordMatches = familyKeywords.filter(([keyword]) => normalizedName.includes(keyword));
  const isCapital = row.capital === "1";
  const isCoastalCandidate = coastalStateCodes.has(stateCode) && keywordMatches.some(match => match[1] === "beach_family");
  const type = known?.[0] || keywordMatches[0]?.[1] || (isCapital ? "capital_family_base" : isCoastalCandidate ? "beach_family" : "regional_family_base");
  const baseScore = 48
    + (isCapital ? 24 : 0)
    + (known ? 22 : 0)
    + keywordMatches.reduce((sum, match) => sum + match[2], 0)
    + (infrastructureStates.has(stateCode) ? 6 : 2)
    + (shortBreakFromSpStates.has(stateCode) ? 4 : 0);
  const familyScore = known?.[1] || Math.max(52, Math.min(89, baseScore));
  const tags = unique([
    ...(known?.[2] || []),
    ...(isCapital ? ["capital", "estrutura urbana"] : []),
    ...keywordMatches.map(match => match[3]),
    macroRegion,
    stateCode,
    typeLabel(type)
  ]).slice(0, 7);
  return {
    slug,
    name: row.nome,
    stateCode,
    stateName,
    country: "Brasil",
    macroRegion,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    ibgeCode: row.codigo_ibge,
    isCapital,
    rank: 0,
    familyScore,
    destinationType: type,
    curationLevel: known ? "known_family_destination" : "family_destination_candidate",
    recommendationReadiness: known ? "ready_for_editorial_review" : "needs_hotel_and_place_validation",
    minimumFamilyRequirementsPassed: false,
    idealAges: idealAgesForType(type),
    travelModes: travelModesForState(stateCode, isCapital, type),
    bestFor: bestForType(type),
    attentionPoints: attentionForType(type, stateCode),
    tags,
    source: sourceMeta
  };
}

function selectBalancedDestinations(candidates, total) {
  const selected = new Map();
  const groups = new Map();
  candidates
    .sort((a, b) => b.familyScore - a.familyScore || Number(b.isCapital) - Number(a.isCapital) || a.name.localeCompare(b.name, "pt-BR"))
    .forEach(destination => {
      if (!groups.has(destination.stateCode)) groups.set(destination.stateCode, []);
      groups.get(destination.stateCode).push(destination);
      if (destination.curationLevel === "known_family_destination") selected.set(destination.slug, destination);
    });

  const stateOrder = [...groups.keys()].sort((a, b) => {
    const aBest = groups.get(a)[0]?.familyScore || 0;
    const bBest = groups.get(b)[0]?.familyScore || 0;
    return bBest - aBest || a.localeCompare(b);
  });

  let cursor = 0;
  while (selected.size < total) {
    const stateCode = stateOrder[cursor % stateOrder.length];
    const next = groups.get(stateCode)?.find(destination => !selected.has(destination.slug));
    if (next) selected.set(next.slug, next);
    cursor += 1;
    if (cursor > candidates.length * 3) break;
  }

  if (selected.size < total) {
    candidates.forEach(destination => {
      if (selected.size < total && !selected.has(destination.slug)) selected.set(destination.slug, destination);
    });
  }
  return [...selected.values()].slice(0, total);
}

function idealAgesForType(type) {
  if (type.includes("water") || type.includes("beach")) return ["2+ anos", "crianças que já brincam em água com supervisão"];
  if (type.includes("mountain") || type.includes("nature")) return ["3+ anos", "famílias que toleram passeios curtos"];
  if (type.includes("capital") || type.includes("urban")) return ["0+ anos", "famílias que priorizam estrutura urbana"];
  return ["1+ ano", "viagens regionais com planejamento simples"];
}

function travelModesForState(stateCode, isCapital, type) {
  if (stateCode === "SP") return ["carro", "ônibus executivo"];
  if (shortBreakFromSpStates.has(stateCode) && !isCapital) return ["carro", "ônibus", "voo curto se fizer sentido"];
  if (isCapital || type.includes("beach") || type.includes("urban")) return ["voo", "carro local"];
  return ["carro regional", "voo para hub próximo"];
}

function bestForType(type) {
  const map = {
    resort_interior: "resort, rotina previsível e viagem de baixa fricção",
    water_resort: "piscinas, águas termais e hotel com lazer concentrado",
    water_park: "crianças maiores, piscina e parque aquático",
    beach_family: "praia, descanso e estrutura turística",
    mountain_family: "serra, gastronomia e clima diferente",
    nature_icon: "natureza marcante e passeios leves bem planejados",
    theme_park: "parques e entretenimento infantil",
    urban_icon: "atrações famosas com boa estrutura urbana",
    urban_family: "museus, parques, restaurantes e acesso fácil",
    capital_family_base: "base urbana com saúde, transporte e alimentação",
    short_break: "fim de semana curto e deslocamento simples",
    parks_family: "áreas verdes e passeio leve",
    regional_family_base: "viagem regional, visita familiar ou base para explorar arredores"
  };
  return map[type] || map.regional_family_base;
}

function attentionForType(type, stateCode) {
  const items = [];
  if (type.includes("beach")) items.push("checar maré, sombra e distância real até a praia");
  if (type.includes("water")) items.push("confirmar piscina infantil, salva-vidas e política para bebês");
  if (type.includes("mountain")) items.push("avaliar frio, acesso ao hotel e programação em chuva");
  if (type.includes("nature")) items.push("validar idade mínima dos passeios e deslocamentos internos");
  if (type.includes("urban") || type.includes("capital")) items.push("priorizar bairro seguro e deslocamento curto");
  if (!items.length) items.push("validar hospedagem familiar antes de recomendar");
  if (stateCode !== "SP") items.push("calcular logística real a partir da origem da família");
  return items.slice(0, 3);
}

function typeLabel(type) {
  return type.replaceAll("_", " ");
}

function renderJs(destinations) {
  return `// Generated by scripts/generateFamilyDestinationCatalog1001.mjs on 2026-06-06.\n` +
    `// Broad candidate catalog. Curated hotel recommendations remain in conciergeFamilyHotels*.js.\n` +
    `export const familyDestinationCatalog1001Meta = ${JSON.stringify({ count: destinations.length, ...sourceMeta }, null, 2)};\n\n` +
    `export const familyDestinationCatalog1001 = ${JSON.stringify(destinations, null, 2)};\n`;
}

function renderMetaJs(destinations) {
  const byCurationLevel = destinations.reduce((acc, destination) => {
    acc[destination.curationLevel] = (acc[destination.curationLevel] || 0) + 1;
    return acc;
  }, {});
  const byState = destinations.reduce((acc, destination) => {
    acc[destination.stateCode] = (acc[destination.stateCode] || 0) + 1;
    return acc;
  }, {});
  return `// Generated by scripts/generateFamilyDestinationCatalog1001.mjs on 2026-06-06.\n` +
    `// Small metadata file for frontend copy. It avoids loading the full 1001 catalog in the main app.\n` +
    `export const familyDestinationCatalog1001Meta = ${JSON.stringify({ count: destinations.length, byCurationLevel, byState, ...sourceMeta }, null, 2)};\n`;
}

function renderSql(destinations) {
  const payload = JSON.stringify(destinations);
  return `-- Generated by agentes/concierge-da-familia/scripts/generateFamilyDestinationCatalog1001.mjs on 2026-06-06.\n` +
`-- Seeds 1001 broad family destination candidates. Hotel-qualified recommendations stay separate.\n\n` +
`create table if not exists public.destinations (\n` +
`  id uuid primary key default gen_random_uuid(),\n` +
`  slug text unique,\n` +
`  name text not null,\n` +
`  state text,\n` +
`  country text not null default 'BR',\n` +
`  latitude numeric,\n` +
`  longitude numeric,\n` +
`  source text not null default 'curated',\n` +
`  api_data jsonb not null default '{}'::jsonb,\n` +
`  curated_data jsonb not null default '{}'::jsonb,\n` +
`  ai_calculated_data jsonb not null default '{}'::jsonb,\n` +
`  created_at timestamptz not null default now(),\n` +
`  updated_at timestamptz not null default now()\n` +
`);\n\n` +
`alter table public.destinations add column if not exists source text not null default 'curated';\n` +
`alter table public.destinations add column if not exists api_data jsonb not null default '{}'::jsonb;\n` +
`alter table public.destinations add column if not exists curated_data jsonb not null default '{}'::jsonb;\n` +
`alter table public.destinations add column if not exists ai_calculated_data jsonb not null default '{}'::jsonb;\n\n` +
`create table if not exists public.family_destination_catalog_1001 (\n` +
`  slug text primary key,\n` +
`  name text not null,\n` +
`  state_code text not null,\n` +
`  state_name text not null,\n` +
`  country text not null default 'Brasil',\n` +
`  macro_region text,\n` +
`  latitude numeric,\n` +
`  longitude numeric,\n` +
`  ibge_code text,\n` +
`  is_capital boolean not null default false,\n` +
`  rank int not null,\n` +
`  family_score int not null,\n` +
`  destination_type text not null,\n` +
`  curation_level text not null,\n` +
`  recommendation_readiness text not null,\n` +
`  minimum_family_requirements_passed boolean not null default false,\n` +
`  tags text[] not null default '{}',\n` +
`  ideal_ages text[] not null default '{}',\n` +
`  travel_modes text[] not null default '{}',\n` +
`  best_for text,\n` +
`  attention_points text[] not null default '{}',\n` +
`  source jsonb not null default '{}'::jsonb,\n` +
`  created_at timestamptz not null default now(),\n` +
`  updated_at timestamptz not null default now()\n` +
`);\n\n` +
`with payload as (\n` +
`  select * from jsonb_to_recordset($json$${payload}$json$::jsonb) as x(\n` +
`    slug text,\n` +
`    name text,\n` +
`    "stateCode" text,\n` +
`    "stateName" text,\n` +
`    country text,\n` +
`    "macroRegion" text,\n` +
`    latitude numeric,\n` +
`    longitude numeric,\n` +
`    "ibgeCode" text,\n` +
`    "isCapital" boolean,\n` +
`    rank int,\n` +
`    "familyScore" int,\n` +
`    "destinationType" text,\n` +
`    "curationLevel" text,\n` +
`    "recommendationReadiness" text,\n` +
`    "minimumFamilyRequirementsPassed" boolean,\n` +
`    "idealAges" text[],\n` +
`    "travelModes" text[],\n` +
`    "bestFor" text,\n` +
`    "attentionPoints" text[],\n` +
`    tags text[],\n` +
`    source jsonb\n` +
`  )\n` +
`), upsert_catalog as (\n` +
`  insert into public.family_destination_catalog_1001 (\n` +
`    slug, name, state_code, state_name, country, macro_region, latitude, longitude,\n` +
`    ibge_code, is_capital, rank, family_score, destination_type, curation_level,\n` +
`    recommendation_readiness, minimum_family_requirements_passed, tags, ideal_ages,\n` +
`    travel_modes, best_for, attention_points, source, updated_at\n` +
`  )\n` +
`  select slug, name, "stateCode", "stateName", country, "macroRegion", latitude, longitude,\n` +
`    "ibgeCode", "isCapital", rank, "familyScore", "destinationType", "curationLevel",\n` +
`    "recommendationReadiness", "minimumFamilyRequirementsPassed", tags, "idealAges",\n` +
`    "travelModes", "bestFor", "attentionPoints", source, now()\n` +
`  from payload\n` +
`  on conflict (slug) do update set\n` +
`    name = excluded.name,\n` +
`    state_code = excluded.state_code,\n` +
`    state_name = excluded.state_name,\n` +
`    country = excluded.country,\n` +
`    macro_region = excluded.macro_region,\n` +
`    latitude = excluded.latitude,\n` +
`    longitude = excluded.longitude,\n` +
`    ibge_code = excluded.ibge_code,\n` +
`    is_capital = excluded.is_capital,\n` +
`    rank = excluded.rank,\n` +
`    family_score = excluded.family_score,\n` +
`    destination_type = excluded.destination_type,\n` +
`    curation_level = excluded.curation_level,\n` +
`    recommendation_readiness = excluded.recommendation_readiness,\n` +
`    minimum_family_requirements_passed = excluded.minimum_family_requirements_passed,\n` +
`    tags = excluded.tags,\n` +
`    ideal_ages = excluded.ideal_ages,\n` +
`    travel_modes = excluded.travel_modes,\n` +
`    best_for = excluded.best_for,\n` +
`    attention_points = excluded.attention_points,\n` +
`    source = excluded.source,\n` +
`    updated_at = now()\n` +
`  returning slug\n` +
`)\n` +
`insert into public.destinations (slug, name, state, country, latitude, longitude, source, curated_data, ai_calculated_data, updated_at)\n` +
`select\n` +
`  slug,\n` +
`  name,\n` +
`  "stateCode",\n` +
`  'BR',\n` +
`  latitude,\n` +
`  longitude,\n` +
`  'family_destination_catalog_1001',\n` +
`  jsonb_build_object(\n` +
`    'stateName', "stateName",\n` +
`    'macroRegion', "macroRegion",\n` +
`    'ibgeCode', "ibgeCode",\n` +
`    'isCapital', "isCapital",\n` +
`    'curationLevel', "curationLevel",\n` +
`    'recommendationReadiness', "recommendationReadiness",\n` +
`    'minimumFamilyRequirementsPassed', "minimumFamilyRequirementsPassed",\n` +
`    'tags', tags,\n` +
`    'idealAges', "idealAges",\n` +
`    'travelModes', "travelModes",\n` +
`    'bestFor', "bestFor",\n` +
`    'attentionPoints', "attentionPoints",\n` +
`    'source', source\n` +
`  ),\n` +
`  jsonb_build_object(\n` +
`    'familyScore', "familyScore",\n` +
`    'destinationType', "destinationType",\n` +
`    'catalogRank', rank\n` +
`  ),\n` +
`  now()\n` +
`from payload\n` +
`on conflict (slug) do update set\n` +
`  name = excluded.name,\n` +
`  state = excluded.state,\n` +
`  country = excluded.country,\n` +
`  latitude = excluded.latitude,\n` +
`  longitude = excluded.longitude,\n` +
`  source = excluded.source,\n` +
`  curated_data = coalesce(public.destinations.curated_data, '{}'::jsonb) || excluded.curated_data,\n` +
`  ai_calculated_data = coalesce(public.destinations.ai_calculated_data, '{}'::jsonb) || excluded.ai_calculated_data,\n` +
`  updated_at = now();\n\n` +
`create index if not exists idx_family_destination_catalog_1001_score on public.family_destination_catalog_1001(family_score desc, rank asc);\n` +
`create index if not exists idx_family_destination_catalog_1001_state on public.family_destination_catalog_1001(state_code, destination_type);\n\n` +
`alter table public.family_destination_catalog_1001 enable row level security;\n` +
`do $$\n` +
`begin\n` +
`  if not exists (\n` +
`    select 1 from pg_policies\n` +
`    where schemaname = 'public' and tablename = 'family_destination_catalog_1001' and policyname = 'family_destination_catalog_1001_read_public'\n` +
`  ) then\n` +
`    create policy family_destination_catalog_1001_read_public\n` +
`      on public.family_destination_catalog_1001 for select\n` +
`      using (true);\n` +
`  end if;\n` +
`end $$;\n\n` +
`grant select on public.family_destination_catalog_1001 to anon, authenticated;\n`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function ensureUnique(values) {
  const seen = new Set();
  values.forEach(value => {
    if (seen.has(value)) throw new Error(`Duplicate value: ${value}`);
    seen.add(value);
  });
}

function slugify(value) {
  return removeAccents(String(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
