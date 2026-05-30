import { NextRequest } from "next/server";
import type { UserProfile } from "@/lib/types";

const PROXY_URL = process.env.PROXY_URL || "http://localhost:42069";

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

    const resp = await fetch(`${PROXY_URL}/v1/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        stream: true,
        system: [{ type: "text", text: SYSTEM_PROMPT }],
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      return Response.json(
        { error: `AI request failed (${resp.status}): ${errorText}` },
        { status: resp.status },
      );
    }

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = resp.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const dataStr = line.slice(6).trim();
              if (!dataStr) continue;

              try {
                const event = JSON.parse(dataStr);
                if (
                  event.type === "content_block_delta" &&
                  event.delta?.type === "text_delta" &&
                  event.delta.text
                ) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
                  );
                }
                if (event.type === "message_stop") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              } catch {
                // skip unparseable lines
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Stream error" })}\n\n`,
            ),
          );
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return Response.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to process inline edit",
      },
      { status: 500 },
    );
  }
}
