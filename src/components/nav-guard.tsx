"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";

/**
 * In-app navigation guard. A page can register a `blocker` — a function that
 * returns true when leaving should be intercepted. The sidebar calls
 * `attemptNavigate(href)`; if a blocker is active, navigation is held and a
 * confirm dialog is shown instead. Confirming proceeds; cancelling stays.
 *
 * App Router has no built-in route-change interception, so this lightweight
 * context fills the gap for the cases we care about (Settings without an
 * active AI provider).
 */

interface PendingNav {
  href: string;
  message: string;
}

interface NavGuardValue {
  /** Register/replace the active blocker (or null to clear). */
  setBlocker: (blocker: (() => string | null) | null) => void;
  /** Called by nav controls; returns true if navigation proceeded immediately. */
  attemptNavigate: (href: string) => boolean;
}

const NavGuardContext = createContext<NavGuardValue | null>(null);

export function NavGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const blockerRef = useRef<(() => string | null) | null>(null);
  const [pending, setPending] = useState<PendingNav | null>(null);

  const setBlocker = useCallback((blocker: (() => string | null) | null) => {
    blockerRef.current = blocker;
  }, []);

  const attemptNavigate = useCallback(
    (href: string) => {
      const message = blockerRef.current?.() ?? null;
      if (message) {
        setPending({ href, message });
        return false;
      }
      router.push(href);
      return true;
    },
    [router],
  );

  function confirmLeave() {
    if (!pending) return;
    const href = pending.href;
    blockerRef.current = null; // user acknowledged; don't re-prompt
    setPending(null);
    router.push(href);
  }

  return (
    <NavGuardContext.Provider value={{ setBlocker, attemptNavigate }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-chrome-border bg-chrome-light p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "fadeIn var(--duration-normal) var(--ease-out-expo)" }}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden="true">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="mb-1.5 text-base font-semibold text-chrome-text-strong">
              Leave without choosing a provider?
            </h2>
            <p className="mb-5 text-sm text-chrome-text">{pending.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPending(null)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                Stay and choose
              </button>
              <button
                type="button"
                onClick={confirmLeave}
                className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
                style={{ transitionDuration: "var(--duration-fast)" }}
              >
                Leave anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </NavGuardContext.Provider>
  );
}

export function useNavGuard(): NavGuardValue {
  const ctx = useContext(NavGuardContext);
  if (!ctx) throw new Error("useNavGuard must be used within NavGuardProvider");
  return ctx;
}
