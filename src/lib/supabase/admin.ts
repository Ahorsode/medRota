import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Admin client using the Supabase service role key.
 * Server-only. Never import this from a client component.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error("Supabase admin client cannot be used in the browser");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client");
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
