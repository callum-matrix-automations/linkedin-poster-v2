import { NextResponse } from "next/server";
import { chatCompletion, type ChatMessage } from "./providers";
import { resolveAiTarget } from "./resolve";

/**
 * Shared helper for the non-streaming AI routes, handling the local Claude
 * proxy (desktop) without duplicating any route logic.
 *
 * The server can't reach the user's localhost proxy. So for local Claude:
 *   1. First call: the route builds its messages and calls runChat. The target
 *      is local-proxy, so runChat returns { deferred: true, payload }. The route
 *      returns that payload to the client.
 *   2. The desktop client runs the completion against its local proxy, then
 *      RE-POSTS to the same route with { proxyText: "<the model output>" }.
 *   3. Second call: the route passes proxyText into runChat, which returns it
 *      as the "text" with no AI call — so the route's normal parsing/validation
 *      runs on it exactly as for a cloud provider. Zero logic duplication.
 *
 * For cloud providers, runChat just calls the provider and returns the text.
 */

export type RunResult =
  | { deferred: false; text: string }
  | {
      deferred: true;
      payload: { localProxy: true; messages: ChatMessage[]; maxTokens: number };
    };

export async function runChat(
  userId: string,
  messages: ChatMessage[],
  maxTokens: number,
  proxyText?: string,
): Promise<RunResult> {
  // The desktop client already ran the proxy and sent the text back — use it.
  if (proxyText !== undefined) {
    return { deferred: false, text: proxyText };
  }

  const target = await resolveAiTarget(userId);
  if (target.kind === "local-proxy") {
    return { deferred: true, payload: { localProxy: true, messages, maxTokens } };
  }
  const text = await chatCompletion({
    provider: target.provider,
    apiKey: target.apiKey,
    model: target.model,
    messages,
    maxTokens,
  });
  return { deferred: false, text };
}

/** For routes whose only job is "return the model's text" under `key`. */
export async function runChatResponse(
  userId: string,
  messages: ChatMessage[],
  maxTokens: number,
  key = "text",
  proxyText?: string,
): Promise<NextResponse> {
  const result = await runChat(userId, messages, maxTokens, proxyText);
  if (result.deferred) {
    return NextResponse.json(result.payload);
  }
  return NextResponse.json({ [key]: result.text });
}
