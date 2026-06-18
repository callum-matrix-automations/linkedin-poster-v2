"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getDraft,
  updateDraftContent,
  updateDraftImage,
  finishDraft,
  deleteDraft,
  scheduleDraft,
  cancelScheduledDraft,
  createPromptDraft,
} from "@/lib/storage";
import { NewPromptDialog } from "@/components/new-prompt-dialog";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { formatInZone } from "@/lib/timezone";
import { aiJsonRequest } from "@/lib/local-proxy-client";
import { ImageComposer, type DraftImage } from "@/components/image-composer";
import { toDataUrl } from "@/lib/image-client";
import {
  useProfile,
  useDrafts,
  useHistory,
  useScheduled,
} from "@/components/app-data-provider";
import { LinkedInPreview } from "@/components/linkedin-preview";
import { PostEditor } from "@/components/post-editor";
import { PostCard } from "@/components/post-card";
import { PostEditorSkeleton, DraftListSkeleton } from "@/components/skeleton";
import { ProviderSetupPrompt } from "@/components/provider-setup-prompt";
import { LinkedInPublishDialog } from "@/components/linkedin-publish-dialog";
import { getLinkedInStatus } from "@/lib/linkedin-client";
import { EMPTY_PROFILE } from "@/lib/types";
import type { PostSuggestion, LinkedInPost, SavedDraft, UserProfile } from "@/lib/types";

/**
 * Removes a trailing block of hashtags (a final paragraph that is only
 * #hashtags) from a post, so regenerating hashtags replaces rather than stacks.
 * Leaves inline hashtags within the body untouched.
 */
