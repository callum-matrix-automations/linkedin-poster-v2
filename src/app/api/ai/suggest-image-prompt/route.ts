import { NextRequest, NextResponse } from "next/server";
import { ResolveError } from "@/lib/ai/resolve";
import { runChatResponse } from "@/lib/ai/run";
import { getUserId } from "@/lib/session";

/**
 * Suggests an image-generation prompt based on the post content. Used to
 * pre-fill the image composer so the user starts from a sensible, editable
 * prompt. Uses the user's ACTIVE text provider (any provider can write a
 * prompt) — distinct from the Gemini key used to actually render the image.
 */

const SYSTEM_PROMPT = `You write concise prompts for an AI image generator, to accompany a LinkedIn post.

Given the post text, produce ONE image prompt that would make a strong, professional, scroll-stopping visual for that post.

Rules:
- Describe a clean, modern, professional illustration or photo — the kind that looks good on LinkedIn.
- Be specific about subject, style, mood, and color palette.
- Explicitly say "no text, no words, no letters" — generated text looks broken.
- Keep it to 1-2 sentences, under 60 words.
- Respond with ONLY the prompt text. No quotes, no preamble, no explanation.`;

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, proxyText } = (await request.json()) as {
      content: string;
      proxyText?: string;
    };
    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: "Post content is required" },
        { status: 400 },
      );
    }

    // Returns the prompt text, or a local-proxy deferral payload for desktop.
    return await runChatResponse(
      userId,
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Post:\n---\n${content.slice(0, 3000)}\n---\n\nWrite one image prompt. Prompt text only.`,
        },
      ],
      256,
      "prompt",
      proxyText,
    );
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to suggest a prompt",
      },
      { status: 500 },
    );
  }
}
