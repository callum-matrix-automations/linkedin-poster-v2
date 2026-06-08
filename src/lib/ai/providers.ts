/**
 * Server-side multi-provider AI client (BYOK).
 *
 * Normalizes the three providers we support (OpenAI, Anthropic, Google Gemini)
 * behind one interface, in BOTH directions:
 *   - request:  same `ChatMessage[]` in, provider-specific body out
 *   - response: provider-specific JSON/SSE in, normalized text/SSE out
 *
 * The streaming path always emits OpenAI-style SSE downstream
 * (`data: {"text": "..."}` then `data: [DONE]`), so the existing client
 * stream parser in the editor keeps working regardless of provider.
 *
 * Keys are passed in by the caller (decrypted from the DB just-in-time) — this
 * module never reads env vars or the database.
 */

export type ProviderId = "openai" | "anthropic" | "gemini";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface CallOptions {
  provider: ProviderId;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  maxTokens: number;
}

// --- helpers to split system vs conversation (Anthropic/Gemini want them apart) ---

function splitSystem(messages: ChatMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages.filter((m) => m.role !== "system");
  return { system, turns };
}

// =====================================================================
// Non-streaming completion → returns the assistant's text.
// =====================================================================

export async function chatCompletion(opts: CallOptions): Promise<string> {
  switch (opts.provider) {
    case "openai":
      return openaiCompletion(opts);
    case "anthropic":
      return anthropicCompletion(opts);
    case "gemini":
      return geminiCompletion(opts);
  }
}

async function openaiCompletion(opts: CallOptions): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model,
      max_completion_tokens: opts.maxTokens,
      messages: opts.messages,
    }),
  });
  if (!res.ok) throw await providerError("OpenAI", res);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("No content in OpenAI response");
  return content.trim();
}

async function anthropicCompletion(opts: CallOptions): Promise<string> {
  const { system, turns } = splitSystem(opts.messages);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      ...(system ? { system } : {}),
      messages: turns.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) throw await providerError("Anthropic", res);
  const data = await res.json();
  // Anthropic returns content as an array of blocks; concatenate text blocks.
  const text = Array.isArray(data.content)
    ? data.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("")
    : "";
  if (!text) throw new Error("No content in Anthropic response");
  return text.trim();
}

async function geminiCompletion(opts: CallOptions): Promise<string> {
  const { system, turns } = splitSystem(opts.messages);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Header auth keeps the key out of URLs/logs (vs the ?key= query param).
      "x-goog-api-key": opts.apiKey,
    },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents: turns.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: opts.maxTokens },
    }),
  });
  if (!res.ok) throw await providerError("Gemini", res);
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (typeof text !== "string" || !text) {
    // Empty completion. The usual cause is the token budget being consumed by
    // reasoning (finishReason MAX_TOKENS) or a safety block — surface which.
    const reason = candidate?.finishReason;
    if (reason === "MAX_TOKENS") {
      throw new Error(
        "Gemini hit the token limit before producing text (reasoning used the whole budget). Try a higher token limit.",
      );
    }
    if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") {
      throw new Error("Gemini blocked the response for safety reasons.");
    }
    throw new Error(
      `Gemini returned no content${reason ? ` (finishReason: ${reason})` : ""}.`,
    );
  }
  return text.trim();
}

// =====================================================================
// Streaming completion → returns a ReadableStream of normalized SSE:
//   data: {"text":"..."}\n\n   (repeated)
//   data: [DONE]\n\n
// =====================================================================

export async function chatCompletionStream(
  opts: CallOptions,
): Promise<ReadableStream<Uint8Array>> {
  const upstream = await openUpstreamStream(opts);
  return normalizeStream(opts.provider, upstream);
}

async function openUpstreamStream(opts: CallOptions): Promise<Response> {
  switch (opts.provider) {
    case "openai": {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify({
          model: opts.model,
          max_completion_tokens: opts.maxTokens,
          stream: true,
          messages: opts.messages,
        }),
      });
      if (!res.ok) throw await providerError("OpenAI", res);
      return res;
    }
    case "anthropic": {
      const { system, turns } = splitSystem(opts.messages);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": opts.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opts.model,
          max_tokens: opts.maxTokens,
          stream: true,
          ...(system ? { system } : {}),
          messages: turns.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw await providerError("Anthropic", res);
      return res;
    }
    case "gemini": {
      const { system, turns } = splitSystem(opts.messages);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model}:streamGenerateContent?alt=sse`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": opts.apiKey,
        },
        body: JSON.stringify({
          ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
          contents: turns.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: opts.maxTokens },
        }),
      });
      if (!res.ok) throw await providerError("Gemini", res);
      return res;
    }
  }
}

/**
 * Reads a provider's SSE stream and re-emits normalized
 * `data: {"text":"..."}` events + a trailing `data: [DONE]`. Each provider
 * has a different delta shape; we extract the text token from each.
 */
function normalizeStream(
  provider: ProviderId,
  upstream: Response,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        return;
      }

      let buffer = "";
      const emit = (text: string) => {
        if (text) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text })}\n\n`),
          );
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === "[DONE]") continue;

            try {
              const event = JSON.parse(dataStr);
              emit(extractDelta(provider, event));
            } catch {
              // ignore unparseable / keep-alive lines
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
}

function extractDelta(provider: ProviderId, event: unknown): string {
  const e = event as Record<string, unknown>;
  switch (provider) {
    case "openai": {
      const choices = e.choices as Array<{ delta?: { content?: string } }> | undefined;
      return choices?.[0]?.delta?.content ?? "";
    }
    case "anthropic": {
      // content_block_delta events carry { delta: { text } }
      if (e.type === "content_block_delta") {
        const delta = e.delta as { text?: string } | undefined;
        return delta?.text ?? "";
      }
      return "";
    }
    case "gemini": {
      const candidates = e.candidates as
        | Array<{ content?: { parts?: Array<{ text?: string }> } }>
        | undefined;
      return (
        candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
      );
    }
  }
}

async function providerError(name: string, res: Response): Promise<Error> {
  let detail = "";
  try {
    detail = await res.text();
  } catch {
    // ignore
  }
  // Surface auth failures in a user-friendly way — these are almost always a
  // bad/expired BYOK key.
  if (res.status === 401 || res.status === 403) {
    return new Error(
      `${name} rejected your API key (${res.status}). Check it in Settings.`,
    );
  }
  return new Error(`${name} request failed (${res.status}): ${detail.slice(0, 300)}`);
}
