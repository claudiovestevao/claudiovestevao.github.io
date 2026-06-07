const SAO_PAULO_CENTER = { latitude: -23.55052, longitude: -46.63331 };

export function hasGoogleMaps() {
  return Boolean(getGoogleMapsKey());
}

export async function searchGooglePlacesText({ query, pageSize = 3, includedType = "" }) {
  assertGoogleMaps();
  const fieldMask = [
    "places.id",
    "places.name",
    "places.displayName",
    "places.formattedAddress",
    "places.rating",
    "places.userRatingCount",
    "places.types",
    "places.location",
    "places.googleMapsUri",
    "places.websiteUri",
    "places.nationalPhoneNumber",
    "places.internationalPhoneNumber",
    "places.photos"
  ].join(",");

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getGoogleMapsKey(),
      "X-Goog-FieldMask": fieldMask
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "pt-BR",
      regionCode: "BR",
      pageSize,
      includedType: includedType || undefined
    })
  });

  const json = await checkedJson(response, "google_places_search");
  return (json.places || []).map(normalizeGooglePlace);
}

export async function getGooglePlaceDetails(placeId) {
  assertGoogleMaps();
  const fieldMask = [
    "id",
    "name",
    "displayName",
    "formattedAddress",
    "rating",
    "userRatingCount",
    "types",
    "location",
    "googleMapsUri",
    "websiteUri",
    "nationalPhoneNumber",
    "internationalPhoneNumber",
    "reviews",
    "photos"
  ].join(",");

  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=pt-BR`, {
    headers: {
      "X-Goog-Api-Key": getGoogleMapsKey(),
      "X-Goog-FieldMask": fieldMask
    }
  });

  const json = await checkedJson(response, "google_place_details");
  return normalizeGooglePlace(json);
}

export async function getGooglePlacePhotoUri(googlePhotoName, { maxWidthPx = 1200, maxHeightPx = 900 } = {}) {
  assertGoogleMaps();
  const params = new URLSearchParams({
    key: getGoogleMapsKey(),
    skipHttpRedirect: "true",
    maxWidthPx: String(maxWidthPx),
    maxHeightPx: String(maxHeightPx)
  });
  const response = await fetch(`https://places.googleapis.com/v1/${googlePhotoName}/media?${params.toString()}`);
  const json = await checkedJson(response, "google_place_photo");
  return json.photoUri || "";
}

export async function computeGoogleRouteFromSp(destination) {
  assertGoogleMaps();
  if (!Number.isFinite(Number(destination?.latitude)) || !Number.isFinite(Number(destination?.longitude))) {
    return { status: "NOT_APPLICABLE", reason: "missing_coordinates" };
  }
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": getGoogleMapsKey(),
      "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory,routes.viewport"
    },
    body: JSON.stringify({
      origin: { location: { latLng: SAO_PAULO_CENTER } },
      destination: {
        location: {
          latLng: {
            latitude: Number(destination.latitude),
            longitude: Number(destination.longitude)
          }
        }
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      languageCode: "pt-BR",
      units: "METRIC"
    })
  });
  const json = await checkedJson(response, "google_routes");
  const route = json.routes?.[0];
  if (!route) return { status: "ZERO_RESULTS" };
  const durationSeconds = parseGoogleDuration(route.duration);
  return {
    status: "OK",
    distanceMeters: Number(route.distanceMeters || 0),
    distanceKm: Math.round(Number(route.distanceMeters || 0) / 100) / 10,
    durationSeconds,
    driveMinutes: Math.round(durationSeconds / 60),
    driveText: formatDriveText(Math.round(durationSeconds / 60)),
    encodedPolyline: route.polyline?.encodedPolyline || "",
    travelAdvisory: route.travelAdvisory || null,
    viewport: route.viewport || null
  };
}

export async function hydrateGooglePlaceMedia(place) {
  const photos = [];
  for (const photo of (place.photos || []).slice(0, 3)) {
    try {
      const photoUri = await getGooglePlacePhotoUri(photo.googlePhotoName);
      if (photoUri) photos.push({ ...photo, photoUri });
    } catch {
      photos.push(photo);
    }
  }
  return { ...place, photos };
}

export function normalizeGooglePlace(place = {}) {
  const displayName = place.displayName?.text || place.displayName || place.name || "";
  const reviews = (place.reviews || []).map((review) => ({
    authorName: review.authorAttribution?.displayName || "",
    authorUri: review.authorAttribution?.uri || "",
    rating: review.rating || null,
    relativeTime: review.relativePublishTimeDescription || "",
    publishTime: review.publishTime || "",
    text: review.text?.text || review.originalText?.text || "",
    languageCode: review.text?.languageCode || review.originalText?.languageCode || "",
    googleMapsUri: review.googleMapsUri || ""
  }));

  return {
    placeId: place.id || place.name?.replace("places/", "") || "",
    googleResourceName: place.name || (place.id ? `places/${place.id}` : ""),
    name: displayName,
    formattedAddress: place.formattedAddress || "",
    rating: place.rating ?? null,
    userRatingCount: place.userRatingCount ?? null,
    categories: place.types || [],
    latitude: place.location?.latitude ?? null,
    longitude: place.location?.longitude ?? null,
    googleMapsUri: place.googleMapsUri || "",
    websiteUri: place.websiteUri || "",
    phoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber || "",
    photos: (place.photos || []).map((photo) => ({
      googlePhotoName: photo.name,
      width: photo.widthPx,
      height: photo.heightPx,
      attributions: photo.authorAttributions || []
    })),
    reviews,
    raw: place
  };
}

function assertGoogleMaps() {
  if (!getGoogleMapsKey()) {
    throw Object.assign(new Error("GOOGLE_MAPS_API_KEY ausente no servidor."), { status: 503 });
  }
}

function getGoogleMapsKey() {
  return String(process.env.GOOGLE_MAPS_API_KEY || "").replace(/^\uFEFF/, "").trim();
}

async function checkedJson(response, provider) {
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || json.error) {
    throw Object.assign(new Error(json.error?.message || `${provider} retornou ${response.status}`), {
      status: response.status || 502,
      provider
    });
  }
  return json;
}

function parseGoogleDuration(duration = "0s") {
  const match = String(duration).match(/^(\d+)s$/);
  return match ? Number(match[1]) : 0;
}

function formatDriveText(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  if (!rest) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
