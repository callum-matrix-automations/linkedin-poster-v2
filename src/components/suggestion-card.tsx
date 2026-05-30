"use client";

import type { PostSuggestion } from "@/lib/types";

export function SuggestionCard({
  suggestion,
  index,
  onSelect,
}: {
  suggestion: PostSuggestion;
  index: number;
  onSelect: (suggestion: PostSuggestion) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className="group flex flex-col items-start rounded-xl border border-chrome-border bg-chrome-light p-5 text-left transition-all"
      style={{
        transitionDuration: "var(--duration-fast)",
        transitionTimingFunction: "var(--ease-out-expo)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--chrome-border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-chrome-border text-xs font-semibold text-chrome-text">
          {index + 1}
        </span>
        <span
          className="rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor:
              suggestion.type === "personal"
                ? "oklch(80% 0.13 86 / 0.14)"
                : "oklch(30% 0.01 80 / 0.6)",
            color:
              suggestion.type === "personal"
                ? "var(--accent)"
                : "var(--chrome-text)",
          }}
        >
          {suggestion.type === "personal" ? "Your story" : "Topical"}
        </span>
      </div>

      <h3 className="mb-2 text-base font-semibold leading-snug text-chrome-text-strong">
        {suggestion.title}
      </h3>

      <p className="mb-3 text-sm leading-relaxed text-chrome-text">
        {suggestion.hook}
      </p>

      <p className="mt-auto text-xs leading-relaxed text-chrome-text/70">
        {suggestion.angle}
      </p>

      <span className="mt-4 text-xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
        Write this post
      </span>
    </button>
  );
}
