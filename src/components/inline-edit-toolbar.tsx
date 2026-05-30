"use client";

import { useState } from "react";
import { getProfile } from "@/lib/storage";

type Action = "rewrite" | "shorten" | "expand" | "bolder" | "softer" | "custom";

const ACTIONS: { key: Action; label: string }[] = [
  { key: "rewrite", label: "Rewrite" },
  { key: "shorten", label: "Shorten" },
  { key: "expand", label: "Expand" },
  { key: "bolder", label: "Bolder" },
  { key: "softer", label: "Softer" },
];

interface InlineEditToolbarProps {
  position: { top: number; left: number };
  selectedText: string;
  fullContent: string;
  onStartStream: () => void;
  onStreamChunk: (chunk: string) => void;
  onStreamDone: () => void;
  onStreamError: (error: string) => void;
  onClose: () => void;
}

export function InlineEditToolbar({
  position,
  selectedText,
  fullContent,
  onStartStream,
  onStreamChunk,
  onStreamDone,
  onStreamError,
  onClose,
}: InlineEditToolbarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<Action | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAction(action: Action, prompt?: string) {
    setIsLoading(true);
    setActiveAction(action);
    setError(null);
    onStartStream();

    try {
      const profile = getProfile();
      const res = await fetch("/api/ai/inline-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          selectedText,
          fullContent,
          customPrompt: prompt,
          profile,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;

          try {
            const event = JSON.parse(dataStr);
            if (event.error) throw new Error(event.error);
            if (event.text) onStreamChunk(event.text);
          } catch (e) {
            if (e instanceof Error && e.message !== dataStr) throw e;
          }
        }
      }

      onStreamDone();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Edit failed";
      setError(msg);
      onStreamError(msg);
    } finally {
      setIsLoading(false);
      setActiveAction(null);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    handleAction("custom", customPrompt.trim());
  }

  return (
    <div
      data-inline-toolbar
      className={`inline-toolbar-bubble flex flex-col gap-1.5 border border-chrome-border bg-chrome-light/95 px-2 py-1 shadow-xl backdrop-blur-sm ${showCustom ? "rounded-xl" : "rounded-full"}`}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: "translateX(-50%)",
        zIndex: 50,
        animation: "fadeIn var(--duration-fast) var(--ease-out-expo)",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-0.5">
        {ACTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleAction(key)}
            disabled={isLoading}
            className="relative rounded-md px-2.5 py-1.5 text-xs font-medium text-chrome-text transition-colors hover:bg-chrome-border hover:text-chrome-text-strong disabled:opacity-40"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            {activeAction === key ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-chrome-text border-t-accent" />
            ) : (
              label
            )}
          </button>
        ))}

        <div className="mx-0.5 h-4 w-px bg-chrome-border" />

        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          disabled={isLoading}
          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-chrome-text transition-colors hover:bg-chrome-border hover:text-chrome-text-strong disabled:opacity-40"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          {activeAction === "custom" ? (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border border-chrome-text border-t-accent" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          )}
        </button>
      </div>

      {showCustom && (
        <form onSubmit={handleCustomSubmit} className="flex gap-1">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="What should I do?"
            disabled={isLoading}
            autoFocus
            className="min-w-48 flex-1 rounded-md border border-chrome-border bg-chrome px-2.5 py-1.5 text-xs text-chrome-text-strong outline-none placeholder:text-chrome-text focus:border-accent disabled:opacity-40"
            style={{ transitionDuration: "var(--duration-fast)" }}
          />
          <button
            type="submit"
            disabled={isLoading || !customPrompt.trim()}
            className="rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-accent-text transition-colors hover:bg-accent-hover disabled:opacity-40"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            Go
          </button>
        </form>
      )}

      {error && (
        <p className="px-1 text-[10px] text-error">
          {error}{" "}
          <button
            type="button"
            onClick={() => setError(null)}
            className="underline"
          >
            Dismiss
          </button>
        </p>
      )}
    </div>
  );
}
