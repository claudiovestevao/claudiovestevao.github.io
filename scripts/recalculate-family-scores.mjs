import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_CHECK_KEY;
const originId = process.env.FAMILY_SCORE_ORIGIN_ID || "355cf841-e5c7-4002-91b0-da1e28f2cb3d";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_CHECK_KEY.");
}

const client = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const now = new Date().toISOString();
const SCORE_LABELS = {
  gold: "Ouro - Experi\u00eancia Fam\u00edlia Excelente",
  silver: "Prata - Muito bom para Fam\u00edlias",
  bronze: "Bronze - Vi\u00e1vel com planejamento",
  blocked: "N\u00e3o recomendado neste perfil"
};

async function main() {
  const [
    destinations,
    profiles,
    existingScores,
    existingFits,
    accessRows,
    routeRows,
    seasonRows,
    riskRows,
    tagRows,
    propertyTypeRows,
    hotelRows,
    placeRows,
    eventRows
  ] = await Promise.all([
    fetchAll("destinations", "*", (query) => query.eq("is_active", true)),
    fetchAll("family_profiles", "*", (query) => query.eq("is_active", true)),
    fetchAll("destination_scores"),
    fetchAll("destination_family_fit"),
    fetchAll("destination_origin_access"),
    fetchAll("destination_sp_route"),
    fetchAll("destination_seasonality"),
    fetchAll("destination_risk_factors"),
    fetchAll("destination_tags"),
    fetchAll("destination_recommended_property_types"),
    fetchAll("destination_hotels"),
    fetchAll("destination_google_places"),
    fetchAll("destination_event_demand")
  ]);

  const indexes = {
    accessByDest: groupByDestination(accessRows),
    routeByDest: groupByDestination(routeRows),
    seasonByDest: groupByDestination(seasonRows),
    riskByDest: groupByDestination(riskRows),
    tagByDest: groupByDestination(tagRows),
    propertyTypesByDest: groupByDestination(propertyTypeRows),
    hotelsByDest: groupByDestination(hotelRows),
    placesByDest: groupByDestination(placeRows),
    eventsByDest: groupByDestination(eventRows)
  };

  const scoreByKey = new Map(
    existingScores.map((row) => [`${row.destination_id}|${row.origin_id || ""}|${row.family_profile_id}`, row])
  );
  const fitByKey = new Map(
    existingFits.map((row) => [`${row.destination_id}|${row.family_profile_id}`, row])
  );

  const scoreRows = [];
  const fitRows = [];
  const counters = {
    insertedScores: 0,
    updatedScores: 0,
    insertedFits: 0,
    updatedFits: 0
  };

  for (const destination of destinations) {
    for (const profile of profiles) {
      const score = computeScore(destination, profile, indexes);
      const scoreKey = `${destination.id}|${originId}|${profile.id}`;
      const existingScore = scoreByKey.get(scoreKey);
      if (existingScore) counters.updatedScores += 1;
      else counters.insertedScores += 1;
      scoreRows.push({
        id: existingScore?.id || randomUUID(),
        destination_id: destination.id,
        origin_id: originId,
        family_profile_id: profile.id,
        ...score,
        calculated_at: now
      });

      const fit = computeFit(destination, profile, score, indexes);
      const fitKey = `${destination.id}|${profile.id}`;
      const existingFit = fitByKey.get(fitKey);
      if (existingFit) counters.updatedFits += 1;
      else counters.insertedFits += 1;
      fitRows.push({
        id: existingFit?.id || randomUUID(),
        destination_id: destination.id,
        family_profile_id: profile.id,
        ...fit,
        updated_at: now
      });
    }
  }

  const scoreDone = await upsertChunks("destination_scores", scoreRows);
  const fitDone = await upsertChunks("destination_family_fit", fitRows);
  const [{ count: totalDestinationScores }, { count: totalDestinationFamilyFit }] = await Promise.all([
    client.from("destination_scores").select("*", { count: "exact", head: true }),
    client.from("destination_family_fit").select("*", { count: "exact", head: true })
  ]);

  console.log(JSON.stringify({
    destinations: destinations.length,
    profiles: profiles.length,
    scoreRowsPrepared: scoreRows.length,
    fitRowsPrepared: fitRows.length,
    scoreRowsUpserted: scoreDone,
    fitRowsUpserted: fitDone,
    totalDestinationScores,
    totalDestinationFamilyFit,
    ...counters,
    labels: countBy(scoreRows, "label"),
    fits: countBy(fitRows, "fit_level")
  }, null, 2));
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
    const { error } = await retry(() => client.from(table).upsert(chunk));
    if (error) throw new Error(`${table} upsert: ${error.code || ""} ${error.message}`);
    done += chunk.length;
  }
  return done;
}

