/**
 * Google OAuth 2.0 (web server flow) for the Google Health API.
 * Docs: https://developers.google.com/health/codelabs/make-your-first-api-call-using-oauth2-playground
 */

import { googleOAuthClient } from "@/config/env.server";

export const SCOPES = {
  activity: "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  metrics: "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
  sleep: "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
} as const;

export type ScopeKey = keyof typeof SCOPES;

export const GOOGLE_HEALTH_SCOPES = Object.values(SCOPES);

/**
 * Which of our scopes the user actually granted. Google's consent screen lets people
 * untick some, and older connections predate the extra scopes.
 */
export function grantedScopes(scope: string | null | undefined): Set<ScopeKey> {
  // Connections saved without a scope string were made when activity was the only scope.
  if (!scope) return new Set(["activity"]);
  const granted = new Set((scope ?? "").split(/\s+/));
  return new Set((Object.keys(SCOPES) as ScopeKey[]).filter((k) => granted.has(SCOPES[k])));
}

export const STATE_COOKIE = "gh_oauth_state";
export const CALLBACK_PATH = "/api/google-health/callback";

export type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type: string;
};

export function redirectUri(origin: string) {
  return `${origin}${CALLBACK_PATH}`;
}

export function authorizationUrl(origin: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: googleOAuthClient().id,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GOOGLE_HEALTH_SCOPES.join(" "),
    // offline + consent guarantees a refresh token, even on reconnect.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const { id, secret } = googleOAuthClient();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, ...params }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new OAuthError(json.error ?? "token_error", json.error_description);
  return json;
}

export class OAuthError extends Error {
  constructor(
    public code: string,
    description?: string,
  ) {
    super(description ?? code);
  }
}

export function exchangeCode(code: string, origin: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });
}

export function refreshAccessToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export async function revokeToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}
