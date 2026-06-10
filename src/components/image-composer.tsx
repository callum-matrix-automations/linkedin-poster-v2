"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  suggestImagePrompt,
  generateImage,
  toDataUrl,
  type AspectRatio,
} from "@/lib/image-client";

export interface DraftImage {
  imageData: string; // base64, no data: prefix
  imageMime: string;
  imageAlt: string;
}

const ASPECT_OPTIONS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "Landscape" },
  { value: "1:1", label: "Square" },
  { value: "4:3", label: "Standard" },
  { value: "9:16", label: "Portrait" },
];

/**
 * Inline image creator for the editor. On open, auto-suggests a prompt from the
 * post (editable), then lets the user generate, regenerate, set alt text, and
 * remove an image. The image is held by the parent (persisted on the draft and
 * mirrored into the LinkedIn preview).
 */
export function ImageComposer({
  postContent,
  image,
  onChange,
}: {
  postContent: string;
  image: DraftImage | null;
  onChange: (image: DraftImage | null) => void;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  // Auto-suggest a prompt the first time the panel opens with no image yet.
  const suggestedRef = useRef(false);

  useEffect(() => {
    if (suggestedRef.current || image || !postContent.trim()) return;
    suggestedRef.current = true;
    setSuggesting(true);
    suggestImagePrompt(postContent)
      .then((r) => {
        if (r.ok && r.data) setPrompt(r.data);
        // A failed suggestion is non-fatal — user can type their own prompt.
      })
      .finally(() => setSuggesting(false));
  }, [postContent, image]);

  async function handleGenerate() {
    if (generating || !prompt.trim()) return;
    setGenerating(true);
    setError(null);
    setSetupNeeded(false);
    const r = await generateImage(prompt.trim(), aspect);
    setGenerating(false);
    if (!r.ok || !r.data) {
      if (r.code === "setup_required") setSetupNeeded(true);
      setError(r.error || "Failed to generate image");
      return;
    }
    onChange({
      imageData: r.data.base64,
      imageMime: r.data.mimeType,
      imageAlt: image?.imageAlt || "",
    });
  }

  function handleRemove() {
    onChange(null);
    setError(null);
  }

  function handleAltChange(alt: string) {
    if (image) onChange({ ...image, imageAlt: alt });
  }

  return (
    <div className="border-t border-chrome-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span className="text-sm font-medium text-chrome-text-strong">Image</span>
        <span className="text-xs text-chrome-text">Generated with Gemini</span>
      </div>

      {/* Existing image preview */}
      {image && (
        <div className="mb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={toDataUrl(image.imageData, image.imageMime)}
            alt={image.imageAlt || "Generated image"}
            className="w-full rounded-lg border border-chrome-border"
          />
          <div className="mt-2">
            <input
              type="text"
              value={image.imageAlt}
              onChange={(e) => handleAltChange(e.target.value)}
              placeholder="Alt text (describe the image for accessibility)"
              maxLength={300}
              className="w-full rounded-lg border border-chrome-border bg-chrome px-3 py-2 text-xs text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
              style={{ transitionDuration: "var(--duration-fast)" }}
            />
          </div>
        </div>
      )}

      {/* Prompt */}
      <label className="mb-1.5 block text-xs font-medium text-chrome-text-strong">
        {image ? "Prompt (edit to regenerate)" : "Image prompt"}
      </label>
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={suggesting ? "Suggesting a prompt..." : "Describe the image you want..."}
          rows={3}
          disabled={suggesting}
          className="w-full resize-none rounded-lg border border-chrome-border bg-chrome px-3 py-2 text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent disabled:opacity-60"
          style={{ transitionDuration: "var(--duration-fast)" }}
        />
        {suggesting && (
          <span className="absolute right-3 top-2.5 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
        )}
      </div>

      {/* Aspect ratio */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-chrome-text">Shape:</span>
        {ASPECT_OPTIONS.map((opt) => {
          const active = aspect === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setAspect(opt.value)}
              className="rounded-md border px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                transitionDuration: "var(--duration-fast)",
                borderColor: active ? "var(--accent)" : "var(--chrome-border)",
                color: active ? "var(--accent)" : "var(--chrome-text)",
                backgroundColor: active ? "oklch(80% 0.13 86 / 0.12)" : "transparent",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || suggesting || !prompt.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
          style={{
            transitionDuration: "var(--duration-fast)",
            transitionTimingFunction: "var(--ease-out-expo)",
          }}
        >
          {generating && (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-text/30 border-t-accent-text" />
          )}
          {generating ? "Generating..." : image ? "Regenerate" : "Generate image"}
        </button>
        {image && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={generating}
            className="rounded-lg border border-chrome-border px-3 py-2 text-sm text-chrome-text transition-colors hover:border-error hover:text-error disabled:opacity-40"
            style={{ transitionDuration: "var(--duration-fast)" }}
          >
            Remove
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2 text-xs text-error">
          <span className="flex-1">{error}</span>
          {setupNeeded && (
            <button
              type="button"
              onClick={() => router.push("/settings")}
              className="font-medium underline underline-offset-2"
            >
              Go to Settings
            </button>
          )}
        </div>
      )}

      {generating && (
        <p className="mt-2 text-xs text-chrome-text">
          This can take 10–30 seconds. Images use your own Gemini key.
        </p>
      )}
    </div>
  );
}