function stripTrailingHashtags(text: string): string {
  // Work from the end: drop trailing whitespace, then peel off any run of
  // lines that consist solely of hashtags (and whitespace between them).
  const trimmed = text.replace(/\s+$/, "");
  // Match a trailing block where the remaining tail is only #tags/whitespace.
  const m = trimmed.match(/(?:^|\n)[ \t]*((?:#[A-Za-z0-9]+[ \t]*)+)$/);
  if (!m) return text.replace(/\s+$/, "");
  return trimmed.slice(0, m.index).replace(/\s+$/, "");
}

function WriteEditor({ draftId }: { draftId: string }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { refresh: refreshDrafts } = useDrafts();
  const { refresh: refreshHistory } = useHistory();
  const { refresh: refreshScheduled } = useScheduled();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True when generation failed because no AI provider is set up.
  const [setupNeeded, setSetupNeeded] = useState(false);
  const [suggestion, setSuggestion] = useState<PostSuggestion | null>(null);
  const [inspirationPosts, setInspirationPosts] = useState<LinkedInPost[]>([]);
  const [tab, setTab] = useState<"editor" | "inspiration">("editor");
  const [copied, setCopied] = useState(false);
  const [finished, setFinished] = useState(false);
  // Finished posts open read-only; "Edit" unlocks them. `locked` only applies
  // to finished posts. `preEditContent` snapshots the text so Cancel can revert.
  const [locked, setLocked] = useState(false);
  const [preEditContent, setPreEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  // LinkedIn: live connection check (run on entering the write phase) + dialog.
  // null = unknown/checking, true = connected & valid, false = needs (re)connect.
  const [linkedinReady, setLinkedinReady] = useState<boolean | null>(null);
  const [showPublish, setShowPublish] = useState(false);
  // Hashtag agent state.
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagError, setHashtagError] = useState<string | null>(null);
  const [hashtagSetupNeeded, setHashtagSetupNeeded] = useState(false);
  // Image creator: the draft's attached image + whether the panel is open.
  const [image, setImage] = useState<DraftImage | null>(null);
  const [showImagePanel, setShowImagePanel] = useState(false);
  // Scheduling: the draft's current scheduled time (ms) + dialog visibility.
  const [scheduledFor, setScheduledFor] = useState<number | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  // Author identity comes from the cached profile; falls back to empty until loaded.
  const authorName = profile?.name ?? "";
  const authorTitle = profile?.title ?? "";
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Wait for the cached profile before loading the draft — generation needs it.
    if (!profile) return;
    let cancelled = false;
    (async () => {
      const draft = await getDraft(draftId);
      if (cancelled) return;
      if (!draft) {
        router.replace("/write");
        return;
      }

      setSuggestion(draft.suggestion);
      setInspirationPosts(draft.inspirationPosts ?? []);
      const isFinished = draft.status === "finished";
      setFinished(isFinished);
      // Finished posts open locked (read-only) until the user clicks Edit.
      setLocked(isFinished);
      setScheduledFor(draft.scheduledFor);
      // Load any saved image; open the panel if one exists.
      if (draft.imageData && draft.imageMime) {
        setImage({
          imageData: draft.imageData,
          imageMime: draft.imageMime,
          imageAlt: draft.imageAlt ?? "",
        });
        setShowImagePanel(true);
      }
      setMounted(true);

      if (draft.content) {
        setContent(draft.content);
        setLoading(false);
      } else {
        generateDraft(profile, draft.suggestion, draft.inspirationPosts ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, router, profile]);

  // Live LinkedIn connection check on entering the write phase. A live=1 check
  // verifies the token still works (not just that a row exists), so an expired
  // connection shows "Reconnect" rather than failing at publish time.
  useEffect(() => {
    let cancelled = false;
    getLinkedInStatus(true)
      .then((s) => {
        if (cancelled) return;
        // valid can be true | false | null(unknown). Treat unknown as ready so
        // a transient network blip doesn't block posting; publish handles 401.
        setLinkedinReady(s.connected && s.valid !== false);
      })
      .catch(() => {
        if (!cancelled) setLinkedinReady(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function generateDraft(
    profile: UserProfile,
    sugg: PostSuggestion,
    posts: LinkedInPost[],
  ) {
    setLoading(true);
    setError(null);
    setSetupNeeded(false);

    try {
      const data = await aiJsonRequest<{ draft?: string }>(
        "/api/ai/generate-draft",
        { profile, suggestion: sugg, posts },
      );
      const text = data.draft || "";
      setContent(text);
      void updateDraftContent(draftId, text);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "setup_required") setSetupNeeded(true);
      setError(e.message || "Failed to generate draft");
    } finally {
      setLoading(false);
    }
  }

  const handleDraftChange = useCallback(
    (value: string) => {
      setContent(value);
      // Drafts autosave as you type. Finished posts don't — their edits are
      // held until the explicit Save button (handleSaveEdit).
      if (finished) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateDraftContent(draftId, value);
      }, 600);
    },
    [draftId, finished],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  async function handleRegenerate() {
    if (!profile) return;
    setContent("");
    await generateDraft(profile, suggestion!, inspirationPosts);
  }

  async function handleFinish() {
    // Flush any pending content save first.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await updateDraftContent(draftId, content);
    await finishDraft(draftId);
    setFinished(true);
    // The draft moved drafting -> finished; refresh both lists so the cache
    // reflects the move when we land back on the list.
    await Promise.all([refreshDrafts(), refreshHistory()]);
    router.push("/write");
  }

  // --- Finished-post edit lock ---
  function handleStartEdit() {
    setPreEditContent(content); // snapshot for Cancel
    setLocked(false);
  }

  function handleCancelEdit() {
    setContent(preEditContent); // revert unsaved changes
    setLocked(true);
  }

  async function handleSaveEdit() {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      await updateDraftContent(draftId, content);
      // Reflect the edited content in the cached history list.
      await refreshHistory();
      setLocked(true);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleGenerateHashtags() {
    if (hashtagLoading || !content.trim()) return;
    setHashtagLoading(true);
    setHashtagError(null);
    setHashtagSetupNeeded(false);
    try {
      const data = await aiJsonRequest<{ hashtags?: string[] }>(
        "/api/ai/generate-hashtags",
        { content, profile: profile ?? EMPTY_PROFILE },
      );
      const tags: string[] = data.hashtags || [];
      if (tags.length === 0) return;

      // Replace any existing trailing hashtag block, then append the new one.
      const base = stripTrailingHashtags(content);
      const tagLine = tags.map((t) => `#${t}`).join(" ");
      const next = `${base}\n\n${tagLine}`;
      handleDraftChange(next);
    } catch (err) {
      const e = err as Error & { code?: string };
      if (e.code === "setup_required") setHashtagSetupNeeded(true);
      setHashtagError(e.message || "Failed to generate hashtags");
    } finally {
      setHashtagLoading(false);
    }
  }

  // Image add/replace/remove/alt-edit. Persists immediately (a deliberate
  // action, not keystroke autosave) and mirrors into the LinkedIn preview.
  function handleImageChange(next: DraftImage | null) {
    setImage(next);
    void updateDraftImage(draftId, next);
  }

  function handlePostToLinkedIn() {
    if (!content) return;
    // If the live check says not connected/expired, send them to connect first.
    if (linkedinReady === false) {
      router.push("/settings");
      return;
    }
    setShowPublish(true);
  }

  async function handleSchedule(utcMs: number) {
    // Flush any pending content edits first so the scheduled post has them.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await updateDraftContent(draftId, content);
    await scheduleDraft(draftId, utcMs);
    setScheduledFor(utcMs);
    setShowSchedule(false);
    // Refresh the lists so the post moves into the Scheduled section.
    await Promise.all([refreshDrafts(), refreshScheduled()]);
    router.push("/write");
  }

  async function handleCancelSchedule() {
    await cancelScheduledDraft(draftId);
    setScheduledFor(null);
    await Promise.all([refreshDrafts(), refreshScheduled()]);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!mounted) {
    return <PostEditorSkeleton />;
  }

  return (
    <div className="flex h-full flex-col bg-chrome">
      <header className="flex shrink-0 items-center justify-between border-b border-chrome-border px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/write")}
            className="flex shrink-0 items-center gap-1.5 text-sm text-chrome-text transition-colors hover:text-chrome-text-strong"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            Drafts
          </button>
          <div className="h-4 w-px bg-chrome-border" />
          {suggestion && (
            <p className="truncate text-sm text-chrome-text-strong">
              {suggestion.title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Drafting posts: regenerate + finish. Finished posts: edit lock. */}
          {!finished && (
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={loading}
              className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Regenerate
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!content}
            className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>

          {/* Hashtag agent — hidden while a finished post is locked (read-only). */}
          {!locked && (
            <button
              type="button"
              onClick={handleGenerateHashtags}
              disabled={!content || loading || hashtagLoading}
              title="Generate and append relevant hashtags"
              className="flex items-center gap-1.5 rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              {hashtagLoading ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="9" x2="20" y2="9" />
                  <line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" />
                  <line x1="16" y1="3" x2="14" y2="21" />
                </svg>
              )}
              {hashtagLoading ? "Adding..." : "Hashtags"}
            </button>
          )}

          {!finished ? (
            <button
              type="button"
              onClick={handleFinish}
              disabled={!content}
              className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Mark as finished
            </button>
          ) : locked ? (
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              Edit
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={savingEdit}
                className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit || !content}
                className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
                style={{
                  transitionDuration: "var(--duration-fast)",
                  transitionTimingFunction: "var(--ease-out-expo)",
                }}
              >
                {savingEdit ? "Saving..." : "Save changes"}
              </button>
            </>
          )}

          {/* Schedule + Post to LinkedIn — hidden while actively editing a
              finished post (save first), shown otherwise. */}
          {!(finished && !locked) && (
            <>
              <button
                type="button"
                onClick={() => setShowSchedule(true)}
                disabled={!content || loading}
                title="Schedule this post for later"
                className="flex items-center gap-1.5 rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                {scheduledFor ? "Reschedule" : "Schedule"}
              </button>
              <button
                type="button"
                onClick={handlePostToLinkedIn}
                disabled={!content || loading}
                title={
                  linkedinReady === false
                    ? "Connect LinkedIn in Settings to post"
                    : "Post this to your LinkedIn feed"
                }
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-30"
                style={{
                  transitionDuration: "var(--duration-fast)",
                  transitionTimingFunction: "var(--ease-out-expo)",
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
                </svg>
                {linkedinReady === false ? "Connect to post" : "Post to LinkedIn"}
              </button>
            </>
          )}
        </div>
      </header>

      {showSchedule && (
        <ScheduleDialog
          initialMs={scheduledFor}
          onClose={() => setShowSchedule(false)}
          onSchedule={handleSchedule}
        />
      )}

      {showPublish && (
        <LinkedInPublishDialog
          text={content}
          authorName={authorName}
          authorTitle={authorTitle}
          image={
            image
              ? {
                  base64: image.imageData,
                  mimeType: image.imageMime,
                  altText: image.imageAlt,
                }
              : null
          }
          imageUrl={image ? toDataUrl(image.imageData, image.imageMime) : null}
          onClose={() => setShowPublish(false)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <div className="flex min-h-0 flex-col" style={{ width: "55%" }}>
          {/* Editor / Inspiration tabs */}
          <div className="flex shrink-0 items-center gap-1 border-b border-chrome-border px-4">
            <button
              type="button"
              onClick={() => setTab("editor")}
              className="border-b-2 px-2 py-2 text-xs font-medium transition-colors"
              style={{
                transitionDuration: "var(--duration-fast)",
                borderColor: tab === "editor" ? "var(--accent)" : "transparent",
                color:
                  tab === "editor"
                    ? "var(--chrome-text-strong)"
                    : "var(--chrome-text)",
              }}
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setTab("inspiration")}
              className="border-b-2 px-2 py-2 text-xs font-medium transition-colors"
              style={{
                transitionDuration: "var(--duration-fast)",
                borderColor:
                  tab === "inspiration" ? "var(--accent)" : "transparent",
                color:
                  tab === "inspiration"
                    ? "var(--chrome-text-strong)"
                    : "var(--chrome-text)",
              }}
            >
              Inspiration{" "}
              {inspirationPosts.length > 0 && (
                <span className="text-chrome-text">
                  ({inspirationPosts.length})
                </span>
              )}
            </button>
          </div>

          {tab === "editor" ? (
            <>
              {loading && (
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="mb-4 inline-block h-6 w-6 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
                    <p className="text-sm text-chrome-text">
                      Writing your post...
                    </p>
                  </div>
                </div>
              )}

              {error && !loading && (
                setupNeeded ? (
                  <ProviderSetupPrompt message={error} className="m-4" />
                ) : (
                  <div className="m-4 rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
                    {error}
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className="ml-2 font-medium underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )
              )}

              {!loading && !error && (
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {locked && (
                    <div className="flex items-center gap-2 border-b border-chrome-border bg-chrome-light px-4 py-2 text-xs text-chrome-text">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      This finished post is read-only. Press{" "}
                      <span className="font-medium text-chrome-text-strong">Edit</span>{" "}
                      to make changes.
                    </div>
                  )}
                  {scheduledFor && (
                    <div className="flex items-center gap-2 border-b border-accent/30 bg-accent/5 px-4 py-2 text-xs text-chrome-text">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="flex-1">
                        Scheduled for{" "}
                        <span className="font-medium text-chrome-text-strong">
                          {formatInZone(scheduledFor)}
                        </span>
                        . Edits here update the scheduled post.
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelSchedule}
                        className="font-medium text-chrome-text underline underline-offset-2 hover:text-error"
                      >
                        Cancel schedule
                      </button>
                    </div>
                  )}
                  {hashtagError && (
                    <div className="flex items-center gap-2 border-b border-error/20 bg-error/5 px-4 py-2 text-xs text-error">
                      <span className="flex-1">{hashtagError}</span>
                      {hashtagSetupNeeded && (
                        <button
                          type="button"
                          onClick={() => router.push("/settings")}
                          className="font-medium underline underline-offset-2"
                        >
                          Go to Settings
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setHashtagError(null)}
                        className="text-error/70 hover:text-error"
                        aria-label="Dismiss"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18" /><path d="M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                  <div className="flex min-h-80 flex-1 flex-col">
                    <PostEditor
                      value={content}
                      onChange={handleDraftChange}
                      placeholder="Start writing your post..."
                      readOnly={locked}
                    />
                  </div>

                  {/* Image creator — editable only when not locked. */}
                  {!locked && (
                    showImagePanel || image ? (
                      <ImageComposer
                        postContent={content}
                        image={image}
                        onChange={handleImageChange}
                      />
                    ) : (
                      <div className="border-t border-chrome-border p-4">
                        <button
                          type="button"
                          onClick={() => setShowImagePanel(true)}
                          disabled={!content}
                          className="flex items-center gap-2 rounded-lg border border-chrome-border px-3.5 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-40"
                          style={{ transitionDuration: "var(--duration-fast)" }}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                          Add an image
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {inspirationPosts.length === 0 ? (
                <p className="py-12 text-center text-sm text-chrome-text">
                  No inspiration posts were saved with this draft.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-xs text-chrome-text">
                    The posts this draft was inspired by.
                  </p>
                  {inspirationPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px bg-chrome-border" />

        <div
          className="flex min-h-0 flex-col overflow-y-auto bg-[#f4f2ee]"
          style={{ width: "45%" }}
        >
          <div className="mx-auto w-full max-w-lg px-6 py-6">
            <LinkedInPreview
              content={content}
              authorName={authorName}
              authorTitle={authorTitle}
              imageUrl={image ? toDataUrl(image.imageData, image.imageMime) : null}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftList() {
  const router = useRouter();
  const { drafts, loading: draftsLoading, removeFromCache } = useDrafts();
  const { history, loading: historyLoading } = useHistory();
  const { scheduled, loading: scheduledLoading } = useScheduled();
  const [showPrompt, setShowPrompt] = useState(false);

  async function handleDelete(id: string) {
    // Optimistically drop from the cache, then persist.
    removeFromCache(id);
    await deleteDraft(id);
  }

  // Start a draft from the user's own brief, then open the editor (which
  // generates from the brief on load, since the new draft has empty content).
  async function handleCreateFromPrompt(brief: string) {
    const draft = await createPromptDraft(brief);
    router.push(`/write?id=${draft.id}`);
  }

  // First load (no cached data yet) shows the ghost list.
  if (
    (draftsLoading && drafts === null) ||
    (historyLoading && history === null) ||
    (scheduledLoading && scheduled === null)
  ) {
    return <DraftListSkeleton />;
  }

  const draftList = drafts ?? [];
  const historyList = history ?? [];
  // The scheduled query returns pending posts; a fired-but-failed post flips to
  // "failed" status, which we surface separately in the same section.
  const scheduledAll = scheduled ?? [];
  const scheduledList = scheduledAll.filter((d) => d.status === "scheduled");
  const failedList = scheduledAll.filter((d) => d.status === "failed");

  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
            <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">
              Your posts
            </h1>
            <p className="text-sm text-chrome-text">
              Drafts in progress and your finished post history.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowPrompt(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
            Write from a prompt
          </button>
        </header>

        <section className="mb-12">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-chrome-text">
            In progress
          </h2>
          {draftList.length === 0 ? (
            <div className="rounded-lg border border-dashed border-chrome-border px-6 py-10 text-center">
              <p className="mb-1 text-sm font-medium text-chrome-text-strong">
                No drafts yet
              </p>
              <p className="mb-4 text-sm text-chrome-text">
                Write from your own prompt, or find inspiring posts to model an
                idea off.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPrompt(true)}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  Write from a prompt
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/find")}
                  className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  Find posts
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {draftList.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  onOpen={() => router.push(`/write?id=${d.id}`)}
                  onDelete={() => handleDelete(d.id)}
                />
              ))}
            </div>
          )}
        </section>

        {scheduledList.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-chrome-text">
              Scheduled
            </h2>
            <div className="flex flex-col gap-2">
              {scheduledList.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  scheduledLabel={
                    d.scheduledFor ? formatInZone(d.scheduledFor) : undefined
                  }
                  onOpen={() => router.push(`/write?id=${d.id}`)}
                  onDelete={() => handleDelete(d.id)}
                />
              ))}
            </div>
          </section>
        )}

        {failedList.length > 0 && (
          <section className="mb-12">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-error">
              Failed to post
            </h2>
            <div className="flex flex-col gap-2">
              {failedList.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  failedReason={d.failedReason ?? "Posting failed"}
                  onOpen={() => router.push(`/write?id=${d.id}`)}
                  onDelete={() => handleDelete(d.id)}
                />
              ))}
            </div>
          </section>
        )}

        {historyList.length > 0 && (
          <section>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-chrome-text">
              History
            </h2>
            <div className="flex flex-col gap-2">
              {historyList.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  finished
                  onOpen={() => router.push(`/write?id=${d.id}`)}
                  onPostToLinkedIn={() => router.push(`/write?id=${d.id}`)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {showPrompt && (
        <NewPromptDialog
          onClose={() => setShowPrompt(false)}
          onCreate={handleCreateFromPrompt}
        />
      )}
    </div>
  );
}

function DraftRow({
  draft,
  finished,
  scheduledLabel,
  failedReason,
  onOpen,
  onDelete,
  onPostToLinkedIn,
}: {
  draft: SavedDraft;
  finished?: boolean;
  scheduledLabel?: string;
  failedReason?: string;
  onOpen: () => void;
  onDelete?: () => void;
  onPostToLinkedIn?: () => void;
}) {
  const preview = draft.content
    ? draft.content.slice(0, 100).trimEnd() +
      (draft.content.length > 100 ? "..." : "")
    : "Empty draft";

  return (
    <div
      className="group flex items-center gap-4 rounded-lg border border-chrome-border bg-chrome-light px-4 py-3 transition-colors hover:border-chrome-text"
      style={{ transitionDuration: "var(--duration-fast)" }}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="mb-1 flex items-center gap-2">
          <span className="truncate text-sm font-medium text-chrome-text-strong">
            {draft.suggestion.title}
          </span>
          {finished && (
            <span className="shrink-0 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              Done
            </span>
          )}
          {draft.imageData && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-chrome-text" aria-label="Has image">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
            </svg>
          )}
        </div>
        {scheduledLabel ? (
          <p className="flex items-center gap-1.5 truncate text-xs text-accent">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {scheduledLabel}
          </p>
        ) : failedReason ? (
          <p className="truncate text-xs text-error">{failedReason}</p>
        ) : (
          <p className="truncate text-xs text-chrome-text">{preview}</p>
        )}
      </button>
      {onPostToLinkedIn && (
        <button
          type="button"
          onClick={onPostToLinkedIn}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-chrome-border px-3 py-1.5 text-xs font-medium text-chrome-text opacity-0 transition-all hover:border-accent hover:text-accent group-hover:opacity-100"
          style={{ transitionDuration: "var(--duration-fast)" }}
          title="Edit and post this to LinkedIn"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
          </svg>
          Post
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 text-chrome-text opacity-0 transition-opacity hover:text-error group-hover:opacity-100"
          style={{ transitionDuration: "var(--duration-fast)" }}
          title="Delete draft"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
}

function WritePageInner() {
  const params = useSearchParams();
  const id = params.get("id");
  return id ? <WriteEditor draftId={id} /> : <DraftList />;
}

export default function WritePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-chrome" />}>
      <WritePageInner />
    </Suspense>
  );
}
