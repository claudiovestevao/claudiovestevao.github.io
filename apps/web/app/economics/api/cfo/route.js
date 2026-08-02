import { economicsJson, requireEconomicsContext } from "../_lib/auth";
import { calculateFinancialSnapshot, calculateMillionGoal, chooseNextBestAction, monthBounds, projectFreedom } from "@/lib/economics-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const month = monthBounds();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const [assetsResult, liabilitiesResult, goalsResult, settingsResult, billsResult, transactionsResult] = await Promise.all([
    context.supabase.from("economics_assets").select("*").eq("household_id", context.householdId).order("current_value", { ascending: false }),
    context.supabase.from("economics_liabilities").select("*").eq("household_id", context.householdId).order("monthly_payment", { ascending: false }),
    context.supabase.from("economics_goals").select("*").eq("household_id", context.householdId).order("priority", { ascending: true }),
    context.supabase.from("economics_scenario_settings").select("*").eq("household_id", context.householdId).maybeSingle(),
    context.supabase.from("economics_bill_instances").select("id, title, amount, due_on, status").eq("household_id", context.householdId).gte("due_on", month.start).lte("due_on", horizonDate).order("due_on", { ascending: true }),
    context.supabase.from("economics_transactions").select("id, amount, type, occurred_on").eq("household_id", context.householdId).eq("status", "posted").gte("occurred_on", month.start).lt("occurred_on", month.end)
  ]);

  const coreError = [assetsResult, liabilitiesResult, goalsResult, settingsResult].find((result) => result.error)?.error;
  if (coreError) {
    const fallback = initialEconomicsSnapshot();
    const snapshot = calculateFinancialSnapshot(fallback);
    const millionGoal = buildMillionGoal(snapshot, fallback.settings);
    const goals = updateGoals(fallback.goals, snapshot.investableAssets);
    const settings = updateSettings(fallback.settings, millionGoal);
    return economicsJson({
      ok: true,
      mode: "initial_snapshot",
      snapshot,
      assets: fallback.assets,
      liabilities: fallback.liabilities,
      goals,
      settings,
      millionGoal,
      upcomingBills: [],
      projections: projectFreedom({ currentValue: snapshot.investableAssets, monthlyContribution: millionGoal.requiredMonthlyContribution, currentAge: settings.current_age, realReturnRate: settings.real_return_rate, withdrawalRate: settings.withdrawal_rate }),
      nextBestAction: { kind: "setup", title: "Completar a base financeira", detail: "O painel inicial está ativo. Os detalhes passam a ser persistidos quando o núcleo financeiro for conectado." },
      warnings: ["Painel inicial carregado; persistência financeira aguardando configuração do banco."]
    });
  }

  const assets = assetsResult.data || [];
  const liabilities = liabilitiesResult.data || [];
  const rawGoals = goalsResult.data || [];
  const rawSettings = settingsResult.data || {};
  const upcomingBills = billsResult.error ? [] : billsResult.data || [];
  const transactions = transactionsResult.error ? [] : transactionsResult.data || [];
  const snapshot = calculateFinancialSnapshot({ assets, liabilities, bills: upcomingBills, transactions, settings: rawSettings });
  const millionGoal = buildMillionGoal(snapshot, rawSettings);
  const goals = updateGoals(rawGoals, snapshot.investableAssets);
  const settings = updateSettings(rawSettings, millionGoal);
  const projections = projectFreedom({
    currentValue: snapshot.investableAssets,
    monthlyContribution: settings.monthly_contribution,
    currentAge: settings.current_age,
    realReturnRate: settings.real_return_rate,
    withdrawalRate: settings.withdrawal_rate
  });

  return economicsJson({
    ok: true,
    snapshot,
    assets,
    liabilities,
    goals,
    settings,
    millionGoal,
    upcomingBills,
    projections,
    nextBestAction: chooseNextBestAction({ snapshot, upcomingBills, assets, goals }),
    warnings: [billsResult.error ? "Calendário de contas ainda indisponível." : "", transactionsResult.error ? "Lançamentos do mês ainda indisponíveis." : ""].filter(Boolean)
  });
}

