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
