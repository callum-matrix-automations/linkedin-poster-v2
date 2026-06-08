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
      setFinished(draft.status === "finished");
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
      // Debounce DB writes while typing.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateDraftContent(draftId, value);
      }, 600);
    },
    [draftId],
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
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!content}
            className="rounded-lg border border-chrome-border px-3 py-1.5 text-sm text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong disabled:opacity-30"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={handleFinish}
            disabled={!content || finished}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-30"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            {finished ? "Finished" : "Mark as finished"}
          </button>
        </div>
      </header>

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
                <PostEditor
                  value={content}
                  onChange={handleDraftChange}
                  placeholder="Start writing your post..."
                />
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
}: {
  draft: SavedDraft;
  finished?: boolean;
  onOpen: () => void;
  onDelete?: () => void;
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
