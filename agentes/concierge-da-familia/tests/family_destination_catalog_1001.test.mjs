import assert from "node:assert/strict";
import test from "node:test";
import {
  familyDestinationCatalog1001,
  familyDestinationCatalog1001Meta
} from "../src/data/familyDestinationCatalog1001.js";
import { familyDestinationCatalog1001Meta as frontendMeta } from "../src/data/familyDestinationCatalog1001Meta.js";

test("family destination catalog has exactly 1001 auditable candidates", () => {
  assert.equal(familyDestinationCatalog1001Meta.count, 1001);
  assert.equal(frontendMeta.count, 1001);
  assert.equal(familyDestinationCatalog1001.length, 1001);

  const slugs = new Set(familyDestinationCatalog1001.map(destination => destination.slug));
  const states = new Set(familyDestinationCatalog1001.map(destination => destination.stateCode));
  assert.equal(slugs.size, 1001);
  assert.equal(states.size, 27);
});

test("family destination catalog separates candidates from hotel-qualified recommendations", () => {
  const known = familyDestinationCatalog1001.filter(destination => destination.curationLevel === "known_family_destination");
  const candidates = familyDestinationCatalog1001.filter(destination => destination.curationLevel === "family_destination_candidate");

  assert.ok(known.length >= 20);
  assert.ok(candidates.length > 900);
  assert.ok(familyDestinationCatalog1001.every(destination => destination.minimumFamilyRequirementsPassed === false));
  assert.ok(familyDestinationCatalog1001.every(destination => destination.recommendationReadiness));
});

test("family destination catalog keeps coordinates and source lineage", () => {
  assert.ok(familyDestinationCatalog1001.every(destination => Number.isFinite(destination.latitude)));
  assert.ok(familyDestinationCatalog1001.every(destination => Number.isFinite(destination.longitude)));
  assert.ok(familyDestinationCatalog1001.every(destination => destination.ibgeCode));
  assert.ok(familyDestinationCatalog1001.every(destination => destination.source?.coordinatesUrl));
});
