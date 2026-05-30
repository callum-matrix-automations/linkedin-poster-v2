"use client";

interface LinkedInPreviewProps {
  content: string;
  authorName: string;
  authorTitle: string;
}

export function LinkedInPreview({
  content,
  authorName,
  authorTitle,
}: LinkedInPreviewProps) {
  const charCount = content.length;
  const isOverLimit = charCount > 3000;
  const initials = authorName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-lg border border-[#e0e0e0] bg-white">
        {/* Author header */}
        <div className="flex items-start gap-2.5 px-4 pt-3 pb-2">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0a66c2] text-sm font-bold text-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-sm font-semibold text-[#191919]">
                {authorName || "Your Name"}
              </span>
              <span className="text-sm text-[#666]">
                · 1st
              </span>
            </div>
            <p className="truncate text-xs text-[#666] leading-4">
              {authorTitle || "Your Title"}
            </p>
            <div className="flex items-center gap-1 text-xs text-[#666] leading-4">
              <span>Just now</span>
              <span>·</span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 7 7 7 7 0 0 0-7-7zM3 7.6A5 5 0 0 1 7.6 3v4.6H3z" />
                <path d="M8.4 3a5 5 0 0 1 0 9.2V7.6H13A5 5 0 0 0 8.4 3z" opacity=".5" />
              </svg>
            </div>
          </div>
          <button
            type="button"
            className="flex shrink-0 items-center gap-1 rounded-full border border-[#0a66c2] px-4 py-1 text-sm font-semibold text-[#0a66c2] transition-colors hover:border-[#004182] hover:bg-[#ebf5ff]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="text-[#0a66c2]">
              <path d="M9 4V3H7v1H3v1h10V4zm-2 8h2V7H9z" />
              <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1zm0 .5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" fillRule="evenodd" clipRule="evenodd" opacity="0" />
            </svg>
            Follow
          </button>
        </div>

        {/* Post content */}
        <div className="px-4 pb-3">
          {content ? (
            <div className="whitespace-pre-line text-sm leading-5 text-[#191919]">
              {content}
            </div>
          ) : (
            <p className="text-sm italic text-[#999]">
              Your post will appear here...
            </p>
          )}
        </div>

        {content && (
          <>
            {/* Reactions bar */}
            <div className="flex items-center justify-between border-t border-[#e0e0e0] px-4 py-1.5">
              <div className="flex items-center gap-0.5">
                <div className="flex -space-x-0.5">
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#0a66c2] text-[8px] text-white ring-1 ring-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M7.3 11.4L3 13.8V21h4.5v-7l3.5-2.6zM12.6 2L9 8.4l3.6 2.2L16 8.4z"/></svg>
                  </span>
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#df704d] text-[8px] text-white ring-1 ring-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 4.5C7 4.5 2.7 8.1 1 13c1.7 4.9 6 8.5 11 8.5s9.3-3.6 11-8.5c-1.7-4.9-6-8.5-11-8.5z"/></svg>
                  </span>
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#f5bb5c] text-[8px] text-white ring-1 ring-white">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z"/></svg>
                  </span>
                </div>
                <span className="ml-1.5 text-xs text-[#666]">42</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#666]">
                <span>8 comments</span>
                <span>·</span>
                <span>2 reposts</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center border-t border-[#e0e0e0]">
              {[
                { label: "Like", icon: "M2 8.5c0-.3.1-.5.4-.6l3.8-2.1c.2-.1.4-.1.6 0l3.1 2c.2.1.3.3.3.6v7.2c0 .3-.2.5-.4.6L6 18.4c-.2.1-.4.1-.6 0l-3-2c-.2-.2-.4-.4-.4-.7V8.5z" },
                { label: "Comment", icon: "M8 1C4.1 1 1 3.6 1 7c0 1.8 1 3.4 2.5 4.5L3 14l3-2h2c3.9 0 7-2.6 7-6s-3.1-6-7-6z" },
                { label: "Repost", icon: "M2 8l4-4v3h8V5l4 4-4 4V10H6v3z" },
                { label: "Send", icon: "M2.6 13.1L13.1 3l-3.3 12.5-3-4.6z" },
              ].map((action) => (
                <button
                  key={action.label}
                  type="button"
                  className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-[#666] transition-colors hover:bg-[#f5f5f5]"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={action.icon} />
                  </svg>
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Character count - outside the LinkedIn card */}
      <div className="flex items-center justify-between px-1 text-xs">
        <span className={isOverLimit ? "font-medium text-error" : "text-chrome-text"}>
          {charCount.toLocaleString()} / 3,000
        </span>
        {charCount > 0 && charCount <= 1500 && (
          <span className="text-accent">Optimal length</span>
        )}
        {charCount > 1500 && charCount <= 3000 && (
          <span className="text-chrome-text">Long - consider trimming</span>
        )}
      </div>
    </div>
  );
}
