"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { displayNameFor, parseLiveCode } from "@/lib/workouts/live";

export type StartLiveResult = { code: string } | { error: string };

/** Starts a live session with the current user as host. */
export async function startLiveSession(): Promise<StartLiveResult> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again." };
  const { data, error } = await supabase.rpc("create_live_session", {
    display_name: await displayNameFor(supabase, auth.user),
  });
  if (error || !data) return { error: error?.message ?? "Couldn't start a live session." };
  return { code: data as string };
}

/** Joins a session from an invite link, then opens the log form connected to it. */
export async function joinLiveSession(formData: FormData) {
  const code = parseLiveCode(String(formData.get("code") ?? ""));
  if (!code) redirect("/workouts/new");
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect(`/login?next=/workouts/live/${code}`);
  const { error } = await supabase.rpc("join_live_session", {
    share_code: code,
    display_name: await displayNameFor(supabase, auth.user),
  });
  if (error) redirect(`/workouts/live/${code}?error=${encodeURIComponent(error.message)}`);
  redirect(`/workouts/new?live=${code}`);
}
