import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_CHECK_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_CHECK_KEY.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const now = new Date().toISOString();

async function main() {
  const [destinations, existingRows, existingTags] = await Promise.all([
    fetchAll("destinations", "*", (query) => query.eq("is_active", true)),
    fetchAll("destination_recommended_property_types"),
    fetchAll("destination_tags")
  ]);
  const existingByKey = new Map(existingRows.map((row) => [`${row.destination_id}|${row.property_type}`, row]));
  const existingTagsByKey = new Map(existingTags.map((row) => [`${row.destination_id}|${row.tag_key}`, row]));
  const rows = [];
  const tagRows = [];
  let inserted = 0;
  let updated = 0;
  let insertedTags = 0;
  let updatedTags = 0;

  for (const destination of destinations) {
    for (const recommendation of recommendationsFor(destination)) {
      if (!ALLOWED_PROPERTY_TYPES.has(recommendation.property_type)) {
        const tag = stayTagFor(destination.id, recommendation);
        const existingTag = existingTagsByKey.get(`${tag.destination_id}|${tag.tag_key}`);
        if (existingTag) updatedTags += 1;
        else insertedTags += 1;
        tagRows.push({
          id: existingTag?.id || randomUUID(),
          ...tag,
          created_at: existingTag?.created_at || now
        });
        continue;
      }
      const key = `${destination.id}|${recommendation.property_type}`;
      const existing = existingByKey.get(key);
      if (existing) updated += 1;
      else inserted += 1;
      rows.push({
        id: existing?.id || randomUUID(),
        destination_id: destination.id,
        ...recommendation,
        created_at: existing?.created_at || now,
        updated_at: now
      });
    }
  }

  const upserted = await upsertChunks("destination_recommended_property_types", rows);
  const tagsUpserted = await upsertChunks("destination_tags", tagRows);
  const { data: after } = await client
    .from("destination_recommended_property_types")
    .select("property_type");
  const { data: afterTags } = await client
    .from("destination_tags")
    .select("tag_key,tag_category")
    .eq("tag_category", "hospedagem");
  console.log(JSON.stringify({
    destinations: destinations.length,
    rowsPrepared: rows.length,
    tagsPrepared: tagRows.length,
    upserted,
    tagsUpserted,
    inserted,
    updated,
    insertedTags,
    updatedTags,
    propertyTypeCounts: countBy(after || [], "property_type"),
    stayTagCounts: countBy(afterTags || [], "tag_key")
  }, null, 2));
}

const ALLOWED_PROPERTY_TYPES = new Set(["hotel", "resort", "hotel_fazenda", "pousada", "apart_hotel"]);