async function retry(operation, attempts = 4) {
  let lastResult;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      lastResult = await operation();
      if (!lastResult.error) return lastResult;
      if (attempt === attempts) return lastResult;
    } catch (error) {
      if (attempt === attempts) throw error;
      lastResult = { error };
    }
    await new Promise((resolve) => setTimeout(resolve, 450 * attempt));
  }
  return lastResult;
}

function groupByDestination(rows) {
  return rows.reduce((map, row) => {
    if (!map.has(row.destination_id)) map.set(row.destination_id, []);
    map.get(row.destination_id).push(row);
    return map;
  }, new Map());
}

function computeScore(destination, profile, indexes) {
  const logistics = logisticsScore(destination, profile, indexes);
  const structure = structureScore(destination, profile, indexes);
  const seasonality = seasonalityScore(destination, profile, indexes);
  const rainy = rainyDayScore(destination, profile, indexes);
  const safety = safetyScore(destination, profile, indexes);
  const parentComfort = parentComfortScore(destination, profile, {
    logistics,
    structure,
    seasonality,
    rainy,
    safety
  }, indexes);
  const weights = weightsFor(profile);
  let overall =
    logistics * weights.logistics +
    structure * weights.structure +
    seasonality * weights.seasonality +
    rainy * weights.rainy +
    safety * weights.safety +
    parentComfort * weights.parentComfort;
  const kind = profileKind(profile);
  const access = chooseAccess(indexes.accessByDest.get(destination.id), profile);
  if (kind.avoidsAirport && access?.transport_mode === "flight") overall = Math.min(overall, 5.9);
  if (kind.isTinyBaby && destination.country && destination.country !== "Brasil") overall = Math.min(overall, 5.8);
  if (
    kind.isTinyBaby &&
    hasAny([...(destination.destination_types || []), destination.destination_scope || ""], ["theme_park", "parque"]) &&
    logistics < 6.2
  ) {
    overall = Math.min(overall, 6.1);
  }

  return {
    overall_score: clamp(overall),
    logistics_score: logistics,
    baby_structure_potential_score: structure,
    seasonality_score: seasonality,
    rainy_day_score: rainy,
    safety_score: safety,
    parent_comfort_score: parentComfort,
    label: scoreLabel(overall),
    confidence_level: confidence(destination, indexes)
  };
}

