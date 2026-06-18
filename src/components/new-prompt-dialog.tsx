"use client";

import { useState } from "react";

/**
 * "Write from a prompt" dialog. The user types a brief in their own words —
 * what they want the post to be about — and we start a draft from it (no
 * inspiration search). The brief becomes the primary generation instruction.
 */
export function NewPromptDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  /** Called with the brief; should create the draft and navigate to it. */
  onCreate: (brief: string) => Promise<void>;
}) {
  const [brief, setBrief] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = brief.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate(brief.trim());
      // Navigation happens in onCreate; no need to reset state.
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-chrome-border bg-chrome-light shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeIn var(--duration-normal) var(--ease-out-expo)" }}
      >
        <div className="flex items-center gap-2.5 border-b border-chrome-border px-5 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <h2 className="flex-1 text-base font-semibold text-chrome-text-strong">
            Write from a prompt
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-chrome-text transition-colors hover:text-chrome-text-strong"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-2 block text-sm text-chrome-text">
            Describe the post you want. The AI writes it in your voice, using your
            profile — no need to search for inspiration.
          </label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter submits.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSubmit) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            rows={6}
            autoFocus
            placeholder={
              'e.g. "Write about how we cut customer onboarding time by 40% by ' +
              'scrapping our old intake form. Make it a story with a lesson for ' +
              'other founders."'
            }
            className="w-full resize-none rounded-lg border border-chrome-border bg-chrome px-3 py-2.5 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
            style={{ transitionDuration: "var(--duration-fast)" }}
          />
          <p className="mt-1.5 text-[11px] text-chrome-text">
            The more specific you are — the angle, a real detail, who it&apos;s for —
            the better the draft.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-chrome-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-40"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            {submitting && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-text/30 border-t-accent-text" />
            )}
            {submitting ? "Starting..." : "Generate post"}
          </button>
        </div>
      </div>
    </div>
  );
}
