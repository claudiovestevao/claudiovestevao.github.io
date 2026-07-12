import { cookies } from "next/headers";
import { ECONOMICS_CSRF_COOKIE } from "@/lib/economics-session";
import {
  normalizeEconomicsOwner,
  normalizePaymentMethod,
  normalizeTransactionType,
  toMoneyNumber
} from "@/lib/economics-finance";
import { writeEconomicsAudit } from "@/lib/economics-db";
import { economicsJson, requireEconomicsContext } from "../../_lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 80), 1), 200);

  const { data, error } = await context.supabase
    .from("economics_transactions")
    .select(`
      id, description, amount, currency, occurred_on, type, payment_method, owner, status, notes, created_at,
      category_id,
      account_id,
      document_id,
      category:economics_categories(id, name, color, kind),
      account:economics_accounts(id, name, institution, type),
      document:economics_documents(id, original_name)
    `)
    .eq("household_id", context.householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return economicsJson({ ok: false, message: "Falha ao listar lancamentos." }, 500);
  return economicsJson({ ok: true, transactions: data || [] });
}

export async function POST(request) {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);
  if (!(await hasValidCsrf(request))) return economicsJson({ ok: false, message: "CSRF invalido." }, 403);

  const body = await request.json().catch(() => ({}));
  const description = String(body.description || "").trim().slice(0, 180);
  const amount = toMoneyNumber(body.amount);
  const occurredOn = normalizeDate(body.occurred_on);

  if (!description) return economicsJson({ ok: false, message: "Descreva o lancamento." }, 400);
  if (!amount) return economicsJson({ ok: false, message: "Informe um valor maior que zero." }, 400);
  if (!occurredOn) return economicsJson({ ok: false, message: "Data invalida." }, 400);

  const payload = {
    household_id: context.householdId,
    account_id: nullableUuid(body.account_id),
    category_id: nullableUuid(body.category_id),
    document_id: nullableUuid(body.document_id),
    type: normalizeTransactionType(body.type),
    description,
    amount,
    currency: "BRL",
    occurred_on: occurredOn,
    payment_method: normalizePaymentMethod(body.payment_method),
    owner: normalizeEconomicsOwner(body.owner),
    status: "posted",
    notes: String(body.notes || "").trim().slice(0, 1000) || null,
    created_by_email: context.member.email
  };

  const { data, error } = await context.supabase
    .from("economics_transactions")
    .insert(payload)
    .select("id, description, amount, occurred_on, type, payment_method, owner")
    .single();

  if (error) return economicsJson({ ok: false, message: "Falha ao salvar lancamento." }, 500);

  await writeEconomicsAudit(context.supabase, {
    householdId: context.householdId,
    actorEmail: context.member.email,
    eventType: "transaction.created",
    entityType: "economics_transactions",
    entityId: data.id,
    metadata: {
      type: payload.type,
      amount: payload.amount,
      owner: payload.owner,
      payment_method: payload.payment_method,
      category_id: payload.category_id
    }
  });

  return economicsJson({ ok: true, transaction: data }, 201);
}

async function hasValidCsrf(request) {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ECONOMICS_CSRF_COOKIE)?.value || "";
  const headerToken = request.headers.get("x-economics-csrf") || "";
  return Boolean(cookieToken && headerToken && cookieToken === headerToken);
}

function normalizeDate(value) {
  const date = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "";
}

function nullableUuid(value) {
  const text = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}