function computeFit(destination, profile, score, indexes) {
  const kind = profileKind(profile);
  const types = [...(destination.destination_types || []), destination.destination_scope || ""];
  const access = chooseAccess(indexes.accessByDest.get(destination.id), profile);
  let fit = score.overall_score >= 8.3
    ? "excellent"
    : score.overall_score >= 7.3
      ? "good"
      : score.overall_score >= 6.2
        ? "acceptable"
        : "avoid";

  if (kind.avoidsAirport && access?.transport_mode === "flight") fit = "avoid";
  if (kind.isTinyBaby && destination.country && destination.country !== "Brasil") fit = "avoid";
  if (
    kind.wantsResort &&
    !hasAny([...types, ...staySignals(destination, indexes).propertyTypes], ["resort", "hotel_fazenda", "resort_area"]) &&
    score.baby_structure_potential_score < 7.4
  ) {
    fit = fit === "excellent" ? "good" : fit === "good" ? "acceptable" : fit;
  }

  const agePlan = agePlanFor(destination, profile);
  const durationMin = access?.transport_mode === "flight" ? 5 : score.logistics_score >= 8.5 ? 2 : 3;
  const durationMax = access?.transport_mode === "flight" ? 8 : score.logistics_score >= 8.5 ? 4 : 5;
  const positives = [];
  const cautions = [];
  const conditions = [];

  if (score.logistics_score >= 8) positives.push("deslocamento simples a partir de S\u00e3o Paulo");
  else cautions.push("deslocamento exige mais planejamento");
  if (score.baby_structure_potential_score >= 8) positives.push("boa chance de estrutura infantil e rotina mais previs\u00edvel");
  else conditions.push("confirmar estrutura infantil antes da reserva");
  if (score.safety_score >= 8) positives.push("baixo n\u00edvel de alerta na curadoria familiar");
  else cautions.push("h\u00e1 pontos de aten\u00e7\u00e3o para seguran\u00e7a/conforto");
  if (score.rainy_day_score < 6.5) conditions.push("ter plano B para chuva");
  if (kind.isBaby) conditions.push("confirmar ber\u00e7o, copa baby e quarto silencioso");
  if (kind.hasGrandparents) conditions.push("validar acessibilidade e dist\u00e2ncias internas");
  if (kind.avoidsAirport) conditions.push("priorizar rota sem aeroporto");
  if (kind.wantsResort) conditions.push("comparar hospedagens com lazer, alimenta\u00e7\u00e3o pr\u00e1tica e rotina previs\u00edvel");

  return {
    fit_level: fit,
    ideal_age_ranges: agePlan.idealAgeRanges,
    minimum_recommended_age_months: agePlan.minimumAgeMonths,
    recommended_trip_duration_days_min: durationMin,
    recommended_trip_duration_days_max: durationMax,
    why_it_fits: positives.length ? `${positives.join("; ")}.` : null,
    why_to_avoid: fit === "avoid"
      ? `${(cautions.length ? cautions : ["n\u00e3o cumpre a r\u00e9gua m\u00ednima para este perfil familiar"]).join("; ")}.`
      : cautions.length
        ? `${cautions.join("; ")}.`
        : null,
    must_have_conditions: [...new Set(conditions)].slice(0, 5)
  };
}

function logisticsScore(destination, profile, indexes) {
  const kind = profileKind(profile);
  const access = chooseAccess(indexes.accessByDest.get(destination.id), profile);
  const route = getRoute(destination.id, indexes);
  let score = 5.2;
  if (access) {
    score = Number(kind.isBaby ? access.baby_logistics_score : access.toddler_logistics_score) || score;
    const minutes = Number(access.estimated_total_minutes || access.estimated_drive_minutes || 0);
    if (minutes > 0) {
      if (minutes <= 90) score += 1.2;
      else if (minutes <= 150) score += 0.7;
      else if (minutes <= 240) score += 0.2;
      else if (minutes <= 360) score -= 0.7;
      else if (minutes <= 480) score -= 1.2;
      else score -= 2.1;
    }
    if (access.transport_mode === "flight") score -= kind.isTinyBaby ? 1.1 : 0.35;
    if (access.transport_mode === "bus" && !kind.acceptsBus) score -= kind.isBaby ? 1.1 : 0.35;
    if (kind.acceptsBus && access.transport_mode === "bus") score += 0.8;
    if (kind.avoidsAirport && access.transport_mode === "flight") score = Math.min(score, 4.4);
    if (access.connection_or_transfer_needed) score -= kind.isBaby ? 0.9 : 0.4;
    if (access.car_needed_at_destination && (kind.isBaby || kind.hasGrandparents)) score -= 0.5;
  }
  if (route && Number(route.drive_minutes) > 0) {
    const minutes = Number(route.drive_minutes_traffic || route.drive_minutes);
    const routeScore = minutes <= 75
      ? 9.6
      : minutes <= 120
        ? 9
        : minutes <= 180
          ? 8.2
          : minutes <= 240
            ? 7.3
            : minutes <= 330
              ? 6.2
              : minutes <= 450
                ? 5.2
                : 4.2;
    score = access ? score * 0.72 + routeScore * 0.28 : routeScore;
  } else if (!access) {
    if (destination.country && destination.country !== "Brasil") score = 3.6;
    else if (destination.state === "SP") score = 6.6;
    else score = 5.4;
  }
  if (kind.hasGrandparents && score > 8.5) score -= 0.2;
  return clamp(score);
}

