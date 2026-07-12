import { economicsJson, requireEconomicsContext } from "../_lib/auth";
import { calculateFinancialSnapshot, chooseNextBestAction, monthBounds, projectFreedom } from "@/lib/economics-finance";

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
    return economicsJson({
      ok: true,
      mode: "initial_snapshot",
      snapshot,
      assets: fallback.assets,
      liabilities: fallback.liabilities,
      goals: fallback.goals,
      settings: fallback.settings,
      upcomingBills: [],
      projections: projectFreedom({ currentValue: snapshot.investableAssets, monthlyContribution: 0, currentAge: fallback.settings.current_age, realReturnRate: fallback.settings.real_return_rate, withdrawalRate: fallback.settings.withdrawal_rate }),
      nextBestAction: { kind: "setup", title: "Completar a base financeira", detail: "O painel inicial está ativo. Os detalhes passam a ser persistidos quando o núcleo financeiro for conectado." },
      warnings: ["Painel inicial carregado; persistência financeira aguardando configuração do banco."]
    });
  }

  const assets = assetsResult.data || [];
  const liabilities = liabilitiesResult.data || [];
  const goals = goalsResult.data || [];
  const settings = settingsResult.data || {};
  const upcomingBills = billsResult.error ? [] : billsResult.data || [];
  const transactions = transactionsResult.error ? [] : transactionsResult.data || [];
  const snapshot = calculateFinancialSnapshot({ assets, liabilities, bills: upcomingBills, transactions, settings });
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
    upcomingBills,
    projections,
    nextBestAction: chooseNextBestAction({ snapshot, upcomingBills, assets, goals }),
    warnings: [billsResult.error ? "Calendario de contas ainda indisponivel." : "", transactionsResult.error ? "Lancamentos do mes ainda indisponiveis." : ""].filter(Boolean)
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
      { id: "initial-freedom", name: "Liberdade aos 55", goal_type: "retirement", target_value_today: 6857143, current_value: 0, status: "active" },
      { id: "initial-education", name: "Educação dos filhos", goal_type: "education", target_value_today: 0, current_value: 0, status: "active" }
    ],
    settings: { current_age: 35, target_age: 55, retirement_age: 60, target_monthly_income_today: 20000, real_return_rate: 0.04, withdrawal_rate: 0.035, essential_monthly_expense: 0 }
  };
}
