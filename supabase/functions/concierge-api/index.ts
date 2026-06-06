import {
  ACTIONS,
  buildBookingAffiliateUrl,
  buildHumanizedExplanation,
  cacheKey,
  classifyTravelDifficulty,
  estimateTripCost,
  normalizeGooglePlace,
  normalizePexelsPhoto,
  scoreFamilyFit,
  stableStringify,
  validateEnv,
  validatePayload
} from "./_shared/concierge_contracts.mjs";

type Json = Record<string, unknown>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-concierge-session",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const memoryRateLimit = new Map<string, number[]>();

Deno.serve(async request => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  if (request.method !== "POST") return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);

  const requestId = crypto.randomUUID();
  const sessionId = request.headers.get("x-concierge-session") || "anonymous";
  let action = "";
  let payload: Json = {};

  try {
    const body = await request.json().catch(() => ({}));
    action = String(body.action || new URL(request.url).pathname.split("/").filter(Boolean).pop() || "");
    payload = (body.payload || {}) as Json;

    const mockMode = env("CONCIERGE_API_MOCKS") === "1" || payload.mock === true;
    validatePayload(action, payload);
    if (!mockMode) validateEnv(action, envObject());
    await enforceRateLimit(action, sessionId, request);

    const cached = await readCache(action, payload);
    if (cached) return jsonResponse({ ok: true, source: "cache", requestId, data: cached });

    const data = mockMode
      ? await mockResponse(action, payload)
      : await dispatch(action, payload, sessionId, requestId);

    await writeCache(action, payload, data);
    await logSearchRequest(action, sessionId, payload, "success", data);
    return jsonResponse({ ok: true, source: mockMode ? "mock" : "live", requestId, data });
  } catch (error) {
    const status = Number(error?.status || 500);
    const fallback = fallbackResponse(action, payload, error);
    await logApiError(action || "unknown", sessionId, requestId, error, payload, Boolean(fallback));
    return jsonResponse({
      ok: false,
      requestId,
      error: error?.code || "api_error",
      message: error?.message || "Erro inesperado na integração.",
      fallback
    }, status >= 500 && fallback ? 200 : status);
  }
});

async function dispatch(action: string, payload: Json, sessionId: string, requestId: string) {
  if (action === ACTIONS.SEARCH_PLACES) return searchGooglePlaces(payload);
  if (action === ACTIONS.PLACE_PHOTO) return fetchGooglePlacePhoto(payload);
  if (action === ACTIONS.PEXELS_SEARCH) return searchPexels(payload);
  if (action === ACTIONS.GEOCODE) return geocodeAddress(payload);
  if (action === ACTIONS.ROUTE) return computeRoute(payload);
  if (action === ACTIONS.RECOMMEND) return recommend(payload, sessionId, requestId);
  if (action === ACTIONS.BOOKING_LINK) return createBookingLink(payload);
  if (action === ACTIONS.ESTIMATE_COST) return estimateTripCost(payload);
  if (action === ACTIONS.SEND_EMAIL) return sendTransactionalEmail(payload);
  if (action === ACTIONS.PREPARE_WHATSAPP) return prepareWhatsApp(payload);
  throw Object.assign(new Error(`Ação não suportada: ${action}`), { status: 400, code: "unsupported_action" });
}

async function searchGooglePlaces(payload: Json) {
  const fieldMask = [
    "places.id",
    "places.name",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.types",
    "places.location",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.photos"
  ].join(",");
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env("GOOGLE_MAPS_API_KEY"),
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify({
      textQuery: payload.query,
      languageCode: payload.languageCode || "pt-BR",
      regionCode: payload.regionCode || "BR",
      includedType: payload.includedType || undefined,
      pageSize: payload.pageSize || 10,
      locationBias: payload.locationBias || undefined
    })
  });
  const json = await checkedJson(response, "google_places", ACTIONS.SEARCH_PLACES);
  const places = (json.places || []).map(normalizeGooglePlace);
  await upsertPlaces(places, String(payload.entityType || "place"));
  return { places };
}

