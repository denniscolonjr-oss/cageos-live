/**
 * lib/watchman.ts — Logistics Watchman (iter-28a)
 *
 * Pure functions that scan a workspace and surface operational issues
 * a Manager+ should know about. Eight deterministic checks plus one
 * AI-powered check (run separately via /api/ai/scan-sop-contradictions).
 *
 * Issues are produced as `WatchmanIssue` objects with stable ids so
 * snooze state persists across renders. The dashboard widget filters
 * out snoozed issues before display.
 *
 * NO database, NO network, NO React. Pure data in, issues out. Easy
 * to test, easy to reason about, and runs every dashboard render
 * (typical workspaces have <500 assets/projects/checkouts so cost
 * is sub-millisecond).
 */

import type { WorkspaceData, Project, SOP } from "@/lib/hooks/workspaceTypes";
import type { Asset, Kit } from "@/lib/data";

// ──────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────

export type WatchmanSeverity = "critical" | "warning" | "info";

export type WatchmanCategory =
  | "crew_double_book"
  | "kit_conflict"
  | "checkout_very_overdue"
  | "project_no_lead"
  | "project_low_kit_count"
  | "kit_flagged_assigned"
  | "stale_sop"
  | "idle_high_value_asset"
  | "sop_contradiction"; // AI-flagged, populated by the scan route

export interface WatchmanIssue {
  /**
   * Stable id derived from the category + entity ids involved. Used to
   * persist snoozes across renders. Same logical issue MUST produce the
   * same id every time it's detected.
   *
   * Format: `<category>:<sortedEntityIds.join(',')>`
   */
  id: string;
  severity: WatchmanSeverity;
  category: WatchmanCategory;
  /** Short headline — fits on one line in the widget. */
  title: string;
  /** One-line elaboration. */
  detail: string;
  /** Optional deep link to the most relevant entity for taking action. */
  href?: string;
  /** Entity references for the issue, in display priority order. */
  entityRefs: Array<{ type: "asset" | "kit" | "project" | "checkout" | "sop"; id: string; name: string }>;
}

/** Result of running the full watchman over a workspace. */
export interface WatchmanResult {
  critical: WatchmanIssue[];
  warning: WatchmanIssue[];
  info: WatchmanIssue[];
  /** Total issues (post-snooze filter). */
  total: number;
  /** Issues that were filtered out due to active snooze. */
  snoozedCount: number;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

/**
 * Run all watchman checks against a workspace and group results by
 * severity. Snoozed issues are filtered out automatically.
 *
 * Issues are sorted within each severity bucket by deterministic id
 * for stable visual ordering across renders.
 */
export function runWatchman(workspace: WorkspaceData, nowMs: number = Date.now()): WatchmanResult {
  const allIssues: WatchmanIssue[] = [
    ...checkCrewDoubleBook(workspace, nowMs),
    ...checkKitConflicts(workspace, nowMs),
    ...checkVeryOverdueCheckouts(workspace, nowMs),
    ...checkUpcomingProjectsNoLead(workspace, nowMs),
    ...checkUpcomingProjectsLowKitCount(workspace, nowMs),
    ...checkFlaggedKitsAssigned(workspace, nowMs),
    ...checkStaleSOPs(workspace, nowMs),
    ...checkIdleHighValueAssets(workspace, nowMs),
  ];

  // Filter out snoozed issues
  const activeSnoozes = new Map<string, string>(); // issueId -> until ISO
  for (const s of workspace.watchmanSnoozes ?? []) {
    if (new Date(s.until).getTime() > nowMs) {
      activeSnoozes.set(s.issueId, s.until);
    }
  }

  const visible = allIssues.filter(i => !activeSnoozes.has(i.id));
  const snoozedCount = allIssues.length - visible.length;

  // Bucket by severity
  const critical = visible.filter(i => i.severity === "critical").sort(byId);
  const warning = visible.filter(i => i.severity === "warning").sort(byId);
  const info = visible.filter(i => i.severity === "info").sort(byId);

  return {
    critical,
    warning,
    info,
    total: visible.length,
    snoozedCount,
  };
}

function byId(a: WatchmanIssue, b: WatchmanIssue): number {
  return a.id.localeCompare(b.id);
}

// ──────────────────────────────────────────────────────────────────────
// Check 1: Crew double-booking
// ──────────────────────────────────────────────────────────────────────

/**
 * Surfaces cases where the SAME person is the lead on TWO projects whose
 * date ranges overlap. Excludes completed and cancelled projects.
 *
 * Edge cases handled:
 *   - Projects without endsAt: treated as a single-day project
 *     (start to start + 24h) for overlap purposes.
 *   - Two projects starting at the same instant but different leads:
 *     no conflict surfaced.
 *   - Same project counted twice: filtered (i.e. project A vs project A).
 */
function checkCrewDoubleBook(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const active = workspace.projects.filter(p =>
    p.status !== "completed" && p.status !== "cancelled" && p.leadInitials
  );

  const issues: WatchmanIssue[] = [];
  const seen = new Set<string>(); // dedupe by sorted pair id

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.leadInitials !== b.leadInitials) continue;

