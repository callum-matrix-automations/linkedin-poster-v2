import { NextRequest } from "next/server";
import type { UserProfile } from "@/lib/types";
import { chatCompletionStream } from "@/lib/ai/providers";
import { resolveProvider, ResolveError } from "@/lib/ai/resolve";
import { getUserId } from "@/lib/session";

const SYSTEM_PROMPT = `You are an inline text editor for LinkedIn posts. You receive a selected portion of text from a LinkedIn post and an editing instruction. Your job is to transform ONLY the selected text according to the instruction while maintaining consistency with the full post's voice and tone.

Rules:
- Return ONLY the replacement text. No quotes, no explanation, no commentary, no markdown.
- The replacement text should seamlessly fit where the original selected text was.
- Match the author's voice and tone based on their profile.
- Preserve any formatting conventions (line breaks, spacing) from the original if appropriate.
- Do not add hashtags or emojis unless they were in the original selection.
- Keep the replacement roughly the same scope unless the instruction explicitly asks to expand or shorten.`;

const ACTION_INSTRUCTIONS: Record<string, string> = {
  rewrite:
    "Rewrite the following text in a different way. Same meaning, different words and structure.",
  shorten:
    "Make the following text more concise. Remove unnecessary words. Be direct.",
  expand:
    "Expand on the following text. Add more detail, examples, or depth. Stay focused on the same point.",
  bolder:
    "Make the following text more assertive and confident. Stronger language, more conviction.",
  softer:
    "Make the following text more conversational and approachable. Warmer tone, less aggressive.",
};

function buildUserContext(profile: UserProfile): string {
  const parts = [`Name: ${profile.name}`, `Tone: ${profile.tone}`];
  if (profile.title) parts.push(`Title: ${profile.title}`);
  if (profile.industry) parts.push(`Industry: ${profile.industry}`);
  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { action, selectedText, fullContent, customPrompt, profile } =
      (await request.json()) as {
        action: string;
        selectedText: string;
        fullContent: string;
        customPrompt?: string;
        profile: UserProfile;
      };

    if (!selectedText || !action) {
      return Response.json(
        { error: "Selected text and action are required" },
        { status: 400 },
      );
    }

    const { provider, apiKey, model } = await resolveProvider(userId);

    const instruction =
      action === "custom" && customPrompt
        ? customPrompt
        : ACTION_INSTRUCTIONS[action];

    if (!instruction) {
      return Response.json(
        { error: `Unknown action: ${action}` },
        { status: 400 },
      );
    }

    const userMessage = [
      "Author profile:",
      buildUserContext(profile),
      "",
      "Full post for context:",
      "---",
      fullContent,
      "---",
      "",
      "Selected text to edit:",
      "---",
      selectedText,
      "---",
      "",
      `Instruction: ${instruction}`,
      "",
      "Return ONLY the replacement text.",
    ].join("\n");

    // The provider abstraction returns a normalized SSE stream
    // (`data: {"text":"..."}` then `data: [DONE]`), so the client parser is
    // provider-agnostic.
    const readable = await chatCompletionStream({
      provider,
      apiKey,
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 2048,
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    if (err instanceof ResolveError) {
      return Response.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to process inline edit",
      },
      { status: 500 },
    );
  }
}
