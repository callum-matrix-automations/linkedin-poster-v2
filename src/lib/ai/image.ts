/**
 * Gemini image generation (BYOK). Uses the native image-out model via
 * :generateContent (same plumbing as our text Gemini calls). Returns the
 * generated image as base64 + mime type. Caller passes the decrypted key in;
 * this module never touches the DB or env.
 *
 * Per current Google docs (mid-2026): native image generation returns the
 * image inline as base64 at candidates[0].content.parts[].inlineData.data —
 * there is no hosted-URL option. A blocked/empty generation yields a candidate
 * with no inlineData part, which we surface as a clear error.
 *
 * After generation we re-encode the pixels with sharp, which (a) drops all
 * metadata — including the C2PA "Created with AI" content credentials that
 * LinkedIn reads to show its visible AI badge — and (b) lightly compresses the
 * file. Gemini's invisible SynthID pixel watermark survives re-encode but
 * renders nothing, so this just removes the visible badge.
 */

import sharp from "sharp";

// Native image model ("Nano Banana"). Kept here so it's easy to swap if Google
// rotates the id. Verified live: this endpoint is on v1beta and accepts
// responseModalities + imageConfig (the v1 path rejects those fields).
export const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";

// LinkedIn feed images look best landscape; default 16:9.
export type AspectRatio = "1:1" | "16:9" | "4:3" | "9:16";

export interface GeneratedImage {
  /** base64-encoded image bytes (no data: prefix). */
  base64: string;
  mimeType: string;
}

export async function generateImage(opts: {
  apiKey: string;
  prompt: string;
  aspectRatio?: AspectRatio;
}): Promise<GeneratedImage> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        imageConfig: {
          aspectRatio: opts.aspectRatio ?? "16:9",
          imageSize: "2K",
        },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Gemini rejected your API key for image generation (${res.status}). Check it in Settings.`,
      );
    }
    throw new Error(
      `Gemini image generation failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const parts: Array<{ inlineData?: { data?: string; mimeType?: string } }> =
    candidate?.content?.parts ?? [];

  // The response interleaves a text part and the image part — find the image.
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    const reason = candidate?.finishReason;
    if (reason && reason !== "STOP") {
      throw new Error(
        `Gemini didn't return an image (${reason}). Try a different prompt.`,
      );
    }
    throw new Error("Gemini didn't return an image. Try a different prompt.");
  }

  // Re-encode to strip metadata (removes the C2PA AI badge LinkedIn shows) and
  // lightly compress. sharp drops metadata by default; we don't call
  // withMetadata(), so the content credentials are gone.
  const rawBytes = Buffer.from(imagePart.inlineData.data, "base64");
  try {
    const cleaned = await sharp(rawBytes)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    return { base64: cleaned.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    // If re-encoding ever fails, fall back to the original bytes rather than
    // failing the whole generation.
    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? "image/png",
    };
  }
}
