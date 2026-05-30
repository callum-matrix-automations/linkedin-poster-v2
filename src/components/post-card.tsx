"use client";

import { useState } from "react";
import type { LinkedInPost } from "@/lib/types";

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return n.toString();
}

const TRUNCATE_AT = 280;

export function PostCard({
  post,
  selected,
  onToggleSelect,
}: {
  post: LinkedInPost;
  selected?: boolean;
  onToggleSelect?: (postId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const content = post.content || "";
  const needsTruncation = content.length > TRUNCATE_AT;
  const displayContent =
    expanded || !needsTruncation
      ? content
      : content.slice(0, TRUNCATE_AT).trimEnd() + "...";

  const likes = post.engagement?.likes ?? 0;
  const comments = post.engagement?.comments ?? 0;
  const shares = post.engagement?.shares ?? 0;
  const totalEngagement = likes + comments + shares;
  const selectable = onToggleSelect !== undefined;

  return (
    <div
      className="flex flex-col rounded-xl border bg-chrome-light p-5 transition-all"
      style={{
        transitionDuration: "var(--duration-fast)",
        transitionTimingFunction: "var(--ease-out-expo)",
        borderColor: selected ? "var(--accent)" : "var(--chrome-border)",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "var(--chrome-text)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "var(--chrome-border)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div className="mb-4 flex items-center gap-3">
        {selectable && (
          <button
            type="button"
            onClick={() => onToggleSelect!(post.id)}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors"
            style={{
              transitionDuration: "var(--duration-fast)",
              borderColor: selected ? "var(--accent)" : "var(--chrome-border)",
              backgroundColor: selected ? "var(--accent)" : "transparent",
            }}
          >
            {selected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-text)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        )}
        {post.author?.avatar?.url ? (
          <img
            src={post.author.avatar.url}
            alt=""
            className="h-9 w-9 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-chrome-border text-xs font-semibold text-chrome-text">
            {post.author?.name?.charAt(0) || "?"}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-chrome-text-strong">
            {post.author?.name || "Unknown"}
          </p>
          <p className="truncate text-xs text-chrome-text">
            {post.author?.info
              ? post.author.info.length > 60
                ? post.author.info.slice(0, 60).trimEnd() + "..."
                : post.author.info
              : ""}
          </p>
        </div>
        <span className="shrink-0 text-xs text-chrome-text">
          {post.postedAt?.postedAgoShort}
        </span>
      </div>

      <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-chrome-text-strong">
        {displayContent}
      </p>

      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mb-4 self-start text-xs font-medium text-accent transition-colors hover:text-accent-hover"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          {expanded ? "Show less" : "See more"}
        </button>
      )}

      <div className="mt-auto flex items-center gap-4 border-t border-chrome-border pt-4 text-xs text-chrome-text">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10v12" />
            <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
          </svg>
          {formatNumber(likes)}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {formatNumber(comments)}
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          {formatNumber(shares)}
        </span>
        <span className="ml-auto font-medium text-accent">
          {formatNumber(totalEngagement)} total
        </span>
        <a
          href={post.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-1 text-chrome-text transition-colors hover:text-chrome-text-strong"
          style={{ transitionDuration: "var(--duration-fast)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    </div>
  );
}
