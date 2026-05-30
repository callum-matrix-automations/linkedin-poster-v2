"use client";

interface DiffPanelProps {
  original: string;
  replacement: string;
  streaming: boolean;
  onAccept: () => void;
  onReject: () => void;
}

export function DiffPanel({
  original,
  replacement,
  streaming,
  onAccept,
  onReject,
}: DiffPanelProps) {
  return (
    <div
      className="flex flex-col rounded-lg border border-chrome-border bg-chrome-light"
      style={{
        animation: "fadeIn var(--duration-normal) var(--ease-out-expo)",
      }}
    >
      <div className="flex items-center justify-between border-b border-chrome-border px-4 py-2.5">
        <span className="text-xs font-semibold text-chrome-text-strong">
          {streaming ? "Generating..." : "Suggested edit"}
        </span>
        {!streaming && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onReject}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-chrome-text transition-colors hover:bg-chrome-border hover:text-chrome-text-strong"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Reject
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-text transition-colors hover:bg-accent-hover"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Accept
            </button>
          </div>
        )}
        {streaming && (
          <span className="inline-block h-3 w-3 animate-spin rounded-full border border-chrome-text border-t-accent" />
        )}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-error/70">
            Original
          </span>
          <div className="whitespace-pre-line rounded-md border border-error/15 bg-error/5 px-3 py-2 text-sm leading-relaxed text-chrome-text-strong line-through decoration-error/30">
            {original}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-accent/70">
            Replacement
          </span>
          <div className="whitespace-pre-line rounded-md border border-accent/15 bg-accent/5 px-3 py-2 text-sm leading-relaxed text-chrome-text-strong">
            {replacement || (
              <span className="text-chrome-text/40">...</span>
            )}
            {streaming && replacement && (
              <span
                className="ml-px inline-block h-4 w-0.5 align-text-bottom bg-accent"
                style={{ animation: "blink 1s step-end infinite" }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