async function fetchGooglePlacePhoto(payload: Json) {
  const photoName = String(payload.googlePhotoName);
  const params = new URLSearchParams({
    key: env("GOOGLE_MAPS_API_KEY"),
    skipHttpRedirect: "true",
    maxWidthPx: String(payload.maxWidthPx || 1600),
    maxHeightPx: String(payload.maxHeightPx || 1200)
  });
  const response = await fetch(`https://places.googleapis.com/v1/${photoName}/media?${params.toString()}`);
  const json = await checkedJson(response, "google_place_photos", ACTIONS.PLACE_PHOTO);
  const photo = {
    source: "google_place_photo",
    googlePhotoName: photoName,
    googlePhotoUri: json.photoUri,
    placeId: payload.placeId || null,
    isEditorial: false,
    isEstablishmentSpecific: true,
    raw: json
  };
  await upsertPhoto(photo);
  return photo;
}

async function searchPexels(payload: Json) {
  const query = String(payload.query);
  const params = new URLSearchParams({
    query,
    locale: String(payload.locale || "en-US"),
    per_page: String(payload.perPage || 8),
    orientation: String(payload.orientation || "landscape")
  });
  const response = await fetch(`https://api.pexels.com/v1/search?${params.toString()}`, {
    headers: { Authorization: env("PEXELS_API_KEY") }
  });
  const json = await checkedJson(response, "pexels", ACTIONS.PEXELS_SEARCH);
  const photos = (json.photos || []).map((photo: Json) => normalizePexelsPhoto(photo, query));
  await Promise.all(photos.map(upsertPhoto));
  return { query, photos };
}

async function geocodeAddress(payload: Json) {
  const params = new URLSearchParams({
    address: String(payload.originText || payload.address),
    key: env("GOOGLE_MAPS_API_KEY"),
    language: "pt-BR",
    region: "br"
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
  const json = await checkedJson(response, "google_geocoding", ACTIONS.GEOCODE);
  const result = json.results?.[0];
  if (!result) return { status: json.status, candidates: [] };
  return {
    status: json.status,
    formattedAddress: result.formatted_address,
    latitude: result.geometry?.location?.lat,
    longitude: result.geometry?.location?.lng,
    placeId: result.place_id,
    locationType: result.geometry?.location_type,
    raw: result
  };
}

async function computeRoute(payload: Json) {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env("GOOGLE_MAPS_API_KEY"),
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.travelAdvisory"
    },
    body: JSON.stringify({
      origin: routeWaypoint(payload.origin),
      destination: routeWaypoint(payload.destination),
      travelMode: payload.travelMode || "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-BR",
      units: "METRIC"
    })
  });
  const json = await checkedJson(response, "google_routes", ACTIONS.ROUTE);
  const route = json.routes?.[0] || {};
  const durationSeconds = parseDurationSeconds(route.duration);
  const difficulty = classifyTravelDifficulty({
    distanceMeters: route.distanceMeters || 0,
    durationSeconds,
    childAges: payload.childAges || []
  });
  return { distanceMeters: route.distanceMeters || 0, durationSeconds, difficulty, raw: route };
}

