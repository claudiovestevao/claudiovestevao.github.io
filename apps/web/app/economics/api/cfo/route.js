import { economicsJson, requireEconomicsContext } from "../_lib/auth";
import { calculateFinancialSnapshot, calculateMillionGoal, chooseNextBestAction, monthBounds, projectFreedom } from "@/lib/economics-finance";
import { ECONOMICS_STORAGE_BUCKET } from "@/lib/economics-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const month = monthBounds();
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonDate = horizon.toISOString().slice(0, 10);

  const [assetsResult, liabilitiesResult, goalsResult, settingsResult, billsResult, transactionsResult, membersResult] = await Promise.all([
    context.supabase.from("economics_assets").select("*").eq("household_id", context.householdId).order("current_value", { ascending: false }),
    context.supabase.from("economics_liabilities").select("*").eq("household_id", context.householdId).order("monthly_payment", { ascending: false }),
    context.supabase.from("economics_goals").select("*").eq("household_id", context.householdId).order("priority", { ascending: true }),
    context.supabase.from("economics_scenario_settings").select("*").eq("household_id", context.householdId).maybeSingle(),
    context.supabase.from("economics_bill_instances").select("id, title, amount, due_on, status").eq("household_id", context.householdId).gte("due_on", month.start).lte("due_on", horizonDate).order("due_on", { ascending: true }),
    context.supabase.from("economics_transactions").select("id, amount, type, occurred_on").eq("household_id", context.householdId).eq("status", "posted").gte("occurred_on", month.start).lt("occurred_on", month.end),
    context.supabase.from("economics_household_members").select("email, display_name, birth_date").eq("household_id", context.householdId)
  ]);

  const timeline = buildMillionGoalTimeline(membersResult.error ? [] : membersResult.data || []);

  const coreError = [assetsResult, liabilitiesResult, goalsResult, settingsResult].find((result) => result.error)?.error;
  if (coreError) {
    const fallback = initialEconomicsSnapshot();
    const snapshot = calculateFinancialSnapshot(fallback);
    const millionGoal = buildMillionGoal(snapshot, fallback.settings, timeline);
    const goals = updateGoals(fallback.goals, snapshot.investableAssets);
    const settings = updateSettings(fallback.settings, millionGoal, timeline.currentAge);
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

  let effectiveSettings = rawSettings;
  let essentialExpenseWarning = "";
  if (!Number(rawSettings?.essential_monthly_expense)) {
    const estimated = await estimateEssentialExpenseFromPlan(context.supabase, context.householdId);
    if (estimated) {
      effectiveSettings = { ...rawSettings, essential_monthly_expense: estimated };
      essentialExpenseWarning = "Despesa essencial estimada automaticamente a partir do planejamento mensal (pagamentos fixos, sem cartões). Ajuste manualmente se necessário.";
    }
  }

  const snapshot = calculateFinancialSnapshot({ assets, liabilities, bills: upcomingBills, transactions, settings: effectiveSettings });
  const millionGoal = buildMillionGoal(snapshot, effectiveSettings, timeline);
  const goals = updateGoals(rawGoals, snapshot.investableAssets);
  const settings = updateSettings(effectiveSettings, millionGoal, timeline.currentAge);
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
    warnings: [
      billsResult.error ? "Calendário de contas ainda indisponível." : "",
      transactionsResult.error ? "Lançamentos do mês ainda indisponíveis." : "",
      essentialExpenseWarning
    ].filter(Boolean)
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

function buildMillionGoal(snapshot, settings, timeline) {
  const common = {
    currentValue: snapshot.investableAssets,
    monthsToTarget: timeline.monthsToTarget,
    contributionMonths: timeline.contributionMonths,
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
    targetDate: timeline.targetDate,
    targetAge: 40,
    assumption: timeline.fromBirthDate
      ? `Calculado a partir da data de nascimento de Vitor (${timeline.birthDateLabel}); aportes automáticos começam em janeiro de 2027.`
      : "Prazo conservador de 60 meses; data de nascimento ainda não confirmada no cadastro."
  };
}

function buildMillionGoalTimeline(members) {
  const now = new Date();
  const vitor = (members || []).find(
    (member) => member.email === "cvitorestevao@gmail.com" || /vitor/i.test(member.display_name || "")
  );
  const birthDate = vitor?.birth_date || null;

  if (!birthDate) {
    return { monthsToTarget: 60, contributionMonths: 55, targetDate: "2031-08-01", currentAge: 35, fromBirthDate: false };
  }

  const targetDateObj = nthBirthday(birthDate, 40);
  const startDateObj = new Date("2027-01-01T00:00:00Z");
  const monthsToTarget = Math.max(1, monthsBetween(now, targetDateObj));
  const monthsToStart = Math.max(0, monthsBetween(now, startDateObj));
  const contributionMonths = Math.max(1, monthsToTarget - monthsToStart);

  return {
    monthsToTarget,
    contributionMonths,
    targetDate: targetDateObj.toISOString().slice(0, 10),
    currentAge: ageInYears(birthDate, now),
    fromBirthDate: true,
    birthDateLabel: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${birthDate}T00:00:00Z`)
    )
  };
}

function ageInYears(birthDateStr, asOf) {
  const birth = new Date(`${birthDateStr}T00:00:00Z`);
  let age = asOf.getUTCFullYear() - birth.getUTCFullYear();
  const hadBirthdayThisYear =
    asOf.getUTCMonth() > birth.getUTCMonth() ||
    (asOf.getUTCMonth() === birth.getUTCMonth() && asOf.getUTCDate() >= birth.getUTCDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

function monthsBetween(fromDate, toDate) {
  let months = (toDate.getUTCFullYear() - fromDate.getUTCFullYear()) * 12 + (toDate.getUTCMonth() - fromDate.getUTCMonth());
  if (toDate.getUTCDate() < fromDate.getUTCDate()) months -= 1;
  return months;
}

function nthBirthday(birthDateStr, targetAge) {
  const birth = new Date(`${birthDateStr}T00:00:00Z`);
  return new Date(Date.UTC(birth.getUTCFullYear() + targetAge, birth.getUTCMonth(), birth.getUTCDate()));
}

async function estimateEssentialExpenseFromPlan(supabase, householdId) {
  const path = `${householdId}/planning/monthly-plan.json`;
  const { data, error } = await supabase.storage.from(ECONOMICS_STORAGE_BUCKET).download(path);
  if (error || !data) return null;

  try {
    const plan = JSON.parse(await data.text());
    const payments = Array.isArray(plan?.payments) ? plan.payments : [];
    const total = payments
      .filter((item) => item.kind === "fixed" && item.recurring !== false && !item.includedInCard && item.status !== "paused")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    return total > 0 ? Math.round(total * 100) / 100 : null;
  } catch {
    return null;
  }
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

function updateSettings(settings, millionGoal, currentAge) {
  return {
    ...(settings || {}),
    current_age: Number.isFinite(currentAge) ? currentAge : Number(settings?.current_age || 35),
    target_age: 40,
    real_return_rate: Number(settings?.real_return_rate || 0.04),
    withdrawal_rate: Number(settings?.withdrawal_rate || 0.035),
    target_monthly_income_today: Number(settings?.target_monthly_income_today || 20000),
    monthly_contribution: millionGoal.requiredMonthlyContribution
  };
}
