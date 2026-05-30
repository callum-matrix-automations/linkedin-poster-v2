"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface SelectionToolbarState {
  isOpen: boolean;
  position: { top: number; left: number };
  selectedText: string;
  selectionRange: Range | null;
  close: () => void;
}

export function useSelectionToolbar(
  editorRef: React.RefObject<HTMLDivElement | null>,
): SelectionToolbarState {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [selectedText, setSelectedText] = useState("");
  const rangeRef = useRef<Range | null>(null);
  const toolbarRef = useRef<boolean>(false);

  const close = useCallback(() => {
    setIsOpen(false);
    setSelectedText("");
    rangeRef.current = null;
    toolbarRef.current = false;
  }, []);

  const checkSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;

    const text = sel.toString().trim();
    if (!text) return;

    if (
      !sel.anchorNode ||
      !sel.focusNode ||
      !editor.contains(sel.anchorNode) ||
      !editor.contains(sel.focusNode)
    ) {
      return;
    }

    const range = sel.getRangeAt(0).cloneRange();
    rangeRef.current = range;

    const rangeRect = range.getBoundingClientRect();
    const toolbarHeight = 44;
    const gap = 8;

    let top = rangeRect.top - toolbarHeight - gap;
    const left = rangeRect.left + rangeRect.width / 2;

    if (top < 40) {
      top = rangeRect.bottom + gap;
    }

    setPosition({ top, left });
    setSelectedText(sel.toString());
    setIsOpen(true);
    toolbarRef.current = true;
  }, [editorRef]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const handleMouseUp = () => {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          if (toolbarRef.current) close();
          return;
        }
        checkSelection();
      }, 10);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.shiftKey) {
        setTimeout(checkSelection, 10);
      }
    };

    const handleMouseDown = () => {
      if (toolbarRef.current) {
        close();
      }
    };

    editor.addEventListener("mouseup", handleMouseUp);
    editor.addEventListener("keyup", handleKeyUp);
    editor.addEventListener("mousedown", handleMouseDown);

    return () => {
      editor.removeEventListener("mouseup", handleMouseUp);
      editor.removeEventListener("keyup", handleKeyUp);
      editor.removeEventListener("mousedown", handleMouseDown);
    };
  }, [editorRef, checkSelection]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-inline-toolbar]")) return;
      const editor = editorRef.current;
      if (editor && editor.contains(target)) return;
      close();
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, close, editorRef]);

  return {
    isOpen,
    position,
    selectedText,
    selectionRange: rangeRef.current,
    close,
  };
}
