import { economicsJson, requireEconomicsContext } from "../../_lib/auth";
import { ECONOMICS_OWNERS, ECONOMICS_PAYMENT_METHODS } from "@/lib/economics-finance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const context = await requireEconomicsContext();
  if (!context.ok) return economicsJson({ ok: false, message: context.message }, context.status);

  const [categoriesResult, accountsResult, documentsResult] = await Promise.all([
    context.supabase
      .from("economics_categories")
      .select("id, name, kind, color, icon, sort_order")
      .eq("household_id", context.householdId)
      .order("kind", { ascending: true })
      .order("sort_order", { ascending: true }),
    context.supabase
      .from("economics_accounts")
      .select("id, name, institution, type, owner, current_balance, active")
      .eq("household_id", context.householdId)
      .eq("active", true)
      .order("name", { ascending: true }),
    context.supabase
      .from("economics_documents")
      .select("id, original_name, category, status, created_at")
      .eq("household_id", context.householdId)
      .order("created_at", { ascending: false })
      .limit(30)
  ]);

  if (categoriesResult.error) {
    return economicsJson({
      ok: false,
      message: `Nucleo financeiro pendente: economics_categories indisponivel (${categoriesResult.error.message}).`
    }, 503);
  }

  return economicsJson({
    ok: true,
    owners: ECONOMICS_OWNERS,
    paymentMethods: ECONOMICS_PAYMENT_METHODS,
    categories: categoriesResult.data || [],
    accounts: accountsResult.error ? [] : accountsResult.data || [],
    documents: documentsResult.error ? [] : documentsResult.data || [],
    warnings: [
      accountsResult.error ? `economics_accounts: ${accountsResult.error.message}` : "",
      documentsResult.error ? `economics_documents: ${documentsResult.error.message}` : ""
    ].filter(Boolean)
  });
}