async function recommend(payload: Json, sessionId: string, requestId: string) {
  const preferences = payload.preferences || {};
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const scored = candidates
    .map((candidate: Json) => {
      const score = scoreFamilyFit(candidate, preferences);
      const cost = estimateTripCost({
        adults: preferences.adultsCount || 2,
        children: preferences.childrenCount || 1,
        nights: preferences.nights || 2,
        distanceKm: candidate.distanceKm || score.route?.distanceKm || 120,
        transportMode: candidate.transportMode || "car",
        lodgingTier: candidate.priceTier === "luxury" ? "premium" : candidate.priceTier === "mid" ? "comfort" : "economic"
      });
      return {
        ...candidate,
        familyScore: score,
        costEstimate: cost,
        explanation: buildHumanizedExplanation({ entity: candidate, score, preferences, cost, route: score.route })
      };
    })
    .filter((candidate: Json) => candidate.familyScore?.minimumRequirementsPassed)
    .sort((a: Json, b: Json) => Number(b.familyScore?.score || 0) - Number(a.familyScore?.score || 0))
    .slice(0, Number(payload.limit || 3));

  const withAi = env("OPENAI_API_KEY")
    ? await enrichWithOpenAI(scored, preferences, requestId)
    : scored;

  await insertRows("family_scores", withAi.map((item: Json) => ({
    entity_type: item.entityType || "accommodation",
    entity_key: item.slug || item.id || item.name,
    score: item.familyScore.score,
    medal: item.familyScore.medal,
    minimum_requirements_passed: item.familyScore.minimumRequirementsPassed,
    scoring_inputs: { preferences, candidate: item },
    ai_explanation: item.explanation || {},
    calculated_at: new Date().toISOString()
  })));
  await logSearchRequest(ACTIONS.RECOMMEND, sessionId, payload, "success", { count: withAi.length });
  return { recommendations: withAi };
}

async function createBookingLink(payload: Json) {
  const affiliateId = String(payload.affiliateId || env("BOOKING_AFFILIATE_ID"));
  const trackingCode = String(payload.trackingCode || `concierge_${Date.now()}`);
  const url = buildBookingAffiliateUrl({ ...payload, affiliateId, trackingCode });
  const row = {
    entity_type: payload.entityType || "accommodation",
    entity_key: payload.entityKey || payload.hotelName || payload.destination,
    provider: "booking",
    url,
    affiliate_id: affiliateId,
    tracking_code: trackingCode,
    label: "Ver disponibilidade na Booking",
    claims_real_availability: false,
    api_data: payload
  };
  await insertRows("affiliate_links", [row]);
  return row;
}

async function sendTransactionalEmail(payload: Json) {
  const to = String(payload.to || payload.email || "");
  if (!to) throw Object.assign(new Error("Informe e-mail de destino."), { status: 400, code: "missing_email" });
  if (!env("RESEND_API_KEY")) {
    return { queued: false, provider: "mock", reason: "RESEND_API_KEY ausente", to };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: env("TRANSACTIONAL_EMAIL_FROM") || "Concierge da Família <noreply@claudiocode.dev>",
      to,
      subject: payload.subject || "Seu roteiro do Concierge da Família",
      html: payload.html || `<p>${escapeHtml(String(payload.summary || "Resumo da sua recomendação."))}</p>`
    })
  });
  return checkedJson(response, "resend", ACTIONS.SEND_EMAIL);
}

function prepareWhatsApp(payload: Json) {
  return {
    readyToSend: Boolean(env("WHATSAPP_API_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID")),
    phone: payload.phone || null,
    message: payload.message || "Resumo preparado para envio futuro pelo WhatsApp.",
    provider: "meta_whatsapp_cloud_api"
  };
}

async function enrichWithOpenAI(scored: Json[], preferences: Json, requestId: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env("OPENAI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env("OPENAI_RECOMMENDATION_MODEL") || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: "Você é uma consultora de viagens familiares. Use apenas os dados JSON fornecidos. Não invente hotéis, preços, fotos ou disponibilidade."
        },
        {
          role: "user",
          content: JSON.stringify({ requestId, preferences, scored })
        }
      ],
      text: { format: { type: "json_object" } }
    })
  });
  if (!response.ok) return scored;
  const json = await response.json();
  const text = json.output_text || json.output?.[0]?.content?.[0]?.text;
  if (!text) return scored;
  try {
    const ai = JSON.parse(text);
    return scored.map((item, index) => ({ ...item, aiRecommendation: ai.recommendations?.[index] || null }));
  } catch {
    return scored;
  }
}

function routeWaypoint(value: unknown) {
  const point = value as Json;
  if (point && typeof point === "object" && point.latitude && point.longitude) {
    return { location: { latLng: { latitude: point.latitude, longitude: point.longitude } } };
  }
  return { address: String(value || "") };
}

