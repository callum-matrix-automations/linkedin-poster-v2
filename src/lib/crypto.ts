import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash,
} from "node:crypto";

/**
 * Authenticated symmetric encryption for secrets at rest (provider API keys).
 *
 * AES-256-GCM. The master key comes from the ENCRYPTION_KEY env var and never
 * leaves the server. Stored format is a single string:
 *
 *     <iv_b64>:<authTag_b64>:<ciphertext_b64>
 *
 * GCM gives us confidentiality + integrity: tampering with the stored value
 * makes decryption throw rather than silently returning garbage.
 */

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit nonce, the GCM standard

/**
 * Derive a stable 32-byte key from ENCRYPTION_KEY. We hash so the env var can
 * be any length/format (a passphrase or base64) and still yield a valid
 * 256-bit key. The env var itself is the real secret.
 */
function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(stored: string): string {
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted value");
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(dataB64, "base64");

  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
