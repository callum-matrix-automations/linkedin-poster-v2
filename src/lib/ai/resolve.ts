import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import type { ProviderId } from "./providers";

/**
 * Resolves the authenticated user's active AI provider into ready-to-use call
 * parameters: provider id, decrypted API key, and selected model.
 *
 * Decryption happens here, server-side, just-in-time. The plaintext key exists
 * only in the returned object's memory for the duration of one request and is
 * never persisted or sent to the client.
 *
 * Throws ResolveError (with a user-facing message) when the user hasn't set up
 * a provider or the active provider has no key — there is no shared fallback.
 */

export class ResolveError extends Error {
  status: number;
  /** Stable code the client can branch on (e.g. show a "Go to Settings" link). */
  code: "setup_required";
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ResolveError";
    this.status = status;
    this.code = "setup_required";
  }
}

export interface ResolvedProvider {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

const KEY_FIELD: Record<ProviderId, "openaiKey" | "anthropicKey" | "geminiKey"> = {
  openai: "openaiKey",
  anthropic: "anthropicKey",
  gemini: "geminiKey",
};

const MODEL_FIELD: Record<
  ProviderId,
  "openaiModel" | "anthropicModel" | "geminiModel"
> = {
  openai: "openaiModel",
  anthropic: "anthropicModel",
  gemini: "geminiModel",
};

const VALID_PROVIDERS: ProviderId[] = ["openai", "anthropic", "gemini"];

export async function resolveProvider(userId: string): Promise<ResolvedProvider> {
  const settings = await prisma.providerSettings.findUnique({ where: { userId } });

  if (!settings || !settings.activeProvider) {
    throw new ResolveError(
      "No AI provider is set up. Add an API key in Settings to generate posts.",
    );
  }

  const provider = settings.activeProvider as ProviderId;
  if (!VALID_PROVIDERS.includes(provider)) {
    throw new ResolveError(
      "Your selected AI provider is invalid. Re-select one in Settings.",
    );
  }

  const encrypted = settings[KEY_FIELD[provider]];
  if (!encrypted) {
    throw new ResolveError(
      `Your ${provider} API key is missing. Add it in Settings to generate posts.`,
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encrypted);
  } catch {
    // Most likely ENCRYPTION_KEY changed or the row is corrupt.
    throw new ResolveError(
      "Your stored API key could not be read. Please re-enter it in Settings.",
    );
  }

  return {
    provider,
    apiKey,
    model: settings[MODEL_FIELD[provider]],
  };
}

/**
 * Resolves the user's GEMINI key specifically, regardless of which provider is
 * active for text. Image generation is Gemini-only, so it needs a Gemini key
 * even if the user generates text with OpenAI/Anthropic. Throws ResolveError
 * (setup_required) with a Gemini-specific message when absent.
 */
export async function resolveGeminiKey(userId: string): Promise<string> {
  const settings = await prisma.providerSettings.findUnique({ where: { userId } });
  const encrypted = settings?.geminiKey;
  if (!encrypted) {
    throw new ResolveError(
      "Image generation needs a Gemini key. Add one in Settings to create images.",
    );
  }
  try {
    return decryptSecret(encrypted);
  } catch {
    throw new ResolveError(
      "Your stored Gemini key could not be read. Please re-enter it in Settings.",
    );
  }
}
