import test from "node:test";
import assert from "node:assert/strict";
import { applyKnownPlanUpdates, ECONOMICS_PLAN_VERSION } from "./economics-plan-updates.js";

const basePlan = {
  version: 1,
  month: "2026-08",
  incomes: [
    { id: "vitor", owner: "Vitor", gross: 38000, netEstimate: 27281.91 },
    { id: "nath", owner: "Nathalie", gross: 23600, netEstimate: 16789.78 }
  ],
  payments: [
    { id: "chatgpt", title: "Assinatura ChatGPT", amount: null },
    { id: "prime", title: "Amazon Prime", amount: null },
    { id: "itau", title: "Cartão Itaú Personnalité", owner: "Vitor", kind: "card", amount: 17961 }
  ],
  bonuses: [
    { id: "13-vitor", owner: "Vitor", title: "13º salário", month: 12, minAmount: 38000, maxAmount: 38000 }
  ]
};

test("updates subscription values and annual renewal without duplicates", () => {
  const plan = applyKnownPlanUpdates(basePlan);
  assert.equal(plan.version, ECONOMICS_PLAN_VERSION);
  assert.equal(plan.payments.length, 3);
  assert.equal(plan.payments.find((item) => item.id === "chatgpt").foreignAmount, 20);
  assert.equal(plan.payments.find((item) => item.id === "prime").amount, 166.8);
  assert.equal(plan.payments.find((item) => item.id === "prime").renewalDate, "2027-07-11");
  assert.equal(plan.payments.find((item) => item.id === "itau").monthlyAmounts["2026-09"], 2800);
});

test("shows thirteenth salary as a net estimate after tax", () => {
  const plan = applyKnownPlanUpdates(basePlan);
  const vitor = plan.bonuses.find((item) => item.owner === "Vitor" && item.taxed);
  const nathalie = plan.bonuses.find((item) => item.owner === "Nathalie" && item.taxed);
  assert.equal(vitor.grossAmount, 38000);
  assert.equal(vitor.netEstimate, 27281.91);
  assert.equal(nathalie.grossAmount, 23600);
  assert.equal(nathalie.netEstimate, 16789.78);
});

test("discounts eight percent for PortoPrev from Vitor available salary", () => {
  const plan = applyKnownPlanUpdates(basePlan);
  const vitor = plan.incomes.find((item) => item.owner === "Vitor");
  assert.equal(vitor.privatePensionContribution, 3040);
  assert.equal(vitor.netBeforePension, 27281.91);
  assert.equal(vitor.netEstimate, 24241.91);
});