function structureScore(destination, profile, indexes) {
  const kind = profileKind(profile);
  const types = [...(destination.destination_types || []), destination.destination_scope || ""].map(String);
  const tags = (indexes.tagByDest.get(destination.id) || []).map((row) => `${row.tag_key} ${row.tag_label} ${row.tag_category}`);
  const stays = staySignals(destination, indexes);
  const hotels = indexes.hotelsByDest.get(destination.id) || [];
  const places = indexes.placesByDest.get(destination.id) || [];
  let score = 6;
  if (hasAny(types, ["resort", "resort_area"])) score += 1.35;
  if (hasAny(types, ["hotel_fazenda", "campo"])) score += 0.95;
  if (stays.hasFullService) score += 0.7;
  if (stays.hasIndependentStay) score += kind.isBaby ? 0.35 : 0.55;
  if (stays.hasPousada) score += kind.isBaby ? 0.2 : 0.45;
  if (stays.hasKitchen) score += kind.isBaby || kind.isToddler ? 0.75 : 0.35;
  if (stays.hasChaleOrCabana) score += kind.hasGrandparents ? -0.25 : 0.25;
  if (hasAny(types, ["praia"])) score += 0.35;
  if (hasAny(types, ["cidade"])) score += 0.2;
  if (hasAny(types, ["parque", "theme_park"])) score += kind.isOlderChild ? 1.1 : kind.isBaby ? -0.8 : 0.35;
  if (hasAny(types, ["ecoturismo", "natureza"])) score += kind.isBaby ? -0.55 : 0.25;
  if (hasAny(tags, ["copa_baby", "bom para beb\u00ea", "bom_para_bebe"])) score += 0.7;
  if (hasAny(tags, ["funciona_com_chuva", "funciona com chuva"])) score += 0.45;
  if (hasAny(tags, ["praia_calma", "praia calma"])) score += 0.5;
  if (hasAny(tags, ["alto_custo_em_temporada"])) score -= 0.15;
  if (hotels.length) score += 0.35 + Math.min(0.45, hotels.length * 0.05);
  const placeRatings = places.map((row) => Number(row.google_rating)).filter(Number.isFinite);
  if (placeRatings.length) score += mean(placeRatings, 4.3) >= 4.6 ? 0.35 : mean(placeRatings, 4.3) >= 4.3 ? 0.15 : -0.25;
  const familyReviewCount = places.reduce((sum, row) => sum + Number(row.family_review_count || 0), 0);
  if (familyReviewCount > 0) score += 0.25;
  if (destination.is_placeholder) score -= 0.7;
  if (kind.wantsResort && !stays.hasFullService) score -= 0.8;
  if (kind.isBaby && score < 7) score -= 0.3;
  return clamp(score);
}

function seasonalityScore(destination, profile, indexes) {
  const kind = profileKind(profile);
  const seasons = indexes.seasonByDest.get(destination.id) || [];
  if (!seasons.length) return clamp(destination.is_mvp_priority ? 7.1 : 6.4);
  const scores = seasons.map((row) => {
    let score = 7;
    if (row.fit_for_babies === true) score += kind.isBaby ? 1 : 0.35;
    if (row.fit_for_babies === false && kind.isBaby) score -= 0.9;
    const crowd = String(row.crowd_level || "").toLowerCase();
    if (crowd.includes("low") || crowd.includes("baixa")) score += 0.4;
    if (crowd.includes("high") || crowd.includes("alta")) score -= kind.isBaby ? 0.75 : 0.35;
    const price = String(row.price_level || "").toLowerCase();
    if (price.includes("high") || price.includes("alto")) score -= 0.25;
    const weather = String(row.weather_risk || "").toLowerCase();
    if (weather.includes("low") || weather.includes("baixo")) score += 0.55;
    if (weather.includes("medium") || weather.includes("m\u00e9dio") || weather.includes("medio")) score -= 0.2;
    if (weather.includes("high") || weather.includes("alto")) score -= 0.8;
    return score;
  });
  const event = (indexes.eventsByDest.get(destination.id) || [])
    .sort((a, b) => new Date(b.last_synced_at || b.created_at || 0) - new Date(a.last_synced_at || a.created_at || 0))[0];
  let score = mean(scores, 6.8);
  const movement = String(event?.movimento_level || "").toLowerCase();
  if (movement.includes("cheio") || movement.includes("alto") || movement.includes("high")) score -= kind.isBaby ? 0.45 : 0.25;
  if (movement.includes("normal")) score += 0.15;
  return clamp(score);
}

