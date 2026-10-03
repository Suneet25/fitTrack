import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { tokenEncryptionKey } from "@/config/env.server";

/**
 * AES-256-GCM for the Google refresh token at rest.
 * GOOGLE_TOKEN_ENCRYPTION_KEY is 32 random bytes, base64 (`openssl rand -base64 32`).
 */
const key = tokenEncryptionKey;

/** Returns `iv.tag.ciphertext`, each base64url. */
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string) {
  const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
