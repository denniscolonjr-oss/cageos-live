/**
 * Permission helpers for the role system.
 *
 * Single source of truth for "can the current user do X." Every UI gate
 * and every mutator guard reads from these functions instead of inlining
 * role checks. Adding a new role or shifting permissions becomes a one-file
 * change instead of a hunt across the whole codebase.
 *
 * Roles in order of authority:
 *   owner     — full control, billing, delete workspace, change anyone's role
 *   manager   — full control over inventory, can invite Crew/Viewer
 *   crew      — checkout/return, flag service issues, view audit log
 *   viewer    — read-only across the whole app
 *
 * Convention: every helper accepts `WorkspaceRole | null`. `null` means
 * "no active workspace / not signed in" and ALWAYS denies. UI code can
 * pass `auth.currentRole` directly without null-checking first.
 */

import type { WorkspaceRole } from "./AuthContext";

/** Ordered authority levels — higher number = more authority. */
const RANK: Record<WorkspaceRole, number> = {
  viewer: 0,
  crew: 1,
  manager: 2,
  owner: 3,
};

/** True if `role` has at least the authority of `min`. */
export function hasAtLeast(role: WorkspaceRole | null, min: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[min];
}

// ── Inventory mutations ────────────────────────────────────────────────────

/** Add or edit assets, kits, profiles, shoots. Manager+. */
export const canManage = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

/** Edit any field on existing items. Manager+. */
export const canEdit = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

/** Archive (soft-delete) any item. Manager+. */
export const canArchive = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

/** Permanently delete (no undo). Owner only — protects against rogue managers. */
export const canPermanentlyDelete = (role: WorkspaceRole | null) => hasAtLeast(role, "owner");

/** Restore archived items. Manager+. */
export const canRestore = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

// ── Daily operations ───────────────────────────────────────────────────────

/** Use the kiosk: check things in and out. Crew+. Viewers cannot. */
export const canCheckout = (role: WorkspaceRole | null) => hasAtLeast(role, "crew");

/** Flag service issues, add repair notes. Crew+. */
export const canFlag = (role: WorkspaceRole | null) => hasAtLeast(role, "crew");

/** Resolve flags / mark in-repair. Manager+ (Crew can flag, only Manager closes). */
export const canResolveFlag = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

// ── Settings & administration ──────────────────────────────────────────────

/** Change workspace settings: name, barcode prefix, timezone, etc. Manager+. */
export const canEditSettings = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

/** Invite new members, generate invite links. Manager+. */
export const canInvite = (role: WorkspaceRole | null) => hasAtLeast(role, "manager");

/** Change another member's role. Owner only. */
export const canChangeRoles = (role: WorkspaceRole | null) => hasAtLeast(role, "owner");

/** Remove a member from the workspace. Owner only. */
export const canRemoveMembers = (role: WorkspaceRole | null) => hasAtLeast(role, "owner");

/** View and rotate workspace passcodes. Owner only (sensitive shared secret). */
export const canManagePasscodes = (role: WorkspaceRole | null) => hasAtLeast(role, "owner");

/** Delete the entire workspace. Owner only. */
export const canDeleteWorkspace = (role: WorkspaceRole | null) => hasAtLeast(role, "owner");

// ── Visibility ─────────────────────────────────────────────────────────────

/**
 * View the audit log. All members including Viewers. Hide entries that would
 * leak member emails/IPs from Crew/Viewer if needed at the row level.
 */
export const canViewAuditLog = (role: WorkspaceRole | null) => role !== null;

/** Effectively read-only mode. Viewer-specific check. */
export const isReadOnly = (role: WorkspaceRole | null) => role === "viewer" || role === null;

// ── Display helpers ────────────────────────────────────────────────────────

/** Human-readable label for UI display. */
export function roleLabel(role: WorkspaceRole | null): string {
  switch (role) {
    case "owner":   return "Owner";
    case "manager": return "Manager";
    case "crew":    return "Crew";
    case "viewer":  return "Viewer";
    default:        return "—";
  }
}

/**
 * One-line description of what the role can do. Used in the role picker UI
 * to help an Owner pick the right tier when inviting someone.
 */
export function roleDescription(role: WorkspaceRole): string {
  switch (role) {
    case "owner":   return "Full control. Manages billing, members, and workspace settings.";
    case "manager": return "Manages inventory, invites Crew, edits settings. No billing or member roles.";
    case "crew":    return "Checks gear in/out, flags service issues. Cannot edit or delete inventory.";
    case "viewer":  return "Read-only access across the workspace. Cannot make any changes.";
  }
}
