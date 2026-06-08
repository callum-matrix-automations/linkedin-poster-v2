import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed OAuth `state` for the LinkedIn connect flow.
 *
 * The state binds the authorization round-trip to a specific logged-in user
 * and a short expiry, signed with AUTH_SECRET (HMAC-SHA256). The callback
 * verifies it, which (a) proves the request originated from our connect route
 * for THIS user — CSRF protection — and (b) tells us which app user to attach
 * the resulting LinkedIn token to, without trusting any client-supplied id.
 *
 * Format: base64url(`${userId}.${expiresAtMs}`) + "." + base64url(hmac)
 */

const TTL_MS = 10 * 60 * 1000; // 10 minutes — generous for the consent screen

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not configured");
  return s;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createState(userId: string): string {
  const payload = `${userId}.${Date.now() + TTL_MS}`;
  return `${b64url(payload)}.${sign(payload)}`;
}

/**
 * Verifies a state value and returns the bound userId, or null if the state is
 * malformed, tampered, or expired.
 */
export function verifyState(state: string): { userId: string } | null {
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, providedSig] = parts;

  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }

  const expectedSig = sign(payload);
  // Constant-time compare to avoid signature-timing leaks.
  const a = Buffer.from(providedSig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const dot = payload.lastIndexOf(".");
  if (dot === -1) return null;
  const userId = payload.slice(0, dot);
  const expiresAt = Number(payload.slice(dot + 1));
  if (!userId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    return null;
  }

  return { userId };
}
