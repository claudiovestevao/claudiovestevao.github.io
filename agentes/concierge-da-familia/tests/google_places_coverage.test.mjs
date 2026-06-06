import assert from "node:assert/strict";
import test from "node:test";
import { conciergeGooglePlacesCoverage } from "../src/data/conciergeGooglePlacesCoverage.js";

test("Google Places coverage is complete for concierge destinations and curated hotels", () => {
  const coverage = conciergeGooglePlacesCoverage;
  assert.equal(coverage.total, 55);
  assert.equal(coverage.covered, coverage.total);
  assert.equal(coverage.missing, 0);
  assert.equal(coverage.destinations.length, 33);
  assert.equal(coverage.hotels.length, 22);

  for (const place of [...coverage.destinations, ...coverage.hotels]) {
    assert.equal(place.coverageStatus, "covered", `${place.id} is not covered`);
    assert.ok(place.placeId, `${place.id} is missing placeId`);
    assert.ok(place.googleName, `${place.id} is missing Google name`);
    assert.ok(place.formattedAddress, `${place.id} is missing formatted address`);
    assert.equal(typeof place.latitude, "number", `${place.id} is missing latitude`);
    assert.equal(typeof place.longitude, "number", `${place.id} is missing longitude`);
    assert.ok(place.photos.length >= 3, `${place.id} needs at least 3 Google photo refs`);
  }
});

test("Google hotel records include public rating signals", () => {
  for (const hotel of conciergeGooglePlacesCoverage.hotels) {
    assert.ok(hotel.rating >= 4, `${hotel.id} has low or missing Google rating`);
    assert.ok(hotel.userRatingCount >= 20, `${hotel.id} has too few Google reviews`);
    assert.ok(hotel.websiteUri, `${hotel.id} is missing website`);
    assert.ok(hotel.phoneNumber, `${hotel.id} is missing phone`);
  }
});

test("International destinations resolve outside Brazil homonyms", () => {
  const byId = new Map(conciergeGooglePlacesCoverage.destinations.map(place => [place.id, place]));
  assert.match(byId.get("buenos-aires").formattedAddress, /Argentina/i);
  assert.match(byId.get("buenos-aires-argentina").formattedAddress, /Argentina/i);
  assert.match(byId.get("orlando").formattedAddress, /EUA|Estados Unidos|United States/i);
  assert.match(byId.get("orlando-fl").formattedAddress, /EUA|Estados Unidos|United States/i);
});
