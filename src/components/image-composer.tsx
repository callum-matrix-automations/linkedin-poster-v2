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
// Max upload size — LinkedIn caps image posts well under this; keeps the
// base64 on the draft row reasonable.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

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
  const [mode, setMode] = useState<"generate" | "upload">("generate");
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<AspectRatio>("16:9");
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupNeeded, setSetupNeeded] = useState(false);
  // Auto-suggest a prompt the first time the panel opens with no image yet.
  const suggestedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Only auto-suggest in generate mode.
    if (suggestedRef.current || image || !postContent.trim() || mode !== "generate") return;
    suggestedRef.current = true;
    setSuggesting(true);
    suggestImagePrompt(postContent)
      .then((r) => {
        if (r.ok && r.data) setPrompt(r.data);
        // A failed suggestion is non-fatal — user can type their own prompt.
      })
      .finally(() => setSuggesting(false));
  }, [postContent, image, mode]);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires again.
    e.target.value = "";
    if (!file) return;
    setError(null);
    setSetupNeeded(false);

    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Use a JPG, PNG, or GIF.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large. Keep it under 8 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      onChange({
        imageData: base64,
        imageMime: file.type,
        imageAlt: image?.imageAlt || "",
      });
    };
    reader.onerror = () => setError("Couldn't read that image. Try another file.");
    reader.readAsDataURL(file);
  }

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
        <div className="flex-1" />
        {/* Generate vs Upload toggle */}
        <div className="flex rounded-lg border border-chrome-border p-0.5">
          {(["generate", "upload"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                  setSetupNeeded(false);
                }}
                className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                style={{
                  transitionDuration: "var(--duration-fast)",
                  backgroundColor: active ? "var(--accent)" : "transparent",
                  color: active ? "var(--accent-text)" : "var(--chrome-text)",
                }}
              >
                {m === "generate" ? "Generate" : "Upload"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={handleFileSelected}
        className="hidden"
      />

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

      {mode === "generate" ? (
        <>
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
        </>
      ) : (
        /* Upload mode */
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {image ? "Choose a different image" : "Choose an image"}
          </button>
          {image && (
            <button
              type="button"
              onClick={handleRemove}
              className="rounded-lg border border-chrome-border px-3 py-2 text-sm text-chrome-text transition-colors hover:border-error hover:text-error"
              style={{ transitionDuration: "var(--duration-fast)" }}
            >
              Remove
            </button>
          )}
          <span className="text-xs text-chrome-text">JPG, PNG, GIF · max 8 MB</span>
        </div>
      )}

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
