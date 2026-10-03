import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { encrypt } from "@/lib/google-health/crypto";
import { exchangeCode, STATE_COOKIE } from "@/lib/google-health/oauth";
import { syncGoogleHealth } from "@/lib/google-health/sync";
import { getRemoteValue } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";

/** Google redirects here after the user approves (or denies) access. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const back = (status: string, reason?: string) => {
    if (reason) console.error("[google-health] connect failed:", reason);
    const url = new URL(`/activity?google=${status}`, origin);
    if (reason) url.searchParams.set("reason", reason.slice(0, 200));
    return NextResponse.redirect(url);
  };

  const cookieStore = await cookies();
  const expected = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  const state = searchParams.get("state") ?? "";
  if (!expected || expected.length !== state.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(state))) {
    return back("state");
  }
  if (searchParams.get("error")) return back("denied");
  if (!(await getRemoteValue("google_health_enabled"))) return NextResponse.redirect(new URL("/activity", origin));

  const code = searchParams.get("code");
  if (!code) return back("error");

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login?next=/activity", origin));

  try {
    const tokens = await exchangeCode(code, origin);
    if (!tokens.refresh_token) return back("error", "Google didn't return a refresh token.");

    const { error } = await supabase.from("google_health_connections").upsert({
      user_id: data.user.id,
      refresh_token_enc: encrypt(tokens.refresh_token),
      access_token: tokens.access_token,
      access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      last_sync_error: null,
    });
    if (error) return back("error", `Saving the connection failed: ${error.message}`);
  } catch (e) {
    return back("error", e instanceof Error ? e.message : "Token exchange failed.");
  }

  // First sync right away; failures are recorded on the connection and shown on the page.
  await syncGoogleHealth(supabase, data.user.id).catch(() => {});
  return back("connected");
}
