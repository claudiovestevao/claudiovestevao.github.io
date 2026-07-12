import assert from "node:assert/strict";
import test from "node:test";
import { saveDiaryEntry } from "./diary.js";

test("saveDiaryEntry lets Postgres generate an id for new WhatsApp entries", async () => {
  const inserts = [];
  const client = {
    from(table) {
      assert.equal(table, "diario_entries");
      return {
        insert(row) {
          inserts.push(row);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: {
                      ...row,
                      id: "11111111-1111-4111-8111-111111111111",
                      created_at: "2026-07-11T12:00:00.000Z"
                    },
                    error: null
                  };
                }
              };
            }
          };
        }
      };
    }
  };

  const result = await saveDiaryEntry(client, {
    autor_phone: "5511998802974",
    autor_nome: "Papai (Vitor)",
    tipo: "texto",
    texto_original: "Teste pelo WhatsApp",
    data_local: "2026-07-11",
    wa_message_id: "wamid.test"
  });

  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(inserts.length, 1);
  assert.equal(Object.hasOwn(inserts[0], "id"), false);
  assert.equal(inserts[0].texto_original, "Teste pelo WhatsApp");
});
