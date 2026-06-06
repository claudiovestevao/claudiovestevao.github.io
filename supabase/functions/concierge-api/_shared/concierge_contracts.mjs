export const ACTIONS = {
  SEARCH_PLACES: "search-places",
  PLACE_PHOTO: "place-photo",
  PEXELS_SEARCH: "pexels-search",
  GEOCODE: "geocode",
  ROUTE: "route",
  RECOMMEND: "recommend",
  BOOKING_LINK: "booking-link",
  ESTIMATE_COST: "estimate-cost",
  SEND_EMAIL: "send-email",
  PREPARE_WHATSAPP: "prepare-whatsapp"
};

export const REQUIRED_ENV = {
  [ACTIONS.SEARCH_PLACES]: ["GOOGLE_MAPS_API_KEY"],
  [ACTIONS.PLACE_PHOTO]: ["GOOGLE_MAPS_API_KEY"],
  [ACTIONS.PEXELS_SEARCH]: ["PEXELS_API_KEY"],
  [ACTIONS.GEOCODE]: ["GOOGLE_MAPS_API_KEY"],
  [ACTIONS.ROUTE]: ["GOOGLE_MAPS_API_KEY"],
  [ACTIONS.RECOMMEND]: [],
  [ACTIONS.BOOKING_LINK]: ["BOOKING_AFFILIATE_ID"],
  [ACTIONS.ESTIMATE_COST]: [],
  [ACTIONS.SEND_EMAIL]: [],
  [ACTIONS.PREPARE_WHATSAPP]: []
};

export function validateAction(action) {
  if (!Object.values(ACTIONS).includes(action)) {
    throw new ContractError("unsupported_action", `Ação não suportada: ${action || "vazia"}`, 400);
  }
}

export function validateEnv(action, env = {}) {
  validateAction(action);
  const missing = (REQUIRED_ENV[action] || []).filter(key => !env[key]);
  if (missing.length) {
    throw new ContractError("missing_env", `Variáveis de ambiente ausentes: ${missing.join(", ")}`, 503);
  }
}

export function validatePayload(action, payload = {}) {
  validateAction(action);
  if (action === ACTIONS.SEARCH_PLACES && !payload.query) {
    throw new ContractError("missing_query", "Informe query para buscar locais reais.", 400);
  }
  if (action === ACTIONS.PLACE_PHOTO && !payload.googlePhotoName) {
    throw new ContractError("missing_google_photo", "Informe googlePhotoName para Place Photos.", 400);
  }
  if (action === ACTIONS.PEXELS_SEARCH && !payload.query) {
    throw new ContractError("missing_query", "Informe query editorial para Pexels.", 400);
  }
  if (action === ACTIONS.PEXELS_SEARCH && payload.establishmentSpecific) {
    throw new ContractError("pexels_scope", "Pexels não pode substituir foto real de hotel/estabelecimento.", 400);
  }
  if (action === ACTIONS.GEOCODE && !payload.originText && !payload.address) {
    throw new ContractError("missing_origin", "Informe CEP, bairro, cidade ou endereço.", 400);
  }
  if (action === ACTIONS.ROUTE && (!payload.origin || !payload.destination)) {
    throw new ContractError("missing_route_points", "Informe origem e destino para cálculo de rota.", 400);
  }
  if (action === ACTIONS.SEND_EMAIL && !payload.consentContact) {
    throw new ContractError("missing_contact_consent", "Consentimento é obrigatório para e-mail transacional.", 400);
  }
}

export function normalizeGooglePlace(place = {}) {
  const location = place.location || {};
  return {
    placeId: place.id || place.name?.replace("places/", "") || "",
    googleResourceName: place.name || "",
    name: place.displayName?.text || place.name || "",
    formattedAddress: place.formattedAddress || "",
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    categories: place.types || [],
    latitude: location.latitude ?? null,
    longitude: location.longitude ?? null,
    websiteUri: place.websiteUri || null,
    phoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
    photos: (place.photos || []).map(photo => ({
      googlePhotoName: photo.name,
      width: photo.widthPx,
      height: photo.heightPx
    })),
    raw: place
  };
}

export function normalizePexelsPhoto(photo = {}, query = "") {
  return {
    pexelsId: String(photo.id || ""),
    photographer: photo.photographer || "",
    photographerUrl: photo.photographer_url || "",
    photoUrl: photo.url || "",
    srcOriginal: photo.src?.original || "",
    srcLarge: photo.src?.large || photo.src?.large2x || "",
    width: photo.width || null,
    height: photo.height || null,
    attributionText: photo.photographer ? `Foto por ${photo.photographer} via Pexels` : "Foto via Pexels",
    searchQuery: query,
    source: "pexels",
    isEditorial: true,
    isEstablishmentSpecific: false,
    raw: photo
  };
}

export function classifyTravelDifficulty({ distanceMeters = 0, durationSeconds = 0, childAges = [] } = {}) {
  const minutes = Math.round(durationSeconds / 60);
  const hasBaby = childAges.some(age => /0|12 meses|1 a 2|beb[eê]/i.test(String(age)));
  let level = "easy";
  let label = "Fácil para família";
  let scorePenalty = 0;
  if (minutes > 180 || distanceMeters > 280000) {
    level = "hard";
    label = "Exige planejamento";
    scorePenalty = hasBaby ? 22 : 16;
  } else if (minutes > 105 || distanceMeters > 150000) {
    level = "moderate";
    label = "Moderado";
    scorePenalty = hasBaby ? 12 : 8;
  }
  return { level, label, minutes, distanceKm: Math.round(distanceMeters / 1000), scorePenalty };
}

