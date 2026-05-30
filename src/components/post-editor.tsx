"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useSelectionToolbar } from "@/hooks/use-selection-toolbar";
import { InlineEditToolbar } from "./inline-edit-toolbar";
import { DiffPanel } from "./diff-panel";

interface PostEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function getStats(text: string) {
  const chars = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const paragraphs = text.trim()
    ? text.split(/\n\s*\n/).filter((p) => p.trim()).length
    : 0;
  return { chars, words, paragraphs };
}

function getInnerOffset(parent: Node, target: Node, offset: number): number {
  if (parent === target) return offset;
  const walker = document.createTreeWalker(parent, NodeFilter.SHOW_TEXT);
  let count = 0;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (node === target) return count + offset;
    count += node.textContent?.length || 0;
  }
  return count + offset;
}

function getSelectionOffsets(
  editorEl: HTMLDivElement,
  range: Range,
): { start: number; end: number } | null {
  const children = Array.from(editorEl.childNodes);
  let charOffset = 0;
  let start = -1;
  let end = -1;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const text = child.textContent || "";

    if (
      child === range.startContainer ||
      child.contains(range.startContainer)
    ) {
      start = charOffset + getInnerOffset(child, range.startContainer, range.startOffset);
    }
    if (child === range.endContainer || child.contains(range.endContainer)) {
      end = charOffset + getInnerOffset(child, range.endContainer, range.endOffset);
    }

    charOffset += text.length;
    if (i < children.length - 1) charOffset += 1;
  }

  if (start === -1 || end === -1) return null;
  return { start, end };
}

