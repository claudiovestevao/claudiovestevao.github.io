export const ECONOMICS_OWNERS = ["Vitor", "Nathalie", "Luiza", "Arthur", "Familia"];
export const ECONOMICS_PAYMENT_METHODS = ["pix", "debit", "credit", "credit_portobank", "cash", "arc_debit", "bank_transfer", "other"];
export const ECONOMICS_TRANSACTION_TYPES = ["income", "expense", "transfer", "asset_adjustment", "liability_adjustment"];

export function normalizeEconomicsOwner(value) {
  const owner = clean(value);
  return ECONOMICS_OWNERS.includes(owner) ? owner : "Familia";
}

export function normalizePaymentMethod(value) {
  const method = clean(value);
  return ECONOMICS_PAYMENT_METHODS.includes(method) ? method : "pix";
}

export function normalizeTransactionType(value) {
  const type = clean(value);
  return ECONOMICS_TRANSACTION_TYPES.includes(type) ? type : "expense";
}

export function toMoneyNumber(value) {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

export function monthBounds(date = new Date()) {
  const base = date instanceof Date ? date : new Date(date);
  const year = base.getFullYear();
  const month = base.getMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

export function summarizeTransactions(transactions = [], categories = []) {
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const totals = {
    income: 0,
    expense: 0,
    transfer: 0,
    assetAdjustment: 0,
    liabilityAdjustment: 0
  };
  const byCategory = new Map();
  const byOwner = new Map();
  const byPaymentMethod = new Map();

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    if (transaction.type === "income") totals.income += amount;
    if (transaction.type === "expense") totals.expense += amount;
    if (transaction.type === "transfer") totals.transfer += amount;
    if (transaction.type === "asset_adjustment") totals.assetAdjustment += amount;
    if (transaction.type === "liability_adjustment") totals.liabilityAdjustment += amount;

    const category = categoryById.get(transaction.category_id);
    const categoryKey = category?.name || "Sem categoria";
    byCategory.set(categoryKey, (byCategory.get(categoryKey) || 0) + amount);

    const ownerKey = transaction.owner || "Familia";
    byOwner.set(ownerKey, (byOwner.get(ownerKey) || 0) + amount);

    const paymentKey = transaction.payment_method || "other";
    byPaymentMethod.set(paymentKey, (byPaymentMethod.get(paymentKey) || 0) + amount);
  }

  return {
    totals: {
      ...totals,
      balance: totals.income - totals.expense
    },
    byCategory: mapToRows(byCategory),
    byOwner: mapToRows(byOwner),
    byPaymentMethod: mapToRows(byPaymentMethod)
  };
}

export function calculateFinancialSnapshot({ assets = [], liabilities = [], bills = [], transactions = [], settings = {} } = {}) {
  const totalAssets = sum(assets, "current_value");
  const totalLiabilities = sum(liabilities, "outstanding_balance");
  const liquidAssets = assets
    .filter((asset) => ["d0_d1", "up_to_30_days"].includes(asset.liquidity_bucket))
    .reduce((total, asset) => total + Number(asset.current_value || 0), 0);
  const knownLiquidity = assets.some((asset) => ["d0_d1", "up_to_30_days"].includes(asset.liquidity_bucket));
  const essentialExpense = Number(settings.essential_monthly_expense || 0);
  const reserveMonths = essentialExpense > 0 ? liquidAssets / essentialExpense : null;
  const targetMonthlyIncome = Number(settings.target_monthly_income_today || 20000);
  const withdrawalRate = Number(settings.withdrawal_rate || 0.035);
  const investableAssets = assets
    .filter((asset) => ["cash", "investment", "pension", "stock_compensation"].includes(asset.type))
    .reduce((total, asset) => total + Number(asset.current_value || 0), 0);
  const passiveMonthlyIncome = investableAssets * withdrawalRate / 12;
  const independenceRatio = targetMonthlyIncome > 0 ? passiveMonthlyIncome / targetMonthlyIncome : 0;
  const now = new Date();
  const horizons = [30, 60, 90].map((days) => {
    const end = new Date(now);
    end.setDate(end.getDate() + days);
    const due = bills.filter((bill) => bill.status !== "paid" && new Date(`${bill.due_on}T12:00:00`) <= end);
    return { days, expenses: sum(due, "amount"), billCount: due.length };
  });
  const monthIncome = transactions.filter((item) => item.type === "income").reduce((total, item) => total + Number(item.amount || 0), 0);
  const monthExpense = transactions.filter((item) => item.type === "expense").reduce((total, item) => total + Number(item.amount || 0), 0);

  return {
    totalAssets: round(totalAssets),
    totalLiabilities: round(totalLiabilities),
    netWorth: round(totalAssets - totalLiabilities),
    liquidAssets: round(liquidAssets),
    liquidityKnown: knownLiquidity,
    essentialExpense: round(essentialExpense),
    reserveMonths: reserveMonths === null ? null : round(reserveMonths),
    investableAssets: round(investableAssets),
    passiveMonthlyIncome: round(passiveMonthlyIncome),
    independenceRatio: round(independenceRatio),
    monthIncome: round(monthIncome),
    monthExpense: round(monthExpense),
    monthBalance: round(monthIncome - monthExpense),
    horizons
  };
}

export function projectFreedom({ currentValue = 0, monthlyContribution = 0, currentAge = 35, ages = [40, 45, 50, 55, 60], realReturnRate = 0.04, withdrawalRate = 0.035 } = {}) {
  return ages.map((age) => {
    const years = Math.max(0, age - currentAge);
    const months = years * 12;
    const monthlyRate = Math.pow(1 + Number(realReturnRate || 0), 1 / 12) - 1;
    const accumulatedCurrent = Number(currentValue || 0) * Math.pow(1 + monthlyRate, months);
    const accumulatedContributions = monthlyRate > 0
      ? Number(monthlyContribution || 0) * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
      : Number(monthlyContribution || 0) * months;
    const projectedAssets = accumulatedCurrent + accumulatedContributions;
    return {
      age,
      projectedAssets: round(projectedAssets),
      passiveMonthlyIncome: round(projectedAssets * Number(withdrawalRate || 0) / 12)
    };
  });
}

export function chooseNextBestAction({ snapshot, upcomingBills = [], assets = [], goals = [] } = {}) {
  const overdue = upcomingBills.find((bill) => new Date(`${bill.due_on}T12:00:00`) < new Date() && bill.status !== "paid");
  if (overdue) return { kind: "bill", title: `Confirmar pagamento de ${overdue.title}`, detail: `${formatMoney(overdue.amount)} com vencimento em ${formatShortDate(overdue.due_on)}.` };
  if (!snapshot?.liquidityKnown) return { kind: "protection", title: "Classificar a liquidez da carteira EQI", detail: "Sem isso, o Economics nao consegue medir a reserva de emergencia com seguranca." };
  if (!snapshot?.essentialExpense) return { kind: "protection", title: "Informar a despesa essencial mensal", detail: "Esse numero destrava a cobertura da reserva em meses." };
  const unknownAsset = assets.find((asset) => Number(asset.current_value || 0) === 0 && /PortoPrev/i.test(asset.name));
  if (unknownAsset) return { kind: "freedom", title: "Enviar o extrato atual da PortoPrev", detail: "O saldo muda a leitura do patrimonio e da liberdade aos 55." };
  const incompleteGoal = goals.find((goal) => Number(goal.target_value_today || 0) === 0 && goal.status === "active");
  if (incompleteGoal) return { kind: "goal", title: `Definir a meta: ${incompleteGoal.name}`, detail: "Uma estimativa inicial ja permite acompanhar o progresso." };
  return { kind: "review", title: "Revisar os proximos vencimentos", detail: "Leva menos de cinco minutos e mantem o mes previsivel." };
}

function sum(items, field) {
  return (items || []).reduce((total, item) => total + Number(item?.[field] || 0), 0);
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${value}T12:00:00`));
}

function mapToRows(map) {
  return Array.from(map.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(Number(amount || 0) * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
}

function clean(value) {
  return String(value ?? "").trim();
}
