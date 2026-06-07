import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_CHECK_KEY;
const excelJsonPath = process.env.EXCEL_DESTINATIONS_JSON || "tmp_excel_destinos.json";
const originId = process.env.FAMILY_SCORE_ORIGIN_ID || "355cf841-e5c7-4002-91b0-da1e28f2cb3d";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_CHECK_KEY.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const now = new Date().toISOString();
const COORDINATE_FALLBACKS = {
  "campinas vinhedo": [-22.9056, -47.0608],
  sorocaba: [-23.5015, -47.4526],
  aparecida: [-22.8495, -45.2325],
  "ouro preto": [-20.3856, -43.5035],
  "florenca toscana": [43.7696, 11.2558],
  curacao: [12.1696, -68.99],
  toquio: [35.6762, 139.6503],
  "osaka kyoto": [34.6937, 135.5023],
  dubai: [25.2048, 55.2708],
  "abu dhabi": [24.4539, 54.3773],
  doha: [25.2854, 51.531],
  singapura: [1.3521, 103.8198],
  sydney: [-33.8688, 151.2093],
  "cape town": [-33.9249, 18.4241],
  maldivas: [4.1755, 73.5093],
  "honolulu oahu": [21.3069, -157.8583],
  vancouver: [49.2827, -123.1207],
  "toronto niagara": [43.6532, -79.3832]
};

async function main() {
  const excelRows = JSON.parse(await fs.readFile(excelJsonPath, "utf8"));
  const auditMissingNames = await readAuditMissingNames();
  const currentDestinations = await fetchAll("destinations");
  const currentBySlug = new Map(currentDestinations.map((row) => [row.slug, row]));
  const missingRows = excelRows.filter((row) => auditMissingNames.has(row.cidade_regiao) || !hasCoverage(row, currentDestinations));
  const destinationRows = missingRows.map((row) => toDestinationRow(row, currentBySlug.get(slugify(row.cidade_regiao))));
  await upsertChunks("destinations", destinationRows, { onConflict: "slug" });

  const afterDestinations = await fetchAll("destinations");
  const bySlug = new Map(afterDestinations.map((row) => [row.slug, row]));
  const insertedDestinations = destinationRows.map((row) => bySlug.get(row.slug)).filter(Boolean);

  const tagRows = [];
  const seasonalityRows = [];
  const accessRows = [];
  const riskRows = [];
  for (const row of missingRows) {
    const destination = bySlug.get(slugify(row.cidade_regiao));
    if (!destination) continue;
    tagRows.push(...toTagRows(destination.id, row));
    seasonalityRows.push(...toSeasonalityRows(destination.id, row));
    accessRows.push(toOriginAccessRow(destination.id, row));
    riskRows.push(...toRiskRows(destination.id, row));
  }

  await deleteExistingForDestinations("destination_tags", insertedDestinations.map((row) => row.id), "tag_category", ["excel_mvp", "perfil", "sazonalidade"]);
  await deleteExistingForDestinations("destination_seasonality", insertedDestinations.map((row) => row.id));
  await deleteExistingForDestinations("destination_origin_access", insertedDestinations.map((row) => row.id));
  await deleteExistingForDestinations("destination_risk_factors", insertedDestinations.map((row) => row.id));
  await upsertChunks("destination_tags", tagRows, { onConflict: "destination_id,tag_key" });
  await upsertChunks("destination_seasonality", seasonalityRows);
  await upsertChunks("destination_origin_access", accessRows);
  await upsertChunks("destination_risk_factors", riskRows);

  console.log(JSON.stringify({
    excelRows: excelRows.length,
    insertedOrUpdatedDestinations: insertedDestinations.length,
    destinationSlugs: insertedDestinations.map((row) => row.slug),
    tagRows: tagRows.length,
    seasonalityRows: seasonalityRows.length,
    accessRows: accessRows.length,
    riskRows: riskRows.length
  }, null, 2));
}

async function readAuditMissingNames() {
  try {
    const text = await fs.readFile("tmp_supabase_audit.json", "utf8");
    const audit = JSON.parse(text.replace(/^\uFEFF/, ""));
    return new Set((audit.excelCoverage?.missing || []).map((item) => item.excelName));
  } catch {
    return new Set();
  }
}

function toDestinationRow(row, existingDestination = null) {
  const slug = slugify(row.cidade_regiao);
  const coords = COORDINATE_FALLBACKS[norm(row.cidade_regiao)] || [null, null];
  const priority = Number(row.prioridade_mvp || 3);
  return {
    id: existingDestination?.id || randomUUID(),
    slug,
    name: displayName(row.cidade_regiao),
    city: displayName(row.cidade_regiao).split("/")[0].trim(),
    state: String(row.uf_estado || "").trim(),
    country: String(row.pais || "Brasil").trim(),
    macro_region: String(row.macro_regiao || "").trim(),
    destination_scope: scopeFor(row),
    destination_types: destinationTypesFor(row),
    short_description: String(row.angulo_conteudo || "").trim(),
    family_summary: String(row.principais_forcas_familia || "").trim(),
    is_active: true,
    is_mvp_priority: priority <= 1,
    mvp_priority: priority,
    is_placeholder: true,
    latitude: coords[0],
    longitude: coords[1],
    created_at: existingDestination?.created_at || now,
    updated_at: now
  };
}