function rainyDayScore(destination, profile, indexes) {
  const kind = profileKind(profile);
  const types = [...(destination.destination_types || []), destination.destination_scope || ""].map(String);
  const tags = (indexes.tagByDest.get(destination.id) || []).map((row) => `${row.tag_key} ${row.tag_label}`);
  const stays = staySignals(destination, indexes);
  const seasons = indexes.seasonByDest.get(destination.id) || [];
  let score = 6.4;
  if (hasAny([...types, ...tags], ["resort", "hotel_fazenda", "funciona_com_chuva", "funciona com chuva", "cidade"])) score += 1.25;
  if (stays.hasKitchen || stays.hasApartHotel) score += 0.45;
  if (stays.hasChaleOrCabana && !kind.isBaby) score += 0.25;
  if (hasAny(types, ["praia"])) score -= 0.45;
  if (hasAny(types, ["ecoturismo", "natureza"])) score -= 0.55;
  const rainyNeed = seasons.filter((row) => row.rainy_day_plan_needed === true).length;
  if (rainyNeed) score -= Math.min(1.1, rainyNeed * 0.35);
  if (kind.isBaby) score -= 0.15;
  return clamp(score);
}

function safetyScore(destination, profile, indexes) {
  const kind = profileKind(profile);
  const risks = indexes.riskByDest.get(destination.id) || [];
  const places = indexes.placesByDest.get(destination.id) || [];
  let score = 8.1;
  for (const risk of risks) {
    const severity = String(risk.severity || "").toLowerCase();
    const ageText = JSON.stringify(risk.applies_to_age_ranges || []).toLowerCase();
    const appliesStrongly = kind.isBaby && (ageText.includes("bebe") || ageText.includes("baby") || ageText.includes("0"));
    if (severity.includes("high") || severity.includes("alta")) score -= appliesStrongly ? 1.25 : 0.9;
    else if (severity.includes("medium") || severity.includes("m\u00e9dia") || severity.includes("media")) score -= appliesStrongly ? 0.75 : 0.5;
    else score -= 0.22;
  }
  const rating = mean(places.map((row) => Number(row.google_rating)).filter(Number.isFinite), NaN);
  if (Number.isFinite(rating)) {
    if (rating >= 4.7) score += 0.45;
    else if (rating >= 4.4) score += 0.2;
    else if (rating < 4.1) score -= 0.45;
  }
  const types = [...(destination.destination_types || []), destination.destination_scope || ""];
  if (hasAny(types, ["ecoturismo", "natureza"]) && kind.isBaby) score -= 0.35;
  if (destination.is_placeholder) score -= 0.25;
  return clamp(score);
}

function parentComfortScore(destination, profile, scores, indexes) {
  const kind = profileKind(profile);
  const types = [...(destination.destination_types || []), destination.destination_scope || ""];
  const stays = staySignals(destination, indexes);
  const access = chooseAccess(indexes.accessByDest.get(destination.id), profile);
  const events = indexes.eventsByDest.get(destination.id) || [];
  let score =
    scores.logistics * 0.28 +
    scores.structure * 0.32 +
    scores.rainy * 0.14 +
    scores.safety * 0.16 +
    scores.seasonality * 0.1;
  if (hasAny(types, ["resort", "hotel_fazenda", "resort_area"]) || stays.hasFullService) score += 0.65;
  if (stays.hasKitchen) score += kind.isBaby || kind.isToddler ? 0.45 : 0.2;
  if (stays.hasIndependentStay && !kind.isBaby) score += 0.25;
  if (hasAny(types, ["parque"]) && kind.isBaby) score -= 0.65;
  if (access?.car_needed_at_destination) score -= kind.hasGrandparents ? 0.55 : 0.25;
  if (access?.connection_or_transfer_needed) score -= kind.isBaby ? 0.45 : 0.2;
  const movement = JSON.stringify(events.map((event) => event.movimento_level || "")).toLowerCase();
  if (movement.includes("cheio") || movement.includes("alto") || movement.includes("high")) score -= 0.25;
  return clamp(score);
}

