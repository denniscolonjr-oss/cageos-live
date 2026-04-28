/**
 * Timezone helpers for displaying shoot dates.
 *
 * All shoot timestamps are stored as ISO UTC strings. Display is per-user via
 * the `timezone` workspace preference (defaults to "auto" = browser timezone).
 */

const COMMON_TZ_OPTIONS = [
  { value: "auto", label: "Auto (browser)" },
  { value: "America/New_York", label: "Eastern (US)" },
  { value: "America/Chicago", label: "Central (US)" },
  { value: "America/Denver", label: "Mountain (US)" },
  { value: "America/Los_Angeles", label: "Pacific (US)" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Shanghai", label: "Shanghai" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
];

export function getTimezoneOptions(): { value: string; label: string }[] {
  return COMMON_TZ_OPTIONS;
}

/** Resolve "auto" to the browser's actual timezone. Anything else is passed through. */
export function resolveTimezone(pref: string): string {
  if (pref !== "auto") return pref;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Short label for displaying which TZ is in use. */
export function timezoneShortLabel(tz: string): string {
  const resolved = resolveTimezone(tz);
  try {
    const dt = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: resolved,
      timeZoneName: "short",
    }).formatToParts(dt);
    const tzPart = parts.find(p => p.type === "timeZoneName");
    return tzPart?.value ?? resolved;
  } catch {
    return resolved;
  }
}

/** Format an ISO timestamp for display. Returns "Tomorrow 9:00 AM" style label. */
export function formatShootTime(iso: string, timezone: string): string {
  if (!iso) return "";
  try {
    const tz = resolveTimezone(timezone);
    const dt = new Date(iso);
    const now = new Date();

    // Convert to the target timezone for "today/tomorrow" comparison
    const dtInTz = new Date(dt.toLocaleString("en-US", { timeZone: tz }));
    const nowInTz = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const dayDiff = Math.floor((dtInTz.setHours(0, 0, 0, 0) - nowInTz.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));

    const timePart = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    }).format(dt);

    if (dayDiff === 0) return `Today ${timePart}`;
    if (dayDiff === 1) return `Tomorrow ${timePart}`;
    if (dayDiff === -1) return `Yesterday ${timePart}`;
    if (dayDiff > 1 && dayDiff < 7) {
      const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(dt);
      return `${weekday} ${timePart}`;
    }
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      month: "short",
      day: "numeric",
    }).format(dt);
    return `${datePart} ${timePart}`;
  } catch {
    return iso;
  }
}

/** Format a range "Today 10:00 AM → 4:00 PM" with end optional */
export function formatShootRange(startISO: string, endISO: string | undefined, timezone: string): string {
  const startLabel = formatShootTime(startISO, timezone);
  if (!endISO) return startLabel;
  try {
    const tz = resolveTimezone(timezone);
    const end = new Date(endISO);
    const start = new Date(startISO);
    // If same calendar day in target tz, show only end time
    const sameDay =
      new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).format(start) ===
      new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).format(end);
    if (sameDay) {
      const endTime = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
      }).format(end);
      return `${startLabel} → ${endTime}`;
    }
    return `${startLabel} → ${formatShootTime(endISO, timezone)}`;
  } catch {
    return startLabel;
  }
}

/**
 * Convert an ISO timestamp into the "yyyy-MM-ddTHH:mm" format that
 * <input type="datetime-local"> expects, in the target timezone.
 */
export function isoToInputValue(iso: string, timezone: string): string {
  if (!iso) return "";
  try {
    const tz = resolveTimezone(timezone);
    const dt = new Date(iso);
    // Use formatToParts to get each component in the target timezone
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    const y = get("year");
    const mo = get("month");
    const d = get("day");
    let h = get("hour");
    if (h === "24") h = "00"; // some locales return 24:00 — normalize
    const mi = get("minute");
    return `${y}-${mo}-${d}T${h}:${mi}`;
  } catch {
    return "";
  }
}

/**
 * Convert an <input type="datetime-local"> value (which is naive: "2026-04-30T14:00")
 * into a real UTC ISO string, treating the naive value as wall-clock time in the
 * given timezone.
 */
export function inputValueToISO(value: string, timezone: string): string {
  if (!value) return "";
  try {
    const tz = resolveTimezone(timezone);
    // Strategy: assume the local string represents a wall-clock in `tz`. Find the
    // UTC offset of `tz` at that moment by formatting an arbitrary date there,
    // then reconstruct the UTC instant.
    const [datePart, timePart] = value.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, min] = timePart.split(":").map(Number);

    // Build candidate UTC date assuming the input was already UTC
    const utcCandidate = Date.UTC(yyyy, mm - 1, dd, hh, min, 0);

    // What does that UTC instant look like when formatted in tz? Compare to input.
    const candidateDate = new Date(utcCandidate);
    const fmtParts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(candidateDate);
    const get = (t: string) => Number(fmtParts.find(p => p.type === t)?.value ?? 0);
    const tzYear = get("year");
    const tzMonth = get("month");
    const tzDay = get("day");
    let tzHour = get("hour");
    if (tzHour === 24) tzHour = 0;
    const tzMin = get("minute");

    // diff between what tz shows and what the user typed
    const tzAsUTC = Date.UTC(tzYear, tzMonth - 1, tzDay, tzHour, tzMin, 0);
    const offset = tzAsUTC - utcCandidate; // ms tz is ahead of UTC

    return new Date(utcCandidate - offset).toISOString();
  } catch {
    return new Date(value).toISOString();
  }
}
