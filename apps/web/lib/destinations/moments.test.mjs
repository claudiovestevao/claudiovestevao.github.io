import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRIP_MOMENT_OPTIONS, destinationMomentScore, momentAllows } from "./moments.js";

describe("trip moment destination rules", () => {
  it("exposes the public filter contract used by the explorer", () => {
    const values = TRIP_MOMENT_OPTIONS.map((option) => option.value);

    assert.ok(values.includes("winter"));
    assert.ok(values.includes("long_vacation"));
    assert.ok(values.includes("weekend_short"));
  });

  it("keeps winter discovery focused on mountain and cold weather destinations", () => {
    const caboFrio = {
      name: "Cabo Frio",
      slug: "cabo-frio",
      stateCode: "RJ",
      country: "Brasil",
      familyScore: 74,
      familyHassleLevel: "baixo",
      tags: ["praia", "litoral"]
    };
    const campos = {
      name: "Campos do Jordão",
      slug: "campos-do-jordao",
      stateCode: "SP",
      country: "Brasil",
      familyScore: 61,
      tags: ["serra", "inverno"]
    };

    assert.equal(momentAllows(caboFrio, "winter"), false);
    assert.equal(momentAllows(campos, "winter"), true);
  });

  it("prioritizes international and long-haul trips for long vacations", () => {
    const orlando = {
      name: "Orlando",
      slug: "orlando",
      country: "Estados Unidos",
      familyScore: 49,
      tags: ["internacional", "parques"]
    };
    const atibaia = {
      name: "Atibaia",
      slug: "atibaia",
      stateCode: "SP",
      country: "Brasil",
      familyScore: 90,
      tags: ["resort", "interior"]
    };

    assert.ok(destinationMomentScore(orlando, "long_vacation") > destinationMomentScore(atibaia, "long_vacation"));
  });

  it("keeps short weekend discovery near São Paulo in this MVP", () => {
    const atibaia = {
      name: "Atibaia",
      slug: "atibaia",
      stateCode: "SP",
      country: "Brasil"
    };
    const montevideo = {
      name: "Montevideo",
      slug: "montevideo",
      country: "Uruguai"
    };

    assert.equal(momentAllows(atibaia, "weekend_short"), true);
    assert.equal(momentAllows(montevideo, "weekend_short"), false);
  });
});
