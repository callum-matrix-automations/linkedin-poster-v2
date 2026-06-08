import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { encryptSecret } from "@/lib/crypto";

/**
 * BYOK provider settings.
 *
 * GET  — returns a CLIENT-SAFE view: which providers have a key (boolean only),
 *        the selected model per provider, and the active provider. Never
 *        returns key material or any value derived from a key.
 * PUT  — saves the active provider, model choices, and/or new API keys. Keys
 *        are encrypted before storage. Sending an empty-string key clears it;
 *        omitting a key leaves the stored one untouched.
 */

type Provider = "openai" | "anthropic" | "gemini";
const PROVIDERS: Provider[] = ["openai", "anthropic", "gemini"];

interface SafeSettings {
  activeProvider: string;
  configured: Record<Provider, boolean>;
  models: Record<Provider, string>;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  openai: "gpt-5.4-mini",
  anthropic: "claude-sonnet-4-6",
  gemini: "gemini-2.5-flash",
};

function toSafe(row: {
  activeProvider: string;
  openaiKey: string | null;
  anthropicKey: string | null;
  geminiKey: string | null;
  openaiModel: string;
  anthropicModel: string;
  geminiModel: string;
} | null): SafeSettings {
  return {
    activeProvider: row?.activeProvider ?? "",
    configured: {
      openai: !!row?.openaiKey,
      anthropic: !!row?.anthropicKey,
      gemini: !!row?.geminiKey,
    },
    models: {
      openai: row?.openaiModel ?? DEFAULT_MODELS.openai,
      anthropic: row?.anthropicModel ?? DEFAULT_MODELS.anthropic,
      gemini: row?.geminiModel ?? DEFAULT_MODELS.gemini,
    },
  };
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await prisma.providerSettings.findUnique({ where: { userId } });
  return NextResponse.json({ settings: toSafe(row) });
}

const putSchema = z.object({
  activeProvider: z.enum(["openai", "anthropic", "gemini", ""]).optional(),
  // A key string is encrypted & stored; "" clears it; undefined leaves it.
  keys: z
    .object({
      openai: z.string().optional(),
      anthropic: z.string().optional(),
      gemini: z.string().optional(),
    })
    .optional(),
  models: z
    .object({
      openai: z.string().max(100).optional(),
      anthropic: z.string().max(100).optional(),
      gemini: z.string().max(100).optional(),
    })
    .optional(),
});

export async function PUT(request: NextRequest) {
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

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  }

  const { activeProvider, keys, models } = parsed.data;

  // Build the column updates. Encrypt any provided key; "" clears it.
  const data: Record<string, string | null> = {};

  if (activeProvider !== undefined) {
    data.activeProvider = activeProvider;
  }

  if (keys) {
    for (const p of PROVIDERS) {
      const incoming = keys[p];
      if (incoming === undefined) continue; // leave untouched
      const col = `${p}Key`;
      data[col] = incoming.trim() === "" ? null : encryptSecret(incoming.trim());
    }
  }

  if (models) {
    for (const p of PROVIDERS) {
      const m = models[p];
      if (m === undefined) continue;
      data[`${p}Model`] = m;
    }
  }

  try {
    const row = await prisma.providerSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    // Guard: never let key material escape, even on the write response.
    return NextResponse.json({ settings: toSafe(row) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save settings" },
      { status: 500 },
    );
  }
}
