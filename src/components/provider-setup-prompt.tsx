"use client";

import { useRouter } from "next/navigation";

/**
 * Shown when an AI action fails because the user hasn't configured a BYOK
 * provider yet (API responds with code: "setup_required"). Offers a direct
 * route to Settings instead of a useless "Retry".
 */
export function ProviderSetupPrompt({
  message,
  className = "",
}: {
  message: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div
      className={`flex flex-col items-center rounded-lg border border-chrome-border bg-chrome-light px-6 py-10 text-center ${className}`}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-accent"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>
      <p className="mb-1 text-sm font-medium text-chrome-text-strong">
        Set up an AI provider first
      </p>
      <p className="mb-4 max-w-md text-sm text-chrome-text">{message}</p>
      <button
        type="button"
        onClick={() => router.push("/settings")}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
        style={{ transitionDuration: "var(--duration-fast)" }}
      >
        Go to Settings
      </button>
    </div>
  );
}
