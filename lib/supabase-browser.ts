import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient<any, "public", any> | null = null;

export function createBrowserSupabase(): SupabaseClient<any, "public", any> {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase public environment variables are missing.");
  }

  client = createClient<any>(url, key);
  return client;
}
