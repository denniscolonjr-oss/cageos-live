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
  | "note_added";

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
  orgName: string;
  orgLocation: string;
  barcodePrefix: string;
  filterableFields: string[];
  /** User's display timezone preference. "auto" = browser timezone. */
  timezone: string;
  /** Has the current user opted into manager mode. v1 has no auth, so this is just a UI flag. */
  managerMode: boolean;
}
