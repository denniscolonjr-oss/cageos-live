/**
 * Workspace types — the shape of an entire workspace's data.
 *
 * Extracted into its own module so storage adapters can depend on the types
 * without pulling in React or the hook itself. This keeps adapter code
 * importable from non-React contexts (e.g., a Node.js sync script).
 */

import type {
  Asset,
  Kit,
  CheckoutRecord,
  Alert,
  UserProfile,
  Note,
} from "@/lib/data";

export type WorkspaceMode = "user" | "demo" | "unset";

/**
 * Project — formerly "Shoot" (renamed iter-23 for generic positioning).
 *
 * A scheduled engagement that gear and team members can be assigned to.
 * Cross-industry name: AV calls these "shoots", construction calls them
 * "jobs", theater calls them "productions", landscaping calls them "jobs"
 * or "service days". All map to this single Project type.
 *
 * The data shape is unchanged from the old Shoot type. Migration is at
 * the workspace-JSON-key level: `projects: [...]` is the new key, but the
 * storage adapter's migrate() also accepts legacy `shoots: [...]` data
 * so existing workspaces don't lose their schedule on upgrade.
 */
export interface Project {
  id: string;
  title: string;
  client: string;
  /** ISO timestamp string (UTC) — "2026-04-30T14:00:00.000Z" */
  startsAt: string;
  /** Optional ISO timestamp (UTC) */
  endsAt?: string;
  location?: string;
  leadInitials?: string;
  assignedTeam: string[];
  assignedKits: string[];
  notes?: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
}

/**
 * Deprecated alias. Some files still import `Shoot` — leaving this here lets
 * the rename roll out file-by-file without breaking the build at any point.
 * Remove once every `import type { Shoot }` is updated to `Project`.
 *
 * @deprecated use Project instead
 */
export type Shoot = Project;

/**
 * Active checkout — extends CheckoutRecord with structured fields the UI needs
 * for live updates (without breaking the existing CheckoutRecord type used in demo data).
 */
export interface ActiveCheckout {
  id: string;
  /** ISO timestamp when checkout occurred */
  checkedOutAtISO: string;
  /** Human label shown in feed: "9:14 AM" */
  checkedOutAtLabel: string;
  /** ISO timestamp due back (six hours after checkout by default) */
  dueBackISO: string;
  /** Human label */
  dueBackLabel: string;
  user: string;
  initials: string;
  color: string;
  /**
   * Project (formerly "shoot") this checkout is for. Display label of the
   * project — see also projectId for the linking. Renamed iter-23 from
   * `shoot` to `project` so the data model matches the new generic
   * terminology. Legacy ActiveCheckouts in storage with `shoot` keys are
   * migrated by the adapter on read.
   */
  project: string;
  projectId?: string;
  kits: string[]; // display labels — "Venice Cinema Kit"
  kitIds: string[]; // for state reconciliation
  assetIds: string[]; // assets that were also checked out, including kit components
  status: "active" | "overdue" | "returned";
  isGuest?: boolean;
  /** ISO timestamp when returned, if returned */
  returnedAtISO?: string;
  /**
   * Photos captured at checkout time (kiosk step 4 condition check).
   * Supabase Storage public URLs. Optional — users can skip the photo
   * step entirely. Two slots: photo1, photo2. iter-20a.
   */
  intakePhotoUrls?: string[];
  /** Self-reported condition at checkout. Same scale used at return. */
  intakeCondition?: "excellent" | "good" | "fair" | "damaged" | "broken";
  /** Photos captured at return / check-in time. iter-20a. */
  returnPhotoUrls?: string[];
  /** Self-reported condition at return. */
  returnCondition?: "excellent" | "good" | "fair" | "damaged" | "broken";
}

export type AuditCategory =
  | "checkout"
  | "return"
  | "asset_added"
  | "asset_archived"
  | "asset_restored"
  | "kit_added"
  | "kit_archived"
  | "kit_restored"
  | "kit_composition_changed"
  | "team_added"
  // iter-23 rename: shoot_* → project_*. The shoot_* values stay in the
  // union so historical audit entries (locked decision: don't rewrite
  // history) keep type-checking. New writes use project_* exclusively.
  | "shoot_scheduled"
  | "shoot_updated"
  | "shoot_status_changed"
  | "shoot_deleted"
  | "project_scheduled"
  | "project_updated"
  | "project_status_changed"
  | "project_deleted"
  | "manager_mode"
  | "flag_opened"
  | "flag_status_changed"
  | "flag_note_added"
  | "flag_resolved"
  | "note_added"
  // SOPs (iter-27a) — Standard Operating Procedures
  | "sop_created"
  | "sop_updated"
  | "sop_reverted"
  | "sop_deleted"
  | "sop_attachment_added"
  | "sop_attachment_removed"
  | "sop_linked"
  | "sop_unlinked"
  | "watchman_snoozed"
  | "ai_scan_run";

