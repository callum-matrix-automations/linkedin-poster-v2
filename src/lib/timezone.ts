/**
 * Timezone helpers for scheduling. We let the user pick a timezone and a local
 * date/time, then convert to a UTC epoch (ms) for storage — the server only
 * ever deals in UTC.
 */

/** A short, curated list of common timezones plus the user's detected one. */
export function getTimezones(): string[] {
  const common = [
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Dubai",
    "Asia/Kolkata",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
  ];
  const detected = detectTimezone();
  // Put the detected zone first, de-duplicated.
  return [detected, ...common.filter((t) => t !== detected)];
}

export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * Given a wall-clock date+time AS SEEN IN `timeZone`, return the UTC epoch (ms).
 *
 * We compute the zone's offset at that instant by formatting a UTC guess in the
 * target zone and measuring the difference, which correctly accounts for DST.
 */
export function zonedTimeToUtcMs(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  // Start from the naive UTC interpretation of the wall-clock time.
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  // Find what that instant looks like in the target zone, and the offset.
  const offset = tzOffsetMs(asUtc, timeZone);
  // The real UTC instant is the naive UTC minus the zone offset.
  return asUtc - offset;
}

/** The offset (ms) of `timeZone` from UTC at the given instant. */
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = Number(p.value);
  }
  // What the zone shows, interpreted as if it were UTC.
  const asIfUtc = Date.UTC(
    map.year,
    (map.hour === 24 ? map.hour - 24 : 0) + map.month - 1,
    map.day,
    map.hour === 24 ? 0 : map.hour,
    map.minute,
    map.second,
  );
  return asIfUtc - utcMs;
}

/** Format a UTC epoch (ms) for display in a given timezone. */
export function formatInZone(
  utcMs: number,
  timeZone: string = detectTimezone(),
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(utcMs));
}
