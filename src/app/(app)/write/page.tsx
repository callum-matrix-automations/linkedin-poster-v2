"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getDraft,
  updateDraftContent,
  finishDraft,
  deleteDraft,
} from "@/lib/storage";
import {
  useProfile,
  useDrafts,
  useHistory,
} from "@/components/app-data-provider";
import { LinkedInPreview } from "@/components/linkedin-preview";
import { PostEditor } from "@/components/post-editor";
import { PostCard } from "@/components/post-card";
import { PostEditorSkeleton, DraftListSkeleton } from "@/components/skeleton";
import { ProviderSetupPrompt } from "@/components/provider-setup-prompt";
import { LinkedInPublishDialog } from "@/components/linkedin-publish-dialog";
import { getLinkedInStatus } from "@/lib/linkedin-client";
import type { PostSuggestion, LinkedInPost, SavedDraft, UserProfile } from "@/lib/types";

function WriteEditor({ draftId }: { draftId: string }) {
  const router = useRouter();
  const { profile } = useProfile();
  const { refresh: refreshDrafts } = useDrafts();
  const { refresh: refreshHistory } = useHistory();
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
      const res = await fetch("/api/ai/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, suggestion: sugg, posts }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "setup_required") setSetupNeeded(true);
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const data = await res.json();
      const text = data.draft || "";
      setContent(text);
      void updateDraftContent(draftId, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft");
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

  function handlePostToLinkedIn() {
    if (!content) return;
    // If the live check says not connected/expired, send them to connect first.
    if (linkedinReady === false) {
      router.push("/settings");
      return;
    }
    setShowPublish(true);
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

          {/* Post to LinkedIn — hidden while actively editing a finished post
              (save first), shown otherwise. */}
          {!(finished && !locked) && (
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
          )}
        </div>
      </header>

      {showPublish && (
        <LinkedInPublishDialog
          text={content}
          authorName={authorName}
          authorTitle={authorTitle}
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
                <>
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
                  <PostEditor
                    value={content}
                    onChange={handleDraftChange}
                    placeholder="Start writing your post..."
                    readOnly={locked}
                  />
                </>
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

  async function handleDelete(id: string) {
    // Optimistically drop from the cache, then persist.
    removeFromCache(id);
    await deleteDraft(id);
  }

  // First load (no cached data yet) shows the ghost list.
  if ((draftsLoading && drafts === null) || (historyLoading && history === null)) {
    return <DraftListSkeleton />;
  }

  const draftList = drafts ?? [];
  const historyList = history ?? [];

  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-10">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">
            Your posts
          </h1>
          <p className="text-sm text-chrome-text">
            Drafts in progress and your finished post history.
          </p>
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
                Find inspiring posts and generate an idea to start writing.
              </p>
              <button
                type="button"
                onClick={() => router.push("/find")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                Find posts
              </button>
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
    </div>
  );
}

function DraftRow({
  draft,
  finished,
  onOpen,
  onDelete,
  onPostToLinkedIn,
}: {
  draft: SavedDraft;
  finished?: boolean;
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
        </div>
        <p className="truncate text-xs text-chrome-text">{preview}</p>
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
