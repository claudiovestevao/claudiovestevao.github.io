"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, CalendarClock, FileText, HeartPulse, Landmark, PiggyBank, Plus, ReceiptText, ShieldCheck, Sparkles, Target, TrendingUp, UploadCloud, WalletCards } from "lucide-react";
import EconomicsPlanning from "./EconomicsPlanning";

const documentCategories = [["triagem", "Triagem"], ["fatura", "Fatura"], ["boleto", "Boleto"], ["investimento", "Investimento"], ["previdencia", "Previdência"], ["consorcio", "Consórcio"], ["contrato", "Contrato"], ["comprovante", "Comprovante"], ["outro", "Outro"]];
const paymentLabels = { pix: "Pix", debit: "Débito", credit: "Crédito", credit_portobank: "Crédito PortoBank", cash: "Dinheiro", arc_debit: "ARC", bank_transfer: "Transferência", other: "Outro" };
const emptyTransaction = () => ({ description: "", amount: "", occurred_on: new Date().toISOString().slice(0, 10), type: "expense", category_id: "", account_id: "", document_id: "", payment_method: "pix", owner: "Familia", notes: "" });

export default function EconomicsDashboard({ csrfToken }) {
  const [data, setData] = useState({ cfo: null, summary: null, planning: null, documents: [], transactions: [], options: { owners: ["Vitor", "Nathalie", "Luiza", "Arthur", "Familia"], paymentMethods: Object.keys(paymentLabels), categories: [], accounts: [], documents: [] } });
  const [form, setForm] = useState(emptyTransaction);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  async function refresh() {
    setLoading(true);
    const endpoints = ["/economics/api/cfo", "/economics/api/summary", "/economics/api/documents", "/economics/api/finance/options", "/economics/api/finance/transactions", "/economics/api/planning"];
    try {
      const responses = await Promise.all(endpoints.map((url) => fetch(url, { cache: "no-store" })));
      const payloads = await Promise.all(responses.map((response) => response.json().catch(() => ({}))));
      if (!responses[1].ok) throw new Error(payloads[1].message || "Falha ao carregar o Economics.");
      setData({
        cfo: responses[0].ok ? payloads[0] : null,
        summary: payloads[1],
        planning: responses[5].ok ? payloads[5].plan || null : null,
        documents: responses[2].ok ? payloads[2].documents || [] : [],
        options: responses[3].ok ? payloads[3] : data.options,
        transactions: responses[4].ok ? payloads[4].transactions || [] : []
      });
      const cfoWarning = (payloads[0].warnings || []).find((message) => !message.startsWith("Despesa essencial estimada"));
      const infoWarning = (payloads[0].warnings || []).find((message) => message.startsWith("Despesa essencial estimada"));
      setStatus(!responses[0].ok
        ? { type: "error", message: payloads[0].message || "Falha ao carregar o painel CFO." }
        : cfoWarning
          ? { type: "error", message: cfoWarning }
          : infoWarning
            ? { type: "success", message: infoWarning }
            : null);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function saveTransaction(event) {
    event.preventDefault();
    setBusy("transaction");
    try {
      const response = await fetch("/economics/api/finance/transactions", { method: "POST", headers: { "content-type": "application/json", "x-economics-csrf": csrfToken }, body: JSON.stringify(form) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Falha ao registrar.");
      setForm(emptyTransaction());
      setStatus({ type: "success", message: "Lançamento registrado." });
      await refresh();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(""); }
  }

  async function uploadDocument(event) {
    event.preventDefault();
    setBusy("upload");
    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch("/economics/api/documents", { method: "POST", headers: { "x-economics-csrf": csrfToken }, body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Falha ao enviar documento.");
      event.currentTarget.reset();
      setStatus({ type: "success", message: "Documento guardado no cofre." });
      await refresh();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(""); }
  }

  async function savePlanning(plan) {
    setBusy("planning");
    try {
      const response = await fetch("/economics/api/planning", {
        method: "POST",
        headers: { "content-type": "application/json", "x-economics-csrf": csrfToken },
        body: JSON.stringify({ plan })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Falha ao salvar o planejamento.");
      setData((current) => ({ ...current, planning: payload.plan }));
      setStatus({ type: "success", message: "Planejamento atualizado." });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setBusy("");
    }
  }

  const cfo = data.cfo;
  const snapshot = cfo?.snapshot || {};
  const finance = data.summary?.finance || { byCategory: [] };
  const totalDocumentSize = useMemo(() => data.documents.reduce((sum, item) => sum + Number(item.size_bytes || 0), 0), [data.documents]);

  return (
    <section className="economics-shell economics-cfo">
      <div className="economics-hero economics-cfo-hero">
        <div><span className="ui-badge">Privado</span><h1>Economics</h1><p>O que importa para a família, sem transformar finanças em um segundo emprego.</p></div>
        <div className="economics-review-time"><CalendarClock size={18} /><span>Revisão semanal</span><b>até 15 min</b></div>
      </div>

      {status?.message && <div className={`economics-status is-${status.type}`} role="alert">{status.message}</div>}

      {data.planning ? <EconomicsPlanning busy={busy === "planning"} onSave={savePlanning} plan={data.planning} /> : null}

      {cfo ? <>
        <section className="economics-next-action">
          <div className="economics-next-icon"><ArrowRight size={24} /></div>
          <div><span>Próxima melhor decisão</span><h2>{cfo.nextBestAction.title}</h2><p>{cfo.nextBestAction.detail}</p></div>
        </section>

        <div className="economics-pillar-grid">
          <Pillar icon={ShieldCheck} label="Proteção" value={snapshot.reserveMonths == null ? "Reserva a calibrar" : `${formatNumber(snapshot.reserveMonths, 1)} meses`} detail={snapshot.liquidityKnown ? `${money(snapshot.liquidAssets)} com liquidez rápida` : "Liquidez dos investimentos ainda não classificada"} tone="green" />
          <Pillar icon={WalletCards} label="Fluxo" value={money(snapshot.monthBalance)} detail={`${money(snapshot.monthExpense)} em saídas neste mês`} tone="blue" />
          <Pillar icon={TrendingUp} label="Liberdade" value={`${formatPercent(snapshot.independenceRatio)} da meta`} detail={`${money(snapshot.passiveMonthlyIncome)}/mês estimados hoje`} tone="violet" />
          <Pillar icon={HeartPulse} label="Vida" value={`${cfo.goals.filter((goal) => goal.status === "active").length} metas ativas`} detail="Experiências e família fazem parte do plano" tone="rose" />
        </div>

        <div className="economics-cfo-layout">
          <section className="economics-panel economics-span-2">
            <PanelTitle icon={Landmark} title="Patrimônio e liquidez" subtitle="Valores conhecidos, com a data informada na origem" />
            <div className="economics-networth"><div><span>Ativos conhecidos</span><b>{money(snapshot.totalAssets)}</b></div><div><span>Obrigações conhecidas</span><b>{money(snapshot.totalLiabilities)}</b></div><div className="is-emphasis"><span>Patrimônio líquido estimado</span><b>{money(snapshot.netWorth)}</b></div></div>
            <div className="economics-assets-list">{cfo.assets.map((asset) => <div key={asset.id}><span><b>{asset.name}</b><small>{ownerLabel(asset.owner)} · {liquidityLabel(asset.liquidity_bucket)}</small></span><strong>{money(asset.current_value)}</strong></div>)}</div>
            <p className="economics-footnote"><AlertCircle size={14} /> O compromisso futuro do consórcio aparece nas obrigações; o crédito contratado não é contado como patrimônio.</p>
          </section>

          <section className="economics-panel">
            <PanelTitle icon={CalendarClock} title="Próximos 90 dias" subtitle="Contas previstas e risco de caixa" />
            <div className="economics-horizons">{snapshot.horizons.map((item) => <div key={item.days}><span>{item.days} dias</span><b>{money(item.expenses)}</b><small>{item.billCount} conta(s)</small></div>)}</div>
            <div className="economics-upcoming">{cfo.upcomingBills.length ? cfo.upcomingBills.slice(0, 5).map((bill) => <div key={bill.id}><span><b>{bill.title}</b><small>{dateBr(bill.due_on)}</small></span><strong>{money(bill.amount)}</strong></div>) : <Empty text="Cadastre as contas recorrentes para enxergar o caixa futuro." />}</div>
          </section>

          <section className="economics-panel economics-span-2">
            <PanelTitle icon={Target} title="R$ 1 milhão aos 40" subtitle={`Aportes a partir de janeiro de 2027 · retorno real de ${formatPercent(cfo.millionGoal.annualRealReturnRate)} ao ano`} />
            <div className="economics-million-grid">
              <div><span>Patrimônio investível atual</span><b>{money(cfo.millionGoal.currentValue)}</b><small>{formatPercent(cfo.millionGoal.progress)} da meta</small></div>
              <div className="is-emphasis"><span>Aporte mensal total</span><b>{money(cfo.millionGoal.requiredMonthlyContribution)}</b><small>{cfo.millionGoal.contributionMonths} aportes planejados</small></div>
              <div><span>PortoPrev automática</span><b>{money(cfo.millionGoal.automaticMonthlyContribution)}</b><small>8% do salário bruto</small></div>
              <div className="is-action"><span>Aporte adicional</span><b>{money(cfo.millionGoal.additionalMonthlyContribution)}</b><small>além da PortoPrev</small></div>
            </div>
            <div className="economics-million-progress" aria-label={`${formatPercent(cfo.millionGoal.progress)} do alvo acumulado`}>
              <i style={{ width: `${cfo.millionGoal.progressToUpper * 100}%` }} />
              <span className="is-minimum" title="Mínimo: R$ 800 mil" />
              <span className="is-target" title="Alvo: R$ 1 milhão" />
            </div>
            <div className="economics-goal-levels" aria-label="Faixas da meta aos 40 anos">
              <div><span>Mínimo</span><b>{money(cfo.millionGoal.minimumValue)}</b><small>{money(cfo.millionGoal.levels.minimum.requiredMonthlyContribution)}/mês</small></div>
              <div className="is-target"><span>Alvo</span><b>{money(cfo.millionGoal.targetValue)}</b><small>{money(cfo.millionGoal.levels.target.requiredMonthlyContribution)}/mês</small></div>
              <div><span>Superior</span><b>{money(cfo.millionGoal.upperValue)}</b><small>{money(cfo.millionGoal.levels.upper.requiredMonthlyContribution)}/mês</small></div>
            </div>
            <div className="economics-million-motivation">
              <Sparkles size={20} aria-hidden="true" />
              <div><strong>Em busca do primeiro milhão aos 40.</strong><span>Cada aporte é um passo de liberdade. Constância faz o plano acontecer.</span></div>
            </div>
            <div className="economics-target-line"><span>Faixa em valores reais · prazo até {monthYearBr(cfo.millionGoal.targetDate)}</span><b>{money(cfo.millionGoal.minimumValue)} a {money(cfo.millionGoal.upperValue)}</b></div>
            <p className="economics-footnote"><AlertCircle size={14} /> A PortoPrev reduz o salário disponível, mas conta integralmente como aporte patrimonial. {cfo.millionGoal.assumption}</p>
          </section>

          <section className="economics-panel">
            <PanelTitle icon={PiggyBank} title="Metas da família" subtitle="Proteção antes de otimização" />
            <div className="economics-goals">{cfo.goals.map((goal) => { const progress = goal.target_value_today > 0 ? Math.min(100, goal.current_value / goal.target_value_today * 100) : 0; return <div key={goal.id}><span><b>{goal.name}</b><small>{goal.target_value_today ? `${money(goal.current_value)} de ${money(goal.target_value_today)}` : "Meta a definir"}</small></span><div><i style={{ width: `${progress}%` }} /></div></div>; })}</div>
          </section>
        </div>
      </> : !loading && <section className="economics-panel"><Empty text="O painel CFO será ativado assim que a migration 0040 estiver no Supabase." /></section>}

      <details className="economics-tools">
        <summary><Plus size={18} /> Registrar gasto ou receita</summary>
        <form className="economics-finance-form" onSubmit={saveTransaction}>
          <label className="wide">Descrição<input required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mercado, escola, salário..." /></label>
          <label>Valor<input required inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0,00" /></label>
          <label>Data<input required type="date" value={form.occurred_on} onChange={(e) => setForm({ ...form, occurred_on: e.target.value })} /></label>
          <label>Tipo<select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option value="expense">Saída</option><option value="income">Entrada</option><option value="transfer">Transferência</option></select></label>
          <label>Categoria<select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}><option value="">Sem categoria</option>{data.options.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Responsável<select value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })}>{data.options.owners.map((owner) => <option value={owner} key={owner}>{ownerLabel(owner)}</option>)}</select></label>
          <label>Pagamento<select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>{data.options.paymentMethods.map((method) => <option value={method} key={method}>{paymentLabels[method] || method}</option>)}</select></label>
          <label className="wide">Observação<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <button disabled={busy === "transaction" || !data.options.categories.length}>{busy === "transaction" ? "Salvando..." : "Registrar"}</button>
        </form>
      </details>

      <div className="economics-layout">
        <section className="economics-panel">
          <PanelTitle icon={ReceiptText} title="Últimos lançamentos" subtitle="Detalhes apenas quando você precisar" />
          <div className="economics-transaction-list">{data.transactions.length ? data.transactions.slice(0, 8).map((item) => <article className="economics-transaction" key={item.id}><div><b>{item.description}</b><span>{item.category?.name || "Sem categoria"} · {ownerLabel(item.owner)}</span></div><strong className={item.type === "income" ? "is-income" : ""}>{item.type === "income" ? "+" : "-"}{money(item.amount)}</strong><small>{dateBr(item.occurred_on)}</small></article>) : <Empty text="Nenhum lançamento registrado." />}</div>
          {finance.byCategory?.length ? <div className="economics-category-summary">{finance.byCategory.slice(0, 5).map((row) => <span key={row.name}><b>{row.name}</b>{money(row.amount)}</span>)}</div> : null}
        </section>

        <section className="economics-panel">
          <PanelTitle icon={FileText} title="Cofre de documentos" subtitle={`${data.documents.length} arquivo(s) · ${bytes(totalDocumentSize)}`} />
          <div className="economics-document-list">{data.documents.slice(0, 5).map((item) => <article className="economics-document" key={item.id}><div><b>{item.original_name}</b><span>{item.category} · {item.status}</span></div><small>{dateBr(item.created_at)}</small></article>)}</div>
          <form className="economics-upload-form economics-compact-upload" onSubmit={uploadDocument}>
            <label>Arquivo<input required type="file" name="file" accept=".pdf,image/jpeg,image/png,image/webp,text/plain,text/csv,application/json" /></label>
            <label>Tipo<select name="category">{documentCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <button disabled={busy === "upload"}><UploadCloud size={17} /> {busy === "upload" ? "Enviando..." : "Guardar"}</button>
          </form>
        </section>
      </div>
    </section>
  );
}

function Pillar({ icon: Icon, label, value, detail, tone }) { return <article className={`economics-pillar is-${tone}`}><div><Icon size={20} /><span>{label}</span></div><b>{value}</b><small>{detail}</small></article>; }
function PanelTitle({ icon: Icon, title, subtitle }) { return <div className="economics-panel-head"><div><h2>{title}</h2><p>{subtitle}</p></div><Icon size={21} /></div>; }
function Empty({ text }) { return <div className="economics-empty">{text}</div>; }
function money(value) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0)); }
function formatNumber(value, digits = 0) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(Number(value || 0)); }
function formatPercent(value) { return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(Number(value || 0)); }
function dateBr(value) { if (!value) return ""; return new Intl.DateTimeFormat("pt-BR").format(new Date(`${String(value).slice(0, 10)}T12:00:00`)); }
function monthYearBr(value) { if (!value) return ""; return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)); }
function bytes(value) { const n = Number(value || 0); return n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`; }
function liquidityLabel(value) { return ({ d0_d1: "liquidez imediata", up_to_30_days: "até 30 dias", "31_to_365_days": "31 a 365 dias", over_1_year: "mais de 1 ano", illiquid: "sem liquidez", unknown: "liquidez pendente" })[value] || "liquidez pendente"; }
function ownerLabel(value) { return value === "Familia" ? "Família" : value; }
