import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GITHUB_STATE_COOKIE = "dofast_github_state";
const STATE_TTL_MS = 10 * 60 * 1000;

function getStateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");
  return secret;
}

function sign(userId: string, expires: string, nonce: string): string {
  return createHmac("sha256", getStateSecret())
    .update(`${userId}.${expires}.${nonce}`)
    .digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * CSRF/claim-binding state for the GitHub install flow: random nonce, bound
 * to the DoFast user id, expiring, HMAC-signed with the app secret. Carried
 * both in the install URL (round-trips through GitHub) and in an httpOnly
 * cookie; the callback requires both to match and verify.
 */
export function createStateToken(userId: string, now: number = Date.now()): string {
  const expires = String(now + STATE_TTL_MS);
  const nonce = randomBytes(16).toString("hex");
  return `${expires}.${nonce}.${sign(userId, expires, nonce)}`;
}

export function verifyStateToken(
  token: string,
  userId: string,
  now: number = Date.now()
): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expires, nonce, signature] = parts;
  if (!/^\d{1,16}$/.test(expires)) return false;
  if (!/^[0-9a-f]{32}$/.test(nonce)) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;
  if (now > Number(expires)) return false;
  return safeEqual(signature, sign(userId, expires, nonce));
}
