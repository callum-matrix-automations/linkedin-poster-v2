"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import {
  getProviderSettings,
  saveProviderSettings,
  testProvider,
  type Provider,
  type SafeProviderSettings,
} from "@/lib/provider-settings";
import { SettingsSkeleton, Skeleton } from "@/components/skeleton";
import {
  getLinkedInStatus,
  disconnectLinkedIn,
  startLinkedInConnect,
  type LinkedInStatus,
} from "@/lib/linkedin-client";

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; model?: string }
  | { status: "error"; message: string };

// Providers that persist a BYOK key (everything except the local proxy).
const KEYED: Provider[] = ["openai", "anthropic", "gemini"];

function isKeyed(id: ProviderId): id is Provider {
  return (KEYED as string[]).includes(id);
}

export default function SettingsPage() {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which provider generation uses. "" until the user picks one.
  const [activeProvider, setActiveProvider] = useState<string>("");
  // Which providers already have a saved key (boolean only — never the value).
  const [configured, setConfigured] = useState<Record<Provider, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  // Newly-typed keys this session (empty = unchanged). Never seeded from server.
  const [keyDrafts, setKeyDrafts] = useState<Record<Provider, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
  });
  // Whether the user is actively editing a key (vs. seeing the "Saved" state).
  const [editing, setEditing] = useState<Record<Provider, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const [models, setModels] = useState<Record<Provider, string>>({
    openai: "gpt-5.4-mini",
    anthropic: "claude-sonnet-4-6",
    gemini: "gemini-2.5-flash",
  });
  const [revealed, setRevealed] = useState<Record<Provider, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });
  const [tests, setTests] = useState<Record<Provider, TestState>>({
    openai: { status: "idle" },
    anthropic: { status: "idle" },
    gemini: { status: "idle" },
  });
  // Inline per-field key-save state (keys persist on blur, not via Save bar).
  const [keySave, setKeySave] = useState<
    Record<Provider, "idle" | "saving" | "saved">
  >({
    openai: "idle",
    anthropic: "idle",
    gemini: "idle",
  });

  useEffect(() => {
    getProviderSettings()
      .then(applySettings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoaded(true));
  }, []);

  function applySettings(s: SafeProviderSettings) {
    setActiveProvider(s.activeProvider);
    setConfigured(s.configured);
    setModels(s.models);
  }

  function resetTest(id: Provider) {
    setTests((prev) =>
      prev[id].status === "idle" ? prev : { ...prev, [id]: { status: "idle" } },
    );
  }
  function setKey(id: Provider, value: string) {
    setKeyDrafts((prev) => ({ ...prev, [id]: value }));
    setKeySave((prev) => (prev[id] === "idle" ? prev : { ...prev, [id]: "idle" }));
    resetTest(id);
  }

  /**
   * Persist a key the moment the user leaves the field — no Save-bar step.
   * Saves only when there's an actual new value; an untouched/blank field is
   * a no-op (and never clears an already-saved key).
   */
  async function handleKeyBlur(id: Provider) {
    const value = keyDrafts[id].trim();
    if (!value) return; // nothing typed — don't save, don't clear
    setKeySave((prev) => ({ ...prev, [id]: "saving" }));
    setError(null);
    try {
      const next = await saveProviderSettings({ keys: { [id]: value } });
      setConfigured(next.configured);
      // Key is stored server-side now — drop the local plaintext draft and
      // flip the field back to its masked "Saved" state.
      setKeyDrafts((prev) => ({ ...prev, [id]: "" }));
      setEditing((prev) => ({ ...prev, [id]: false }));
      setRevealed((prev) => ({ ...prev, [id]: false }));
      setKeySave((prev) => ({ ...prev, [id]: "saved" }));
      setTimeout(
        () =>
          setKeySave((prev) =>
            prev[id] === "saved" ? { ...prev, [id]: "idle" } : prev,
          ),
        2000,
      );
    } catch (e) {
      setKeySave((prev) => ({ ...prev, [id]: "idle" }));
      setError(e instanceof Error ? e.message : "Failed to save key");
    }
  }
  function setModel(id: Provider, value: string) {
    setModels((prev) => ({ ...prev, [id]: value }));
    setSaved(false);
    resetTest(id);
  }

  async function handleTest(id: Provider) {
    setTests((prev) => ({ ...prev, [id]: { status: "testing" } }));
    try {
      const result = await testProvider(id);
      setTests((prev) => ({
        ...prev,
        [id]: result.ok
          ? { status: "ok", model: result.model }
          : { status: "error", message: result.error || "Test failed" },
      }));
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        [id]: {
          status: "error",
          message: e instanceof Error ? e.message : "Test failed",
        },
      }));
    }
  }
  function toggleReveal(id: Provider) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function startEditing(id: Provider) {
    setEditing((prev) => ({ ...prev, [id]: true }));
  }
  function chooseActive(id: string) {
    setActiveProvider(id);
    setSaved(false);
  }

  // Keys persist on blur (handleKeyBlur). The Save bar only commits the active
  // provider choice and model selections.
  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const next = await saveProviderSettings({ activeProvider, models });
      applySettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <SettingsSkeleton />;

  return (
    <div className="min-h-dvh bg-chrome px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <header className="mb-10">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight text-chrome-text-strong">
            Settings
          </h1>
          <p className="text-sm text-chrome-text">
            Bring your own API keys. Choose which provider and model writes your
            posts. Keys are stored against your account and never shared.
          </p>
        </header>

        <div className="flex flex-col gap-4">
          {PROVIDERS.map((provider) => {
            const keyed = isKeyed(provider.id);
            // Narrowed id for indexing the per-provider records (only meaningful
            // when `keyed`). The keyed-only JSX below always guards on `keyed`.
            const pid = (keyed ? provider.id : "openai") as Provider;
            const isActive = activeProvider === provider.id;
            // A provider can be selected as active once it has a saved key
            // (or a freshly typed one). Desktop proxy can't be activated yet.
            const hasSavedKey = keyed && configured[pid];
            const hasDraftKey =
              keyed && editing[pid] && keyDrafts[pid].trim().length > 0;
            const selectable = hasSavedKey || hasDraftKey;

            return (
              <section
                key={provider.id}
                className="rounded-xl border bg-chrome-light transition-colors"
                style={{
                  borderColor: isActive
                    ? "var(--accent)"
                    : "var(--chrome-border)",
                  transitionDuration: "var(--duration-fast)",
                }}
              >
                {/* Header row */}
                <div className="flex items-start gap-3.5 px-5 pt-5">
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-chrome-text-strong"
                    style={{ backgroundColor: "var(--chrome)" }}
                  >
                    {provider.icon}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-semibold text-chrome-text-strong">
                        {provider.name}
                      </h2>
                      {isActive && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-text">
                          Active
                        </span>
                      )}
                      {provider.requiresDesktopApp && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            borderColor: "var(--chrome-border)",
                            color: "var(--chrome-text)",
                          }}
                        >
                          Desktop app
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-chrome-text">
                      {provider.tagline}
                    </p>
                  </div>

                  {/* Use-this toggle */}
                  {!provider.requiresDesktopApp && (
                    <button
                      type="button"
                      onClick={() => keyed && chooseActive(provider.id)}
                      disabled={isActive || !selectable}
                      className="shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed"
                      style={{
                        transitionDuration: "var(--duration-fast)",
                        transitionTimingFunction: "var(--ease-out-expo)",
                        borderColor: isActive
                          ? "var(--accent)"
                          : "var(--chrome-border)",
                        color: isActive
                          ? "var(--accent)"
                          : !selectable
                            ? "oklch(45% 0.01 80)"
                            : "var(--chrome-text-strong)",
                        backgroundColor: isActive
                          ? "oklch(80% 0.13 86 / 0.12)"
                          : "transparent",
                      }}
                    >
                      {isActive ? "In use" : "Use this"}
                    </button>
                  )}
                </div>

                {/* Body */}
                <div className="px-5 pb-5 pt-4">
                  {provider.requiresDesktopApp || !keyed ? (
                    <DesktopNotice />
                  ) : (
                    <div className="flex flex-col gap-4">
                      {/* API key field */}
                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <label className="text-xs font-medium text-chrome-text-strong">
                            API key
                          </label>
                          {provider.keysUrl && (
                            <a
                              href={provider.keysUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-accent hover:underline"
                            >
                              Get a key ↗
                            </a>
                          )}
                        </div>

                        {configured[pid] && !editing[pid] ? (
                          // Saved state — cosmetic dots, no real key material.
                          <div className="flex items-center justify-between rounded-lg border border-chrome-border bg-chrome px-4 py-3">
                            <div className="flex items-center gap-2">
                              <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-success"
                                aria-hidden="true"
                              >
                                <path d="M20 6L9 17l-5-5" />
                              </svg>
                              <span className="font-mono text-sm tracking-widest text-chrome-text">
                                ••••••••••••
                              </span>
                              <span className="text-xs font-medium text-success">
                                Saved
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => startEditing(pid)}
                              className="text-xs font-medium text-chrome-text transition-colors hover:text-chrome-text-strong"
                              style={{ transitionDuration: "var(--duration-fast)" }}
                            >
                              Replace
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type={revealed[pid] ? "text" : "password"}
                              value={keyDrafts[pid]}
                              onChange={(e) => setKey(pid, e.target.value)}
                              onFocus={() => startEditing(pid)}
                              onBlur={() => handleKeyBlur(pid)}
                              placeholder={provider.keyPlaceholder}
                              autoComplete="off"
                              spellCheck={false}
                              disabled={keySave[pid] === "saving"}
                              className="w-full rounded-lg border border-chrome-border bg-chrome px-4 py-3 pr-20 font-mono text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent disabled:opacity-60"
                              style={{ transitionDuration: "var(--duration-fast)" }}
                            />
                            {keyDrafts[pid].length > 0 && (
                              <button
                                type="button"
                                // Keep focus so blur-to-save doesn't fire on toggle.
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => toggleReveal(pid)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-chrome-text transition-colors hover:text-chrome-text-strong"
                                style={{ transitionDuration: "var(--duration-fast)" }}
                              >
                                {revealed[pid] ? "Hide" : "Show"}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Inline save/help state under the field */}
                        {keySave[pid] === "saving" ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-chrome-text">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
                            Saving key…
                          </p>
                        ) : keySave[pid] === "saved" ? (
                          <p className="mt-1.5 text-xs font-medium text-success">
                            Key saved.
                          </p>
                        ) : !configured[pid] && !editing[pid] ? (
                          <p className="mt-1.5 text-xs text-chrome-text">
                            Not set — paste a key to use this provider.
                          </p>
                        ) : editing[pid] ? (
                          <p className="mt-1.5 text-xs text-chrome-text">
                            Paste your key, then click away to save it.
                          </p>
                        ) : null}
                      </div>

                      {/* Model selector */}
                      <ModelPicker
                        models={provider.models}
                        selected={models[pid]}
                        onSelect={(m) => setModel(pid, m)}
                      />

                      {/* Test connection */}
                      <TestRow
                        canTest={configured[pid] && !editing[pid]}
                        state={tests[pid]}
                        onTest={() => handleTest(pid)}
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* LinkedIn connection (separate from AI provider settings) */}
        <LinkedInSection />

        {/* Save bar (AI provider + model only — keys & LinkedIn save on their own) */}
        <div className="mt-10 flex items-center gap-3 border-t border-chrome-border pt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save settings"}
          </button>
          {saved ? (
            <span className="text-sm text-accent">Settings saved.</span>
          ) : (
            <span className="text-xs text-chrome-text">
              Saves your provider and model choice. API keys save automatically
              when entered.
            </span>
          )}
          {error && <span className="text-sm text-error">{error}</span>}
        </div>
      </div>
    </div>
  );
}

// Read the OAuth-callback result from the URL (pure — no side effects, safe to
// run during render in a lazy initializer). Returns the flash message or null.
function readLinkedInFlash(): string | null {
  if (typeof window === "undefined") return null;
  const result = new URLSearchParams(window.location.search).get("linkedin");
  if (!result) return null;
  return result === "connected"
    ? "LinkedIn connected."
    : result === "cancelled"
      ? "Connection cancelled."
      : "Couldn't connect LinkedIn. Please try again.";
}

function LinkedInSection() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [busy, setBusy] = useState(false);
  // Lazy init reads the callback flag once (pure read, no side effects).
  const [flash, setFlash] = useState<string | null>(readLinkedInFlash);

  useEffect(() => {
    getLinkedInStatus().then(setStatus).catch(() => setStatus({ connected: false }));
    if (flash) {
      // Strip the ?linkedin= param now (side effect belongs in the effect, not
      // render) so a refresh doesn't re-show the toast.
      window.history.replaceState({}, "", "/settings");
      const t = setTimeout(() => setFlash(null), 4000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setBusy(true);
    try {
      await disconnectLinkedIn();
      setStatus({ connected: false });
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected;
  const expiresLabel = status?.expiresAt
    ? new Date(status.expiresAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <section className="mt-10 border-t border-chrome-border pt-8">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-chrome-text-strong">
          LinkedIn
        </h2>
        <p className="mt-0.5 text-xs text-chrome-text">
          Connect your LinkedIn account to post drafts straight to your feed.
          You post only to your own account.
        </p>
      </div>

      <div className="rounded-xl border border-chrome-border bg-chrome-light p-5">
        <div className="flex items-center gap-3.5">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--chrome)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#0A66C2" aria-hidden="true">
              <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.22.79 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            {status === null ? (
              <Skeleton className="h-4 w-40" />
            ) : connected ? (
              <>
                <p className="text-sm font-medium text-chrome-text-strong">
                  Connected{status.name ? ` as ${status.name}` : ""}
                </p>
                {expiresLabel && (
                  <p className="mt-0.5 text-xs text-chrome-text">
                    Access valid until {expiresLabel} — reconnect after that.
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-chrome-text">Not connected.</p>
            )}
          </div>

          {status !== null && (
            <div className="flex shrink-0 items-center gap-2">
              {connected ? (
                <>
                  <button
                    type="button"
                    onClick={startLinkedInConnect}
                    className="rounded-lg border border-chrome-border px-3.5 py-2 text-xs font-medium text-chrome-text-strong transition-colors hover:border-chrome-text"
                    style={{ transitionDuration: "var(--duration-fast)" }}
                  >
                    Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={busy}
                    className="rounded-lg border border-chrome-border px-3.5 py-2 text-xs font-medium text-chrome-text transition-colors hover:border-error hover:text-error disabled:opacity-40"
                    style={{ transitionDuration: "var(--duration-fast)" }}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={startLinkedInConnect}
                  className="rounded-lg bg-accent px-4 py-2 text-xs font-medium text-accent-text transition-colors hover:bg-accent-hover"
                  style={{ transitionDuration: "var(--duration-fast)" }}
                >
                  Connect LinkedIn
                </button>
              )}
            </div>
          )}
        </div>

        {flash && (
          <p className="mt-3 text-xs font-medium text-accent">{flash}</p>
        )}
      </div>
    </section>
  );
}

function TestRow({
  canTest,
  state,
  onTest,
}: {
  canTest: boolean;
  state: TestState;
  onTest: () => void;
}) {
  const testing = state.status === "testing";
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onTest}
        disabled={!canTest || testing}
        className="flex items-center gap-2 rounded-lg border border-chrome-border px-3.5 py-2 text-xs font-medium text-chrome-text-strong transition-colors hover:border-chrome-text disabled:cursor-not-allowed disabled:opacity-40"
        style={{ transitionDuration: "var(--duration-fast)" }}
      >
        {testing && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-chrome-border border-t-accent" />
        )}
        {testing ? "Testing..." : "Test connection"}
      </button>

      {state.status === "ok" && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Working{state.model ? ` — ${state.model}` : ""}
        </span>
      )}
      {state.status === "error" && (
        <span className="flex items-center gap-1.5 text-xs font-medium text-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {state.message}
        </span>
      )}
      {state.status === "idle" && !canTest && (
        <span className="text-xs text-chrome-text">Save a key to test it.</span>
      )}
    </div>
  );
}

function ModelPicker({
  models,
  selected,
  onSelect,
}: {
  models: { id: string; label: string; note?: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-chrome-text-strong">
        Model
      </label>
      <div className="flex flex-wrap gap-2">
        {models.map((model) => {
          const isSelected = selected === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelect(model.id)}
              className="rounded-lg border px-3.5 py-2 text-left transition-all"
              style={{
                transitionDuration: "var(--duration-fast)",
                transitionTimingFunction: "var(--ease-out-expo)",
                borderColor: isSelected
                  ? "var(--accent)"
                  : "var(--chrome-border)",
                backgroundColor: isSelected
                  ? "oklch(80% 0.13 86 / 0.12)"
                  : "transparent",
              }}
            >
              <span
                className="block text-sm font-medium"
                style={{
                  color: isSelected ? "var(--accent)" : "var(--chrome-text-strong)",
                }}
              >
                {model.label}
              </span>
              {model.note && (
                <span className="block text-[11px] text-chrome-text">
                  {model.note}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesktopNotice() {
  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-dashed p-4"
      style={{ borderColor: "var(--chrome-border)" }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0 text-accent"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <div className="text-xs leading-relaxed text-chrome-text">
        <p className="font-medium text-chrome-text-strong">
          Requires the Elevateo desktop app.
        </p>
        <p className="mt-1">
          This routes generation through Claude Code running on your own
          machine — no API key, no per-token cost. The web app can&apos;t reach{" "}
          <code className="font-mono text-chrome-text-strong">localhost</code>,
          so this option unlocks once you install the downloadable app.
        </p>
        <p className="mt-2 italic">Coming soon.</p>
      </div>
    </div>
  );
}