function toTagRows(destinationId, row) {
  const tags = [
    { key: "excel_mvp", label: "Base Excel MVP", category: "excel_mvp" },
    { key: `custo_${slugify(row.nivel_custo)}`, label: `Custo ${row.nivel_custo}`, category: "custo" },
    { key: `selo_${slugify(row.selo_familia)}`, label: `Selo Excel ${row.selo_familia}`, category: "excel_mvp" }
  ];
  for (const token of String(row.tags_ia || "").split(",")) {
    const label = token.trim();
    if (label) tags.push({ key: slugify(label), label, category: "tema" });
  }
  for (const [field, label] of [
    ["bom_para_bebe", "Bom para bebê"],
    ["bom_para_crianca_2_5", "Bom para criança 2-5"],
    ["bom_para_crianca_6_10", "Bom para criança 6-10"],
    ["bom_para_avos", "Bom para avós"],
    ["bom_para_pet", "Aceita viagem com pet"]
  ]) {
    if (String(row[field] || "").toLowerCase() === "sim") tags.push({ key: slugify(label), label, category: "perfil" });
  }
  return dedupe(tags, "key").map((tag) => ({
    id: randomUUID(),
    destination_id: destinationId,
    tag_key: tag.key,
    tag_label: tag.label,
    tag_category: tag.category,
    created_at: now
  }));
}

function toSeasonalityRows(destinationId, row) {
  const months = monthsFor(row.melhor_epoca);
  return [{
    id: randomUUID(),
    destination_id: destinationId,
    season_key: "excel_best_window",
    season_label: String(row.melhor_epoca || "validar melhor época").trim(),
    months,
    fit_for_babies: babyFitFor(row.bom_para_bebe),
    crowd_level: "medium",
    price_level: String(row.nivel_custo || "").toLowerCase().includes("lux") ? "high" : "medium",
    weather_risk: weatherRiskFor(row),
    rainy_day_plan_needed: rainyPlanNeeded(row),
    recommendation_summary: String(row.janela_viagem || "").trim(),
    attention_points: splitList(row.alertas_perrengue),
    created_at: now,
    updated_at: now
  }];
}

function toOriginAccessRow(destinationId, row) {
  const transport = transportModeFor(row.transporte_principal_sp);
  const totalMinutes = estimatedMinutes(row.tempo_estimado_sp);
  const logisticsBase = totalMinutes <= 120 ? 8.5 : totalMinutes <= 240 ? 7 : totalMinutes <= 480 ? 6 : totalMinutes <= 900 ? 4.5 : 3;
  return {
    id: randomUUID(),
    destination_id: destinationId,
    origin_id: originId,
    transport_mode: transport,
    estimated_total_minutes: totalMinutes,
    estimated_flight_minutes: transport === "flight" ? Math.max(60, totalMinutes - 90) : null,
    estimated_drive_minutes: transport === "car" ? totalMinutes : null,
    estimated_bus_minutes: transport === "bus" ? totalMinutes : null,
    estimated_transfer_minutes: transport === "flight" ? 90 : null,
    direct_route_usually_available: !String(row.tempo_estimado_sp || "").toLowerCase().includes("conex"),
    connection_or_transfer_needed: String(row.transporte_principal_sp || "").includes("+") || String(row.tempo_estimado_sp || "").toLowerCase().includes("conex"),
    car_needed_at_destination: String(row.transporte_principal_sp || "").toLowerCase().includes("carro"),
    stroller_complexity_score: totalMinutes > 600 ? 8 : totalMinutes > 240 ? 6 : 4,
    luggage_complexity_score: totalMinutes > 600 ? 8 : totalMinutes > 240 ? 6 : 4,
    baby_logistics_score: Math.max(2, logisticsBase - (String(row.bom_para_bebe || "").toLowerCase() === "não" ? 1.5 : 0)),
    toddler_logistics_score: Math.max(3, logisticsBase + 0.5),
    family_friendly_notes: [String(row.principais_forcas_familia || "").trim()].filter(Boolean),
    attention_points: splitList(row.alertas_perrengue),
    confidence_level: "medium",
    is_placeholder: true,
    created_at: now,
    updated_at: now
  };
}

function toRiskRows(destinationId, row) {
  return splitList(row.alertas_perrengue).slice(0, 4).map((risk) => ({
    id: randomUUID(),
    destination_id: destinationId,
    risk_key: slugify(risk),
    risk_label: risk,
    severity: riskSeverity(risk),
    applies_to_age_ranges: ["0-6m", "6-12m", "1-3y", "3-5y"],
    description: risk,
    mitigation: "Validar no diagnóstico e confirmar logística antes da reserva.",
    created_at: now
  }));
}