/** Result returned by deleteAsset / deleteKit to communicate what happened. */
export type DeleteResult =
  | { kind: "blocked"; reason: string }
  | { kind: "deleted"; undo: () => void }
  | { kind: "archived"; undo: () => void };

export type FlagStatus = "open" | "in_repair" | "resolved";
export type FlagSeverity = "critical" | "warning";

export interface RepairNote {
  id: string;
  /** ISO UTC timestamp */
  timestamp: string;
  author: string;
  /** Free-form text — UI enforces 20-word minimum */
  body: string;
  actionType: "diagnostic" | "sent_to_vendor" | "received_back" | "tested" | "other";
  /** Optional photos attached to this note. Supabase Storage URLs. */
  photoUrls?: string[];
}

export interface ServiceFlag {
  id: string;
  assetId: string;
  severity: FlagSeverity;
  /** Initial reason the asset was flagged. UI enforces 20-word minimum. */
  reason: string;
  flaggedBy: string;
  /** ISO UTC */
  flaggedAtISO: string;

  status: FlagStatus;

  repairNotes: RepairNote[];

  /** Optional photos attached to the initial flag. Supabase Storage URLs. */
  photoUrls?: string[];

  /** ISO UTC */
  resolvedAtISO?: string;
  resolvedBy?: string;
  /** UI enforces 20-word minimum at resolution time */
  resolutionSummary?: string;
}

export interface AuditEvent {
  id: string;
  /** ISO UTC timestamp */
  timestamp: string;
  category: AuditCategory;
  /** Who performed it. For v1 with no auth, this is "—" or the actor name (e.g., kiosk user) */
  actor: string;
  /** Short summary, e.g. "Checked out Venice Cinema Kit" */
  summary: string;
  /** Optional secondary line, e.g. "for DOI Interview B-Roll" */
  detail?: string;
}

/**
 * SOP — Standard Operating Procedure (iter-27a).
 *
 * Institutional knowledge captured as markdown documents. Each SOP is
 * authored by a workspace member and visible to everyone in the workspace.
 * SOPs can be categorized using the existing asset-category vocabulary
 * (multi-select — an SOP can belong to several categories).
 *
 * Version history: every save creates a new SOPVersion entry. Capped at
 * the last 50 versions per SOP to bound growth. Revert from an old version
 * by writing it as the new current body — that creates yet another version
 * in the history, preserving the audit trail.
 *
 * iter-27b: attached files (markdown body + optional attachments coexist).
 * An SOP can have authored markdown content AND a list of supporting
 * uploaded files — e.g. authored setup instructions plus the manufacturer's
 * PDF manual. Attachments are NOT versioned with body edits; they're a
 * separate dimension since removing an attachment is a deliberate
 * file-delete action, not an edit to the words.
 */
export interface SOP {
  id: string;
  title: string;
  /** Markdown body. Rendered to HTML on display via the same renderer used in comments. */
  body: string;
  /**
   * Categories this SOP applies to. Multi-select. Values come from the
   * union of (a) unique asset categories and (b) categories already in
   * use by other SOPs. Empty array = uncategorized.
   */
  categories: string[];
  /** Initials of the original creator. */
  createdBy: string;
  /** ISO UTC. */
  createdAt: string;
  /** Initials of the last person to edit. May equal createdBy. */
  lastEditedBy: string;
  /** ISO UTC. */
  lastEditedAt: string;
  /**
   * Version history (newest last). Each save pushes a snapshot before
   * applying the new content. Capped at last 50 entries.
   */
  versions: SOPVersion[];
  /**
   * Uploaded file attachments (iter-27b). Independent of body/version
   * history — adding or removing attachments doesn't create a version
   * snapshot. Files live in Supabase Storage under the `sop-files` bucket.
   */
  attachments: SOPAttachment[];
  /**
   * Entities this SOP is explicitly linked to (iter-27c). Granular,
   * intentional linking — SOPs do NOT auto-surface via category match.
   * Manager+ controls all linking (linking is an editorial decision about
   * the entity, not the SOP). Each array stores entity ids only; the
   * matching helper resolves them against current data.
   *
   * Note for kits: SOPs linked to a kit AND SOPs linked to any of its
   * component assets all surface on the kit detail page. See
   * lib/sopMatching.ts for the aggregation helper.
   */
  linkedAssetIds: string[];
  linkedKitIds: string[];
  linkedProjectIds: string[];
}

/**
 * Uploaded file attached to an SOP (iter-27b).
 *
 * Constraints (enforced at upload):
 *   - Size: ≤ 1 MB
 *   - Extensions: .md, .txt, .rtf, .pdf
 *   - MIME type validated against allowlist (not just extension)
 *
 * Storage path in the `sop-files` Supabase bucket:
 *   <workspaceId>/<sopId>/<timestamp>-<random>-<filename>
 *
 * Display behavior:
 *   - .pdf — inline preview via iframe (toggleable) + open in new tab
 *   - .md / .txt — open in new tab (browser renders as text)
 *   - .rtf — download-only (browsers don't render RTF inline)
 */
