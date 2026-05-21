/**
 * lib/auditEngine.ts — Asset audit + completeness scoring (iter-28d).
 *
 * Pure functions. Given a workspace, compute:
 *   1. Per-asset audit rows: current values + last-used info + drift
 *      analysis + completeness percentage vs CSV-import baseline
 *   2. Workspace-wide score: aggregate completeness across all
 *      auditable assets (those with a CSV-import baseline)
 *   3. Drift summary: list of fields that diverged across the workspace
 *
 * Scoring model (locked iter-28d):
 *   - Only assets with csvBaseline contribute to the score
 *   - Each scored field counts equally
 *   - Field excluded from scoring if baseline value is empty (no truth
 *     to compare against)
 *   - Score per asset = (matched fields / non-empty baseline fields) * 100
 *   - Workspace score = sum(matched) / sum(non-empty baseline fields)
 *     across all auditable assets (NOT a mean of per-asset percentages —
 *     that would weight a 1-field asset the same as a 9-field asset)
 *
 * Scored fields: name, category, make, model, location, serialNumber,
 *   cost, eolDate. Notes/photo/serviceFlag/status/lastUser/lastUpdated
 *   are excluded (they legitimately change over time).
 */

import type { WorkspaceData, ActiveCheckout } from "@/lib/hooks/workspaceTypes";
import type { Asset, AssetCSVBaseline } from "@/lib/data";

// Fields included in the score. Order is the display order in exports.
const SCORED_FIELDS = [
  "name", "category", "make", "model", "location",
  "serialNumber", "cost", "eolDate",
] as const;
type ScoredField = typeof SCORED_FIELDS[number];

export interface AssetAuditRow {
  /** Asset id for reference */
  assetId: string;
  /** Asset name (current — for display) */
  name: string;
  /** Asset barcode (current) */
  barcode: string;
  /** Asset category (current) */
  category: string;
  /** Current location */
  location: string;
  /** Status from data.ts: "in" | "out" | "flagged" */
  status: string;
  /** Lifecycle: "active" | "retired" | "lost" | "in_repair" */
  lifecycle: string;
  /** When was this asset last touched (lastUpdated ISO) */
  lastUsed: string | null;
  /** Initials of last user (from checkout history) */
  lastUsedBy: string | null;
  /** Service flag summary if present */
  flagSummary: string | null;
  /**
   * Completeness percentage (0-100) vs CSV-import baseline.
   * `null` if no baseline exists (manual-add asset).
   */
  score: number | null;
  /** Field-by-field drift list. Empty if no baseline or no drift. */
  drift: AssetDrift[];
  /** True if this asset has no baseline (manual-add, no CSV import). */
  noBaseline: boolean;
  /** True if archived. Archived assets included in export but excluded from workspace score. */
  archived: boolean;
}

export interface AssetDrift {
  field: ScoredField;
  baselineValue: string;
  currentValue: string;
}

export interface WorkspaceAudit {
  /** Per-asset rows. Includes ALL assets (archived + manual + CSV-imported). */
  rows: AssetAuditRow[];
  /**
   * Per-kit rows (iter-28d-fix). One row per kit, sorted worst-first
   * by kit score. Kit score is presence/expected — if a 5-component
   * kit has 5 components present, it's 100%; missing 1 = 80%; etc.
   * Drift in individual component fields belongs in the asset score,
   * not the kit score.
   */
  kits: KitAuditRow[];
  /**
   * Workspace-wide completeness score (0-100).
   * Computed from auditable assets only (active + has baseline).
   * Null if no auditable assets exist.
   */
  workspaceScore: number | null;
  /** Total assets in the workspace (any status). */
  totalAssets: number;
  /** Assets contributing to the workspace score. */
  auditableAssets: number;
  /** Assets excluded because they have no baseline. */
  noBaselineAssets: number;
  /** Assets excluded because they're archived. */
  archivedAssets: number;
  /** Assets with at least one drifted field. */
  driftedAssets: number;
  /** Asset count with active flags. */
  flaggedAssets: number;
  /** Total kits in the workspace (excludes archived). */
  totalKits: number;
  /** Kits at 100% (all expected components present). */
  completeKits: number;
  /** Kits missing at least one component. */
  incompleteKits: number;
  /** When this audit was generated (ISO). */
  generatedAt: string;
}

/**
 * Per-kit audit row (iter-28d-fix). Kit score is component presence:
 * present components ÷ expected components × 100. A kit definition lists
 * componentIds; a component is "missing" if its asset has been archived
 * (or no longer exists). Out checkouts don't count as missing — gear
 * out in the field is still part of the kit.
 */