function chooseAccess(rows, profile) {
  const kind = profileKind(profile);
  if (!rows?.length) return null;
  const scored = rows.map((row) => {
    let score = 0;
    if (row.transport_mode === "car") score += 3;
    if (row.transport_mode === "bus") score += kind.acceptsBus ? 3.2 : 1.2;
    if (row.transport_mode === "flight") score += kind.avoidsAirport ? -5 : kind.isTinyBaby ? -1.5 : 0.8;
    if (kind.acceptsBus && row.transport_mode === "bus") score += 2;
    if (kind.avoidsAirport && row.transport_mode !== "flight") score += 4;
    const minutes = Number(row.estimated_total_minutes || row.estimated_drive_minutes || 999);
    score += Math.max(0, 6 - minutes / 90);
    score += Number(kind.isBaby ? row.baby_logistics_score : row.toddler_logistics_score) || 0;
    if (row.connection_or_transfer_needed) score -= kind.isBaby ? 1.2 : 0.6;
    if (row.car_needed_at_destination && (kind.isBaby || kind.hasGrandparents)) score -= 0.8;
    return { row, score };
  });
  return scored.sort((a, b) => b.score - a.score)[0].row;
}

function getRoute(destinationId, indexes) {
  const rows = indexes.routeByDest.get(destinationId) || [];
  return rows.find((row) => row.google_status === "OK") || rows[0] || null;
}

function profileKind(profile) {
  const key = profile.profile_key;
  return {
    isBaby: key.includes("bebe") || key.includes("primeira") || key.includes("rotina"),
    isTinyBaby: key.includes("0_6") || key.includes("primeira") || key.includes("rotina"),
    isToddler: key.includes("toddler") || key.includes("1_3") || key.includes("mais_de_um"),
    isOlderChild: key.includes("3_5"),
    wantsResort: key.includes("quer_resort"),
    avoidsAirport: key.includes("evitar_aeroporto"),
    acceptsBus: key.includes("aceita_onibus"),
    hasGrandparents: key.includes("avos"),
    rigidRoutine: key.includes("rotina")
  };
}

function agePlanFor(destination, profile) {
  const kind = profileKind(profile);
  const types = [...(destination.destination_types || []), destination.destination_scope || ""];
  const stayText = JSON.stringify(types).toLowerCase();
  let minimumAgeMonths = 0;
  let idealAgeRanges = ["0-6m", "6-12m", "1-3y", "3-5y"];
  if (hasAny(types, ["parque", "theme_park"])) {
    minimumAgeMonths = 36;
    idealAgeRanges = ["3-5y"];
  } else if (destination.country && destination.country !== "Brasil") {
    minimumAgeMonths = 24;
    idealAgeRanges = ["3-5y"];
  } else if (hasAny(types, ["praia"]) && !hasAny(types, ["resort"])) {
    minimumAgeMonths = 6;
    idealAgeRanges = ["6-12m", "1-3y", "3-5y"];
  } else if (hasAny(types, ["resort", "hotel_fazenda", "resort_area"])) {
    minimumAgeMonths = 0;
    idealAgeRanges = ["0-6m", "6-12m", "1-3y", "3-5y"];
  } else if (stayText.includes("chale") || stayText.includes("cabana")) {
    minimumAgeMonths = 12;
    idealAgeRanges = ["1-3y", "3-5y"];
  }
  if (kind.isOlderChild) idealAgeRanges = ["3-5y"];
  if (kind.isToddler) idealAgeRanges = ["1-3y", "3-5y"];
  if (kind.isBaby) {
    idealAgeRanges = ["0-6m", "6-12m", "1-3y"].filter((age) => minimumAgeMonths <= ageMinimum(age));
  }
  return {
    minimumAgeMonths,
    idealAgeRanges: idealAgeRanges.length ? idealAgeRanges : ["validar no diagn\u00f3stico"]
  };
}