export interface SOPAttachment {
  id: string;
  /** Original filename for display, e.g. "FR7-manual.pdf". */
  filename: string;
  /** Supabase Storage public URL. */
  url: string;
  /** MIME type as reported by browser at upload time. */
  mimeType: string;
  sizeBytes: number;
  /** Initials of the uploader. */
  uploadedBy: string;
  /** ISO UTC. */
  uploadedAt: string;
}

/**
 * A single point-in-time snapshot of an SOP's content. Created automatically
 * on every save (and on revert). Used to render history view + power revert.
 */
export interface SOPVersion {
  id: string;
  /** ISO UTC. When this version was saved. */
  savedAt: string;
  /** Initials of who saved this version. */
  savedBy: string;
  /** Snapshot of title at this version. */
  title: string;
  /** Snapshot of body at this version. */
  body: string;
  /** Snapshot of categories at this version. */
  categories: string[];
}

export interface WorkspaceData {
  assets: Asset[];
  kits: Kit[];
  /** Demo data uses CheckoutRecord; live workspaces use ActiveCheckout. */
  checkouts: (CheckoutRecord | ActiveCheckout)[];
  alerts: Alert[];
  profiles: UserProfile[];
  /**
   * Scheduled projects (formerly "shoots"). See Project interface above.
   * Renamed iter-23 for industry-neutral terminology. Migration in adapter
   * handles old `shoots: [...]` payloads.
   */
  projects: Project[];
  events: AuditEvent[];
  /**
   * Service flag history. Each flag is its own record with full repair lifecycle.
   * Replaces the older single-flag-per-asset model — `asset.serviceFlag` is now
   * computed from the most recent open flag in this list.
   */
  flags: ServiceFlag[];
  /**
   * Comments / notes attached to entities in this workspace. Added in iter-17.
   *
   * Each note declares its parent (asset, kit, shoot, checkout, or user for DMs)
   * and is filterable by parentType + parentId. Stored inline in workspace JSON
   * since note volume per workspace is expected to remain modest (low thousands);
   * future migration to a dedicated table is straightforward if needed.
   *
   * See lib/data.ts for the Note interface details.
   */
  notes: Note[];
  /**
   * Standard Operating Procedures (iter-27a). Markdown-authored documents
   * capturing institutional knowledge. Versioned (each save creates a
   * snapshot); categorized using the existing asset-category vocabulary;
   * commentable via parentType: "sop".
   */
  sops: SOP[];
  orgName: string;
  orgLocation: string;
  barcodePrefix: string;
  filterableFields: string[];
  /** User's display timezone preference. "auto" = browser timezone. */
  timezone: string;
  /** Has the current user opted into manager mode. v1 has no auth, so this is just a UI flag. */
  managerMode: boolean;
  /**
   * Logistics watchman snoozes (iter-28a). When a Manager+ dismisses a
   * watchman issue, the snooze is stored here with a 24-hour expiry.
   * Issue ids are stable across renders for the same logical issue
   * (e.g. "crew-double-book:alice:project-123:project-456") so snooze
   * persists until the underlying condition changes or 24h pass.
   *
   * Watchman renderer filters out issues whose id is in here with an
   * `until` date in the future. Cleanup of expired snoozes happens on
   * read — no background job needed.
   */
  watchmanSnoozes: WatchmanSnooze[];
  /**
   * AI usage tracking (iter-28a). Counters incremented when a Manager+
   * runs an opt-in AI scan. Surfaced in Settings for Owner visibility
   * so they can see what their workspace is spending tokens on. We track
   * total scans and a daily counter (resets at UTC midnight) for the
   * rate limit (20 scans / day / workspace).
   *
   * Cost is approximate — calculated from prompt+completion tokens
   * returned by Anthropic at the configured per-million rate.
   */
  aiUsage: AIUsage;
}

/**
 * Logistics watchman snooze record (iter-28a). A Manager+ can hide a
 * watchman issue for 24 hours; afterward it re-surfaces if the
 * underlying condition still holds.
 */
export interface WatchmanSnooze {
  /** Stable issue id (matches WatchmanIssue.id from lib/watchman.ts). */
  issueId: string;
  /** ISO UTC — when the snooze expires and the issue re-surfaces. */
  until: string;
  /** Initials of the user who snoozed. For audit visibility. */
  by: string;
  /** ISO UTC — when the snooze was created. */
  snoozedAt: string;
}

/**
 * AI usage counters (iter-28a). Both lifetime and daily tallies so the
 * rate limit can be enforced (daily) and totals can be displayed
 * (lifetime). Daily count resets at UTC midnight (compared via
 * date-only string match on `dailyDate`).
 */
export interface AIUsage {
  /** Lifetime SOP-contradiction scans run. */
  totalScans: number;
  /** Approximate lifetime API cost in USD. */
  totalCostUsd: number;
  /** Last UTC date string (YYYY-MM-DD) the daily counter was active. */
  dailyDate: string;
  /** Scans run on `dailyDate`. Resets when date rolls over. */
  dailyScans: number;
}
