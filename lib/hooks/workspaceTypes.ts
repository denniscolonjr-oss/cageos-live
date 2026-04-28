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
} from "@/lib/data";

export type WorkspaceMode = "user" | "demo" | "unset";

export interface Shoot {
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
  shoot: string;
  shootId?: string;
  kits: string[]; // display labels — "Venice Cinema Kit"
  kitIds: string[]; // for state reconciliation
  assetIds: string[]; // assets that were also checked out, including kit components
  status: "active" | "overdue" | "returned";
  isGuest?: boolean;
  /** ISO timestamp when returned, if returned */
  returnedAtISO?: string;
}

export interface WorkspaceData {
  assets: Asset[];
  kits: Kit[];
  /** Demo data uses CheckoutRecord; live workspaces use ActiveCheckout. */
  checkouts: (CheckoutRecord | ActiveCheckout)[];
  alerts: Alert[];
  profiles: UserProfile[];
  shoots: Shoot[];
  orgName: string;
  orgLocation: string;
  barcodePrefix: string;
  filterableFields: string[];
  /** User's display timezone preference. "auto" = browser timezone. */
  timezone: string;
  /** Has the current user opted into manager mode. v1 has no auth, so this is just a UI flag. */
  managerMode: boolean;
}
