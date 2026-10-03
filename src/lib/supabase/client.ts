import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "@/config/env.public";

/** Supabase client for Client Components (runs in the browser). */
export function createClient() {
  return createBrowserClient(
    supabaseEnv.url,
    supabaseEnv.publishableKey,
  );
}
