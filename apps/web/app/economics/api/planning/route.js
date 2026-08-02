import { cookies } from "next/headers";
import { ECONOMICS_STORAGE_BUCKET, writeEconomicsAudit } from "@/lib/economics-db";
import { applyKnownPlanUpdates, ECONOMICS_PLAN_VERSION } from "@/lib/economics-plan-updates";
import { ECONOMICS_CSRF_COOKIE } from "@/lib/economics-session";
import { economicsJson, requireEconomicsContext } from "../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_FILE = "planning/monthly-plan.json";
const OWNERS = new Set(["Vitor", "Nathalie", "Familia"]);
const STATUSES = new Set(["open", "paid", "scheduled", "paused"]);
const KINDS = new Set(["fixed", "subscription", "card", "annual"]);

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const saved = await readPlan(context);
  if (saved) {
    if (saved.sourceVersion < ECONOMICS_PLAN_VERSION) await savePlan(context, saved.plan);
    return economicsJson({ ok: true, plan: saved.plan });
  }

  const seeded = initialPlan();
  if (!seeded) return economicsJson({ ok: true, plan: emptyPlan() });

  await savePlan(context, seeded);
  return economicsJson({ ok: true, plan: seeded });
}

export async function POST(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);
  if (!(await hasValidCsrf(request))) return economicsJson({ ok: false, message: "Sessão expirada." }, 403);

  const body = await request.json().catch(() => ({}));
  const plan = normalizePlan(body?.plan);
  const saved = await savePlan(context, plan);
  if (!saved) return economicsJson({ ok: false, message: "Falha ao salvar o planejamento." }, 500);

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: context.member.email,
    eventType: "planning.saved",
    entityType: "economics_monthly_plan",
    entityId: plan.month,
    metadata: { payments: plan.payments.length }
  });

  return economicsJson({ ok: true, plan });
}

async function readPlan(context) {
  const { data, error } = await context.supabase.storage
    .from(ECONOMICS_STORAGE_BUCKET)
    .download(planPath(context.householdId));
  if (error || !data) return null;
  const content = await data.text().catch(() => "{}");
  try {
    const parsed = JSON.parse(content);
    return { plan: normalizePlan(parsed), sourceVersion: Number(parsed?.version || 1) };
  } catch {
    return null;
  }
}

async function savePlan(context, plan) {
  const path = planPath(context.householdId);
  const upload = await context.supabase.storage
    .from(ECONOMICS_STORAGE_BUCKET)
    .upload(path, JSON.stringify(plan, null, 2), {
      cacheControl: "0",
      contentType: "application/json",
      upsert: true
    });
  return !upload.error;
}

function initialPlan() {
  const raw = String(process.env.ECONOMICS_INITIAL_PLAN_JSON || "").trim();
  if (!raw) return null;
  try {
    return normalizePlan(JSON.parse(raw));
  } catch {
    return null;
  }
}

function normalizePlan(value) {
  const incomes = Array.isArray(value?.incomes) ? value.incomes : [];
  const payments = Array.isArray(value?.payments) ? value.payments : [];
  const bonuses = Array.isArray(value?.bonuses) ? value.bonuses : [];
  return applyKnownPlanUpdates({
    version: ECONOMICS_PLAN_VERSION,
    month: /^\d{4}-\d{2}$/.test(String(value?.month || "")) ? value.month : "2026-08",
    updatedAt: new Date().toISOString(),
    incomes: incomes.slice(0, 10).map((item, index) => ({
      id: cleanId(item?.id || `income-${index}`),
      owner: OWNERS.has(item?.owner) ? item.owner : "Familia",
      title: clean(item?.title || "Renda mensal", 80),
      gross: amount(item?.gross),
      netEstimate: amount(item?.netEstimate),
      netBeforePension: nullableAmount(item?.netBeforePension),
      privatePensionRate: nullableRate(item?.privatePensionRate),
      privatePensionContribution: nullableAmount(item?.privatePensionContribution),
      notes: clean(item?.notes, 240)
    })),
    payments: payments.slice(0, 120).map((item, index) => ({
      id: cleanId(item?.id || `payment-${index}`),
      title: clean(item?.title || "Pagamento", 100),
      owner: OWNERS.has(item?.owner) ? item.owner : "Familia",
      kind: KINDS.has(item?.kind) ? item.kind : "fixed",
      category: clean(item?.category || "Outros", 60),
      amount: nullableAmount(item?.amount),
      foreignAmount: nullableAmount(item?.foreignAmount),
      foreignCurrency: clean(item?.foreignCurrency, 3).toUpperCase(),
      dueDay: dueDay(item?.dueDay),
      renewalDate: isoDate(item?.renewalDate),
      status: STATUSES.has(item?.status) ? item.status : "open",
      monthStatuses: monthStatusMap(item?.monthStatuses),
      monthlyAmounts: monthlyAmountMap(item?.monthlyAmounts),
      recurring: item?.recurring !== false,
      autopay: Boolean(item?.autopay),
      source: clean(item?.source, 80),
      includedInCard: Boolean(item?.includedInCard),
      calendarVisible: item?.calendarVisible !== false,
      notes: clean(item?.notes, 300)
    })),
    bonuses: bonuses.slice(0, 20).map((item, index) => ({
      id: cleanId(item?.id || `bonus-${index}`),
      owner: OWNERS.has(item?.owner) ? item.owner : "Familia",
      title: clean(item?.title || "Entrada extra", 80),
      month: Math.min(12, Math.max(1, Number(item?.month) || 1)),
      minAmount: amount(item?.minAmount),
      maxAmount: amount(item?.maxAmount || item?.minAmount),
      grossAmount: nullableAmount(item?.grossAmount),
      netEstimate: nullableAmount(item?.netEstimate),
      taxed: Boolean(item?.taxed),
      notes: clean(item?.notes, 240)
    }))
  });
}

function emptyPlan() {
  return normalizePlan({ month: "2026-08", incomes: [], payments: [], bonuses: [] });
}

function planPath(householdId) {
  return `${householdId}/${PLAN_FILE}`;
}

async function hasValidCsrf(request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get("x-economics-csrf") || "";
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

function amount(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : 0;
}

function nullableAmount(value) {
  if (value === null || value === undefined || value === "") return null;
  return amount(value);
}

function dueDay(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= 31 ? number : null;
}

function isoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

function nullableRate(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function monthStatusMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([month, status]) => /^\d{4}-\d{2}$/.test(month) && STATUSES.has(status))
    .slice(-36));
}

function monthlyAmountMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .filter(([month, itemAmount]) => /^\d{4}-\d{2}$/.test(month) && nullableAmount(itemAmount) != null)
    .slice(-36)
    .map(([month, itemAmount]) => [month, nullableAmount(itemAmount)]));
}

function clean(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function cleanId(value) {
  return String(value || "item").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}
