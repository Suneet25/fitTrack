import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Name shown to training partners: the profile's display name, else the email's local part. */
export async function displayNameFor(supabase: Supabase, user: User) {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const name = (data?.display_name as string | null) || user.email?.split("@")[0] || "Friend";
  return name.slice(0, 40);
}

/**
 * The 8-character share code from whatever arrived in the URL. Pasted links sometimes carry
 * extra text ("7F3K9QAZ Join my live workout"), so take the first code-shaped run.
 */
export function parseLiveCode(raw: string) {
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    // Malformed escapes: match against the raw value.
  }
  return decoded.toUpperCase().match(/[A-Z0-9]{8}/)?.[0] ?? null;
}

export type LiveSet = {
  id: string;
  user_id: string;
  exercise: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  created_at: string;
};
export type LiveMember = { user_id: string; display_name: string };
export type LiveSessionInit = {
  sessionId: string;
  code: string;
  hostId: string;
  expiresAt: string;
  members: LiveMember[];
  sets: LiveSet[];
};

/** Loads a session the user belongs to (RLS hides any other), with its members and sets. */
export async function loadLiveSession(supabase: Supabase, code: string): Promise<LiveSessionInit | null> {
  const { data } = await supabase
    .from("live_sessions")
    .select(
      "id, code, host_id, expires_at, live_session_members(user_id, display_name), live_sets(id, user_id, exercise, set_number, reps, weight_kg, created_at)",
    )
    .eq("code", code.toUpperCase())
    .order("created_at", { referencedTable: "live_sets" })
    .maybeSingle();
  if (!data) return null;
  return {
    sessionId: data.id,
    code: data.code,
    hostId: data.host_id,
    expiresAt: data.expires_at,
    members: data.live_session_members as LiveMember[],
    sets: data.live_sets as LiveSet[],
  };
}