function parseDurationSeconds(duration: unknown) {
  const match = String(duration || "0s").match(/^(\d+)s$/);
  return match ? Number(match[1]) : 0;
}

async function checkedJson(response: Response, provider: string, action: string) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || json.status === "REQUEST_DENIED" || json.status === "OVER_QUERY_LIMIT") {
    throw Object.assign(new Error(json.error_message || json.message || `${provider} retornou ${response.status}`), {
      status: response.status || 502,
      code: `${provider}_${action}_failed`
    });
  }
  return json;
}

async function readCache(action: string, payload: Json) {
  const key = cacheKey(providerForAction(action), action, payload);
  const rows = await supabaseRest("api_cache", "GET", null, {
    cache_key: `eq.${key}`,
    expires_at: `gt.${new Date().toISOString()}`,
    select: "response",
    limit: "1"
  });
  return rows?.[0]?.response || null;
}

async function writeCache(action: string, payload: Json, response: unknown) {
  const key = cacheKey(providerForAction(action), action, payload);
  const ttlMinutes = Number(env("CONCIERGE_CACHE_MINUTES") || 1440);
  await upsertRows("api_cache", [{
    cache_key: key,
    provider: providerForAction(action),
    action,
    request_hash: stableStringify(payload),
    response,
    expires_at: new Date(Date.now() + ttlMinutes * 60_000).toISOString(),
    updated_at: new Date().toISOString()
  }], "cache_key");
}

async function enforceRateLimit(action: string, sessionId: string, request: Request) {
  const now = Date.now();
  const windowMs = Number(env("CONCIERGE_RATE_LIMIT_WINDOW_MS") || 60_000);
  const max = Number(env("CONCIERGE_RATE_LIMIT_MAX") || 40);
  const key = `${sessionId}:${action}`;
  const hits = (memoryRateLimit.get(key) || []).filter(ts => now - ts < windowMs);
  if (hits.length >= max) throw Object.assign(new Error("Muitas requisições. Tente novamente em instantes."), { status: 429, code: "rate_limited" });
  hits.push(now);
  memoryRateLimit.set(key, hits);
  await insertRows("api_rate_limits", [{
    bucket: new Date(now).toISOString().slice(0, 16),
    session_id: sessionId,
    ip_hash: await sha256(request.headers.get("x-forwarded-for") || ""),
    action
  }]);
}

async function upsertPlaces(places: Json[], entityType: string) {
  await upsertRows("places", places.map(place => ({
    place_id: place.placeId,
    provider: "google_places",
    name: place.name,
    formatted_address: place.formattedAddress,
    rating: place.rating,
    user_rating_count: place.userRatingCount,
    categories: place.categories,
    latitude: place.latitude,
    longitude: place.longitude,
    website_uri: place.websiteUri,
    phone_number: place.phoneNumber,
    raw_api_data: place.raw,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })), "place_id");
  if (["hotel", "lodging", "resort", "pousada", "accommodation"].includes(entityType)) {
    await upsertRows("accommodations", places.map(place => ({
      place_id: place.placeId,
      slug: slugify(String(place.name)),
      name: place.name,
      property_type: "hotel",
      address: place.formattedAddress,
      latitude: place.latitude,
      longitude: place.longitude,
      google_rating: place.rating,
      google_ratings_total: place.userRatingCount,
      google_categories: place.categories,
      google_website: place.websiteUri,
      google_phone: place.phoneNumber,
      api_data: place.raw,
      confidence_level: "verified",
      updated_at: new Date().toISOString()
    })), "place_id");
  }
  if (["attraction", "restaurant", "point_of_interest"].includes(entityType)) {
    await upsertRows("attractions", places.map(place => ({
      place_id: place.placeId,
      name: place.name,
      item_type: entityType === "restaurant" ? "restaurant" : "attraction",
      formatted_address: place.formattedAddress,
      rating: place.rating,
      user_rating_count: place.userRatingCount,
      categories: place.categories,
      latitude: place.latitude,
      longitude: place.longitude,
      website_uri: place.websiteUri,
      phone_number: place.phoneNumber,
      api_data: place.raw,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })), "place_id");
  }
}