function initialEconomicsSnapshot() {
  return {
    assets: [
      { id: "initial-eqi", name: "Carteira EQI", owner: "Vitor", type: "investment", current_value: 151805.01, liquidity_bucket: "unknown" },
      { id: "initial-bradesco", name: "Previdência Bradesco", owner: "Vitor", type: "pension", current_value: 23921.31, liquidity_bucket: "over_1_year" },
      { id: "initial-porto", name: "Ações e PLR Porto", owner: "Vitor", type: "stock_compensation", current_value: 43092, liquidity_bucket: "unknown" },
      { id: "initial-portoprev", name: "PortoPrev", owner: "Vitor", type: "pension", current_value: 0, liquidity_bucket: "over_1_year" }
    ],
    liabilities: [{ id: "initial-consortium", name: "Consórcio imobiliário", owner: "Familia", type: "consortium_commitment", outstanding_balance: 543560.61, monthly_payment: 1393.5 }],
    goals: [
      { id: "initial-emergency", name: "Reserva de emergência", goal_type: "emergency", target_value_today: 0, current_value: 0, status: "active" },
      { id: "initial-health", name: "Reserva de saúde", goal_type: "health", target_value_today: 0, current_value: 0, status: "active" },
      { id: "initial-freedom", name: "R$ 1 milhão aos 40", goal_type: "retirement", target_value_today: 1000000, current_value: 218818.32, status: "active" },
      { id: "initial-education", name: "Educação dos filhos", goal_type: "education", target_value_today: 0, current_value: 0, status: "active" }
    ],
    settings: { current_age: 35, target_age: 40, retirement_age: 60, target_monthly_income_today: 20000, real_return_rate: 0.04, withdrawal_rate: 0.035, essential_monthly_expense: 0 }
  };
}

function buildMillionGoal(snapshot, settings) {
  const common = {
    currentValue: snapshot.investableAssets,
    monthsToTarget: 60,
    contributionMonths: 55,
    annualRealReturnRate: Number(settings?.real_return_rate || 0.04),
    automaticMonthlyContribution: 3040
  };
  const minimum = calculateMillionGoal({ ...common, targetValue: 800000 });
  const target = calculateMillionGoal({ ...common, targetValue: 1000000 });
  const upper = calculateMillionGoal({ ...common, targetValue: 1200000 });
  return {
    ...target,
    minimumValue: minimum.targetValue,
    upperValue: upper.targetValue,
    progressToUpper: upper.targetValue > 0 ? Math.min(1, snapshot.investableAssets / upper.targetValue) : 0,
    levels: { minimum, target, upper },
    startDate: "2027-01-01",
    targetDate: "2031-08-01",
    targetAge: 40,
    assumption: "Prazo conservador de 60 meses; confirmar a data de nascimento para ajustar o mês final."
  };
}

function updateGoals(goals, currentValue) {
  const rows = Array.isArray(goals) ? goals : [];
  const updated = rows.map((goal) => goal.goal_type === "retirement" ? {
    ...goal,
    name: "R$ 1 milhão aos 40",
    target_value_today: 1000000,
    current_value: currentValue,
    status: "active"
  } : goal);
  if (updated.some((goal) => goal.goal_type === "retirement")) return updated;
  return [...updated, { id: "million-at-40", name: "R$ 1 milhão aos 40", goal_type: "retirement", target_value_today: 1000000, current_value: currentValue, status: "active" }];
}

function updateSettings(settings, millionGoal) {
  return {
    ...(settings || {}),
    current_age: Number(settings?.current_age || 35),
    target_age: 40,
    real_return_rate: Number(settings?.real_return_rate || 0.04),
    withdrawal_rate: Number(settings?.withdrawal_rate || 0.035),
    target_monthly_income_today: Number(settings?.target_monthly_income_today || 20000),
    monthly_contribution: millionGoal.requiredMonthlyContribution
  };
}
