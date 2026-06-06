import assert from "node:assert/strict";
import test from "node:test";
import { conciergeFamilyItineraries } from "../src/data/conciergeFamilyItineraries.js";

test("Circuito das Aguas itinerary is available for Aguas de Lindoia families", () => {
  const itinerary = conciergeFamilyItineraries.find(item => item.id === "circuito-das-aguas-aguas-socorro");
  assert.ok(itinerary, "missing Circuito das Aguas itinerary");
  assert.ok(itinerary.primaryDestinationKeys.includes("aguas-de-lindoia"));
  assert.ok(itinerary.nearbyDestinationKeys.includes("socorro-sp"));
  assert.equal(itinerary.minNights, 3);
  assert.ok(itinerary.routeFacts.some(fact => fact.value.includes("2h29")));
  assert.ok(itinerary.dayPlans.some(plan => plan.nights.includes("3 a 4")));
});
