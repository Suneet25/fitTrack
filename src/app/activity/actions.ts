"use server";

import { revalidatePath } from "next/cache";
import { decrypt } from "@/lib/google-health/crypto";
import { revokeToken } from "@/lib/google-health/oauth";
import { syncGoogleHealth } from "@/lib/google-health/sync";
import { getRemoteValue } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";

export async function syncNow() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user || !(await getRemoteValue("google_health_enabled"))) return;
  // Errors are saved on the connection row and rendered by the page.
  await syncGoogleHealth(supabase, data.user.id).catch(() => {});
  revalidatePath("/activity");
}

export async function disconnect() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;

  const { data: conn } = await supabase
    .from("google_health_connections")
    .select("refresh_token_enc")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (conn) {
    try {
      await revokeToken(decrypt(conn.refresh_token_enc));
    } catch {
      // Still remove the link locally even if the key changed or Google is unreachable.
    }
  }
  await supabase.from("google_health_connections").delete().eq("user_id", data.user.id);
  // Disconnecting removes everything that came from Google Health.
  await supabase.from("daily_activity").delete().eq("user_id", data.user.id).eq("source", "google_health");
  await supabase.from("synced_exercises").delete().eq("user_id", data.user.id).eq("source", "google_health");
  revalidatePath("/activity");
}
