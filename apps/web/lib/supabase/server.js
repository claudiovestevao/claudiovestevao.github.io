import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

let cachedClient;

export function getSupabaseServerClient() {
  if (!appConfig.supabaseUrl) return null;
  const key = appConfig.supabaseServiceRoleKey || appConfig.supabaseAnonKey;
  if (!key) return null;
  if (!cachedClient) {
    cachedClient = createClient(appConfig.supabaseUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      },
      global: {
        headers: {
          "x-application-name": "claudiocode-family-concierge-web"
        }
      }
    });
  }
  return cachedClient;
}
