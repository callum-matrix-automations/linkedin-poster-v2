"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLinkedInStatus } from "@/lib/linkedin-client";
import {
  getTimezones,
  detectTimezone,
  zonedTimeToUtcMs,
  formatInZone,
} from "@/lib/timezone";

/**
 * Default the date/time inputs to an existing schedule, or ~1 hour from now,
 * expressed in the user's detected timezone. Pure helper for lazy init.
 */
function seedDateTime(initialMs: number | null): { date: string; time: string } {
  const seed = initialMs ? new Date(initialMs) : new Date(Date.now() + 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: detectTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(seed);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  return {
    date: `${m.year}-${m.month}-${m.day}`,
    time: `${m.hour === "24" ? "00" : m.hour}:${m.minute}`,
  };
}

/**
 * Schedule-a-post dialog. The user picks a date, time, and timezone; we convert
 * to a UTC epoch on submit (the server only stores UTC). Before scheduling we
 * check the LinkedIn token's expiry — if the chosen time is after it expires,
 * we block and prompt a reconnect (we can't refresh tokens, so the post would
 * fail at fire time).
 */
export function ScheduleDialog({
  initialMs,
  onClose,
  onSchedule,
}: {
  /** Existing scheduled time (epoch ms) when rescheduling, else null. */
  initialMs: number | null;
  onClose: () => void;
  onSchedule: (utcMs: number) => Promise<void>;
}) {
  const router = useRouter();
  const timezones = getTimezones();
  const [tz, setTz] = useState(detectTimezone());
  // Seed date/time once via lazy initializers: existing schedule or ~1 hour out.
  const [date, setDate] = useState(() => seedDateTime(initialMs).date); // yyyy-mm-dd
  const [time, setTime] = useState(() => seedDateTime(initialMs).time); // HH:mm
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Capture "now" once at mount so render stays pure (the dialog is short-lived).
  const [nowMs] = useState(() => Date.now());

  // Fetch the LinkedIn connection + token expiry for the pre-check.
  useEffect(() => {
    getLinkedInStatus()
      .then((s) => {
        setConnected(s.connected);
        setTokenExpiresAt(s.expiresAt ? new Date(s.expiresAt).getTime() : null);
      })
      .catch(() => setConnected(false));
  }, []);

  // Compute the chosen UTC instant live for validation/preview.
  const chosenUtcMs = (() => {
    if (!date || !time) return null;
    const [y, mo, d] = date.split("-").map(Number);
    const [h, mi] = time.split(":").map(Number);
    if (!y || !mo || !d || Number.isNaN(h) || Number.isNaN(mi)) return null;
    return zonedTimeToUtcMs(y, mo, d, h, mi, tz);
  })();

  const inPast = chosenUtcMs !== null && chosenUtcMs <= nowMs + 60_000;
  const afterExpiry =
    chosenUtcMs !== null && tokenExpiresAt !== null && chosenUtcMs >= tokenExpiresAt;

  async function handleSubmit() {
    if (submitting || chosenUtcMs === null) return;
    setError(null);
    if (inPast) {
      setError("Pick a time at least a minute in the future.");
      return;
    }
    if (afterExpiry) {
      setError(
        "Your LinkedIn connection will have expired by then. Reconnect it now so this post can publish.",
      );
      return;
    }
    setSubmitting(true);
    try {
      await onSchedule(chosenUtcMs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
      setSubmitting(false);
    }
  }

  const inputCls =
    "rounded-lg border border-chrome-border bg-chrome px-3 py-2 text-sm text-chrome-text-strong outline-none transition-colors focus:border-accent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-chrome-border bg-chrome-light shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "fadeIn var(--duration-normal) var(--ease-out-expo)" }}
      >
        <div className="flex items-center gap-2.5 border-b border-chrome-border px-5 py-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <h2 className="flex-1 text-base font-semibold text-chrome-text-strong">
            Schedule post
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-chrome-text transition-colors hover:text-chrome-text-strong"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4">
          {connected === false ? (
            <div className="rounded-lg border border-chrome-border bg-chrome p-4 text-center">
              <p className="mb-3 text-sm text-chrome-text">
                Connect LinkedIn before scheduling a post.
              </p>
              <button
                type="button"
                onClick={() => router.push("/settings")}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-colors hover:bg-accent-hover"
              >
                Go to Settings
              </button>
            </div>
          ) : (
            <>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-xs font-medium text-chrome-text-strong">Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-chrome-text-strong">Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <label className="text-xs font-medium text-chrome-text-strong">Timezone</label>
                <select value={tz} onChange={(e) => setTz(e.target.value)} className={inputCls}>
                  {timezones.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              {chosenUtcMs !== null && !inPast && (
                <p className="mt-3 text-xs text-chrome-text">
                  Publishes around{" "}
                  <span className="font-medium text-chrome-text-strong">
                    {formatInZone(chosenUtcMs, tz)}
                  </span>
                  . Posts fire within ~5 minutes of the scheduled time.
                </p>
              )}

              {afterExpiry && !error && (
                <p className="mt-3 text-xs text-error">
                  Your LinkedIn connection expires before this time — reconnect it
                  in Settings first.
                </p>
              )}
              {error && <p className="mt-3 text-xs text-error">{error}</p>}
            </>
          )}
        </div>

        {connected !== false && (
          <div className="flex justify-end gap-2 border-t border-chrome-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-chrome-border px-4 py-2 text-sm font-medium text-chrome-text transition-colors hover:border-chrome-text hover:text-chrome-text-strong"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || chosenUtcMs === null || inPast || afterExpiry}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-text transition-all hover:bg-accent-hover disabled:opacity-40"
            >
              {submitting && (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-accent-text/30 border-t-accent-text" />
              )}
              {submitting ? "Scheduling..." : initialMs ? "Reschedule" : "Schedule"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
