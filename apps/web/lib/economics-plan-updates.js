export const ECONOMICS_PLAN_VERSION = 5;

// Alguns títulos foram salvos em algum momento com os acentos virando "?"
// (perda de encoding fora do app — não é bug do código de leitura/gravação,
// que sempre trata UTF-8). Corrige pelo texto exato conhecido; se aparecer
// mais algum título quebrado, adicionar aqui.
const MOJIBAKE_TITLE_FIXES = {
  "Bab?": "Babá",
  "Condom?nio, ?gua e g?s": "Condomínio, água e gás",
  "Fatura Ita? Personnalit?": "Fatura Itaú Personnalité",
  "Financiamento imobili?rio Bradesco": "Financiamento imobiliário Bradesco"
};

function fixMojibakeText(value) {
  if (typeof value !== "string") return value;
  return Object.prototype.hasOwnProperty.call(MOJIBAKE_TITLE_FIXES, value)
    ? MOJIBAKE_TITLE_FIXES[value]
    : value;
}

export function applyKnownPlanUpdates(plan) {
  const incomes = Array.isArray(plan?.incomes) ? plan.incomes.map(fixMojibakeFields).map(updateKnownIncome) : [];
  let payments = Array.isArray(plan?.payments) ? plan.payments.map(fixMojibakeFields).map(updateKnownPayment) : [];
  let bonuses = Array.isArray(plan?.bonuses)
    ? plan.bonuses.map(fixMojibakeFields).map((bonus) => updateThirteenthSalary(bonus, incomes))
    : [];

  payments = ensurePayment(payments, "chatgpt-portobank", "ChatGPT", {
    owner: "Vitor",
    kind: "subscription",
    category: "Streaming",
    amount: null,
    foreignAmount: 20,
    foreignCurrency: "USD",
    dueDay: null,
    status: "open",
    recurring: true,
    autopay: false,
    source: "Cartão PortoBank",
    includedInCard: true,
    calendarVisible: false,
    notes: "US$ 20 por mês; o valor em reais varia conforme a conversão da fatura."
  });

  payments = ensurePayment(payments, "amazon-prime", "Amazon Prime", {
    owner: "Vitor",
    kind: "annual",
    category: "Streaming",
    amount: 166.8,
    dueDay: 11,
    renewalDate: "2027-07-11",
    status: "paid",
    recurring: true,
    autopay: false,
    source: "Cartão PortoBank",
    includedInCard: true,
    calendarVisible: false,
    notes: "Anuidade paga; próxima renovação em 11/07/2027."
  });

  bonuses = ensureThirteenthSalary(bonuses, incomes, "Vitor", 38000, 27281.91);
  bonuses = ensureThirteenthSalary(bonuses, incomes, "Nathalie", 23600, 16789.78);

  return { ...plan, version: ECONOMICS_PLAN_VERSION, incomes, payments, bonuses };
}

function fixMojibakeFields(item) {
  if (!item || typeof item !== "object") return item;
  const title = fixMojibakeText(item.title);
  const notes = fixMojibakeText(item.notes);
  const source = fixMojibakeText(item.source);
  if (title === item.title && notes === item.notes && source === item.source) return item;
  return { ...item, title, notes, source };
}

function updateKnownIncome(income) {
  if (income?.owner !== "Vitor") return income;
  const gross = Number(income.gross || 38000);
  const netBeforePension = Number(income.netBeforePension || (Number(income.netEstimate) > 25000 ? income.netEstimate : 27281.91));
  const privatePensionRate = 0.08;
  const privatePensionContribution = Math.round(gross * privatePensionRate * 100) / 100;
  return {
    ...income,
    gross,
    netBeforePension,
    privatePensionRate,
    privatePensionContribution,
    netEstimate: Math.round((netBeforePension - privatePensionContribution) * 100) / 100,
    notes: "Líquido disponível após aporte automático de 8% do bruto para a PortoPrev."
  };
}

function updateKnownPayment(payment) {
  const key = canonical(payment?.title);
  if (key.includes("itau") && payment?.owner === "Vitor" && payment?.kind === "card") {
    return {
      ...payment,
      monthlyAmounts: { "2026-09": 2800, ...(payment.monthlyAmounts || {}) },
      notes: "Agosto fechado conforme informado; setembro começou em R$ 2.800 e ainda pode aumentar."
    };
  }
  if (key.includes("chatgpt")) {
    return {
      ...payment,
      amount: null,
      foreignAmount: 20,
      foreignCurrency: "USD",
      kind: "subscription",
      category: "Streaming",
      recurring: true,
      source: "Cartão PortoBank",
      includedInCard: true,
      calendarVisible: false,
      notes: "US$ 20 por mês; o valor em reais varia conforme a conversão da fatura."
    };
  }
  if (key.includes("amazon prime")) {
    return {
      ...payment,
      amount: 166.8,
      kind: "annual",
      dueDay: 11,
      renewalDate: "2027-07-11",
      status: "paid",
      recurring: true,
      source: "Cartão PortoBank",
      includedInCard: true,
      calendarVisible: false,
      notes: "Anuidade paga; próxima renovação em 11/07/2027."
    };
  }
  return payment;
}

function updateThirteenthSalary(bonus, incomes) {
  if (!isThirteenthSalary(bonus)) return bonus;
  const income = incomes.find((item) => item.owner === bonus.owner);
  const gross = Number(income?.gross || bonus.grossAmount || bonus.maxAmount || 0);
  const net = Number(income?.netBeforePension || income?.netEstimate || bonus.netEstimate || 0);
  return {
    ...bonus,
    grossAmount: gross,
    netEstimate: net,
    minAmount: net,
    maxAmount: net,
    taxed: true,
    notes: "Estimativa líquida após INSS e IRRF; o valor final pode variar."
  };
}

function ensureThirteenthSalary(bonuses, incomes, owner, fallbackGross, fallbackNet) {
  if (bonuses.some((bonus) => bonus.owner === owner && isThirteenthSalary(bonus))) return bonuses;
  const income = incomes.find((item) => item.owner === owner);
  const gross = Number(income?.gross || fallbackGross);
  const net = Number(income?.netBeforePension || income?.netEstimate || fallbackNet);
  return [...bonuses, {
    id: `decimo-terceiro-${owner.toLowerCase()}`,
    owner,
    title: "13º salário",
    month: 12,
    grossAmount: gross,
    netEstimate: net,
    minAmount: net,
    maxAmount: net,
    taxed: true,
    notes: "Estimativa líquida após INSS e IRRF; o valor final pode variar."
  }];
}

function ensurePayment(payments, id, title, defaults) {
  if (payments.some((payment) => canonical(payment.title).includes(canonical(title)))) return payments;
  return [...payments, { id, title, ...defaults }];
}

function isThirteenthSalary(bonus) {
  const key = canonical(bonus?.title);
  return key.includes("13") || key.includes("decimo terceiro");
}

function canonical(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
