"use client";

import { useEffect, useState, useCallback } from "react";

interface AuthStatus {
  authenticated: boolean;
  expires_at: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proxyDown, setProxyDown] = useState(false);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    setProxyDown(false);
    try {
      const res = await fetch("/api/ai/auth/status");
      if (!res.ok) throw new Error("status failed");
      const data = await res.json();
      setStatus(data);
    } catch {
      setProxyDown(true);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  async function handleStartLogin() {
    setError(null);
    try {
      const res = await fetch("/api/ai/auth/login");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start login");
      }
      const data = await res.json();
      setAuthUrl(data.url);
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start login");
    }
  }

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    const raw = codeInput.trim();
    if (!raw) return;

    const parts = raw.split("#");
    if (parts.length !== 2) {
      setError("Invalid code. Expected the full code#state string.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: parts[0], state: parts[1] }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Authentication failed");
      }
      setCodeInput("");
      setAuthUrl(null);
      await checkStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  function formatExpiry(iso: string): string {
    const exp = new Date(iso).getTime();
    const mins = Math.floor((exp - Date.now()) / 60000);
    if (mins <= 0) return "expiring now";
    if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  }

  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">
            Settings
          </h1>
          <p className="text-sm text-chrome-text">
            Connect Claude so the AI features can generate and edit posts.
          </p>
        </header>

        <section className="rounded-lg border border-chrome-border bg-chrome-light p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-chrome-text-strong">
                Claude connection
              </h2>
              <p className="mt-0.5 text-xs text-chrome-text">
                Authenticates the local proxy with your Claude account.
              </p>
            </div>

            {!loading && (
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: proxyDown
                      ? "var(--error)"
                      : status?.authenticated
                        ? "var(--success)"
                        : "oklch(70% 0.15 75)",
                  }}
                />
                <span className="text-sm font-medium text-chrome-text-strong">
                  {proxyDown
                    ? "Proxy offline"
                    : status?.authenticated
                      ? "Connected"
                      : "Not connected"}
                </span>
              </div>
            )}
          </div>

          {loading && (
            <p className="text-sm text-chrome-text">Checking status...</p>
          )}

          {!loading && proxyDown && (
            <div className="rounded-md border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
              The proxy server isn&apos;t reachable. Make sure it&apos;s running
              on port 42069, then{" "}
              <button
                type="button"
                onClick={checkStatus}
                className="font-medium underline underline-offset-2"
              >
                retry
              </button>
              .
            </div>
          )}

          {!loading && !proxyDown && status?.authenticated && (
            <div className="flex items-center justify-between rounded-md border border-chrome-border bg-chrome px-4 py-3">
              <div>
                <p className="text-sm text-chrome-text-strong">
                  Authenticated and ready
                </p>
                {status.expires_at && (
                  <p className="mt-0.5 text-xs text-chrome-text">
                    Token expires in {formatExpiry(status.expires_at)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={checkStatus}
                className="rounded-lg border border-chrome-border px-3 py-1.5 text-xs font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                Refresh
              </button>
            </div>
          )}

          {!loading && !proxyDown && !status?.authenticated && (
            <div className="flex flex-col gap-4">
              <ol className="flex flex-col gap-3 text-sm text-chrome-text">
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chrome-border text-[10px] font-semibold text-chrome-text-strong">
                    1
                  </span>
                  <span>
                    Open the Claude authorization page and approve access.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chrome-border text-[10px] font-semibold text-chrome-text-strong">
                    2
                  </span>
                  <span>
                    Copy the full code shown after authorizing (format:{" "}
                    <code className="rounded bg-chrome px-1 text-xs">
                      code#state
                    </code>
                    ).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-chrome-border text-[10px] font-semibold text-chrome-text-strong">
                    3
                  </span>
                  <span>Paste it below and submit.</span>
                </li>
              </ol>

              <button
                type="button"
                onClick={handleStartLogin}
                className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                {authUrl ? "Reopen authorization page" : "Open authorization page"}
              </button>

              <form onSubmit={handleSubmitCode} className="flex gap-2">
                <input
                  type="text"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  placeholder="Paste code#state here"
                  spellCheck={false}
                  autoComplete="off"
                  className="flex-1 rounded-lg border border-chrome-border bg-chrome px-4 py-2.5 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                />
                <button
                  type="submit"
                  disabled={submitting || !codeInput.trim()}
                  className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-40"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  {submitting ? "Connecting..." : "Submit"}
                </button>
              </form>
            </div>
          )}

          {error && (
            <p className="mt-3 text-xs text-error">{error}</p>
          )}
        </section>
      </div>
    </div>
  );
}
