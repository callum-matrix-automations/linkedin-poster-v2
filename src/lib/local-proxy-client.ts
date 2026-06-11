"use client";

import { LOCAL_PROXY_URL } from "@/lib/desktop";

/**
 * Client-side executor for the local Claude proxy.
 *
 * Cloud AI calls go to our /api/ai/* routes (server → provider). But the local
 * Claude proxy runs on the user's localhost, which our Railway server can't
 * reach. So for "local Claude", the API route returns a deferral payload
 * `{ localProxy: true, messages, maxTokens }`, and the desktop CLIENT runs the
 * actual completion against the proxy here. The proxy is OpenAI-compatible.
 */

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LocalProxyPayload {
  localProxy: true;
  messages: ChatMessage[];
  maxTokens: number;
}

export function isLocalProxyPayload(data: unknown): data is LocalProxyPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { localProxy?: unknown }).localProxy === true
  );
}

// A Claude model the proxy accepts. The proxy maps this to the user's Claude
// subscription; no API key is involved.
const PROXY_MODEL = "claude-sonnet-4-6";

/**
 * Unified AI request to one of our /api/ai/* routes.
 *
 * Normal (cloud) case: POST once, return the route's JSON.
 *
 * Local Claude (desktop) case: the route responds with a deferral payload
 * `{ localProxy, messages, maxTokens }`. We run the completion against the local
 * proxy, then RE-POST to the same route with `{ ...body, proxyText }` so the
 * route's own parsing/validation runs on the proxy output (no logic duplicated
 * client-side). The second response is returned.
 *
 * Throws an Error on failure; the thrown error carries `.code` (e.g.
 * "setup_required") when the route reports one.
 */
export async function aiJsonRequest<T = Record<string, unknown>>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const first = await postJson(url, body);
  if (!isLocalProxyPayload(first)) {
    return first as T;
  }
  // Deferred: run the proxy, then resubmit the raw text for normal parsing.
  const proxyText = await localProxyCompletion(first);
  const second = await postJson(url, { ...body, proxyText });
  return second as T;
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    ) as Error & { code?: string };
    err.code = (data as { code?: string }).code;
    throw err;
  }
  return data;
}

/** Non-streaming completion via the local proxy. Returns the text. */
export async function localProxyCompletion(
  payload: LocalProxyPayload,
): Promise<string> {
  const res = await fetch(`${LOCAL_PROXY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PROXY_MODEL,
      messages: payload.messages,
      max_tokens: payload.maxTokens,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Local Claude proxy failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("No content from the local Claude proxy.");
  }
  return content.trim();
}

/**
 * Streaming completion via the local proxy. Returns an async generator of text
 * chunks. The proxy emits OpenAI-style SSE (`choices[0].delta.content`).
 */
export async function* localProxyStream(
  payload: LocalProxyPayload,
): AsyncGenerator<string> {
  const res = await fetch(`${LOCAL_PROXY_URL}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: PROXY_MODEL,
      messages: payload.messages,
      max_tokens: payload.maxTokens,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Local Claude proxy failed (${res.status}).`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
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
        const text = event.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // ignore keep-alive / unparseable lines
      }
    }
  }
}
