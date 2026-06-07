import { appConfig, hasServerSupabase } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  destinationFacets,
  filterStaticDestinations,
  normalizeDestination
} from "@/lib/destinations/search";
import {
  familyDestinationCatalog1001,
  familyDestinationCatalog1001Meta
} from "../../../../agentes/concierge-da-familia/src/data/familyDestinationCatalog1001.js";

export async function searchDestinations(params) {
  if (hasServerSupabase()) {
    const familyView = await searchSupabaseFamilyViewDestinations(params);
    if (familyView.ok) return familyView;
    const existing = await searchSupabaseExistingDestinations(params);
    if (existing.ok) return existing;
    const live = await searchSupabaseDestinations(params);
    if (live.ok) return live;
    console.warn("[family-concierge] Supabase destination sources unavailable", {
      existingError: existing.error,
      catalogError: live.error
    });
  }
  if (!appConfig.useStaticFallback) {
    return {
      ok: false,
      source: "none",
      destinations: [],
      facets: { states: [], types: [], curationLevels: [] },
      totalKnown: 0,
      error: "Supabase is not configured and static fallback is disabled."
    };
  }
  const destinations = filterStaticDestinations(familyDestinationCatalog1001, params);
  return {
    ok: true,
    source: "static_catalog_1001",
    destinations,
    facets: destinationFacets(familyDestinationCatalog1001),
    totalKnown: familyDestinationCatalog1001Meta.count
  };
}

export async function getDestinationCatalogStats() {
  if (hasServerSupabase()) {
    const client = getSupabaseServerClient();
    const familyView = await client
      .from("vw_destinations_for_sp_families")
      .select("slug", { count: "exact", head: true });
    if (!familyView.error && Number.isFinite(familyView.count)) {
      return { source: "supabase_family_view", count: familyView.count };
    }
    const existing = await client
      .from("destinations")
      .select("slug", { count: "exact", head: true })
      .eq("is_active", true);
    if (!existing.error && Number.isFinite(existing.count)) {
      return { source: "supabase_destinations", count: existing.count };
    }
    if (existing.error) {
      console.warn("[family-concierge] Supabase destinations stats failed", {
        code: existing.error.code,
        message: existing.error.message
      });
    }
    const { count, error } = await client
      .from("family_destination_catalog_1001")
      .select("slug", { count: "exact", head: true });
    if (!error && Number.isFinite(count)) {
      return { source: "supabase", count };
    }
  }
  return { source: "static_catalog_1001", count: familyDestinationCatalog1001Meta.count };
}

async function searchSupabaseFamilyViewDestinations(params) {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: "Supabase client unavailable" };

  const { data, error, count } = await client
    .from("vw_destinations_for_sp_families")
    .select("*", { count: "exact" })
    .order("overall_score", { ascending: false })
    .order("mvp_priority", { ascending: true })
    .limit(500);

  if (error) {
    console.warn("[family-concierge] Supabase family view search failed", {
      code: error.code,
      message: error.message
    });
    return { ok: false, source: "supabase_family_view", error: error.message };
  }

  const destinationIds = [...new Set((data || []).map((row) => row.destination_id).filter(Boolean))];
  const [coordinatesById, scoresById] = await Promise.all([
    fetchDestinationCoordinates(client, destinationIds),
    fetchDestinationScoreSummaries(client, destinationIds)
  ]);
  const normalized = (data || []).map((destination) => normalizeFamilyViewDestination(destination, coordinatesById, scoresById));
  const destinations = filterStaticDestinations(normalized, params);

  return {
    ok: true,
    source: "supabase_family_view",
    destinations,
    facets: destinationFacets(normalized),
    totalKnown: count || normalized.length
  };
}

async function fetchDestinationCoordinates(client, destinationIds) {
  if (!destinationIds.length) return new Map();
  const { data, error } = await client
    .from("destinations")
    .select("id,latitude,longitude,macro_region,short_description")
    .in("id", destinationIds)
    .limit(500);

  if (error) {
    console.warn("[family-concierge] Supabase destination coordinate lookup failed", {
      code: error.code,
      message: error.message
    });
    return new Map();
  }

  return new Map((data || []).map((destination) => [destination.id, destination]));
}

