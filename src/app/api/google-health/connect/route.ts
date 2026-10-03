import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { authorizationUrl, CALLBACK_PATH, STATE_COOKIE } from "@/lib/google-health/oauth";
import { getRemoteValue } from "@/lib/remote-config/server";
import { createClient } from "@/lib/supabase/server";

/** Starts the Google consent flow. */
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login?next=/activity", origin));
  if (!(await getRemoteValue("google_health_enabled"))) return NextResponse.redirect(new URL("/activity", origin));

  // CSRF protection: the callback must echo this value back.
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CALLBACK_PATH,
    maxAge: 600,
  });

  try {
    return NextResponse.redirect(authorizationUrl(origin, state));
  } catch {
    return NextResponse.redirect(new URL("/activity?google=config", origin));
  }
}
