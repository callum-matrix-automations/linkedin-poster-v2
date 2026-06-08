/**
 * Client helpers for the LinkedIn connection + posting. The access token never
 * reaches the browser — these only deal with status, connect/disconnect, and
 * triggering a server-side publish.
 */

export interface LinkedInStatus {
  connected: boolean;
  name?: string;
  expiresAt?: string;
  valid?: boolean | null; // present only on a ?live=1 check
}

export async function getLinkedInStatus(live = false): Promise<LinkedInStatus> {
  const res = await fetch(`/api/linkedin/status${live ? "?live=1" : ""}`);
  if (!res.ok) return { connected: false };
  return res.json();
}

export async function disconnectLinkedIn(): Promise<void> {
  await fetch("/api/linkedin/status", { method: "DELETE" });
}

/** Navigates the browser into the OAuth connect flow (full-page redirect). */
export function startLinkedInConnect(): void {
  window.location.href = "/api/linkedin/connect";
}

export interface PublishResult {
  ok: boolean;
  postUrl?: string;
  error?: string;
  /** "reconnect_required" when the connection is missing/expired. */
  code?: string;
}

export async function publishToLinkedIn(text: string): Promise<PublishResult> {
  const res = await fetch("/api/linkedin/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || `Failed (${res.status})`, code: data.code };
  }
  return { ok: true, postUrl: data.postUrl };
}

export const LINKEDIN_MAX_CHARS = 3000;
