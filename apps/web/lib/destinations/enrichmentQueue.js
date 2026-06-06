import { appConfig, hasServerSupabase } from "@/lib/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function enqueueDestinationEnrichment({ limit = appConfig.enrichBatchSize } = {}) {
  if (!hasServerSupabase()) {
    return {
      ok: false,
      source: "none",
      enqueued: 0,
      message: "Supabase server credentials are not configured."
    };
  }

  const client = getSupabaseServerClient();
  const { data: destinations, error } = await client
    .from("family_destination_catalog_1001")
    .select("slug,name,state_code,destination_type,family_score")
    .eq("recommendation_readiness", "needs_hotel_and_place_validation")
    .order("family_score", { ascending: false })
    .order("rank", { ascending: true })
    .limit(limit);

  if (error) {
    return { ok: false, source: "supabase", enqueued: 0, message: error.message };
  }

  if (!destinations?.length) {
    return { ok: true, source: "supabase", enqueued: 0, message: "No pending destinations." };
  }

  const jobs = destinations.map(destination => ({
    job_type: "destination_enrichment",
    entity_slug: destination.slug,
    priority: destination.family_score >= 80 ? 90 : 60,
    status: "queued",
    payload: {
      name: destination.name,
      stateCode: destination.state_code,
      destinationType: destination.destination_type,
      requestedIntegrations: ["google_places", "google_routes", "pexels", "predicthq"]
    }
  }));

  const { error: upsertError } = await client
    .from("destination_enrichment_jobs")
    .upsert(jobs, { onConflict: "job_type,entity_slug,status" });

  if (upsertError) {
    return { ok: false, source: "supabase", enqueued: 0, message: upsertError.message };
  }

  return {
    ok: true,
    source: "supabase",
    enqueued: jobs.length,
    message: "Destination enrichment jobs queued."
  };
}
