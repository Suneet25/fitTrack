import "server-only";

/**
 * Server-only secrets. `server-only` makes any import from a Client Component a build
 * error, so these can't leak into the browser bundle. They're read lazily, so a missing
 * optional integration (Google Health) only breaks that feature, not the whole app.
 */

export class MissingEnvError extends Error {
  constructor(name: string, hint = "") {
    super(`Missing or invalid environment variable ${name}.${hint ? ` ${hint}` : ""}`);
  }
}

/** OAuth client for the Google Health API. */
export function googleOAuthClient() {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id) throw new MissingEnvError("GOOGLE_CLIENT_ID");
  if (!secret) throw new MissingEnvError("GOOGLE_CLIENT_SECRET");
  return { id, secret };
}

/** 32-byte AES key that encrypts stored Google refresh tokens. */
export function tokenEncryptionKey() {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  const key = raw ? Buffer.from(raw, "base64") : null;
  if (!key || key.length !== 32) {
    throw new MissingEnvError("GOOGLE_TOKEN_ENCRYPTION_KEY", "It must be 32 bytes, base64-encoded (openssl rand -base64 32).");
  }
  return key;
}