export function minimumFamilyRequirements(accommodation = {}, preferences = {}) {
  const needs = preferences.comfortNeeds || preferences.comfort_needs || [];
  const childAges = preferences.childAges || [];
  const hasBaby = childAges.some(age => /0|12 meses|1 a 2|beb[eê]/i.test(String(age)));
  const failures = [];
  if (hasBaby && accommodation.minimumBabyFriendly === false) failures.push("não validado para bebê");
  if (needs.includes("Copa baby") && !accommodation.hasCopaBaby && !accommodation.has_copa_baby) failures.push("sem copa baby");
  if (needs.includes("Kids club") && !accommodation.hasKidsClub && !accommodation.has_kids_club) failures.push("sem kids club");
  if ((accommodation.googleRating || accommodation.rating || 0) < 4 && (accommodation.userRatingCount || 0) >= 20) failures.push("avaliação abaixo do mínimo");
  return { passed: failures.length === 0, failures };
}

export function scoreFamilyFit(entity = {}, preferences = {}) {
  const minimum = minimumFamilyRequirements(entity, preferences);
  if (!minimum.passed) {
    return {
      score: 0,
      medal: "not_recommended",
      minimumRequirementsPassed: false,
      alerts: minimum.failures
    };
  }

  const rating = Number(entity.googleRating ?? entity.rating ?? entity.familyScore ?? 4.2);
  const ratingCount = Number(entity.userRatingCount ?? entity.reviewCount ?? 0);
  const route = classifyTravelDifficulty({
    distanceMeters: Number(entity.distanceMeters || 0),
    durationSeconds: Number(entity.durationSeconds || 0),
    childAges: preferences.childAges || []
  });
  let score = 52;
  score += Math.min(18, Math.max(0, (rating - 3.8) * 18));
  score += ratingCount > 500 ? 8 : ratingCount > 100 ? 5 : ratingCount > 20 ? 2 : 0;
  score += entity.hasCopaBaby || entity.has_copa_baby ? 8 : 0;
  score += entity.hasKidsClub || entity.has_kids_club ? 7 : 0;
  score += entity.hasKidsPool || entity.has_kids_pool ? 5 : 0;
  score += entity.worksOnRainyDay || entity.works_on_rainy_day ? 5 : 0;
  score += entity.easyFood || entity.babyMealsAvailable || entity.baby_meals_available ? 5 : 0;
  score -= route.scorePenalty;
  if (preferences.budgetTotal?.includes("Até R$ 1.500") && entity.priceTier === "luxury") score -= 16;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    medal: score >= 84 ? "gold" : score >= 70 ? "silver" : score >= 58 ? "bronze" : "not_recommended",
    minimumRequirementsPassed: score >= 58,
    route,
    alerts: score >= 58 ? [] : ["score familiar abaixo do mínimo"]
  };
}

export function estimateTripCost({ adults = 2, children = 1, nights = 2, distanceKm = 120, transportMode = "car", lodgingTier = "comfort" } = {}) {
  const peopleWeight = Number(adults) + Number(children) * 0.55;
  const baseNight = lodgingTier === "premium" ? 1350 : lodgingTier === "economic" ? 520 : 840;
  const lodging = baseNight * Number(nights || 1);
  const food = peopleWeight * Number(nights || 1) * (lodgingTier === "premium" ? 190 : lodgingTier === "economic" ? 95 : 140);
  const transport = transportMode === "flight"
    ? peopleWeight * 900
    : Math.max(120, Number(distanceKm || 0) * 2.1);
  const total = lodging + food + transport;
  return {
    economic: currencyRange(total * 0.72, total * 0.9),
    comfort: currencyRange(total * 0.95, total * 1.18),
    premium: currencyRange(total * 1.35, total * 1.75),
    assumptions: { adults, children, nights, distanceKm, transportMode, lodgingTier }
  };
}

export function buildBookingAffiliateUrl({ destination = "", hotelName = "", checkin = "", checkout = "", affiliateId = "", trackingCode = "" } = {}) {
  const query = new URLSearchParams();
  query.set("ss", [hotelName, destination].filter(Boolean).join(" "));
  if (checkin) query.set("checkin", checkin);
  if (checkout) query.set("checkout", checkout);
  if (affiliateId) query.set("aid", affiliateId);
  if (trackingCode) query.set("label", trackingCode);
  return `https://www.booking.com/searchresults.html?${query.toString()}`;
}

export function buildHumanizedExplanation({ entity = {}, score = {}, preferences = {}, cost = {}, route = {} } = {}) {
  return {
    whyMatches: `${entity.name || "Este destino"} combina por equilibrar estrutura familiar, avaliações e logística dentro do perfil informado.`,
    attentionPoints: score.alerts?.length ? score.alerts : route.level === "hard" ? ["deslocamento exige pausas e horário bem escolhido"] : [],
    bestFor: preferences.childAges?.some(age => /0|12 meses|beb[eê]/i.test(String(age))) ? "bebê com rotina previsível" : "crianças com energia para lazer",
    estimatedCost: cost.comfort || "",
    travelTime: route.minutes ? `${route.minutes} minutos estimados` : "tempo em validação"
  };
}

export function cacheKey(provider, action, payload = {}) {
  return `${provider}:${action}:${stableStringify(payload)}`;
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function currencyRange(min, max) {
  const round = value => Math.round(value / 100) * 100;
  return `R$ ${round(min).toLocaleString("pt-BR")} a R$ ${round(max).toLocaleString("pt-BR")}`;
}

export class ContractError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "ContractError";
    this.code = code;
    this.status = status;
  }
}
