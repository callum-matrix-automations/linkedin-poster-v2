"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getProfile } from "@/lib/storage";

type FeedbackType = "bug" | "idea" | "other";

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "idea", label: "Idea" },
  { value: "bug", label: "Bug" },
  { value: "other", label: "Other" },
];

export function FeedbackBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("idea");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function reset() {
    setType("idea");
    setMessage("");
    setSent(false);
    setError(null);
  }

  function close() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const profile = getProfile();
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page: pathname,
          name: profile.name || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send feedback");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Always-visible banner */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 items-center justify-center gap-2 py-2 text-sm font-semibold uppercase tracking-wider text-accent-text transition-opacity hover:opacity-90"
        style={{
          background: "var(--gold-gradient)",
          transitionDuration: "var(--duration-fast)",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        This is an MVP — submit feedback
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "oklch(10% 0.008 80 / 0.6)",
            animation: "fadeIn var(--duration-fast) var(--ease-out-expo)",
          }}
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-xl border border-chrome-border bg-chrome-light p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sent ? (
              <div className="py-6 text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "oklch(80% 0.13 86 / 0.15)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="mb-1 text-base font-semibold text-chrome-text-strong">
                  Thanks for the feedback
                </h2>
                <p className="mb-5 text-sm text-chrome-text">
                  It came through. We read every message.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-chrome-text-strong">
                      Submit feedback
                    </h2>
                    <p className="mt-0.5 text-xs text-chrome-text">
                      Bugs, ideas, anything. It goes straight to the team.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    className="text-chrome-text transition-colors hover:text-chrome-text-strong"
                    style={{ transitionDuration: "var(--duration-fast)" }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18" />
                      <path d="M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4 flex gap-2">
                  {TYPE_OPTIONS.map((opt) => {
                    const active = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setType(opt.value)}
                        className="flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all"
                        style={{
                          transitionDuration: "var(--duration-fast)",
                          borderColor: active
                            ? "var(--accent)"
                            : "var(--chrome-border)",
                          backgroundColor: active
                            ? "oklch(80% 0.13 86 / 0.12)"
                            : "transparent",
                          color: active
                            ? "var(--accent)"
                            : "var(--chrome-text)",
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What's on your mind?"
                  rows={5}
                  autoFocus
                  className="mb-2 w-full resize-none rounded-lg border border-chrome-border bg-chrome px-4 py-3 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                />

                {error && (
                  <p className="mb-2 text-xs text-error">{error}</p>
                )}

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:text-chrome-text-strong"
                    style={{ transitionDuration: "var(--duration-fast)" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !message.trim()}
                    className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
                    style={{
                      transitionDuration: "var(--duration-fast)",
                      transitionTimingFunction: "var(--ease-out-expo)",
                    }}
                  >
                    {submitting ? "Sending..." : "Send feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
