"use client";

import { LOCAL_PROXY_URL, isProxyReachable } from "@/lib/desktop";

/**
 * Client helpers for the local Claude proxy's OAuth flow. The proxy exposes
 * its own auth endpoints (it signs the user into their Claude account and
 * stores tokens locally on their machine — no API key, uses their Claude
 * subscription). These only work in the desktop app where localhost is
 * reachable.
 */

export interface ProxyAuthStatus {
  reachable: boolean; // is the proxy process running at all
  authenticated: boolean; // is the user signed into Claude
  expiresAt: string | null;
}

export async function getProxyAuthStatus(): Promise<ProxyAuthStatus> {
  const reachable = await isProxyReachable();
  if (!reachable) return { reachable: false, authenticated: false, expiresAt: null };
  try {
    const res = await fetch(`${LOCAL_PROXY_URL}/auth/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { reachable: true, authenticated: false, expiresAt: null };
    const data = await res.json();
    return {
      reachable: true,
      authenticated: !!data.authenticated,
      expiresAt: data.expires_at ?? null,
    };
  } catch {
    return { reachable: true, authenticated: false, expiresAt: null };
  }
}

/**
 * Opens the proxy's Claude sign-in page. The proxy serves a login page at
 * /auth/login that drives the OAuth (PKCE) flow and stores tokens on success.
 * We open it in a new window; the user completes sign-in there.
 */
export function openProxyLogin(): void {
  window.open(`${LOCAL_PROXY_URL}/auth/login`, "_blank", "noopener,noreferrer");
}

export async function proxyLogout(): Promise<void> {
  try {
    await fetch(`${LOCAL_PROXY_URL}/auth/logout`);
  } catch {
    // ignore — proxy may be down
  }
}
