import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_CHECK_KEY;
const excelJsonPath = process.env.EXCEL_DESTINATIONS_JSON || "tmp_excel_destinos.json";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_CHECK_KEY.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const TABLES = [
  "br_public_holidays",
  "destination_climate_normals",
  "destination_event_demand",
  "destination_events",
  "destination_family_fit",
  "destination_google_places",
  "destination_hotel_cards",
  "destination_hotels",
  "destination_map_points",
  "destination_origin_access",
  "destination_primary_rating",
  "destination_recommended_property_types",
  "destination_risk_factors",
  "destination_scores",
  "destination_seasonality",
  "destination_sp_route",
  "destination_stay_summary",
  "destination_tags",
  "destinations",
  "family_profiles",
  "origin_transport_hubs",
  "travel_origins",
  "vw_destination_cards_for_concierge",
  "vw_destinations_for_sp_families"
];

const DESTINATION_CHILD_TABLES = [
  "destination_climate_normals",
  "destination_event_demand",
  "destination_events",
  "destination_family_fit",
  "destination_google_places",
  "destination_hotel_cards",
  "destination_hotels",
  "destination_map_points",
  "destination_origin_access",
  "destination_primary_rating",
  "destination_recommended_property_types",
  "destination_risk_factors",
  "destination_scores",
  "destination_seasonality",
  "destination_sp_route",
  "destination_stay_summary",
  "destination_tags"
];

const ALIASES = {
  "bertioga riviera": ["bertioga", "riviera de sao lourenco"],
  "sao sebastiao juquehy": ["sao sebastiao", "juquehy"],
  "itu salto cabreuva": ["itu", "salto", "cabreuva"],
  "campinas vinhedo": ["campinas", "vinhedo"],
  "cabo frio arraial": ["cabo frio", "arraial do cabo"],
  "belo horizonte inhotim": ["belo horizonte", "brumadinho", "inhotim"],
  "salvador praia do forte": ["salvador", "praia do forte"],
  "porto seguro arraial d ajuda": ["porto seguro", "arraial d ajuda"],
  "recife olinda": ["recife", "olinda"],
  "natal pipa": ["natal", "pipa"],
  "fortaleza aquiraz": ["fortaleza", "aquiraz"],
  "lencois maranhenses barreirinhas": ["barreirinhas", "lencois maranhenses"],
  "caldas novas rio quente": ["caldas novas", "rio quente"],
  "manaus amazonia": ["manaus"],
  "florenca toscana": ["florenca", "toscana"],
  "cancun riviera maya": ["cancun", "riviera maya"],
  "miami fort lauderdale": ["miami", "fort lauderdale"],
  "osaka kyoto": ["osaka", "kyoto"],
  "honolulu oahu": ["honolulu", "oahu"],
  "los angeles anaheim": ["los angeles", "anaheim"],
  "toronto niagara": ["toronto", "niagara falls"]
};

async function main() {
  const excelRows = JSON.parse(await fs.readFile(excelJsonPath, "utf8"));
  const tableStats = await collectTableStats();
  const destinations = await fetchAll("destinations");
  const destinationIds = new Set(destinations.map((row) => row.id));
  const activeDestinations = destinations.filter((row) => row.is_active !== false);
  const duplicateFindings = collectDuplicates(destinations);
  const orphanFindings = await collectOrphans(destinationIds);
  const excelCoverage = collectExcelCoverage(excelRows, activeDestinations);
  const viewCoverage = await collectViewCoverage();

  const report = {
    generatedAt: new Date().toISOString(),
    tableStats,
    totals: {
      destinations: destinations.length,
      activeDestinations: activeDestinations.length,
      excelRows: excelRows.length,
      excelRowsCovered: excelCoverage.covered.length,
      excelRowsMissing: excelCoverage.missing.length
    },
    excelCoverage,
    viewCoverage,
    duplicateFindings,
    orphanFindings,
    recommendations: buildRecommendations({
      tableStats,
      duplicateFindings,
      orphanFindings,
      excelCoverage
    })
  };

  console.log(JSON.stringify(report, null, 2));
}

async function collectTableStats() {
  const stats = [];
  for (const table of TABLES) {
    const [{ count, error: countError }, { data, error: sampleError }] = await Promise.all([
      client.from(table).select("*", { count: "exact", head: true }),
      client.from(table).select("*").limit(1)
    ]);
    stats.push({
      table,
      ok: !countError && !sampleError,
      count: countError ? null : count,
      error: countError?.message || sampleError?.message || null,
      columns: Object.keys(data?.[0] || {})
    });
  }
  return stats;
}

