const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

export function selectManualPaymentReminders(plan, now = new Date()) {
  const today = dateParts(now);
  const currentMonth = `${today.year}-${String(today.month).padStart(2, "0")}`;
  const payments = Array.isArray(plan?.payments) ? plan.payments : [];

  return payments
    .filter((payment) => shouldConsiderPayment(payment, plan?.month, currentMonth))
    .map((payment) => reminderForPayment(payment, today, plan?.month))
    .filter((payment) => payment?.daysUntil === 0)
    .sort((left, right) => left.daysUntil - right.daysUntil || left.dueDay - right.dueDay);
}

export function formatPaymentReminderMessage(items, siteUrl = "https://claudiocode.dev") {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return "";

  const lines = [
    "[ECONOMICS] Bom dia, Vitor e Nath!",
    "Passando com um lembrete amigável dos pagamentos manuais:",
    ""
  ];

  for (const item of rows) {
    const amount = item.amount == null ? "valor a confirmar" : formatMoney(item.amount);
    lines.push(`- ${dueLabel(item.daysUntil)}: ${item.title} — ${amount} (${item.owner})`);
  }

  lines.push(
    "",
    "Depois de pagar, marquem no Economics e os lembretes daquele pagamento param:",
    `${String(siteUrl || "https://claudiocode.dev").replace(/\/$/, "")}/economics`
  );

  return lines.join("\n").slice(0, 900);
}

export function saoPauloDateKey(now = new Date()) {
  const value = dateParts(now);
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function shouldConsiderPayment(payment, planMonth, currentMonth) {
  if (!payment || !Number.isInteger(Number(payment.dueDay))) return false;
  const currentStatus = payment.status === "paused" ? "paused" : (payment.monthStatuses?.[currentMonth] || (planMonth === currentMonth ? payment.status : "open"));
  if (payment.autopay || payment.includedInCard || currentStatus === "paused") return false;
  if (payment.kind === "annual" && payment.renewalDate && payment.renewalDate.slice(0, 7) !== currentMonth) return false;
  if (payment.recurring === false && planMonth !== currentMonth) return false;
  if (currentStatus === "paid") return false;
  return true;
}

function reminderForPayment(payment, today, planMonth) {
  const dueDay = Math.min(Math.max(1, Number(payment.dueDay)), daysInMonth(today.year, today.month));
  const todayOrdinal = Date.UTC(today.year, today.month - 1, today.day) / DAY_MS;
  const dueOrdinal = Date.UTC(today.year, today.month - 1, dueDay) / DAY_MS;

  return {
    id: String(payment.id || "payment"),
    title: String(payment.title || "Pagamento"),
    owner: String(payment.owner || "Família"),
    amount: reminderAmount(payment, `${today.year}-${String(today.month).padStart(2, "0")}`, planMonth),
    dueDay,
    daysUntil: dueOrdinal - todayOrdinal
  };
}

function reminderAmount(payment, currentMonth, planMonth) {
  if (Object.prototype.hasOwnProperty.call(payment.monthlyAmounts || {}, currentMonth)) return Number(payment.monthlyAmounts[currentMonth]);
  return payment.kind === "card" && currentMonth !== planMonth ? null : (payment.amount == null ? null : Number(payment.amount));
}

function dateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function dueLabel(daysUntil) {
  return daysUntil === 0 ? "Vence hoje" : "Vencimento";
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
