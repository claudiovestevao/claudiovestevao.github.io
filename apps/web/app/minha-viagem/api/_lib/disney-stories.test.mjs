import assert from "node:assert/strict";
import test from "node:test";
import { storyWhatsAppPreview } from "./disney-stories-core.js";

test("story WhatsApp preview invites the family into the site", () => {
  const message = storyWhatsAppPreview({
    id: "2026-07-29-branca-de-neve",
    character: "Branca de Neve",
    lesson: "cuidado e amizade",
    pageUrl: "https://claudiocode.dev/minha-viagem/disney-stories/2026-07-29-branca-de-neve"
  });

  assert.match(message, /Veja hoje a historinha da Branca de Neve e os sete anões/);
  assert.match(message, /Abrir no Claudio Code/);
  assert.match(message, /narração calma/);
});