export interface KitAuditRow {
  kitId: string;
  name: string;
  barcode: string;
  /** Kit's storage location, if set. */
  location: string;
  /** Expected component count from kit definition. */
  expectedCount: number;
  /** Actually-present component count (non-archived, asset still exists). */
  presentCount: number;
  /** Missing components — archived or deleted since being added to kit. */
  missing: Array<{ assetId: string; name: string; barcode: string; reason: "archived" | "deleted" }>;
  /** Components currently checked out (still part of the kit, just away). */
  outCount: number;
  /** Kit-level score: presentCount / expectedCount * 100. 100% if expectedCount=0. */
  score: number;
  /** Component asset ids for cross-referencing with the assets section. */
  componentAssetIds: string[];
  /** True if this kit is archived. */
  archived: boolean;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export function runAudit(workspace: WorkspaceData, nowMs: number = Date.now()): WorkspaceAudit {
  const rows = workspace.assets.map(a => buildRow(a, workspace, nowMs));

  // Workspace-wide score: sum across auditable assets only
  // (active, has baseline, not archived)
  let totalMatched = 0;
  let totalScorable = 0;
  let auditableCount = 0;
  for (const row of rows) {
    if (row.archived) continue;
    if (row.noBaseline) continue;
    auditableCount++;
    const asset = workspace.assets.find(a => a.id === row.assetId);
    if (!asset || !asset.csvBaseline) continue;
    const { matched, scorable } = countFieldMatches(asset, asset.csvBaseline);
    totalMatched += matched;
    totalScorable += scorable;
  }
  const workspaceScore = totalScorable > 0
    ? Math.round((totalMatched / totalScorable) * 1000) / 10
    : null;

  // Kits section (iter-28d-fix). One row per kit, sorted worst-first.
  const kitRows = workspace.kits.map(k => buildKitRow(k, workspace));
  const completeKits = kitRows.filter(k => !k.archived && k.score === 100).length;
  const incompleteKits = kitRows.filter(k => !k.archived && k.score < 100).length;

  return {
    rows,
    kits: kitRows,
    workspaceScore,
    totalAssets: rows.length,
    auditableAssets: auditableCount,
    noBaselineAssets: rows.filter(r => r.noBaseline && !r.archived).length,
    archivedAssets: rows.filter(r => r.archived).length,
    driftedAssets: rows.filter(r => r.drift.length > 0).length,
    flaggedAssets: rows.filter(r => r.flagSummary !== null).length,
    totalKits: kitRows.filter(k => !k.archived).length,
    completeKits,
    incompleteKits,
    generatedAt: new Date(nowMs).toISOString(),
  };
}

// ──────────────────────────────────────────────────────────────────────
// Per-kit row construction (iter-28d-fix)
// ──────────────────────────────────────────────────────────────────────

function buildKitRow(kit: import("@/lib/data").Kit, workspace: WorkspaceData): KitAuditRow {
  const assetById = new Map(workspace.assets.map(a => [a.id, a]));

  const missing: KitAuditRow["missing"] = [];
  let presentCount = 0;
  let outCount = 0;

  for (const componentId of kit.componentIds) {
    const asset = assetById.get(componentId);
    if (!asset) {
      // Component was deleted from the workspace entirely
      missing.push({
        assetId: componentId,
        name: "(deleted asset)",
        barcode: componentId,
        reason: "deleted",
      });
      continue;
    }
    if (asset.archivedAt) {
      missing.push({
        assetId: asset.id,
        name: asset.name,
        barcode: asset.barcode,
        reason: "archived",
      });
      continue;
    }
    presentCount++;
    if (asset.status === "out") outCount++;
  }

  const expectedCount = kit.componentIds.length;
  // Empty-kit definition gets 100% — there's nothing to be missing.
  const score = expectedCount === 0
    ? 100
    : Math.round((presentCount / expectedCount) * 1000) / 10;

  return {
    kitId: kit.id,
    name: kit.name,
    barcode: kit.barcode,
    location: kit.location ?? "",
    expectedCount,
    presentCount,
    missing,
    outCount,
    score,
    componentAssetIds: kit.componentIds,
    archived: !!kit.archivedAt,
  };
}

// ──────────────────────────────────────────────────────────────────────
// Per-asset row construction
// ──────────────────────────────────────────────────────────────────────

function buildRow(asset: Asset, workspace: WorkspaceData, _nowMs: number): AssetAuditRow {
  const drift = asset.csvBaseline ? computeDrift(asset, asset.csvBaseline) : [];
  const score = asset.csvBaseline ? computeScore(asset, asset.csvBaseline) : null;

  const lastUsedBy = findLastUserInitials(asset.id, workspace);

  const flagSummary = asset.serviceFlag
    ? `${asset.serviceFlag.severity}: ${asset.serviceFlag.reason}`
    : null;

  return {
    assetId: asset.id,
    name: asset.name,
    barcode: asset.barcode,
    category: asset.category,
    location: asset.location,
    status: asset.status,
    lifecycle: asset.lifecycle,
    lastUsed: asset.lastUpdated,
    lastUsedBy,
    flagSummary,
    score,
    drift,
    noBaseline: !asset.csvBaseline,
    archived: !!asset.archivedAt,
  };
}

/**
 * Find the initials of the user who last checked out this asset.
 *
 * Strategy: scan all checkouts (active + historical) for ones whose
 * kitIds contain a kit that contains this asset. Most recent wins.
 *
 * If the asset has never been part of a checked-out kit, returns null
 * (asset.lastUser is also null in that case).
 *
 * Note: this is O(checkouts × kits) per asset. For workspaces under
 * ~1000 assets and a few hundred checkouts, it's still <100ms total.
 * If we grow past that, build an index once before calling buildRow
 * for each asset.
 */
function findLastUserInitials(assetId: string, workspace: WorkspaceData): string | null {
  // Build a quick lookup: kit id → set of asset ids it contains
  let mostRecentISO: string | null = null;
  let mostRecentUser: string | null = null;

  for (const c of workspace.checkouts) {
    if (!("checkedOutAtISO" in c)) continue;
    const co = c as ActiveCheckout;
    // Does any of this checkout's kits include the asset?
    const includes = co.kitIds.some(kitId => {
      const kit = workspace.kits.find(k => k.id === kitId);
      return kit?.componentIds.includes(assetId) ?? false;
    });
    if (!includes) continue;

    if (!mostRecentISO || co.checkedOutAtISO > mostRecentISO) {
      mostRecentISO = co.checkedOutAtISO;
      // ActiveCheckout has a `user` field (display name) — but we want
      // initials for consistency with the rest of the system. Look up
      // the profile.
      const profile = workspace.profiles.find(p => p.name === co.user);
      mostRecentUser = profile?.initials ?? co.user;
    }
  }
  return mostRecentUser;
}

// ──────────────────────────────────────────────────────────────────────
// Drift + score
// ──────────────────────────────────────────────────────────────────────

function computeDrift(asset: Asset, baseline: AssetCSVBaseline): AssetDrift[] {
  const drift: AssetDrift[] = [];
  for (const field of SCORED_FIELDS) {
    const baselineValue = baselineFieldString(baseline, field);
    const currentValue = currentFieldString(asset, field);
    // Skip if baseline empty — no truth to compare against
    if (baselineValue === "") continue;
    // Skip if both are empty (rare — baseline empty path already skipped)
    if (baselineValue === currentValue) continue;
    drift.push({ field, baselineValue, currentValue });
  }
  return drift;
}

function computeScore(asset: Asset, baseline: AssetCSVBaseline): number {
  const { matched, scorable } = countFieldMatches(asset, baseline);
  if (scorable === 0) return 100; // No scorable fields = vacuously perfect
  return Math.round((matched / scorable) * 1000) / 10;
}

function countFieldMatches(asset: Asset, baseline: AssetCSVBaseline): { matched: number; scorable: number } {
  let matched = 0;
  let scorable = 0;
  for (const field of SCORED_FIELDS) {
    const b = baselineFieldString(baseline, field);
    if (b === "") continue;
    scorable++;
    if (b === currentFieldString(asset, field)) matched++;
  }
  return { matched, scorable };
}

/**
 * Normalize a baseline field to a comparison string. null/undefined → "",
 * numbers → stringified with no trailing zeros, everything else
 * trim+lowercase for case-insensitive comparison.
 *
 * Same normalization for current and baseline = symmetric comparison.
 */
function baselineFieldString(baseline: AssetCSVBaseline, field: ScoredField): string {
  switch (field) {
    case "name":         return normalize(baseline.name);
    case "category":     return normalize(baseline.category);
    case "make":         return normalize(baseline.make);
    case "model":        return normalize(baseline.model);
    case "location":     return normalize(baseline.location);
    case "serialNumber": return normalize(baseline.serialNumber);
    case "cost":         return baseline.cost === null ? "" : String(baseline.cost);
    case "eolDate":      return baseline.eolDate ?? "";
  }
}

function currentFieldString(asset: Asset, field: ScoredField): string {
  switch (field) {
    case "name":         return normalize(asset.name);
    case "category":     return normalize(asset.category);
    case "make":         return normalize(asset.make);
    case "model":        return normalize(asset.model);
    case "location":     return normalize(asset.location);
    case "serialNumber": return normalize(asset.serialNumber ?? "");
    case "cost":         return asset.cost === null ? "" : String(asset.cost);
    case "eolDate":      return asset.eolDate ?? "";
  }
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

// ──────────────────────────────────────────────────────────────────────
// CSV export
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a CSV string representing the audit. Header row + one row per
 * asset. Drift detail is collapsed to a single semicolon-separated
 * column ("field: baseline -> current; ...").
 *
 * Kits get a separate section below assets with their own header row.
 *
 * Fields are properly quoted: any value containing a comma, quote, or
 * newline gets wrapped in double quotes with internal quotes doubled.
 *
 * Note: uses ASCII hyphen everywhere instead of em-dash to avoid Excel
 * mojibake when the BOM is absent. The caller should ALSO prepend a
 * UTF-8 BOM before saving the file for full safety.
 */
export function auditToCSV(audit: WorkspaceAudit, workspaceName: string): string {
  const lines: string[] = [];

  // Metadata banner — uses ASCII hyphen, no em-dash
  lines.push(`# Audit export - ${workspaceName}`);
  lines.push(`# Generated: ${audit.generatedAt}`);
  lines.push(`# Total assets: ${audit.totalAssets}`);
  lines.push(`# Auditable (has baseline): ${audit.auditableAssets}`);
  lines.push(`# No baseline (manual-add): ${audit.noBaselineAssets}`);
  lines.push(`# Archived: ${audit.archivedAssets}`);
  lines.push(`# Drifted: ${audit.driftedAssets}`);
  lines.push(`# Flagged for service: ${audit.flaggedAssets}`);
  lines.push(`# Total kits: ${audit.totalKits}`);
  lines.push(`# Kits complete: ${audit.completeKits}`);
  lines.push(`# Kits incomplete: ${audit.incompleteKits}`);
  lines.push(`# Workspace score: ${audit.workspaceScore === null ? "N/A" : audit.workspaceScore + "%"}`);
  lines.push("");

  // ── KITS SECTION ──
  lines.push("# === KITS ===");
  const kitHeader = [
    "Kit ID", "Name", "Barcode", "Location",
    "Expected Components", "Present Components", "Components Out",
    "Score (%)", "Missing Components", "Notes",
  ];
  lines.push(kitHeader.map(csvCell).join(","));
  for (const kit of audit.kits) {
    const missingStr = kit.missing.length === 0
      ? ""
      : kit.missing.map(m => `${m.name} (${m.barcode}, ${m.reason})`).join("; ");
    const notes = kit.archived ? "Archived" : "";
    lines.push([
      kit.kitId, kit.name, kit.barcode, kit.location,
      kit.expectedCount, kit.presentCount, kit.outCount,
      kit.score, missingStr, notes,
    ].map(csvCell).join(","));
  }

  lines.push("");

  // ── ASSETS SECTION ──
  lines.push("# === ASSETS ===");
  const assetHeader = [
    "Asset ID", "Name", "Barcode", "Category", "Current Location",
    "Status", "Lifecycle", "Last Used", "Last Used By",
    "Service Flag", "Score (%)", "Drift", "Notes",
  ];
  lines.push(assetHeader.map(csvCell).join(","));

  for (const row of audit.rows) {
    const driftStr = row.drift.length === 0
      ? ""
      : row.drift
          // ASCII arrow, no em-dash
          .map(d => `${d.field}: "${d.baselineValue}" -> "${d.currentValue}"`)
          .join("; ");
    const notes = row.noBaseline
      ? "No baseline (manual-add)"
      : row.archived
        ? "Archived"
        : "";
    lines.push([
      row.assetId,
      row.name,
      row.barcode,
      row.category,
      row.location,
      row.status,
      row.lifecycle,
      row.lastUsed ?? "",
      row.lastUsedBy ?? "",
      row.flagSummary ?? "",
      row.score === null ? "N/A" : `${row.score}`,
      driftStr,
      notes,
    ].map(csvCell).join(","));
  }

  return lines.join("\n");
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote if value contains comma, quote, or newline
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
