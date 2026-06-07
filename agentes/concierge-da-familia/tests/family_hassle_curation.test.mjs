import assert from "node:assert/strict";
import test from "node:test";
import { familyDestinationCatalog1001 } from "../src/data/familyDestinationCatalog1001.js";
import {
  applyFamilyHassleCuration,
  calculateFamilyFitScore,
  curatedFamilyHassleBySlug
} from "../src/data/familyHassleCuration.js";

test("family hassle curation enriches every catalog destination", () => {
  const enriched = familyDestinationCatalog1001.map(applyFamilyHassleCuration);
  assert.ok(enriched.every((destination) => ["baixo", "moderado", "alto", "muito_alto"].includes(destination.familyHassleLevel)));
  assert.ok(enriched.every((destination) => Number.isInteger(destination.hassleScore)));
  assert.ok(enriched.every((destination) => Array.isArray(destination.mainHassles) && destination.mainHassles.length > 0));
  assert.ok(enriched.every((destination) => destination.semPerrengueStrategy));
});

test("hard destinations are explicit about baby and toddler risk", () => {
  const lencois = applyFamilyHassleCuration({ slug: "lencois-ba", name: "Lencois", familyScore: 82 });
  const jalapao = applyFamilyHassleCuration({ slug: "jalapao-to", name: "Jalapao", familyScore: 82 });

  assert.equal(lencois.familyHassleLevel, "alto");
  assert.equal(lencois.avoidWithBaby, true);
  assert.equal(jalapao.familyHassleLevel, "muito_alto");
  assert.equal(jalapao.requires4x4, true);
  assert.equal(jalapao.bestMinimumAge, 8);
});

test("family fit score penalizes perrengue for babies", () => {
  const jalapao = curatedFamilyHassleBySlug["jalapao-to"];
  const babyScore = calculateFamilyFitScore(90, jalapao, { youngestChildAge: 1, travelEffort: "short", budget: "smart", restFirst: true });
  const olderKidScore = calculateFamilyFitScore(90, jalapao, { youngestChildAge: 9, travelEffort: "flight", budget: "comfort" });

  assert.ok(babyScore < 40);
  assert.ok(olderKidScore > babyScore);
});
