import { getSupabaseServerClient } from "@/lib/supabase/server";
import { economicsProfileForEmail } from "@/lib/economics-session";

export const ECONOMICS_HOUSEHOLD_SLUG = "familia-estevao-bonomi";
export const ECONOMICS_STORAGE_BUCKET = "economics-documents";

export function getEconomicsClient() {
  return getSupabaseServerClient();
}

export async function getEconomicsContext(user) {
  const profile = economicsProfileForEmail(user?.email);
  if (!profile) return { ok: false, status: 403, message: "E-mail nao liberado no Economics." };

  const supabase = getEconomicsClient();
  if (!supabase) return { ok: false, status: 503, message: "Supabase nao configurado no servidor." };

  const { data: member, error } = await supabase
    .from("economics_household_members")
    .select("household_id, email, role, display_name, households:economics_households!inner(id, name, slug)")
    .eq("email", profile.email)
    .eq("households.slug", ECONOMICS_HOUSEHOLD_SLUG)
    .maybeSingle();

  if (error) return { ok: false, status: 500, message: "Falha ao validar acesso ao household." };
  if (!member?.household_id) return { ok: false, status: 403, message: "Household Economics ainda nao liberado para este e-mail." };

  return {
    ok: true,
    supabase,
    householdId: member.household_id,
    member: {
      email: profile.email,
      name: member.display_name || profile.name,
      role: member.role || profile.role,
      avatar: profile.avatar
    },
    household: member.households
  };
}

export async function writeEconomicsAudit(supabase, event) {
  if (!supabase || !event?.householdId) return;

  await supabase.from("economics_audit_events").insert({
    household_id: event.householdId,
    actor_email: event.actorEmail || null,
    event_type: event.eventType,
    entity_type: event.entityType || null,
    entity_id: event.entityId || null,
    metadata: event.metadata || {}
  });
}

export function sanitizeFileName(name) {
  const base = String(name || "documento.pdf")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 140);
  return base || "documento.pdf";
}