async function upsertPhoto(photo: Json) {
  const row = {
    owner_type: photo.ownerType || (photo.isEstablishmentSpecific ? "place" : "destination"),
    owner_id: photo.ownerId || null,
    place_id: photo.placeId || null,
    source: photo.source || "pexels",
    google_photo_name: photo.googlePhotoName || null,
    google_photo_uri: photo.googlePhotoUri || null,
    pexels_id: photo.pexelsId || null,
    photographer: photo.photographer || null,
    photographer_url: photo.photographerUrl || null,
    photo_url: photo.photoUrl || null,
    src_original: photo.srcOriginal || photo.googlePhotoUri || null,
    src_large: photo.srcLarge || photo.googlePhotoUri || null,
    attribution_text: photo.attributionText || null,
    width: photo.width || null,
    height: photo.height || null,
    is_editorial: Boolean(photo.isEditorial),
    is_establishment_specific: Boolean(photo.isEstablishmentSpecific),
    search_query: photo.searchQuery || null,
    api_data: photo.raw || {},
    cached_until: new Date(Date.now() + Number(env("CONCIERGE_CACHE_MINUTES") || 1440) * 60_000).toISOString(),
    updated_at: new Date().toISOString()
  };
  const conflict = photo.googlePhotoName ? "google_photo_name" : photo.pexelsId ? "pexels_id" : "";
  if (conflict) await upsertRows("photos", [row], conflict);
  else await insertRows("photos", [row]);
}

async function logSearchRequest(action: string, sessionId: string, payload: Json, status: string, result: unknown) {
  await insertRows("search_requests", [{
    session_id: sessionId,
    request_type: action,
    origin_text: String(payload.originText || payload.origin || ""),
    destination_text: String(payload.destinationText || payload.destination || ""),
    query: String(payload.query || ""),
    preferences: payload.preferences || {},
    consent_contact: Boolean(payload.consentContact),
    consent_lgpd: Boolean(payload.consentLgpd),
    status,
    api_provider: providerForAction(action),
    result_summary: summarizeResult(result)
  }]);
}

async function logApiError(action: string, sessionId: string, requestId: string, error: Error, payload: Json, fallbackUsed: boolean) {
  await insertRows("api_error_logs", [{
    provider: providerForAction(action),
    action,
    request_id: requestId,
    session_id: sessionId,
    status_code: Number(error?.status || 500),
    error_message: error?.message || "Erro inesperado",
    request_payload: payload || {},
    fallback_used: fallbackUsed
  }]);
}

async function insertRows(table: string, rows: Json[], prefer = "") {
  if (!rows.length) return null;
  return supabaseRest(table, "POST", rows, {}, { prefer });
}

async function upsertRows(table: string, rows: Json[], onConflict: string) {
  if (!rows.length) return null;
  return supabaseRest(table, "POST", rows, { on_conflict: onConflict }, { prefer: "resolution=merge-duplicates" });
}

