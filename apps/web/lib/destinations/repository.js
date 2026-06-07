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
    const existing = await searchSupabaseExistingDestinations(params);
    if (existing.ok) return existing;
    const live = await searchSupabaseDestinations(params);
    if (live.ok) return live;
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
    const existing = await client
      .from("destinations")
      .select("slug", { count: "exact", head: true })
      .eq("is_active", true);
    if (!existing.error && Number.isFinite(existing.count)) {
      return { source: "supabase_destinations", count: existing.count };
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
