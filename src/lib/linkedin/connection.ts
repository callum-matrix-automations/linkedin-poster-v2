import { prisma } from "@/lib/prisma";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type { TokenResponse, LinkedInUser } from "./api";

/**
 * DB helpers for the per-user LinkedIn connection. The access token is stored
 * encrypted (AES-256-GCM) and decrypted just-in-time here, server-side — it is
 * never returned to the client.
 */

export interface ResolvedConnection {
  accessToken: string; // decrypted
  linkedinSub: string;
  expiresAt: Date;
}

/** Persist (or replace) a user's LinkedIn connection after OAuth. */
export async function saveConnection(
  userId: string,
  token: TokenResponse,
  user: LinkedInUser,
): Promise<void> {
  const expiresAt = new Date(Date.now() + token.expiresInSec * 1000);
  const data = {
    linkedinSub: user.sub,
    name: user.name,
    accessToken: encryptSecret(token.accessToken),
    refreshToken: token.refreshToken ? encryptSecret(token.refreshToken) : null,
    expiresAt,
    scope: token.scope,
  };
  await prisma.linkedInConnection.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/** Load + decrypt a user's connection, or null if not connected. */
export async function getConnection(
  userId: string,
): Promise<ResolvedConnection | null> {
  const row = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!row) return null;
  let accessToken: string;
  try {
    accessToken = decryptSecret(row.accessToken);
  } catch {
    // ENCRYPTION_KEY changed or row corrupt — treat as not connected.
    return null;
  }
  return { accessToken, linkedinSub: row.linkedinSub, expiresAt: row.expiresAt };
}

/** Client-safe status (no token material). */
export interface ConnectionStatus {
  connected: boolean;
  name?: string;
  expiresAt?: string;
}

export async function getStatus(userId: string): Promise<ConnectionStatus> {
  const row = await prisma.linkedInConnection.findUnique({ where: { userId } });
  if (!row) return { connected: false };
  return {
    connected: true,
    name: row.name,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function deleteConnection(userId: string): Promise<void> {
  await prisma.linkedInConnection.deleteMany({ where: { userId } });
}
