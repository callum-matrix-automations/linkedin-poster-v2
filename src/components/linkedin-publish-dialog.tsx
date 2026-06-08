"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  publishToLinkedIn,
  LINKEDIN_MAX_CHARS,
} from "@/lib/linkedin-client";
import { LinkedInPreview } from "@/components/linkedin-preview";

/**
 * Confirm-before-publish dialog for posting a draft to LinkedIn. Renders the
 * post in the real LinkedIn preview card (same as the editor) so the user sees
 * exactly what it will look like, plus the PUBLIC visibility. Handles success
 * (links to the live post) and the reconnect-required case.
 */
export function LinkedInPublishDialog({
  text,
  authorName,
  authorTitle,
  onClose,
}: {
  text: string;
  authorName: string;
  authorTitle: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<
    | { kind: "success"; url?: string }
    | { kind: "error"; message: string; reconnect?: boolean }
    | null
  >(null);

  const overLimit = text.length > LINKEDIN_MAX_CHARS;

  async function handlePublish() {
    if (publishing || overLimit) return;
    setPublishing(true);
    setResult(null);
    const r = await publishToLinkedIn(text);
    setPublishing(false);
    if (r.ok) {
      setResult({ kind: "success", url: r.postUrl });
    } else {
      setResult({
        kind: "error",
        message: r.error || "Failed to post.",
        reconnect: r.code === "reconnect_required",
      });
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-chrome-border bg-chrome-light shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeIn var(--duration-normal) var(--ease-out-expo)" }}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-chrome-border px-5 py-4">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
          </svg>
          <h2 className="flex-1 text-base font-semibold text-chrome-text-strong">
            Post to LinkedIn
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-chrome-text transition-colors hover:text-chrome-text-strong"
            style={{ transitionDuration: "var(--duration-fast)" }}
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body (scrolls if needed; footer stays pinned) */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {result?.kind === "success" ? (
            <div className="py-6 text-center">
              <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-success/15">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="mb-1 text-sm font-medium text-chrome-text-strong">
                Posted to LinkedIn
              </p>
              <p className="mb-4 text-sm text-chrome-text">
                Your post is now live on your feed.
              </p>
              {result.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  View on LinkedIn ↗
                </a>
              )}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-1.5 text-xs text-chrome-text">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
                Visible to <span className="font-medium text-chrome-text-strong">anyone</span> (Public)
              </div>

              {/* Real LinkedIn preview — same card as the editor. */}
              <LinkedInPreview
                content={text}
                authorName={authorName}
                authorTitle={authorTitle}
              />

              {overLimit && (
                <p className="mt-2 text-xs text-error">
                  This post is over LinkedIn&apos;s {LINKEDIN_MAX_CHARS.toLocaleString()}-character
                  limit. Trim it before posting.
                </p>
              )}

              {result?.kind === "error" && (
                <div className="mt-3 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">
                  {result.message}
                  {result.reconnect && (
                    <button
                      type="button"
                      onClick={() => router.push("/settings")}
                      className="ml-2 font-medium underline underline-offset-2"
                    >
                      Go to Settings
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {result?.kind !== "success" && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-chrome-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing || overLimit}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
              style={{
                transitionDuration: "var(--duration-fast)",
                transitionTimingFunction: "var(--ease-out-expo)",
              }}
            >
              {publishing && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-text/30 border-t-accent-text" />
              )}
              {publishing ? "Posting..." : "Post now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
