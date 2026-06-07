export const DEFAULT_DESTINATION_LIMIT = 24;
export const MAX_DESTINATION_LIMIT = 80;

export function normalizeDestination(destination) {
  return {
    slug: destination.slug,
    name: destination.name,
    stateCode: destination.stateCode || destination.state_code,
    stateName: destination.stateName || destination.state_name,
    country: destination.country || "Brasil",
    macroRegion: destination.macroRegion || destination.macro_region || "",
    latitude: cleanNumber(destination.latitude),
    longitude: cleanNumber(destination.longitude),
    rank: Number(destination.rank || 9999),
    familyScore: Number(destination.familyScore || destination.family_score || 0),
    destinationType: destination.destinationType || destination.destination_type || "regional_family_base",
    curationLevel: destination.curationLevel || destination.curation_level || "family_destination_candidate",
    recommendationReadiness: destination.recommendationReadiness || destination.recommendation_readiness || "needs_hotel_and_place_validation",
    minimumFamilyRequirementsPassed: Boolean(destination.minimumFamilyRequirementsPassed || destination.minimum_family_requirements_passed),
    scoreLabel: destination.scoreLabel || destination.score_label || "",
    scoreConfidence: destination.scoreConfidence || destination.score_confidence || "",
    categoryScores: normalizeCategoryScores(destination.categoryScores || destination.category_scores),
    fitSummary: normalizeFitSummary(destination.fitSummary || destination.fit_summary),
    tags: destination.tags || [],
    idealAges: destination.idealAges || destination.ideal_ages || [],
    travelModes: destination.travelModes || destination.travel_modes || [],
    bestFor: destination.bestFor || destination.best_for || "",
    attentionPoints: destination.attentionPoints || destination.attention_points || []
  };
}

export function parseDestinationSearchParams(searchParams = {}) {
  const query = cleanString(searchParams.q || searchParams.query || "");
  const state = cleanString(searchParams.state || "");
  const type = cleanString(searchParams.type || "");
  const curationLevel = cleanString(searchParams.curationLevel || "");
  const limit = clampLimit(searchParams.limit);
  return { query, state, type, curationLevel, limit };
}

export function filterStaticDestinations(destinations, params) {
  const query = removeAccents(params.query).toLowerCase();
  return destinations
    .map(normalizeDestination)
    .filter(destination => !params.state || destination.stateCode === params.state)
    .filter(destination => !params.type || destination.destinationType === params.type)
    .filter(destination => !params.curationLevel || destination.curationLevel === params.curationLevel)
    .filter(destination => {
      if (!query) return true;
      const haystack = removeAccents([
        destination.name,
        destination.stateCode,
        destination.stateName,
        destination.macroRegion,
        destination.destinationType,
        ...(destination.tags || [])
      ].join(" ")).toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => b.familyScore - a.familyScore || a.rank - b.rank || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, params.limit);
}

export function destinationFacets(destinations) {
  const normalized = destinations.map(normalizeDestination);
  return {
    states: countFacet(normalized, "stateCode"),
    types: countFacet(normalized, "destinationType"),
    curationLevels: countFacet(normalized, "curationLevel")
  };
}

function countFacet(items, key) {
  return Object.entries(items.reduce((acc, item) => {
    const value = item[key] || "unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

function cleanString(value) {
  return String(value || "").trim();
}

function clampLimit(value) {
  const numeric = Number.parseInt(value || DEFAULT_DESTINATION_LIMIT, 10);
  if (!Number.isFinite(numeric)) return DEFAULT_DESTINATION_LIMIT;
  return Math.max(1, Math.min(MAX_DESTINATION_LIMIT, numeric));
}

function cleanNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeCategoryScores(scores = {}) {
  if (!scores || typeof scores !== "object") return null;
  return {
    logistics: cleanNumber(scores.logistics),
    structure: cleanNumber(scores.structure),
    seasonality: cleanNumber(scores.seasonality),
    rainyDay: cleanNumber(scores.rainyDay || scores.rainy_day),
    safety: cleanNumber(scores.safety),
    parentComfort: cleanNumber(scores.parentComfort || scores.parent_comfort)
  };
}

function normalizeFitSummary(summary = {}) {
  if (!summary || typeof summary !== "object") return null;
  return {
    recommendedProfiles: Number(summary.recommendedProfiles || summary.recommended_profiles || 0),
    blockedProfiles: Number(summary.blockedProfiles || summary.blocked_profiles || 0),
    totalProfiles: Number(summary.totalProfiles || summary.total_profiles || 0)
  };
}

function removeAccents(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
