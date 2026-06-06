import test from "node:test";
import assert from "node:assert/strict";
import {
  ACTIONS,
  buildBookingAffiliateUrl,
  classifyTravelDifficulty,
  estimateTripCost,
  normalizeGooglePlace,
  normalizePexelsPhoto,
  scoreFamilyFit,
  validateEnv,
  validatePayload
} from "../supabase/functions/concierge-api/_shared/concierge_contracts.mjs";

test("Google Places normalization keeps required persisted fields", () => {
  const place = normalizeGooglePlace({
    id: "ChIJ123",
    name: "places/ChIJ123",
    displayName: { text: "Resort Família Real" },
    formattedAddress: "Rua Teste, 123",
    rating: 4.7,
    userRatingCount: 932,
    types: ["lodging", "resort_hotel"],
    location: { latitude: -23.5, longitude: -46.6 },
    websiteUri: "https://hotel.example",
    nationalPhoneNumber: "+55 11 9999-9999",
    photos: [{ name: "places/ChIJ123/photos/A", widthPx: 1600, heightPx: 900 }]
  });

  assert.equal(place.placeId, "ChIJ123");
  assert.equal(place.name, "Resort Família Real");
  assert.equal(place.rating, 4.7);
  assert.deepEqual(place.categories, ["lodging", "resort_hotel"]);
  assert.equal(place.photos[0].googlePhotoName, "places/ChIJ123/photos/A");
});

test("Pexels is blocked for establishment-specific hotel photos", () => {
  assert.throws(
    () => validatePayload(ACTIONS.PEXELS_SEARCH, { query: "resort kids pool", establishmentSpecific: true }),
    /não pode substituir foto real/
  );
});

test("Pexels normalization stores photographer, links, src and attribution", () => {
  const photo = normalizePexelsPhoto({
    id: 42,
    photographer: "Ana Foto",
    photographer_url: "https://pexels.com/@ana",
    url: "https://pexels.com/photo/42",
    width: 3000,
    height: 2000,
    src: { original: "https://images.pexels.com/original.jpg", large: "https://images.pexels.com/large.jpg" }
  }, "Campos do Jordão family travel");

  assert.equal(photo.pexelsId, "42");
  assert.equal(photo.photographer, "Ana Foto");
  assert.equal(photo.srcOriginal, "https://images.pexels.com/original.jpg");
  assert.equal(photo.isEditorial, true);
  assert.equal(photo.isEstablishmentSpecific, false);
  assert.match(photo.attributionText, /Ana Foto/);
});

test("family score refuses hotels that fail minimum requirements", () => {
  const score = scoreFamilyFit(
    { name: "Hotel Bonito Só Na Foto", googleRating: 4.6, hasCopaBaby: false },
    { childAges: ["0 a 12 meses"], comfortNeeds: ["Copa baby"] }
  );

  assert.equal(score.minimumRequirementsPassed, false);
  assert.equal(score.medal, "not_recommended");
  assert.ok(score.alerts.includes("sem copa baby"));
});

test("family score returns medal for qualified family accommodation", () => {
  const score = scoreFamilyFit(
    {
      name: "Resort Familiar",
      googleRating: 4.7,
      userRatingCount: 1800,
      hasCopaBaby: true,
      hasKidsClub: true,
      hasKidsPool: true,
      worksOnRainyDay: true,
      easyFood: true,
      durationSeconds: 5400,
      distanceMeters: 120000
    },
    { childAges: ["1 a 2 anos"], comfortNeeds: ["Copa baby", "Kids club"], budgetTotal: "R$ 5.000 a R$ 8.000" }
  );

  assert.equal(score.minimumRequirementsPassed, true);
  assert.equal(score.medal, "gold");
  assert.ok(score.score >= 84);
});

test("travel difficulty penalizes long trips with babies", () => {
  const route = classifyTravelDifficulty({ distanceMeters: 320000, durationSeconds: 4 * 3600, childAges: ["0 a 12 meses"] });
  assert.equal(route.level, "hard");
  assert.equal(route.scorePenalty, 22);
});

test("booking affiliate URL is trackable and does not claim availability", () => {
  const url = buildBookingAffiliateUrl({
    destination: "Atibaia, SP",
    hotelName: "Bourbon Atibaia",
    affiliateId: "123456",
    trackingCode: "concierge_test"
  });
  const parsed = new URL(url);
  assert.equal(parsed.hostname, "www.booking.com");
  assert.equal(parsed.searchParams.get("aid"), "123456");
  assert.equal(parsed.searchParams.get("label"), "concierge_test");
  assert.match(parsed.searchParams.get("ss"), /Bourbon Atibaia/);
});

test("cost estimator returns ranges, not exact price promises", () => {
  const estimate = estimateTripCost({ adults: 2, children: 2, nights: 3, distanceKm: 180, lodgingTier: "comfort" });
  assert.match(estimate.economic, /^R\$ .+ a R\$ .+/);
  assert.match(estimate.comfort, /^R\$ .+ a R\$ .+/);
  assert.match(estimate.premium, /^R\$ .+ a R\$ .+/);
});

test("email transaction requires explicit contact consent", () => {
  assert.throws(
    () => validatePayload(ACTIONS.SEND_EMAIL, { email: "familia@example.com", consentContact: false }),
    /Consentimento/
  );
});

test("env validation keeps external API keys server-side", () => {
  assert.throws(() => validateEnv(ACTIONS.SEARCH_PLACES, {}), /GOOGLE_MAPS_API_KEY/);
  assert.doesNotThrow(() => validateEnv(ACTIONS.SEARCH_PLACES, { GOOGLE_MAPS_API_KEY: "server-only" }));
});
