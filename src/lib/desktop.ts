/**
 * Desktop (Electron) environment detection + the local Claude proxy address.
 *
 * The web app is the same whether it runs in a browser or inside the Electron
 * desktop shell. The shell signals its presence two ways (we accept either):
 *   - a global `window.elevateoDesktop = true` injected via preload, and/or
 *   - a "Elevateo-Desktop" marker in the user agent.
 *
 * Only in the desktop app can the page reach the local Claude proxy on
 * localhost, so the "local Claude" provider is gated on this.
 */

export const LOCAL_PROXY_URL = "http://localhost:42069";

export function isDesktopApp(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { elevateoDesktop?: boolean };
  if (w.elevateoDesktop === true) return true;
  return /Elevateo-Desktop/i.test(navigator.userAgent);
}

/** Quick liveness check that the local proxy is up (used before relying on it). */
export async function isProxyReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${LOCAL_PROXY_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