function recommendationsFor(destination) {
  const types = [
    ...(destination.destination_types || []),
    destination.destination_scope || "",
    destination.macro_region || "",
    destination.name || ""
  ].join(" ").toLowerCase();
  const rows = [];

  if (includesAny(types, ["resort", "parque", "thermal", "termas", "\u00e1guas", "aguas"])) {
    rows.push(typeRow("resort", ["0-6m", "6-12m", "1-3y", "3-5y"], ["piscina_infantil"], ["recreacao", "restaurante", "copa_baby"], "Boa escolha quando a familia quer concentrar alimentacao, descanso e lazer no mesmo lugar.", ["Confirmar politica para criancas, berco e estrutura infantil real."]));
  }
  if (includesAny(types, ["hotel_fazenda", "fazenda", "campo", "rural", "interior"])) {
    rows.push(typeRow("hotel_fazenda", ["6-12m", "1-3y", "3-5y"], ["restaurante"], ["recreacao", "area_verde", "pensao_completa"], "Funciona bem para familias que querem natureza, rotina simples e refeicoes resolvidas.", ["Validar distancias internas, acessibilidade e cardapio infantil."]));
    rows.push(typeRow("chale", ["1-3y", "3-5y"], ["estacionamento"], ["cozinha", "area_externa", "lareira"], "Chale ou cabana da mais privacidade e ritmo proprio para familias que nao precisam de recreacao o dia todo.", ["Checar aquecimento, escadas, cozinha e isolamento do quarto."]));
  }
  if (includesAny(types, ["serra", "mantiqueira", "frio", "gramado", "campos"])) {
    rows.push(typeRow("pousada", ["6-12m", "1-3y", "3-5y"], ["aquecimento"], ["cafe_da_manha", "area_indoor", "poucas_escadas"], "Pousada acolhedora pode ser melhor que resort quando a familia quer charme, centro perto e rotina leve.", ["Evitar ladeiras, muitas escadas e quartos frios com bebe."]));
    rows.push(typeRow("chale", ["1-3y", "3-5y"], ["aquecimento"], ["cozinha", "estacionamento", "area_externa"], "Chale combina com serra para familias que querem espaco, silencio e autonomia nas refeicoes.", ["Confirmar seguranca de lareira, escadas e sacadas."]));
  }
  if (includesAny(types, ["praia", "litoral", "beach", "mar"])) {
    rows.push(typeRow("pousada", ["6-12m", "1-3y", "3-5y"], ["estacionamento"], ["beira_mar", "praia_calma", "poucas_escadas"], "Pousada perto da praia reduz deslocamento e permite pausas rapidas no quarto.", ["Confirmar acesso sem escadas e distancia real da praia."]));
    rows.push(typeRow("casa_temporada", ["1-3y", "3-5y"], ["cozinha"], ["lavanderia", "quartos_separados", "estacionamento"], "Casa de temporada funciona para familias maiores que precisam de cozinha, quartos e liberdade de horarios.", ["Validar piscina protegida, tela de seguranca e confiabilidade do anfitriao."]));
    if (!includesAny(types, ["resort"])) {
      rows.push(typeRow("hotel", ["1-3y", "3-5y"], ["cafe_da_manha"], ["piscina_infantil", "restaurante", "beira_mar"], "Hotel com cafe da manha e boa localizacao resolve uma viagem de praia sem exigir estrutura completa de resort.", ["Conferir tamanho do quarto e se ha restaurante por perto."]));
    }
  }
  if (includesAny(types, ["cidade", "capital", "urbano", "internacional", "city"])) {
    rows.push(typeRow("hotel", ["6-12m", "1-3y", "3-5y"], ["localizacao_central"], ["cafe_da_manha", "elevador", "berco"], "Hotel bem localizado reduz deslocamentos e simplifica passeios urbanos.", ["Confirmar elevador, berco e quarto silencioso."]));
    rows.push(typeRow("apart_hotel", ["0-6m", "6-12m", "1-3y", "3-5y"], ["cozinha", "localizacao_central"], ["lavanderia", "berco", "quarto_separado"], "Apart-hotel ajuda muito com papinha, mamadeira, soneca e rotina de criancas pequenas.", ["Confirmar cozinha equipada, limpeza e elevador."]));
  }
  if (includesAny(types, ["ecoturismo", "natureza", "chapada", "montanha", "parque"])) {
    rows.push(typeRow("pousada", ["1-3y", "3-5y"], ["estacionamento"], ["cafe_da_manha", "area_externa", "restaurante"], "Pousada estruturada serve como base mais simples para passeios de natureza.", ["Evitar hospedagens isoladas demais com bebe pequeno."]));
    rows.push(typeRow("cabana", ["3-5y"], ["estacionamento"], ["cozinha", "area_externa"], "Cabana pode ser uma experiencia especial para criancas maiores em viagem de natureza.", ["Checar acesso, sinal de celular e distancia de farmacia/hospital."]));
  }
  if (!rows.length) {
    rows.push(typeRow("hotel", ["1-3y", "3-5y"], ["cafe_da_manha"], ["estacionamento", "berco"], "Hotel simples e bem localizado e a opcao mais previsivel quando a curadoria local ainda esta em validacao.", ["Validar avaliacoes recentes antes de recomendar."]));
    rows.push(typeRow("pousada", ["1-3y", "3-5y"], ["estacionamento"], ["cafe_da_manha", "area_externa"], "Pousada pode funcionar bem em viagens regionais quando tem avaliacao consistente e boa localizacao.", ["Confirmar estrutura para criancas antes da reserva."]));
  }

  return dedupe(rows, "property_type").slice(0, 5);
}

function typeRow(propertyType, ages, required, preferred, reason, attentionPoints) {
  return {
    property_type: propertyType,
    recommended_for_age_ranges: ages,
    required_amenity_keys: required,
    preferred_amenity_keys: preferred,
    recommendation_reason: reason,
    attention_points: attentionPoints
  };
}

function stayTagFor(destinationId, recommendation) {
  const labels = {
    chale: "Chal\u00e9",
    cabana: "Cabana",
    casa_temporada: "Casa de temporada",
    flat: "Flat com cozinha"
  };
  return {
    destination_id: destinationId,
    tag_key: `hospedagem_${recommendation.property_type}`,
    tag_label: labels[recommendation.property_type] || recommendation.property_type,
    tag_category: "hospedagem"
  };
}

function includesAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function dedupe(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row[key])) return false;
    seen.add(row[key]);
    return true;
  });
}

async function fetchAll(table, select = "*", queryFn = (query) => query) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const query = queryFn(client.from(table).select(select).range(from, from + pageSize - 1));
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.code} ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function upsertChunks(table, rows, chunkSize = 100) {
  let done = 0;
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await client.from(table).upsert(chunk);
    if (error) throw new Error(`${table} upsert: ${error.code || ""} ${error.message}`);
    done += chunk.length;
  }
  return done;
}

function countBy(rows, key) {
  return Object.fromEntries(
    [...rows.reduce((map, row) => {
      map.set(row[key] || "unknown", (map.get(row[key] || "unknown") || 0) + 1);
      return map;
    }, new Map()).entries()].sort()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
