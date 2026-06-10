import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/session";
import { resolveGeminiKey, ResolveError } from "@/lib/ai/resolve";
import { generateImage } from "@/lib/ai/image";

/**
 * Generate an image for a post via Gemini (BYOK). Image generation is
 * Gemini-only, so this resolves the user's Gemini key specifically (regardless
 * of which provider is active for text) and returns setup_required if absent.
 *
 * Returns base64 + mime; the client holds it as a data URL and persists it on
 * the draft. Never returns a hosted URL (the provider doesn't offer one).
 */

// Image generation can take 10-60s; allow a generous server budget.
export const maxDuration = 120;

const bodySchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspectRatio: z.enum(["1:1", "16:9", "4:3", "9:16"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid input" },
        { status: 400 },
      );
    }

    const apiKey = await resolveGeminiKey(userId);

    const image = await generateImage({
      apiKey,
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio,
    });

    return NextResponse.json({ image });
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate image" },
      { status: 502 },
    );
  }
}