      const aStart = new Date(a.startsAt).getTime();
      const aEnd = a.endsAt ? new Date(a.endsAt).getTime() : aStart + 24 * 60 * 60 * 1000;
      const bStart = new Date(b.startsAt).getTime();
      const bEnd = b.endsAt ? new Date(b.endsAt).getTime() : bStart + 24 * 60 * 60 * 1000;

      // Overlap if neither ends before the other starts
      const overlap = aStart < bEnd && bStart < aEnd;
      if (!overlap) continue;

      // Past conflicts get demoted: if the overlap is fully in the past,
      // skip — there's nothing to act on.
      if (aEnd < nowMs && bEnd < nowMs) continue;

      const sortedIds = [a.id, b.id].sort();
      const issueId = `crew_double_book:${a.leadInitials}:${sortedIds.join(",")}`;
      if (seen.has(issueId)) continue;
      seen.add(issueId);

      const leadProfile = workspace.profiles.find(p => p.initials === a.leadInitials);
      const leadName = leadProfile?.name ?? a.leadInitials!;

      issues.push({
        id: issueId,
        severity: "critical",
        category: "crew_double_book",
        title: `${leadName} is leading two overlapping projects`,
        detail: `"${a.title}" and "${b.title}" overlap.`,
        href: `/projects/${encodeURIComponent(a.id)}`,
        entityRefs: [
          { type: "project", id: a.id, name: a.title },
          { type: "project", id: b.id, name: b.title },
        ],
      });
    }
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 2: Kit conflict (assigned to project + currently checked out elsewhere)
// ──────────────────────────────────────────────────────────────────────

/**
 * Kit is assigned to an upcoming project but currently checked out, with
 * the checkout's due-back date AFTER the project's start date. The kit
 * physically won't be back in time.
 *
 * Only considers `active` and `overdue` checkouts (returned ones are gone).
 * Only considers upcoming/active projects (completed ones don't matter).
 */
