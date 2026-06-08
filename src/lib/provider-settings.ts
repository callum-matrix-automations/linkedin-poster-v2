/**
 * Client helpers for BYOK provider settings. The server never returns key
 * material — only whether each provider is `configured`, the selected model,
 * and the active provider.
 */

export type Provider = "openai" | "anthropic" | "gemini";

export interface SafeProviderSettings {
  activeProvider: string; // "" | Provider
  configured: Record<Provider, boolean>;
  models: Record<Provider, string>;
}

export interface ProviderSettingsUpdate {
  activeProvider?: string;
  // Per-provider plaintext key to save. "" clears it; omit to leave unchanged.
  keys?: Partial<Record<Provider, string>>;
  models?: Partial<Record<Provider, string>>;
}

export async function getProviderSettings(): Promise<SafeProviderSettings> {
  const res = await fetch("/api/provider-settings");
  if (!res.ok) throw new Error("Failed to load settings");
  const data = await res.json();
  return data.settings;
}

export async function saveProviderSettings(
  update: ProviderSettingsUpdate,
): Promise<SafeProviderSettings> {
  const res = await fetch("/api/provider-settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to save settings");
  }
  const data = await res.json();
  return data.settings;
}

export interface ProviderTestResult {
  ok: boolean;
  error?: string;
  model?: string;
}

/**
 * Tests a provider's SAVED key + model with a tiny live request. Sends only the
 * provider id; the key stays server-side. A bad key resolves to { ok: false }
 * (not a thrown error) — only network/transport failures throw.
 */
export async function testProvider(
  provider: Provider,
): Promise<ProviderTestResult> {
  const res = await fetch("/api/provider-settings/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.error || `Test failed (${res.status})` };
  }
  return data as ProviderTestResult;
}