function ageMinimum(age) {
  if (age === "0-6m") return 0;
  if (age === "6-12m") return 6;
  if (age === "1-3y") return 12;
  return 36;
}

function weightsFor(profile) {
  const kind = profileKind(profile);
  if (kind.avoidsAirport || kind.acceptsBus) {
    return { logistics: 0.34, structure: 0.2, seasonality: 0.08, rainy: 0.06, safety: 0.19, parentComfort: 0.13 };
  }
  if (kind.isBaby) {
    return { logistics: 0.29, structure: 0.23, seasonality: 0.08, rainy: 0.06, safety: 0.2, parentComfort: 0.14 };
  }
  if (kind.wantsResort || kind.isOlderChild) {
    return { logistics: 0.2, structure: 0.29, seasonality: 0.1, rainy: 0.08, safety: 0.16, parentComfort: 0.17 };
  }
  return { logistics: 0.24, structure: 0.25, seasonality: 0.1, rainy: 0.08, safety: 0.18, parentComfort: 0.15 };
}

function staySignals(destination, indexes) {
  const propertyRows = indexes.propertyTypesByDest?.get(destination.id) || [];
  const stayTags = (indexes.tagByDest.get(destination.id) || [])
    .filter((row) => row.tag_category === "hospedagem")
    .map((row) => `${row.tag_key} ${row.tag_label}`.toLowerCase());
  const propertyTypes = propertyRows.map((row) => row.property_type);
  const amenityText = propertyRows
    .flatMap((row) => [
      row.property_type,
      ...(row.required_amenity_keys || []),
      ...(row.preferred_amenity_keys || [])
    ])
    .join(" ")
    .toLowerCase();
  const text = `${propertyTypes.join(" ")} ${stayTags.join(" ")} ${amenityText}`;
  return {
    propertyTypes,
    hasFullService: hasAny([text], ["resort", "hotel_fazenda", "pensao_completa", "recreacao"]),
    hasIndependentStay: hasAny([text], ["pousada", "apart_hotel", "chale", "chal\u00e9", "cabana", "casa_temporada", "casa de temporada", "flat"]),
    hasPousada: hasAny([text], ["pousada"]),
    hasApartHotel: hasAny([text], ["apart_hotel", "flat"]),
    hasKitchen: hasAny([text], ["cozinha", "apart_hotel", "flat", "casa_temporada", "casa de temporada"]),
    hasChaleOrCabana: hasAny([text], ["chale", "chal\u00e9", "cabana"])
  };
}

function confidence(destination, indexes) {
  const evidence = [
    (indexes.accessByDest.get(destination.id) || []).length > 0,
    (indexes.routeByDest.get(destination.id) || []).some((row) => row.google_status === "OK"),
    (indexes.seasonByDest.get(destination.id) || []).length > 0,
    (indexes.riskByDest.get(destination.id) || []).length > 0,
    (indexes.tagByDest.get(destination.id) || []).length > 0,
    (indexes.propertyTypesByDest.get(destination.id) || []).length > 0,
    (indexes.hotelsByDest.get(destination.id) || []).length > 0 || (indexes.placesByDest.get(destination.id) || []).length > 0,
    !destination.is_placeholder
  ].filter(Boolean).length;
  if (evidence >= 6) return "high";
  if (evidence >= 4) return "medium";
  return "low";
}

function scoreLabel(overall) {
  if (overall >= 8.3) return SCORE_LABELS.gold;
  if (overall >= 7.3) return SCORE_LABELS.silver;
  if (overall >= 6.2) return SCORE_LABELS.bronze;
  return SCORE_LABELS.blocked;
}

function clamp(value, min = 1, max = 10) {
  return Math.max(min, Math.min(max, Number(value.toFixed(2))));
}

function mean(values, fallback = 6.5) {
  const clean = values.filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : fallback;
}

function hasAny(values, needles) {
  const haystack = values.join(" ").toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function countBy(rows, key) {
  return Object.fromEntries(
    [...rows.reduce((map, row) => {
      map.set(row[key], (map.get(row[key]) || 0) + 1);
      return map;
    }, new Map()).entries()].sort()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
