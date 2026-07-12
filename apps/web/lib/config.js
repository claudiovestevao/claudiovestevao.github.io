function cleanEnv(value) {
  return (value || "").replace(/^\uFEFF/, "").trim();
}

export const appConfig = {
  siteUrl: cleanEnv(process.env.NEXT_PUBLIC_SITE_URL) || "https://claudiocode.dev",
  supabaseUrl: cleanEnv(process.env.SUPABASE_URL) || cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseServiceRoleKey: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
  supabaseAnonKey: cleanEnv(process.env.SUPABASE_ANON_KEY) || cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  cronSecret: cleanEnv(process.env.CRON_SECRET),
  familyCurationAdminPassword: cleanEnv(process.env.FAMILY_CURATION_ADMIN_PASSWORD),
  enrichBatchSize: Number.parseInt(process.env.ENRICH_BATCH_SIZE || "25", 10),
  useStaticFallback: process.env.USE_STATIC_DESTINATION_FALLBACK !== "0"
};

export function hasServerSupabase() {
  return Boolean(appConfig.supabaseUrl && (appConfig.supabaseServiceRoleKey || appConfig.supabaseAnonKey));
}
