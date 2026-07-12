import { economicsJson, requireEconomicsContext } from "../_lib/auth";
import { monthBounds, summarizeTransactions } from "@/lib/economics-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const month = monthBounds(new Date());
  const [documentsResult, auditResult] = await Promise.all([
    context.supabase
      .from("economics_documents")
      .select("id, category, status, size_bytes, created_at")
      .eq("household_id", context.householdId),
    context.supabase
      .from("economics_audit_events")
      .select("id, event_type, actor_email, created_at")
      .eq("household_id", context.householdId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (documentsResult.error) {
    return economicsJson({ ok: false, message: "Falha ao carregar documentos." }, 500);
  }

  const [categoriesResult, transactionsResult, billsResult] = await Promise.all([
    context.supabase
      .from("economics_categories")
      .select("id, name, kind, color")
      .eq("household_id", context.householdId),
    context.supabase
      .from("economics_transactions")
      .select("id, category_id, type, amount, payment_method, owner, occurred_on, status")
      .eq("household_id", context.householdId)
      .eq("status", "posted")
      .gte("occurred_on", month.start)
      .lt("occurred_on", month.end),
    context.supabase
      .from("economics_bill_instances")
      .select("id, title, amount, due_on, status")
      .eq("household_id", context.householdId)
      .eq("status", "open")
      .order("due_on", { ascending: true })
      .limit(8)
  ]);

  const financeReady = !categoriesResult.error && !transactionsResult.error && !billsResult.error;
  const finance = financeReady
    ? summarizeTransactions(transactionsResult.data || [], categoriesResult.data || [])
    : {
        totals: { income: 0, expense: 0, transfer: 0, assetAdjustment: 0, liabilityAdjustment: 0, balance: 0 },
        byCategory: [],
        byOwner: [],
        byPaymentMethod: []
      };
  const documents = documentsResult.data || [];
  const byCategory = documents.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  return economicsJson({
    ok: true,
    household: context.household,
    user: context.member,
    metrics: {
      documentCount: documents.length,
      uploadedBytes: documents.reduce((total, item) => total + Number(item.size_bytes || 0), 0),
      pendingReviewCount: documents.filter((item) => ["uploaded", "reviewing"].includes(item.status)).length,
      transactionCount: financeReady ? (transactionsResult.data || []).length : 0,
      openBillCount: financeReady ? (billsResult.data || []).length : 0
    },
    financeReady,
    finance,
    currentMonth: month,
    upcomingBills: financeReady ? billsResult.data || [] : [],
    byCategory,
    recentAudit: auditResult.data || []
  });
}
