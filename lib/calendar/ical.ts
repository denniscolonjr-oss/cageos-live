/**
 * lib/calendar/ical.ts — iCal (RFC 5545) generation
 *
 * Pure functions that turn workspace data into a string of iCal text.
 * Used by the /api/calendar route handlers; reusable from anywhere.
 *
 * Design notes:
 *   - All dates are emitted as UTC (Z-suffixed) to avoid timezone ambiguity.
 *     Calendar apps convert to the viewer's timezone on display.
 *   - VEVENT UIDs are stable per source object (project.id or checkout.id)
 *     so that calendar apps treat repeated subscriptions as UPDATES, not
 *     duplicates.
 *   - Line folding (RFC 5545 §3.1) is implemented: long lines are split at
 *     75 octets with a leading space on the continuation line.
 *   - DESCRIPTION fields with newlines are escaped per spec (\\n).
 *
 * No external libraries. The iCal spec is small enough to implement
 * directly, and pulling in a package adds maintenance burden.
 */

import type { Project, ActiveCheckout } from "@/lib/hooks/workspaceTypes";

// ──────────────────────────────────────────────────────────────────────────
// Top-level builders
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a complete iCal document for the workspace's projects.
 *
 * Projects within a recency window are included (everything from `pastDays`
 * ago through unlimited future). Default 90 days back keeps the feed
 * focused on relevant scheduling without unbounded history.
 */
export function buildProjectsICal(opts: {
  workspaceName: string;
  projects: Project[];
  pastDays?: number;  // default 90
}): string {
  const pastDays = opts.pastDays ?? 90;
  const cutoff = Date.now() - pastDays * 24 * 60 * 60 * 1000;

  const filtered = opts.projects.filter(p => {
    const endTime = p.endsAt ? new Date(p.endsAt).getTime() : new Date(p.startsAt).getTime();
    return endTime >= cutoff;
  });

  const events = filtered.map(p => buildProjectEvent(p, opts.workspaceName));

  return wrapVCalendar({
    prodId: "-//CageOS//Projects//EN",
    calName: `${opts.workspaceName} — Projects`,
    events,
  });
}

/**
 * Build a complete iCal document for the workspace's active+overdue checkouts.
 * Returned checkouts are excluded — they're historical noise on a calendar.
 */
