const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
export const MODEL = "gpt-5.4-mini";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Non-streaming chat completion. Returns the assistant's text content.
 * Throws on missing key or API error.
 */
export async function chatCompletion(
  messages: ChatMessage[],
  maxTokens = 4096,
): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No content in OpenAI response");
  }
  return content.trim();
}

/**
 * Streaming chat completion. Returns the raw upstream Response so the caller
 * can pipe/transform the SSE stream. The OpenAI SSE format emits
 * `data: {choices:[{delta:{content}}]}` lines and a final `data: [DONE]`.
 */
export async function chatCompletionStream(
  messages: ChatMessage[],
  maxTokens = 2048,
): Promise<Response> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not configured");

  return fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: maxTokens,
      stream: true,
      messages,
    }),
  });
}
