import { createClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createClient> | null = null;
export function createBrowserSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase public environment variables are missing.");
  client = createClient(url, key);
  return client;
}