async function deleteExistingForDestinations(table, destinationIds, filterColumn, filterValues) {
  if (!destinationIds.length) return;
  let query = client.from(table).delete().in("destination_id", destinationIds);
  if (filterColumn && filterValues?.length) query = query.in(filterColumn, filterValues);
  const { error } = await query;
  if (error) throw new Error(`${table} delete: ${error.code} ${error.message}`);
}

async function upsertChunks(table, rows, options = {}, chunkSize = 100) {
  if (!rows.length) return 0;
  let done = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await client.from(table).upsert(rows.slice(index, index + chunkSize), options);
    if (error) throw new Error(`${table} upsert: ${error.code || ""} ${error.message}`);
    done += rows.slice(index, index + chunkSize).length;
  }
  return done;
}

async function fetchAll(table, select = "*") {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client.from(table).select(select).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

function hasCoverage(row, destinations) {
  const tokens = requiredNames(row.cidade_regiao);
  return destinations.some((destination) => tokens.some((token) => {
    const values = [destination.name, destination.city, destination.slug].map(norm).filter(Boolean);
    return values.some((value) => value === token || value.includes(token) || token.includes(value));
  }));
}

function requiredNames(rawName) {
  return String(rawName || "").split("/").map(norm).filter(Boolean);
}

function destinationTypesFor(row) {
  return dedupe([
    slugify(row.tipo_destino),
    ...String(row.tags_ia || "").split(",").map((item) => slugify(item.trim())),
    String(row.pais || "").toLowerCase() === "brasil" ? "brasil" : "internacional"
  ].filter(Boolean));
}

function scopeFor(row) {
  const text = `${row.tipo_destino || ""} ${row.tags_ia || ""}`.toLowerCase();
  if (text.includes("praia")) return "beach_area";
  if (text.includes("parque")) return "theme_park_area";
  if (text.includes("natureza") || text.includes("safari") || text.includes("campo")) return "region";
  if (String(row.pais || "").toLowerCase() !== "brasil") return "international_city";
  return "city";
}

function transportModeFor(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("avi") || text.includes("voo")) return "flight";
  if (text.includes("ônibus") || text.includes("onibus")) return "bus";
  return "car";
}

function estimatedMinutes(value) {
  const text = String(value || "").toLowerCase();
  const explicit = [...text.matchAll(/(\d+)h(?:(\d{1,2}))?/g)].map((match) => Number(match[1]) * 60 + Number(match[2] || 0));
  if (explicit.length) return Math.round(explicit.reduce((sum, item) => sum + item, 0) / explicit.length);
  if (text.includes("muito longo")) return 1260;
  if (text.includes("voo longo")) return 1080;
  if (text.includes("conex")) return 900;
  if (text.includes("voo")) return 720;
  return 180;
}

function monthsFor(value) {
  const text = norm(value);
  const months = new Set();
  const map = [
    ["janeiro", 1], ["fevereiro", 2], ["marco", 3], ["abril", 4], ["maio", 5], ["junho", 6],
    ["julho", 7], ["agosto", 8], ["setembro", 9], ["outubro", 10], ["novembro", 11], ["dezembro", 12]
  ];
  for (const [name, month] of map) if (text.includes(name)) months.add(month);
  if (text.includes("ano todo")) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  if (text.includes("primavera")) [9, 10, 11].forEach((month) => months.add(month));
  if (text.includes("verao")) [12, 1, 2, 3].forEach((month) => months.add(month));
  if (text.includes("outono")) [3, 4, 5, 6].forEach((month) => months.add(month));
  if (text.includes("inverno")) [6, 7, 8, 9].forEach((month) => months.add(month));
  return [...months].sort((a, b) => a - b);
}

function weatherRiskFor(row) {
  const text = String(row.alertas_perrengue || "").toLowerCase();
  if (text.includes("calor") || text.includes("chuva") || text.includes("frio")) return "medium";
  return "low";
}

function rainyPlanNeeded(row) {
  const text = `${row.tipo_destino || ""} ${row.alertas_perrengue || ""}`.toLowerCase();
  return text.includes("praia") || text.includes("chuva") || text.includes("parque");
}

function babyFitFor(value) {
  const text = String(value || "").toLowerCase();
  if (text === "sim") return "excellent";
  if (text === "talvez") return "acceptable";
  return "acceptable";
}

function riskSeverity(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("segurança") || text.includes("voo muito longo") || text.includes("altíssimo")) return "high";
  if (text.includes("voo") || text.includes("custo") || text.includes("calor") || text.includes("lotação")) return "medium";
  return "low";
}

function splitList(value) {
  return String(value || "").split(/,|;/).map((item) => item.trim()).filter(Boolean);
}

function displayName(value) {
  return String(value || "").replace(/\s*\/\s*/g, " / ").trim();
}

function slugify(value) {
  return norm(value).replace(/\s+/g, "-");
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

function dedupe(items, key = null) {
  const seen = new Set();
  return items.filter((item) => {
    const value = key ? item[key] : item;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