async function fetchDestinationScoreSummaries(client, destinationIds) {
  if (!destinationIds.length) return new Map();
  const data = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data: page, error } = await client
      .from("destination_scores")
      .select(`
        destination_id,
        overall_score,
        logistics_score,
        baby_structure_potential_score,
        seasonality_score,
        rainy_day_score,
        safety_score,
        parent_comfort_score,
        label,
        confidence_level
      `)
      .in("destination_id", destinationIds)
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn("[family-concierge] Supabase destination score lookup failed", {
        code: error.code,
        message: error.message
      });
      return new Map();
    }
    data.push(...(page || []));
    if (!page || page.length < pageSize) break;
  }

  const grouped = new Map();
  for (const score of data || []) {
    if (!grouped.has(score.destination_id)) grouped.set(score.destination_id, []);
    grouped.get(score.destination_id).push(score);
  }
  return new Map([...grouped.entries()].map(([destinationId, scores]) => [destinationId, summarizeScores(scores)]));
}

function summarizeScores(scores) {
  const recommendedScores = scores.filter((score) => Number(score.overall_score) >= 6.2);
  const rowsForAverage = recommendedScores.length ? recommendedScores : scores;
  const averageOverall = average(rowsForAverage, "overall_score");
  return {
    familyScore: Math.round(averageOverall * 10),
    scoreLabel: scoreLabelFor(averageOverall),
    scoreConfidence: confidenceFor(scores),
    fitSummary: {
      recommendedProfiles: recommendedScores.length,
      blockedProfiles: Math.max(0, scores.length - recommendedScores.length),
      totalProfiles: scores.length
    },
    categoryScores: {
      logistics: roundOne(average(rowsForAverage, "logistics_score")),
      structure: roundOne(average(rowsForAverage, "baby_structure_potential_score")),
      seasonality: roundOne(average(rowsForAverage, "seasonality_score")),
      rainyDay: roundOne(average(rowsForAverage, "rainy_day_score")),
      safety: roundOne(average(rowsForAverage, "safety_score")),
      parentComfort: roundOne(average(rowsForAverage, "parent_comfort_score"))
    }
  };
}

function scoreLabelFor(score) {
  if (score >= 8.3) return "Ouro - Experiência Família Excelente";
  if (score >= 7.3) return "Prata - Muito bom para Famílias";
  if (score >= 6.2) return "Bronze - Viável com planejamento";
  return "Não recomendado neste perfil";
}

