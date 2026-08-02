import test from "node:test";
import assert from "node:assert/strict";
import {
  formatPaymentReminderMessage,
  saoPauloDateKey,
  selectManualPaymentReminders
} from "./economics-payment-reminders.js";

const plan = {
  month: "2026-08",
  payments: [
    { id: "condominio", title: "Condomínio", owner: "Nathalie", amount: 2300, dueDay: 5, status: "open", recurring: true },
    { id: "luz", title: "Luz", owner: "Vitor", amount: 361, dueDay: 5, status: "open", recurring: true, autopay: true },
    { id: "netflix", title: "Netflix", owner: "Vitor", amount: 59.9, dueDay: 5, status: "open", recurring: true, includedInCard: true },
    { id: "nubank", title: "Nubank", owner: "Nathalie", amount: 1300, dueDay: 1, status: "paid", recurring: true }
  ]
};

test("selects only manual open payments on the due date", () => {
  const items = selectManualPaymentReminders(plan, new Date("2026-08-05T14:00:00Z"));
  assert.deepEqual(items.map((item) => item.id), ["condominio"]);
  assert.equal(items[0].daysUntil, 0);
});

test("does not remind autopay, card-contained or paid items in the plan month", () => {
  const items = selectManualPaymentReminders(plan, new Date("2026-08-05T14:00:00Z"));
  assert.deepEqual(items.map((item) => item.id), ["condominio"]);
});

test("a recurring paid item becomes eligible in a later month", () => {
  const items = selectManualPaymentReminders(plan, new Date("2026-09-01T14:00:00Z"));
  assert.deepEqual(items.map((item) => item.id), ["nubank"]);
});

test("formats a friendly message with the Economics link", () => {
  const items = selectManualPaymentReminders(plan, new Date("2026-08-05T14:00:00Z"));
  const message = formatPaymentReminderMessage(items, "https://claudiocode.dev/");
  assert.match(message, /Bom dia, Vitor e Nath!/);
  assert.match(message, /Condomínio/);
  assert.match(message, /R\$\s*2\.300,00/);
  assert.match(message, /https:\/\/claudiocode\.dev\/economics/);
});

test("does not remind before or after the due date", () => {
  assert.equal(selectManualPaymentReminders(plan, new Date("2026-08-04T14:00:00Z")).length, 0);
  assert.equal(selectManualPaymentReminders(plan, new Date("2026-08-06T14:00:00Z")).length, 0);
});

test("keeps paid status separate for each recurring month", () => {
  const recurringPlan = { month: "2026-08", payments: [{ id: "school", title: "Escola", owner: "Vitor", amount: 3000, dueDay: 5, status: "paid", recurring: true, monthStatuses: { "2026-09": "paid" } }] };
  assert.equal(selectManualPaymentReminders(recurringPlan, new Date("2026-09-05T14:00:00Z")).length, 0);
  assert.equal(selectManualPaymentReminders(recurringPlan, new Date("2026-10-05T14:00:00Z")).length, 1);
});

test("uses Sao Paulo calendar date", () => {
  assert.equal(saoPauloDateKey(new Date("2026-08-02T01:30:00Z")), "2026-08-01");
});

test("annual payments only remind in their renewal month", () => {
  const annualPlan = { month: "2026-08", payments: [{ id: "prime", title: "Amazon Prime", owner: "Vitor", amount: 166.8, dueDay: 11, renewalDate: "2027-07-11", kind: "annual", status: "paid", recurring: true }] };
  assert.equal(selectManualPaymentReminders(annualPlan, new Date("2026-09-11T14:00:00Z")).length, 0);
  assert.equal(selectManualPaymentReminders(annualPlan, new Date("2027-07-11T14:00:00Z")).length, 1);
});
