import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { decryptSecret } from "@/lib/crypto";
import { chatCompletion, type ProviderId } from "@/lib/ai/providers";

/**
 * Sends a minimal request through a provider's SAVED key + selected model to
 * confirm it works. The client sends only the provider id — the key is read
 * from the DB and decrypted server-side, never crossing the wire.
 *
 * Returns { ok: true } on success, or { ok: false, error } with a friendly
 * message (bad key, wrong model id, etc).
 */

const KEY_FIELD = {
  openai: "openaiKey",
  anthropic: "anthropicKey",
  gemini: "geminiKey",
} as const;

const MODEL_FIELD = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  gemini: "geminiModel",
} as const;

const bodySchema = z.object({
  provider: z.enum(["openai", "anthropic", "gemini"]),
});

export async function POST(request: NextRequest) {
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
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  const provider = parsed.data.provider as ProviderId;

  const settings = await prisma.providerSettings.findUnique({
    where: { userId },
  });
  const encrypted = settings?.[KEY_FIELD[provider]];
  if (!encrypted) {
    return NextResponse.json(
      { ok: false, error: "No saved key for this provider. Save a key first." },
      { status: 200 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encrypted);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Stored key couldn't be read. Re-enter it and save." },
      { status: 200 },
    );
  }

  const model = settings[MODEL_FIELD[provider]];

  try {
    // Minimal round-trip to confirm auth + model id. Budget is generous (256)
    // because reasoning models (Gemini 2.5/3.x, GPT-5.x) spend output tokens on
    // internal thinking first — too small a budget returns an empty completion
    // (finishReason MAX_TOKENS) even though the key/model are valid. We keep
    // reasoning ON so the test exercises the same path as real generation.
    const reply = await chatCompletion({
      provider,
      apiKey,
      model,
      messages: [
        { role: "user", content: "Reply with the single word: OK" },
      ],
      maxTokens: 256,
    });
    return NextResponse.json({ ok: true, model, sample: reply.slice(0, 40) });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "The test request failed.",
      },
      { status: 200 },
    );
  }
}