export function PostEditor({ value, onChange, placeholder }: PostEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isUpdating = useRef(false);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [pendingDiff, setPendingDiff] = useState<{
    original: string;
    replacement: string;
    start: number;
    end: number;
    streaming: boolean;
  } | null>(null);

  const toolbar = useSelectionToolbar(editorRef);

  const paragraphs = useMemo(() => {
    if (!value) return [];
    return value.split("\n");
  }, [value]);

  const stats = useMemo(() => getStats(value), [value]);
  const charPercent = Math.min((stats.chars / 3000) * 100, 100);
  const isOverLimit = stats.chars > 3000;

  const syncFromDOM = useCallback(() => {
    if (isUpdating.current || !editorRef.current) return;
    const lines: string[] = [];
    const children = editorRef.current.childNodes;
    children.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        lines.push(node.textContent || "");
      } else if (node instanceof HTMLElement) {
        lines.push(node.textContent || "");
      }
    });
    const text = lines.join("\n");
    onChange(text);
  }, [onChange]);

  useEffect(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    let savedOffset = 0;
    let savedNode: Node | null = null;

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      savedNode = range.startContainer;
      savedOffset = range.startOffset;
    }

    const currentText = Array.from(editorRef.current.childNodes)
      .map((n) => n.textContent || "")
      .join("\n");

    if (currentText === value) return;

    isUpdating.current = true;
    const lines = value.split("\n");
    editorRef.current.innerHTML = "";
    lines.forEach((line) => {
      const div = document.createElement("div");
      if (!line) {
        div.appendChild(document.createElement("br"));
      } else {
        div.textContent = line;
      }
      editorRef.current!.appendChild(div);
    });

    if (savedNode && sel) {
      try {
        const range = document.createRange();
        const lastChild = editorRef.current.lastChild;
        if (lastChild) {
          const textNode = lastChild.firstChild || lastChild;
          const offset = Math.min(
            savedOffset,
            textNode.textContent?.length || 0,
          );
          range.setStart(textNode, offset);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      } catch {
        // cursor restoration failed
      }
    }

    isUpdating.current = false;
  }, [value]);

  const charBuffer = useRef<string[]>([]);
  const typeInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamDone = useRef(false);

  const startTyping = useCallback(() => {
    if (typeInterval.current) return;
    typeInterval.current = setInterval(() => {
      if (charBuffer.current.length > 0) {
        const char = charBuffer.current.shift()!;
        setPendingDiff((prev) =>
          prev ? { ...prev, replacement: prev.replacement + char } : null,
        );
      } else if (streamDone.current) {
        if (typeInterval.current) clearInterval(typeInterval.current);
        typeInterval.current = null;
        setPendingDiff((prev) =>
          prev ? { ...prev, streaming: false } : null,
        );
        setInlineLoading(false);
        streamDone.current = false;
      }
    }, 18);
  }, []);

  useEffect(() => {
    return () => {
      if (typeInterval.current) clearInterval(typeInterval.current);
    };
  }, []);

  const handleStartStream = useCallback(() => {
    if (!editorRef.current || !toolbar.selectionRange) return;

    const offsets = getSelectionOffsets(
      editorRef.current,
      toolbar.selectionRange,
    );

    const start = offsets?.start ?? value.indexOf(toolbar.selectedText);
    const end = offsets?.end ?? start + toolbar.selectedText.length;

    charBuffer.current = [];
    streamDone.current = false;
    if (typeInterval.current) {
      clearInterval(typeInterval.current);
      typeInterval.current = null;
    }

    setPendingDiff({
      original: toolbar.selectedText,
      replacement: "",
      start,
      end,
      streaming: true,
    });
    setInlineLoading(true);
  }, [value, toolbar]);

  const handleStreamChunk = useCallback((chunk: string) => {
    for (const char of chunk) {
      charBuffer.current.push(char);
    }
    startTyping();
  }, [startTyping]);

  const handleStreamDone = useCallback(() => {
    streamDone.current = true;
  }, []);

  const handleStreamError = useCallback(() => {
    streamDone.current = true;
  }, []);

  const handleAcceptDiff = useCallback(() => {
    if (!pendingDiff) return;
    const newValue =
      value.slice(0, pendingDiff.start) +
      pendingDiff.replacement +
      value.slice(pendingDiff.end);
    onChange(newValue);
    setPendingDiff(null);
  }, [pendingDiff, value, onChange]);

  const handleRejectDiff = useCallback(() => {
    setPendingDiff(null);
  }, []);

  const lineCount = paragraphs.length || 1;

  return (
    <div className="flex min-h-0 flex-1">
      {/* Line numbers */}
      <div className="flex shrink-0 select-none flex-col border-r border-chrome-border py-6 pr-3 pl-4 text-right font-mono text-xs leading-7 text-chrome-text/40">
        {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
          <div key={i} className="h-7">
            {i < lineCount ? i + 1 : ""}
          </div>
        ))}
      </div>

      {/* Editor area */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Line guides */}
        <div className="pointer-events-none absolute inset-0 py-6 pl-4">
          {Array.from({ length: Math.max(lineCount, 20) }, (_, i) => (
            <div
              key={i}
              className="h-7 border-b"
              style={{
                borderColor:
                  i < lineCount && paragraphs[i] === ""
                    ? "oklch(30% 0.01 80 / 0.5)"
                    : "oklch(30% 0.01 80 / 0.15)",
              }}
            />
          ))}
        </div>

        {/* ContentEditable */}
        <div
          ref={editorRef}
          contentEditable={!inlineLoading}
          suppressContentEditableWarning
          onInput={syncFromDOM}
          data-placeholder={placeholder || "Start writing..."}
          className="post-editor relative min-h-0 flex-1 overflow-y-auto px-4 py-6 text-[15px] leading-7 text-chrome-text-strong outline-none"
          style={{
            caretColor: "var(--accent)",
            opacity: inlineLoading ? 0.6 : 1,
          }}
          spellCheck
        />

        {/* Inline edit toolbar */}
        {toolbar.isOpen && !pendingDiff && (
          <InlineEditToolbar
            position={toolbar.position}
            selectedText={toolbar.selectedText}
            fullContent={value}
            onStartStream={handleStartStream}
            onStreamChunk={handleStreamChunk}
            onStreamDone={handleStreamDone}
            onStreamError={handleStreamError}
            onClose={toolbar.close}
          />
        )}
      </div>

      {/* Stats strip / Diff panel */}
      {pendingDiff ? (
        <div className="flex shrink-0 flex-col border-l border-chrome-border" style={{ width: 280 }}>
          <DiffPanel
            original={pendingDiff.original}
            replacement={pendingDiff.replacement}
            streaming={pendingDiff.streaming}
            onAccept={handleAcceptDiff}
            onReject={handleRejectDiff}
          />
        </div>
      ) : (
      <div className="flex shrink-0 flex-col items-center justify-between border-l border-chrome-border px-3 py-6">
        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-chrome-text/50">
              Chars
            </span>
            <span
              className={`font-mono text-sm tabular-nums ${isOverLimit ? "text-error" : "text-chrome-text-strong"}`}
            >
              {stats.chars.toLocaleString()}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-chrome-text/50">
              Words
            </span>
            <span className="font-mono text-sm tabular-nums text-chrome-text-strong">
              {stats.words}
            </span>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-chrome-text/50">
              Paras
            </span>
            <span className="font-mono text-sm tabular-nums text-chrome-text-strong">
              {stats.paragraphs}
            </span>
          </div>
        </div>

        {/* Character gauge */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="relative h-24 w-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: "oklch(30% 0.01 80)" }}
          >
            <div
              className="absolute bottom-0 w-full rounded-full transition-all"
              style={{
                height: `${charPercent}%`,
                backgroundColor: isOverLimit
                  ? "var(--error)"
                  : charPercent > 50
                    ? "var(--accent)"
                    : "oklch(45% 0.01 80)",
                transitionDuration: "var(--duration-normal)",
                transitionTimingFunction: "var(--ease-out-expo)",
              }}
            />
          </div>
          <span className="text-[9px] tabular-nums text-chrome-text/50">
            3k
          </span>
        </div>
      </div>
      )}
    </div>
  );
}
