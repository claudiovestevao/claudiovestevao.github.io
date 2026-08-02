"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, ShieldAlert, Users, WalletCards } from "lucide-react";

const OWNER_OPTIONS = ["Familia", "Vitor", "Nathalie"];
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function EconomicsPlanning({ busy, onSave, plan }) {
  const [owner, setOwner] = useState("Familia");
  const [selectedMonth, setSelectedMonth] = useState(plan.month);
  const summary = useMemo(() => summarize(plan, selectedMonth), [plan, selectedMonth]);
  const foreignPayments = plan.payments.filter((item) => item.foreignAmount != null && item.foreignCurrency);
  const annualPayments = plan.payments.filter((item) => item.kind === "annual" && item.renewalDate);
  const unknownPayments = plan.payments.filter((item) => item.amount == null && item.foreignAmount == null && !["paid", "paused"].includes(item.status));
  const calendarItems = useMemo(() => (
    plan.payments
      .filter((item) => item.calendarVisible !== false && item.dueDay && paymentOccursInMonth(item, selectedMonth, plan.month) && (owner === "Familia" || item.owner === owner))
      .map((item) => effectivePayment(item, selectedMonth, plan.month))
      .sort((a, b) => a.dueDay - b.dueDay || a.title.localeCompare(b.title))
  ), [owner, plan.month, plan.payments, selectedMonth]);

  const monthDate = monthFrom(selectedMonth);
  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(monthDate);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const leadingDays = monthDate.getDay();
  const monthNumber = selectedMonth.slice(5, 7);
  const canGoBack = selectedMonth > plan.month;
  const canGoForward = selectedMonth < addMonths(plan.month, 24);

  async function togglePaid(payment) {
    const nextStatus = payment.status === "paid" ? "open" : "paid";
    await onSave({
      ...plan,
      payments: plan.payments.map((item) => item.id === payment.id ? {
        ...item,
        status: selectedMonth === plan.month ? nextStatus : item.status,
        monthStatuses: { ...(item.monthStatuses || {}), [selectedMonth]: nextStatus }
      } : item)
    });
  }

  return (
    <section className="economics-planning" aria-labelledby="planning-title">
      <div className="economics-planning-head">
        <div>
          <span>Planejamento familiar</span>
          <div className="economics-month-nav">
            <button aria-label="Mês anterior" disabled={!canGoBack} onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))} title="Mês anterior" type="button"><ChevronLeft size={18} /></button>
            <h2 id="planning-title">Caixa de {capitalize(monthLabel)}</h2>
            <button aria-label="Próximo mês" disabled={!canGoForward} onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))} title="Próximo mês" type="button"><ChevronRight size={18} /></button>
          </div>
          <p>Faturas são conciliadas sem repetir assinaturas e contas já incluídas nelas.</p>
        </div>
        <div className="economics-owner-filter" aria-label="Filtrar responsável">
          {OWNER_OPTIONS.map((item) => (
            <button aria-pressed={owner === item} className={owner === item ? "is-active" : ""} key={item} onClick={() => setOwner(item)} type="button">
              {item === "Familia" ? "Todos" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="economics-plan-metrics">
        <PlanMetric icon={Users} label="Renda líquida estimada" value={money(summary.netIncome)} detail={`${money(summary.grossIncome)} brutos`} tone="income" />
        <PlanMetric icon={WalletCards} label="Custo fixo conhecido" value={money(summary.fixedKnown)} detail={`${money(summary.directFixed)} fora das faturas`} tone="fixed" />
        <PlanMetric icon={CreditCard} label="Faturas pendentes" value={money(summary.openCards)} detail={`${summary.openCardCount} com valor · ${summary.unknownCardCount} a confirmar`} tone="cards" />
        <PlanMetric icon={CircleDollarSign} label="Saldo após compromissos" value={money(summary.cashAfterKnown)} detail="antes de mercado, transporte e lazer" tone={summary.cashAfterKnown < 0 ? "danger" : "income"} />
      </div>

      {summary.cashAfterKnown < 0 ? (
        <div className="economics-plan-alert" role="status">
          <ShieldAlert size={19} />
          <span><b>{capitalize(monthLabel)} exige caixa adicional de {money(Math.abs(summary.cashAfterKnown))}.</b> Esse valor ainda pode cair quando as faturas forem conciliadas, mas não deve ser coberto com rotativo.</span>
        </div>
      ) : null}

      <div className="economics-plan-layout">
        <section className="economics-plan-calendar" aria-label={`Calendário de ${monthLabel}`}>
          <div className="economics-plan-section-title"><CalendarDays size={18} /><b>Calendário de pagamentos</b></div>
          <div className="economics-calendar-scroll">
            <div className="economics-calendar-grid">
              {WEEKDAYS.map((day) => <span className="economics-calendar-weekday" key={day}>{day}</span>)}
              {Array.from({ length: leadingDays }, (_, index) => <span className="economics-calendar-day is-empty" key={`empty-${index}`} />)}
              {Array.from({ length: daysInMonth }, (_, index) => {
                const day = index + 1;
                const items = calendarItems.filter((item) => item.dueDay === day);
                return (
                  <span className={`economics-calendar-day${items.length ? " has-items" : ""}`} key={day}>
                    <b>{day}</b>
                    {items.slice(0, 3).map((item) => (
                      <small className={`is-${item.status} is-${item.owner.toLowerCase()}`} key={item.id} title={`${item.title}: ${item.amount == null ? "valor a confirmar" : money(item.amount)}`}>
                        {item.title}
                      </small>
                    ))}
                    {items.length > 3 ? <i>+{items.length - 3}</i> : null}
                  </span>
                );
              })}
            </div>
          </div>
        </section>

        <section className="economics-plan-agenda" aria-label="Agenda de pagamentos">
          <div className="economics-plan-section-title"><CreditCard size={18} /><b>Vencimentos</b></div>
          <div className="economics-payment-list">
            {calendarItems.map((item) => (
              <article className={`economics-payment is-${item.status}`} key={item.id}>
                <time>{String(item.dueDay).padStart(2, "0")}/{monthNumber}</time>
                <div><b>{item.title}</b><span>{ownerLabel(item.owner)} · {item.source || item.category}{item.autopay ? " · débito automático" : ""}</span></div>
                <strong>{item.amount == null ? "A confirmar" : money(item.amount)}</strong>
                <button aria-label={`${item.status === "paid" ? "Reabrir" : "Marcar como pago"} ${item.title}`} disabled={busy} onClick={() => togglePaid(item)} title={item.status === "paid" ? "Reabrir" : "Marcar como pago"} type="button">
                  <Check size={16} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="economics-plan-bottom">
        <section>
          <h3>Renda mensal estimada</h3>
          {plan.incomes.map((item) => <div key={item.id}><span><b>{ownerLabel(item.owner)}</b><small>{incomeDetail(item)}</small></span><strong>{money(item.netEstimate)}</strong></div>)}
        </section>
        <section>
          <h3>Entradas extraordinárias</h3>
          {plan.bonuses.map((item) => <div key={item.id}><span><b>{item.title}</b><small>{bonusDetail(item)}</small></span><strong>{bonusValue(item)}</strong></div>)}
        </section>
        {foreignPayments.length ? <section>
          <h3>Em moeda estrangeira</h3>
          {foreignPayments.map((item) => <div key={item.id}><span><b>{item.title}</b><small>{ownerLabel(item.owner)} · {item.source || item.category} · conversão na fatura</small></span><strong>{foreignMoney(item.foreignAmount, item.foreignCurrency)}/mês</strong></div>)}
        </section> : null}
        {annualPayments.length ? <section>
          <h3>Renovações anuais</h3>
          {annualPayments.map((item) => <div key={item.id}><span><b>{item.title}</b><small>{item.status === "paid" ? "Pago" : "Pendente"} · renova em {dateBr(item.renewalDate)}</small></span><strong>{money(item.amount)}</strong></div>)}
        </section> : null}
        {unknownPayments.length ? <section>
          <h3>Valores a confirmar</h3>
          {unknownPayments.map((item) => <div key={item.id}><span><b>{item.title}</b><small>{ownerLabel(item.owner)} · {item.source || item.category}</small></span><strong>Pendente</strong></div>)}
        </section> : null}
      </div>
    </section>
  );
}

function PlanMetric({ detail, icon: Icon, label, tone, value }) {
  return <article className={`economics-plan-metric is-${tone}`}><div><Icon size={18} /><span>{label}</span></div><b>{value}</b><small>{detail}</small></article>;
}

function summarize(plan, selectedMonth) {
  const netIncome = sum(plan.incomes, "netEstimate");
  const grossIncome = sum(plan.incomes, "gross");
  const payments = plan.payments
    .filter((item) => paymentOccursInMonth(item, selectedMonth, plan.month))
    .map((item) => effectivePayment(item, selectedMonth, plan.month));
  const recurring = payments.filter((item) => item.recurring && item.kind !== "card" && item.kind !== "annual" && item.status !== "paused");
  const fixedKnown = recurring.reduce((total, item) => total + Number(item.amount || 0), 0);
  const directFixed = recurring.filter((item) => !item.includedInCard).reduce((total, item) => total + Number(item.amount || 0), 0);
  const cards = payments.filter((item) => item.kind === "card" && item.status === "open");
  const openCards = cards.reduce((total, item) => total + Number(item.amount || 0), 0);
  const openCardCount = cards.filter((item) => item.amount != null).length;
  const unknownCardCount = cards.filter((item) => item.amount == null).length;
  return { netIncome, grossIncome, fixedKnown, directFixed, openCards, openCardCount, unknownCardCount, cashAfterKnown: netIncome - directFixed - openCards };
}

function sum(items, field) { return items.reduce((total, item) => total + Number(item[field] || 0), 0); }
function monthFrom(value) { const [year, month] = String(value || "2026-08").split("-").map(Number); return new Date(year, month - 1, 1); }
function addMonths(value, amount) { const date = monthFrom(value); date.setMonth(date.getMonth() + amount); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function paymentOccursInMonth(item, selectedMonth, baseMonth) {
  if (item.kind === "annual" && item.renewalDate) return item.renewalDate.slice(0, 7) === selectedMonth;
  return item.recurring !== false || selectedMonth === baseMonth;
}
function effectivePayment(item, selectedMonth, baseMonth) {
  const hasMonthlyAmount = Object.prototype.hasOwnProperty.call(item.monthlyAmounts || {}, selectedMonth);
  const amount = hasMonthlyAmount ? item.monthlyAmounts[selectedMonth] : (item.kind === "card" && selectedMonth !== baseMonth ? null : item.amount);
  const status = item.status === "paused" ? "paused" : (item.monthStatuses?.[selectedMonth] || (selectedMonth === baseMonth ? item.status : "open"));
  return { ...item, amount, status };
}
function monthName(month) { return capitalize(new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(2026, month - 1, 1))); }
function capitalize(value) { return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1); }
function money(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
function compactMoney(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(Number(value || 0)); }
function foreignMoney(value, currency) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "USD" }).format(Number(value || 0)); }
function ownerLabel(value) { return value === "Familia" ? "Família" : value; }
function dateBr(value) { return new Intl.DateTimeFormat("pt-BR").format(new Date(`${value}T12:00:00`)); }
function bonusValue(item) { return item.netEstimate != null ? money(item.netEstimate) : (item.minAmount === item.maxAmount ? money(item.minAmount) : `${compactMoney(item.minAmount)}–${compactMoney(item.maxAmount)}`); }
function bonusDetail(item) {
  const base = `${monthName(item.month)} · ${ownerLabel(item.owner)}`;
  return item.taxed && item.grossAmount != null ? `${base} · líquido estimado sobre ${money(item.grossAmount)} brutos` : base;
}
function incomeDetail(item) {
  if (item.privatePensionContribution == null) return item.notes;
  return `Disponível após ${money(item.privatePensionContribution)} para a PortoPrev · líquido antes da previdência: ${money(item.netBeforePension)}`;
}