function confidenceFor(scores) {
  const counts = scores.reduce((acc, score) => {
    const level = score.confidence_level || "low";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "low";
}

function average(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function normalizeFamilyViewDestination(destination, coordinatesById, scoresById) {
  const coordinates = coordinatesById.get(destination.destination_id) || {};
  const scoreSummary = scoresById.get(destination.destination_id);
  const score = Number(scoreSummary?.familyScore || Math.round(Number(destination.overall_score || 0) * 10));
  const tags = [
    ...(destination.top_tags || []),
    ...(destination.destination_types || []),
    destination.best_transport_mode_from_sp,
    destination.estimated_total_minutes_from_sp
      ? `${Math.round(destination.estimated_total_minutes_from_sp / 60)}h desde SP`
      : ""
  ].filter(Boolean);

  return normalizeDestination({
    slug: destination.slug,
    name: destination.name,
    stateCode: destination.state,
    stateName: destination.state,
    country: destination.country || "Brasil",
    macroRegion: coordinates.macro_region || "",
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    rank: destination.mvp_priority || 999,
    familyScore: score,
    scoreLabel: scoreSummary?.scoreLabel || destination.label || "",
    scoreConfidence: scoreSummary?.scoreConfidence || "",
    fitSummary: scoreSummary?.fitSummary,
    categoryScores: scoreSummary?.categoryScores,
    destinationType: destination.destination_types?.[0] || "regional_family_base",
    curationLevel: destination.is_placeholder ? "family_destination_candidate" : "known_family_destination",
    recommendationReadiness: destination.is_placeholder ? "needs_hotel_and_place_validation" : "ready_for_editorial_review",
    minimumFamilyRequirementsPassed: false,
    tags,
    idealAges: destination.ideal_age_ranges || [],
    travelModes: [
      destination.best_transport_mode_from_sp,
      destination.estimated_total_minutes_from_sp
        ? `${destination.estimated_total_minutes_from_sp} min desde SP`
        : ""
    ].filter(Boolean),
    bestFor: destination.family_summary || coordinates.short_description || "",
    attentionPoints: destination.main_attention_points || []
  });
}

async function searchSupabaseDestinations(params) {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: "Supabase client unavailable" };

  let query = client
    .from("family_destination_catalog_1001")
    .select("*")
    .order("family_score", { ascending: false })
    .order("rank", { ascending: true })
    .limit(params.limit);

  if (params.state) query = query.eq("state_code", params.state);
  if (params.type) query = query.eq("destination_type", params.type);
  if (params.curationLevel) query = query.eq("curation_level", params.curationLevel);
  if (params.query) {
    const escaped = params.query.replaceAll("%", "\\%").replaceAll("_", "\\_");
    query = query.or(`name.ilike.%${escaped}%,state_name.ilike.%${escaped}%,destination_type.ilike.%${escaped}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[family-concierge] Supabase family_destination_catalog_1001 search failed", {
      code: error.code,
      message: error.message
    });
    return { ok: false, source: "supabase", error: error.message };
  }

  const stats = await getDestinationCatalogStats();
  return {
    ok: true,
    source: "supabase",
    destinations: (data || []).map(normalizeDestination),
    facets: { states: [], types: [], curationLevels: [] },
    totalKnown: stats.count
  };
}

async function searchSupabaseExistingDestinations(params) {
  const client = getSupabaseServerClient();
  if (!client) return { ok: false, error: "Supabase client unavailable" };

  const { data, error, count } = await client
    .from("destinations")
    .select("*", { count: "exact" })
    .eq("is_active", true)
    .order("is_mvp_priority", { ascending: false })
    .order("mvp_priority", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    console.warn("[family-concierge] Supabase destinations search failed", {
      code: error.code,
      message: error.message
    });
    return { ok: false, source: "supabase_destinations", error: error.message };
  }

  const normalized = (data || []).map(normalizeExistingDestination);
  const destinations = filterStaticDestinations(normalized, params);

  return {
    ok: true,
    source: "supabase_destinations",
    destinations,
    facets: destinationFacets(normalized),
    totalKnown: count || normalized.length
  };
}

function normalizeExistingDestination(destination) {
  const tags = [
    ...(destination.destination_types || []),
    destination.destination_scope,
    destination.macro_region
  ].filter(Boolean);
  const priority = Number(destination.mvp_priority || 20);
  return normalizeDestination({
    slug: destination.slug,
    name: destination.city || destination.name,
    stateCode: destination.state,
    stateName: destination.state,
    country: destination.country || "Brasil",
    macroRegion: destination.macro_region || "",
    latitude: destination.latitude,
    longitude: destination.longitude,
    rank: priority,
    familyScore: destination.is_mvp_priority ? Math.max(80, 96 - priority * 2) : 72,
    destinationType: destination.destination_scope || destination.destination_types?.[0] || "regional_family_base",
    curationLevel: destination.is_mvp_priority ? "known_family_destination" : "family_destination_candidate",
    recommendationReadiness: destination.is_placeholder ? "needs_hotel_and_place_validation" : "ready_for_editorial_review",
    minimumFamilyRequirementsPassed: false,
    tags,
    idealAges: ["familias com criancas", "validar idades no diagnostico"],
    travelModes: ["carro", "voo curto quando fizer sentido"],
    bestFor: destination.family_summary || destination.short_description || "",
    attentionPoints: destination.is_placeholder ? ["validar dados antes de recomendar hotel"] : []
  });
}