export function buildCheckoutsICal(opts: {
  workspaceName: string;
  checkouts: ActiveCheckout[];
}): string {
  const filtered = opts.checkouts.filter(c =>
    c.status === "active" || c.status === "overdue"
  );

  const events = filtered.map(c => buildCheckoutEvent(c, opts.workspaceName));

  return wrapVCalendar({
    prodId: "-//CageOS//Checkouts//EN",
    calName: `${opts.workspaceName} — Active Checkouts`,
    events,
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Per-event builders
// ──────────────────────────────────────────────────────────────────────────

function buildProjectEvent(p: Project, workspaceName: string): string {
  const start = new Date(p.startsAt);
  const end = p.endsAt ? new Date(p.endsAt) : new Date(start.getTime() + 8 * 60 * 60 * 1000); // default 8h

  const descriptionLines = [
    `Client: ${p.client}`,
  ];
  if (p.leadInitials) descriptionLines.push(`Lead: ${p.leadInitials}`);
  if (p.assignedTeam.length > 0) descriptionLines.push(`Team: ${p.assignedTeam.join(", ")}`);
  if (p.assignedKits.length > 0) descriptionLines.push(`Kits: ${p.assignedKits.length}`);
  if (p.notes) descriptionLines.push("", p.notes);
  descriptionLines.push("", `— ${workspaceName} via CageOS`);

  const status = mapProjectStatus(p.status);

  const lines = [
    "BEGIN:VEVENT",
    `UID:project-${p.id}@cageos.app`,
    `DTSTAMP:${toICalUtc(new Date())}`,
    `DTSTART:${toICalUtc(start)}`,
    `DTEND:${toICalUtc(end)}`,
    `SUMMARY:${escapeText(p.title)}`,
    `DESCRIPTION:${escapeText(descriptionLines.join("\n"))}`,
  ];

  if (p.location) {
    lines.push(`LOCATION:${escapeText(p.location)}`);
  }
  if (status) {
    lines.push(`STATUS:${status}`);
  }

  lines.push("END:VEVENT");
  return lines.map(foldLine).join("\r\n");
}

function buildCheckoutEvent(c: ActiveCheckout, workspaceName: string): string {
  const start = new Date(c.checkedOutAtISO);
  const end = c.dueBackISO ? new Date(c.dueBackISO) : new Date(start.getTime() + 8 * 60 * 60 * 1000);

  // Defensive: legacy checkouts may still expose `shoot` instead of `project`.
  // The adapter migration normalizes this on read but we belt-and-suspenders
  // it here so a stale row doesn't break the feed.
  const projectLabel = (c as { project?: string; shoot?: string }).project
    ?? (c as { shoot?: string }).shoot
    ?? "—";

  const descriptionLines = [
    `Out with: ${c.user}`,
    `Kits: ${c.kits.join(", ")}`,
    `For: ${projectLabel}`,
  ];
  if (c.intakeCondition) {
    descriptionLines.push(`Condition at checkout: ${c.intakeCondition}`);
  }
  if (c.isGuest) {
    descriptionLines.push("(Guest user)");
  }
  descriptionLines.push("", `— ${workspaceName} via CageOS`);

  const summary = c.kits.length === 1
    ? `${c.user} has ${c.kits[0]}`
    : `${c.user} has ${c.kits.length} kits`;

  const lines = [
    "BEGIN:VEVENT",
    `UID:checkout-${c.id}@cageos.app`,
    `DTSTAMP:${toICalUtc(new Date())}`,
    `DTSTART:${toICalUtc(start)}`,
    `DTEND:${toICalUtc(end)}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(descriptionLines.join("\n"))}`,
    c.status === "overdue" ? "STATUS:TENTATIVE" : "STATUS:CONFIRMED",
    "END:VEVENT",
  ];
  return lines.map(foldLine).join("\r\n");
}

// ──────────────────────────────────────────────────────────────────────────
// Wrapper + helpers
// ──────────────────────────────────────────────────────────────────────────

function wrapVCalendar(opts: {
  prodId: string;
  calName: string;
  events: string[];
}): string {
  /*
   * X-WR-CALNAME is a non-standard but widely-supported extension that
   * controls how the subscribed calendar is named in client UIs (Apple
   * Calendar, Google Calendar, Outlook all respect it). Without it, the
   * feed shows up as the URL or a generic name.
   *
   * X-PUBLISHED-TTL hints at refresh frequency. Apple Calendar uses it;
   * Google ignores it (Google polls hourly regardless).
   */
  const header = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${opts.prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calName)}`,
    "X-PUBLISHED-TTL:PT1H",
  ].map(foldLine).join("\r\n");

  const footer = "END:VCALENDAR";

  return [header, ...opts.events, footer].join("\r\n") + "\r\n";
}

/**
 * Convert a Date to iCal UTC format: YYYYMMDDTHHmmssZ.
 */
function toICalUtc(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Escape special characters in iCal text values per RFC 5545 §3.3.11:
 *   backslash → \\
 *   newline → \n
 *   semicolon → \;
 *   comma → \,
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * RFC 5545 §3.1 line folding: lines must not exceed 75 octets. Long lines
 * are split with CRLF + a single leading space on each continuation. The
 * receiving parser unfolds by removing CRLF+space sequences.
 *
 * We measure in BYTES (UTF-8 length) not characters, since multibyte chars
 * count toward the 75-octet limit. Without this, emoji or accented chars
 * in project titles could push a line over the limit and break parsers.
 */
function foldLine(line: string): string {
  const MAX_OCTETS = 75;
  const encoder = new TextEncoder();
  const bytes = encoder.encode(line);

  if (bytes.length <= MAX_OCTETS) return line;

  // Walk through the line, chunking at MAX_OCTETS boundaries. We can't just
  // slice() because we're working in bytes but JS strings are UTF-16.
  // Convert byte chunks back to strings via TextDecoder.
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let offset = 0;
  while (offset < bytes.length) {
    // Find the largest chunk that fits in MAX_OCTETS without splitting a
    // multibyte character. We do this by repeatedly shrinking the candidate
    // chunk until decoding succeeds without a replacement character.
    let chunkLen = Math.min(MAX_OCTETS, bytes.length - offset);
    let chunk = decoder.decode(bytes.slice(offset, offset + chunkLen));
    while (chunk.includes("\uFFFD") && chunkLen > 1) {
      chunkLen--;
      chunk = decoder.decode(bytes.slice(offset, offset + chunkLen));
    }
    chunks.push(chunk);
    offset += chunkLen;
  }

  // First chunk renders as-is. Continuation chunks get CRLF + leading space.
  return chunks[0] + chunks.slice(1).map(c => "\r\n " + c).join("");
}

function mapProjectStatus(s: Project["status"]): string | null {
  switch (s) {
    case "scheduled": return "CONFIRMED";
    case "active":    return "CONFIRMED";
    case "completed": return "CONFIRMED";
    case "cancelled": return "CANCELLED";
    default: return null;
  }
}