function checkKitConflicts(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const upcomingProjects = workspace.projects.filter(p =>
    p.status === "scheduled" || p.status === "active"
  );
  /*
   * Narrow to ActiveCheckout — the union with legacy CheckoutRecord doesn't
   * have the structured ISO fields we need. The migration shim ensures
   * fresh data is always ActiveCheckout-shaped; this filter is a defensive
   * type guard.
   */
  const activeCheckouts = workspace.checkouts.filter(
    (c): c is import("@/lib/hooks/workspaceTypes").ActiveCheckout =>
      "checkedOutAtISO" in c && (c.status === "active" || c.status === "overdue")
  );

  const issues: WatchmanIssue[] = [];

  for (const project of upcomingProjects) {
    const projectStartMs = new Date(project.startsAt).getTime();
    if (projectStartMs < nowMs) continue; // already started — different problem

    for (const kitId of project.assignedKits) {
      // Is this kit currently out?
      const co = activeCheckouts.find(c => c.kitIds.includes(kitId));
      if (!co) continue;

      const dueBackMs = new Date(co.dueBackISO).getTime();
      if (dueBackMs <= projectStartMs) continue; // returns in time, no conflict

      const kit = workspace.kits.find(k => k.id === kitId);
      const kitName = kit?.name ?? kitId;

      const issueId = `kit_conflict:${kitId}:${project.id}:${co.id}`;

      issues.push({
        id: issueId,
        severity: "critical",
        category: "kit_conflict",
        title: `${kitName} won't be back for "${project.title}"`,
        detail: `Currently out with ${co.user}, due back ${formatRelativeDate(co.dueBackISO, nowMs)} — after the project starts.`,
        href: `/projects/${encodeURIComponent(project.id)}`,
        entityRefs: [
          { type: "kit", id: kitId, name: kitName },
          { type: "project", id: project.id, name: project.title },
          { type: "checkout", id: co.id, name: `Checkout to ${co.user}` },
        ],
      });
    }
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 3: Very overdue checkouts (>14 days)
// ──────────────────────────────────────────────────────────────────────

/**
 * Checkouts that are more than 14 days past their due-back date.
 * The existing kiosk surfaces 1-day-overdue as a warning; this captures
 * the cases that need management escalation (lost / forgotten / disputed).
 */
function checkVeryOverdueCheckouts(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const issues: WatchmanIssue[] = [];

  // Narrow to ActiveCheckout via field presence (same defensive pattern
  // as checkKitConflicts above)
  const activeCheckouts = workspace.checkouts.filter(
    (c): c is import("@/lib/hooks/workspaceTypes").ActiveCheckout =>
      "checkedOutAtISO" in c
  );

  for (const c of activeCheckouts) {
    if (c.status !== "active" && c.status !== "overdue") continue;
    const dueBackMs = new Date(c.dueBackISO).getTime();
    const overdueByMs = nowMs - dueBackMs;
    if (overdueByMs < FOURTEEN_DAYS_MS) continue;

    const daysOverdue = Math.floor(overdueByMs / (24 * 60 * 60 * 1000));

    issues.push({
      id: `checkout_very_overdue:${c.id}`,
      severity: "critical",
      category: "checkout_very_overdue",
      title: `${c.user} — ${daysOverdue} days overdue`,
      detail: `Checked out ${formatRelativeDate(c.checkedOutAtISO, nowMs)}, due back ${formatRelativeDate(c.dueBackISO, nowMs)}.`,
      href: "/checkouts",
      entityRefs: [
        { type: "checkout", id: c.id, name: `Checkout to ${c.user}` },
      ],
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 4: Upcoming project with no lead
// ──────────────────────────────────────────────────────────────────────

/**
 * Project starts within 48 hours and has no leadInitials assigned.
 * High-friction omission — projects without a lead are at risk of
 * day-of confusion.
 */
function checkUpcomingProjectsNoLead(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const HORIZON_MS = 48 * 60 * 60 * 1000;
  const issues: WatchmanIssue[] = [];

  for (const p of workspace.projects) {
    if (p.status !== "scheduled" && p.status !== "active") continue;
    if (p.leadInitials) continue;

    const startMs = new Date(p.startsAt).getTime();
    if (startMs < nowMs) continue; // already started
    if (startMs - nowMs > HORIZON_MS) continue; // too far out

    issues.push({
      id: `project_no_lead:${p.id}`,
      severity: "warning",
      category: "project_no_lead",
      title: `"${p.title}" has no team lead`,
      detail: `Starts ${formatRelativeDate(p.startsAt, nowMs)}. Assign a lead.`,
      href: `/projects/${encodeURIComponent(p.id)}`,
      entityRefs: [
        { type: "project", id: p.id, name: p.title },
      ],
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 5: Upcoming project with low kit count vs client average
// ──────────────────────────────────────────────────────────────────────

/**
 * Compare this project's kit count to the average for past projects
 * with the SAME client. If <50% of that average AND starts within
 * 48 hours, surface as warning.
 *
 * Skip if the client has fewer than 2 historical projects (no baseline).
 * Also skip if average is 0 (client never assigned kits — no expectation).
 */
function checkUpcomingProjectsLowKitCount(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const HORIZON_MS = 48 * 60 * 60 * 1000;
  const issues: WatchmanIssue[] = [];

  for (const p of workspace.projects) {
    if (p.status !== "scheduled" && p.status !== "active") continue;
    const startMs = new Date(p.startsAt).getTime();
    if (startMs < nowMs) continue;
    if (startMs - nowMs > HORIZON_MS) continue;

    // Compute historical average for this client (excluding this project)
    const historical = workspace.projects.filter(other =>
      other.id !== p.id
      && other.client === p.client
      && (other.status === "completed" || other.status === "active")
    );
    if (historical.length < 2) continue;

    const avgKits = historical.reduce((sum, h) => sum + h.assignedKits.length, 0) / historical.length;
    if (avgKits === 0) continue;
    if (p.assignedKits.length >= avgKits * 0.5) continue;

    issues.push({
      id: `project_low_kit_count:${p.id}`,
      severity: "warning",
      category: "project_low_kit_count",
      title: `"${p.title}" looks under-equipped`,
      detail: `${p.assignedKits.length} kit${p.assignedKits.length === 1 ? "" : "s"} assigned — typical ${p.client} project has ~${avgKits.toFixed(1)}.`,
      href: `/projects/${encodeURIComponent(p.id)}`,
      entityRefs: [
        { type: "project", id: p.id, name: p.title },
      ],
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 6: Kits with open service flags assigned to upcoming projects
// ──────────────────────────────────────────────────────────────────────

/**
 * Same logic as the kiosk's blocking-flag check, but proactive: surfaces
 * the issue BEFORE the user attempts checkout. A kit assigned to a
 * project starting within 48 hours that contains a flagged asset is a
 * problem waiting to happen.
 *
 * Severity is `warning` even for critical flags here — we're not
 * blocking anything, just flagging early. The kiosk handles enforcement.
 */
function checkFlaggedKitsAssigned(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const HORIZON_MS = 48 * 60 * 60 * 1000;
  const issues: WatchmanIssue[] = [];

  // Build set of asset ids with open flags
  const flaggedAssetIds = new Set(
    workspace.assets.filter(a => a.serviceFlag).map(a => a.id)
  );
  if (flaggedAssetIds.size === 0) return issues;

  for (const p of workspace.projects) {
    if (p.status !== "scheduled" && p.status !== "active") continue;
    const startMs = new Date(p.startsAt).getTime();
    if (startMs < nowMs) continue;
    if (startMs - nowMs > HORIZON_MS) continue;

    for (const kitId of p.assignedKits) {
      const kit = workspace.kits.find(k => k.id === kitId);
      if (!kit) continue;

      const flaggedComponents = kit.componentIds.filter(cid => flaggedAssetIds.has(cid));
      if (flaggedComponents.length === 0) continue;

      const firstFlagged = workspace.assets.find(a => a.id === flaggedComponents[0]);
      if (!firstFlagged) continue;

      const flagSeverity = firstFlagged.serviceFlag!.severity;

      issues.push({
        id: `kit_flagged_assigned:${p.id}:${kit.id}`,
        severity: "warning",
        category: "kit_flagged_assigned",
        title: `"${kit.name}" has a ${flagSeverity} flag`,
        detail: `Assigned to "${p.title}" starting ${formatRelativeDate(p.startsAt, nowMs)}. Flag: ${firstFlagged.serviceFlag!.reason}`,
        href: `/kit/${encodeURIComponent(kit.barcode)}`,
        entityRefs: [
          { type: "kit", id: kit.id, name: kit.name },
          { type: "project", id: p.id, name: p.title },
          { type: "asset", id: firstFlagged.id, name: firstFlagged.name },
        ],
      });
    }
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 7: Stale SOPs (not edited in 6+ months, linked to active gear)
// ──────────────────────────────────────────────────────────────────────

/**
 * SOPs that haven't been touched in 6 months AND are currently linked
 * to at least one non-archived asset or kit. Stale procedures linked
 * to active gear are a documentation rot signal.
 *
 * Severity: info (not actionable urgently, just worth knowing).
 */
function checkStaleSOPs(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;
  const issues: WatchmanIssue[] = [];

  const activeAssetIds = new Set(
    workspace.assets.filter(a => !a.archivedAt).map(a => a.id)
  );
  const activeKitIds = new Set(
    workspace.kits.filter(k => !k.archivedAt).map(k => k.id)
  );

  for (const sop of workspace.sops) {
    const lastEditedMs = new Date(sop.lastEditedAt).getTime();
    if (nowMs - lastEditedMs < SIX_MONTHS_MS) continue;

    const hasActiveLink =
      sop.linkedAssetIds.some(id => activeAssetIds.has(id))
      || sop.linkedKitIds.some(id => activeKitIds.has(id));
    if (!hasActiveLink) continue;

    const monthsStale = Math.floor((nowMs - lastEditedMs) / (30 * 24 * 60 * 60 * 1000));

    issues.push({
      id: `stale_sop:${sop.id}`,
      severity: "info",
      category: "stale_sop",
      title: `"${sop.title}" hasn't been updated in ${monthsStale} months`,
      detail: `Linked to active gear. Consider reviewing.`,
      href: `/sops/${encodeURIComponent(sop.id)}`,
      entityRefs: [
        { type: "sop", id: sop.id, name: sop.title },
      ],
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Check 8: Idle high-value assets (cost ≥ $1K, no checkout in 90+ days)
// ──────────────────────────────────────────────────────────────────────

/**
 * Assets with cost ≥ $1,000 that haven't been touched (lastUpdated)
 * in 90+ days. Heuristic — possibly misplaced, possibly under-utilized,
 * possibly forgotten in a closet.
 *
 * Severity: info. Not urgent. Surfaced so the workspace owner can
 * audit periodically. Cost gating prevents flooding the widget with
 * every cable that's been sitting idle.
 */
function checkIdleHighValueAssets(workspace: WorkspaceData, nowMs: number): WatchmanIssue[] {
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const COST_THRESHOLD = 1000;
  const issues: WatchmanIssue[] = [];

  for (const a of workspace.assets) {
    if (a.archivedAt) continue;
    if (a.lifecycle !== "active") continue;
    if (!a.cost || a.cost < COST_THRESHOLD) continue;
    if (!a.lastUpdated) continue;

    const lastUpdatedMs = new Date(a.lastUpdated).getTime();
    if (nowMs - lastUpdatedMs < NINETY_DAYS_MS) continue;

    const daysIdle = Math.floor((nowMs - lastUpdatedMs) / (24 * 60 * 60 * 1000));

    issues.push({
      id: `idle_high_value_asset:${a.id}`,
      severity: "info",
      category: "idle_high_value_asset",
      title: `"${a.name}" hasn't moved in ${daysIdle} days`,
      detail: `$${a.cost.toLocaleString()} asset, last touched ${formatRelativeDate(a.lastUpdated, nowMs)}.`,
      href: `/asset/${encodeURIComponent(a.barcode)}`,
      entityRefs: [
        { type: "asset", id: a.id, name: a.name },
      ],
    });
  }

  return issues;
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const diffMs = then - nowMs;
  const absDays = Math.abs(diffMs) / (24 * 60 * 60 * 1000);

  if (absDays < 1) {
    const hours = Math.round(Math.abs(diffMs) / (60 * 60 * 1000));
    if (diffMs >= 0) return `in ${hours}h`;
    return `${hours}h ago`;
  }
  const days = Math.round(absDays);
  if (diffMs >= 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Suppress unused-type warnings if some checks evolve to use them later
type _AssertTypes = Asset | Kit | Project | SOP;