async function supabaseRest(table: string, method: string, body: unknown = null, query: Record<string, string> = {}, options: { prefer?: string } = {}) {
  const url = new URL(`${env("SUPABASE_URL").replace(/\/$/, "")}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
  const headers: Record<string, string> = {
    apikey: env("SUPABASE_SERVICE_ROLE_KEY"),
    authorization: `Bearer ${env("SUPABASE_SERVICE_ROLE_KEY")}`,
    "Content-Type": "application/json"
  };
  const prefer = ["return=representation", options.prefer].filter(Boolean).join(",");
  if (prefer) headers.prefer = prefer;
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw Object.assign(new Error(`Supabase ${table} ${method} retornou ${response.status}`), { status: 502, code: "supabase_rest_failed" });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function mockResponse(action: string, payload: Json) {
  if (action === ACTIONS.SEARCH_PLACES) {
    const place = normalizeGooglePlace({
      id: "mock-place-id",
      name: "places/mock-place-id",
      displayName: { text: payload.query || "Mock Resort Familiar" },
      formattedAddress: "São Paulo, Brasil",
      rating: 4.6,
      userRatingCount: 1234,
      types: ["lodging"],
      location: { latitude: -23.55, longitude: -46.63 },
      websiteUri: "https://example.com",
      nationalPhoneNumber: "+55 11 0000-0000",
      photos: [{ name: "places/mock-place-id/photos/mock-photo", widthPx: 1600, heightPx: 1000 }]
    });
    return { places: [place] };
  }
  if (action === ACTIONS.PEXELS_SEARCH) return { query: payload.query, photos: [normalizePexelsPhoto({ id: 1, photographer: "Mock", photographer_url: "https://pexels.com", url: "https://pexels.com/photo/mock", src: { original: "https://images.pexels.com/mock-original.jpg", large: "https://images.pexels.com/mock-large.jpg" }, width: 1600, height: 1000 }, String(payload.query))] };
  if (action === ACTIONS.ROUTE) return { distanceMeters: 120000, durationSeconds: 5400, difficulty: classifyTravelDifficulty({ distanceMeters: 120000, durationSeconds: 5400, childAges: payload.childAges || [] }) };
  if (action === ACTIONS.GEOCODE) return { formattedAddress: payload.originText || payload.address, latitude: -23.55, longitude: -46.63, placeId: "mock-geocode" };
  if (action === ACTIONS.BOOKING_LINK) {
    const url = buildBookingAffiliateUrl({ ...payload, affiliateId: String(payload.affiliateId || ""), trackingCode: String(payload.trackingCode || "mock") });
    return { provider: "booking", url, label: "Ver disponibilidade na Booking", claimsRealAvailability: false };
  }
  if (action === ACTIONS.ESTIMATE_COST) return estimateTripCost(payload);
  if (action === ACTIONS.PREPARE_WHATSAPP) return prepareWhatsApp(payload);
  return { ok: true, mock: true };
}

function fallbackResponse(action: string, payload: Json, error: Error) {
  if (action === ACTIONS.PEXELS_SEARCH) return { photos: [], warning: "Pexels indisponível; exibir ícone de advertência ou foto manual verificada." };
  if (action === ACTIONS.PLACE_PHOTO) return { photo: null, warning: "Foto Google indisponível; não substituir por foto genérica de hotel." };
  if (action === ACTIONS.ROUTE) return { difficulty: { level: "unknown", label: "rota em validação" } };
  if (action === ACTIONS.ESTIMATE_COST) return estimateTripCost(payload);
  return { warning: error?.message || "Integração indisponível." };
}

function providerForAction(action: string) {
  if ([ACTIONS.SEARCH_PLACES, ACTIONS.PLACE_PHOTO, ACTIONS.GEOCODE, ACTIONS.ROUTE].includes(action)) return "google";
  if (action === ACTIONS.PEXELS_SEARCH) return "pexels";
  if (action === ACTIONS.RECOMMEND) return env("OPENAI_API_KEY") ? "openai" : "rules_engine";
  if (action === ACTIONS.BOOKING_LINK) return "booking";
  if (action === ACTIONS.SEND_EMAIL) return "resend";
  if (action === ACTIONS.PREPARE_WHATSAPP) return "whatsapp";
  return "internal";
}

function summarizeResult(result: unknown) {
  const json = result as Json;
  if (Array.isArray(json)) return { count: json.length };
  if (json?.places) return { places: (json.places as unknown[]).length };
  if (json?.photos) return { photos: (json.photos as unknown[]).length };
  if (json?.recommendations) return { recommendations: (json.recommendations as unknown[]).length };
  return {};
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));
}

function env(key: string) {
  return Deno.env.get(key) || "";
}

function envObject() {
  return {
    GOOGLE_MAPS_API_KEY: env("GOOGLE_MAPS_API_KEY"),
    PEXELS_API_KEY: env("PEXELS_API_KEY"),
    OPENAI_API_KEY: env("OPENAI_API_KEY"),
    BOOKING_AFFILIATE_ID: env("BOOKING_AFFILIATE_ID")
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}
