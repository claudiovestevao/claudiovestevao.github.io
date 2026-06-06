export const appConfig = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://claudiocode.dev",
  supabaseUrl: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  cronSecret: process.env.CRON_SECRET || "",
  enrichBatchSize: Number.parseInt(process.env.ENRICH_BATCH_SIZE || "25", 10),
  useStaticFallback: process.env.USE_STATIC_DESTINATION_FALLBACK !== "0"
};

export function hasServerSupabase() {
  return Boolean(appConfig.supabaseUrl && (appConfig.supabaseServiceRoleKey || appConfig.supabaseAnonKey));
}
