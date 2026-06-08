"use client";

import { useState } from "react";
import { PROVIDERS, type ProviderId } from "@/lib/providers";

export default function SettingsPage() {
  // Which provider is the active one used for generation.
  const [activeProvider, setActiveProvider] = useState<ProviderId>("openai");
  // Per-provider API keys (BYOK). UI-only for now — not persisted yet.
  const [keys, setKeys] = useState<Record<ProviderId, string>>({
    openai: "",
    anthropic: "",
    gemini: "",
    "local-claude": "",
  });
  // Per-provider selected model.
  const [models, setModels] = useState<Record<ProviderId, string>>({
    openai: "gpt-5.4-mini",
    anthropic: "claude-sonnet-4-6",
    gemini: "gemini-3-flash",
    "local-claude": "default",
  });
  const [revealed, setRevealed] = useState<Record<ProviderId, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
    "local-claude": false,
  });

  function setKey(id: ProviderId, value: string) {
    setKeys((prev) => ({ ...prev, [id]: value }));
  }
  function setModel(id: ProviderId, value: string) {
    setModels((prev) => ({ ...prev, [id]: value }));
  }
  function toggleReveal(id: ProviderId) {
    setRevealed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
            const isActive = activeProvider === provider.id;
            const hasKey =
              provider.requiresDesktopApp || keys[provider.id].trim().length > 0;

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
                  <button
                    type="button"
                    onClick={() => setActiveProvider(provider.id)}
                    disabled={isActive || (!hasKey && !provider.requiresDesktopApp)}
                    className="shrink-0 rounded-lg border px-3.5 py-2 text-xs font-medium transition-all disabled:cursor-not-allowed"
                    style={{
                      transitionDuration: "var(--duration-fast)",
                      transitionTimingFunction: "var(--ease-out-expo)",
                      borderColor: isActive
                        ? "var(--accent)"
                        : "var(--chrome-border)",
                      color: isActive
                        ? "var(--accent)"
                        : !hasKey && !provider.requiresDesktopApp
                          ? "oklch(45% 0.01 80)"
                          : "var(--chrome-text-strong)",
                      backgroundColor: isActive
                        ? "oklch(80% 0.13 86 / 0.12)"
                        : "transparent",
                    }}
                  >
                    {isActive ? "In use" : "Use this"}
                  </button>
                </div>

                {/* Body */}
                <div className="px-5 pb-5 pt-4">
                  {provider.requiresDesktopApp ? (
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
                        <div className="relative">
                          <input
                            type={revealed[provider.id] ? "text" : "password"}
                            value={keys[provider.id]}
                            onChange={(e) => setKey(provider.id, e.target.value)}
                            placeholder={provider.keyPlaceholder}
                            autoComplete="off"
                            spellCheck={false}
                            className="w-full rounded-lg border border-chrome-border bg-chrome px-4 py-3 pr-20 font-mono text-sm text-chrome-text-strong outline-none transition-colors placeholder:text-chrome-text focus:border-accent"
                            style={{ transitionDuration: "var(--duration-fast)" }}
                          />
                          {keys[provider.id].length > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleReveal(provider.id)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-chrome-text transition-colors hover:text-chrome-text-strong"
                              style={{ transitionDuration: "var(--duration-fast)" }}
                            >
                              {revealed[provider.id] ? "Hide" : "Show"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Model selector */}
                      <ModelPicker
                        providerId={provider.id}
                        models={provider.models}
                        selected={models[provider.id]}
                        onSelect={(m) => setModel(provider.id, m)}
                      />
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        {/* Save bar */}
        <div className="mt-10 flex items-center gap-3 border-t border-chrome-border pt-6">
          <button
            type="button"
            disabled
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
            style={{
              transitionDuration: "var(--duration-fast)",
              transitionTimingFunction: "var(--ease-out-expo)",
            }}
          >
            Save settings
          </button>
          <span className="text-xs text-chrome-text">
            Persistence comes next — this view is the interface only.
          </span>
        </div>
      </div>
    </div>
  );
}

function ModelPicker({
  models,
  selected,
  onSelect,
}: {
  providerId: ProviderId;
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
