/**
 * Client helpers for the image creator: suggest a prompt from the post, and
 * generate an image. Both return plain results; the editor holds the image as
 * a data URL and persists it on the draft.
 */

import { aiJsonRequest } from "@/lib/local-proxy-client";

export type AspectRatio = "1:1" | "16:9" | "4:3" | "9:16";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

interface Result<T> {
  ok: boolean;
  data?: T;
  error?: string;
  /** "setup_required" when the needed key isn't configured. */
  code?: string;
}

/** Suggest an image prompt from the post content (uses the active text provider). */
export async function suggestImagePrompt(content: string): Promise<Result<string>> {
  try {
    const data = await aiJsonRequest<{ prompt?: string }>(
      "/api/ai/suggest-image-prompt",
      { content },
    );
    return { ok: true, data: data.prompt };
  } catch (err) {
    const e = err as Error & { code?: string };
    return { ok: false, error: e.message, code: e.code };
  }
}

/** Generate an image via Gemini (needs a Gemini key). */
export async function generateImage(
  prompt: string,
  aspectRatio: AspectRatio = "16:9",
): Promise<Result<GeneratedImage>> {
  const res = await fetch("/api/ai/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspectRatio }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || `Failed (${res.status})`, code: data.code };
  }
  return { ok: true, data: data.image };
}

/** Build a data: URL for previewing base64 image bytes in an <img>. */
export function toDataUrl(base64: string, mimeType: string): string {
  return `data:${mimeType};base64,${base64}`;
}
