import test from "node:test";
import assert from "node:assert/strict";
import { calculateFinancialSnapshot, projectFreedom } from "./economics-finance.js";

test("calcula patrimonio, liquidez e independencia sem LLM", () => {
  const snapshot = calculateFinancialSnapshot({
    assets: [
      { type: "investment", current_value: 100000, liquidity_bucket: "d0_d1" },
      { type: "pension", current_value: 200000, liquidity_bucket: "over_1_year" }
    ],
    liabilities: [{ outstanding_balance: 50000 }],
    settings: { essential_monthly_expense: 10000, target_monthly_income_today: 20000, withdrawal_rate: 0.04 }
  });
  assert.equal(snapshot.netWorth, 250000);
  assert.equal(snapshot.reserveMonths, 10);
  assert.equal(snapshot.passiveMonthlyIncome, 1000);
  assert.equal(snapshot.independenceRatio, 0.05);
});

test("projeta idades em valores reais", () => {
  const result = projectFreedom({ currentValue: 100000, monthlyContribution: 0, currentAge: 35, ages: [35, 55], realReturnRate: 0.04 });
  assert.equal(result[0].projectedAssets, 100000);
  assert.ok(result[1].projectedAssets > 219000 && result[1].projectedAssets < 220000);
});