async function collectOrphans(destinationIds) {
  const findings = [];
  for (const table of DESTINATION_CHILD_TABLES) {
    const rows = await fetchAll(table, "id,destination_id");
    const orphans = rows.filter((row) => row.destination_id && !destinationIds.has(row.destination_id));
    findings.push({
      table,
      rows: rows.length,
      orphanCount: orphans.length,
      orphanIds: orphans.slice(0, 25).map((row) => row.id)
    });
  }
  return findings;
}

function collectDuplicates(destinations) {
  return {
    destinationsBySlug: duplicates(destinations, (row) => row.slug),
    destinationsByNameStateCountry: duplicates(destinations, (row) => `${norm(row.name)}|${norm(row.state)}|${norm(row.country)}`),
  };
}

async function collectViewCoverage() {
  const [cards, familyView] = await Promise.all([
    fetchAll("vw_destination_cards_for_concierge", "slug,name"),
    fetchAll("vw_destinations_for_sp_families", "destination_id,slug,name")
  ]);
  return {
    vwDestinationCardsForConcierge: cards.length,
    vwDestinationsForSpFamilies: familyView.length
  };
}

function collectExcelCoverage(excelRows, destinations) {
  const indexed = destinations.map((row) => ({
    ...row,
    normalized: new Set([
      norm(row.name),
      norm(row.city),
      norm(row.slug),
      ...(row.destination_types || []).map(norm)
    ].filter(Boolean))
  }));
  const covered = [];
  const missing = [];
  for (const row of excelRows) {
    const rawName = row.cidade_regiao || "";
    const requiredTokens = requiredNames(rawName);
    const matches = indexed.filter((destination) => requiredTokens.some((token) => matchesDestination(token, destination)));
    const item = {
      excelName: rawName,
      state: row.uf_estado || "",
      country: row.pais || "",
      priority: row.prioridade_mvp ?? null,
      requiredTokens,
      matches: matches.map((destination) => ({
        id: destination.id,
        slug: destination.slug,
        name: destination.name,
        state: destination.state,
        country: destination.country
      }))
    };
    if (matches.length) covered.push(item);
    else missing.push(item);
  }
  return { covered, missing };
}

function requiredNames(rawName) {
  const key = norm(rawName);
  if (ALIASES[key]) return ALIASES[key];
  return String(rawName || "")
    .split("/")
    .map((part) => norm(part))
    .filter(Boolean);
}

function matchesDestination(token, destination) {
  if (!token) return false;
  for (const value of destination.normalized) {
    if (value === token) return true;
    if (value.includes(token) || token.includes(value)) return true;
  }
  return false;
}

function duplicates(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return [...map.entries()]
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => ({
      key,
      count: items.length,
      rows: items.map((row) => ({ id: row.id, slug: row.slug, name: row.name, state: row.state, country: row.country }))
    }));
}

function buildRecommendations({ tableStats, duplicateFindings, orphanFindings, excelCoverage }) {
  const recommendations = [];
  const emptyTables = tableStats.filter((item) => item.ok && item.count === 0).map((item) => item.table);
  if (emptyTables.length) recommendations.push({ severity: "medium", action: "review_empty_tables", tables: emptyTables });
  const orphanTables = orphanFindings.filter((item) => item.orphanCount > 0);
  if (orphanTables.length) recommendations.push({ severity: "high", action: "delete_orphan_rows", tables: orphanTables.map((item) => ({ table: item.table, orphanCount: item.orphanCount })) });
  if (duplicateFindings.destinationsBySlug.length || duplicateFindings.destinationsByNameStateCountry.length) {
    recommendations.push({ severity: "high", action: "merge_duplicate_destinations", duplicateFindings });
  }
  if (excelCoverage.missing.length) recommendations.push({ severity: "high", action: "insert_missing_excel_destinations", rows: excelCoverage.missing });
  recommendations.push({
    severity: "low",
    action: "keep_views",
    reason: "Views in Supabase power the site/API and should not be deleted even when they duplicate fields from base tables."
  });
  return recommendations;
}

async function fetchAll(table, select = "*") {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select(select).range(from, from + pageSize - 1);
    if (error) return [];
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

function norm(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
