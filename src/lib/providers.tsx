"use client";

import type { ReactNode } from "react";

export type ProviderId = "openai" | "anthropic" | "gemini" | "local-claude";

export interface ModelOption {
  id: string;
  label: string;
  note?: string;
}

export interface ProviderConfig {
  id: ProviderId;
  name: string;
  /** Short tagline shown under the provider name. */
  tagline: string;
  /** Official brand icon. */
  icon: ReactNode;
  /** Where the user gets a key (shown as a helper link). */
  keysUrl?: string;
  keyPlaceholder?: string;
  models: ModelOption[];
  /** Local proxy provider that has no API key and needs the desktop app. */
  requiresDesktopApp?: boolean;
}

// --- Official brand icons (single-color, inherit currentColor where sensible) ---

function OpenAIIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071.006l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071-.006l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
    </svg>
  );
}

function AnthropicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.765 3h-3.207l5.83 18h3.207l-5.83-18zM7.235 3L1.405 21h3.273l1.192-3.69h6.097l1.192 3.69h3.273L10.602 3H7.235zm-.42 11.55l1.992-6.17 1.993 6.17H6.815z" />
    </svg>
  );
}

function GeminiIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c.667 6.146 5.854 11.333 12 12-6.146.667-11.333 5.854-12 12-.667-6.146-5.854-11.333-12-12C6.146 11.333 11.333 6.146 12 0z" />
    </svg>
  );
}

function LocalProxyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    tagline: "ChatGPT models — GPT-5 family.",
    icon: <OpenAIIcon />,
    keysUrl: "https://platform.openai.com/api-keys",
    keyPlaceholder: "sk-proj-...",
    models: [
      { id: "gpt-5.4", label: "GPT-5.4", note: "Most capable" },
      { id: "gpt-5.4-mini", label: "GPT-5.4 mini", note: "Fast & affordable" },
      { id: "gpt-5.4-nano", label: "GPT-5.4 nano", note: "Cheapest" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    tagline: "Claude models — strongest writing.",
    icon: <AnthropicIcon />,
    keysUrl: "https://console.anthropic.com/settings/keys",
    keyPlaceholder: "sk-ant-...",
    models: [
      { id: "claude-opus-4-8", label: "Claude Opus 4.8", note: "Most capable" },
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", note: "Balanced" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", note: "Fast & affordable" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    tagline: "Gemini models — long context.",
    icon: <GeminiIcon />,
    keysUrl: "https://aistudio.google.com/app/apikey",
    keyPlaceholder: "AIza...",
    models: [
      { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", note: "Most capable" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash", note: "Latest, fast" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", note: "Fast & affordable" },
    ],
  },
  {
    id: "local-claude",
    name: "Local Claude Code",
    tagline: "Runs through your own Claude Code — no API key, no usage cost.",
    icon: <LocalProxyIcon />,
    requiresDesktopApp: true,
    models: [
      { id: "default", label: "Claude Code default", note: "Uses your CLI model" },
    ],
  },
];

export function getProvider(id: ProviderId): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
