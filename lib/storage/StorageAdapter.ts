/**
 * Storage Adapter Interface
 *
 * Every backend (localStorage, Supabase, ServiceNow proxy, custom REST API, etc.)
 * implements this interface. The useWorkspace hook never talks to a storage backend
 * directly — it goes through whatever adapter is currently configured.
 *
 * To swap backends, you implement a new adapter and change a single line in
 * lib/hooks/useWorkspace.ts to use it. No UI code changes.
 *
 * Adapters are async. The localStorage adapter wraps its sync calls in
 * resolved Promises so the hook code stays uniform across backends.
 */

import type { WorkspaceData } from "@/lib/hooks/workspaceTypes";

export interface StorageAdapter {
  /** Identifier for diagnostics — "localStorage", "supabase", etc. */
  name: string;

  /** Load the user's workspace. Returns null if none exists. */
  load(): Promise<WorkspaceData | null>;

  /** Persist the entire workspace. Last-write-wins for v1. */
  save(data: WorkspaceData): Promise<void>;

  /** Clear all workspace data. */
  clear(): Promise<void>;

  /** Optional: subscribe to remote changes. Returns an unsubscribe fn. */
  subscribe?(onChange: (data: WorkspaceData) => void): () => void;
}

/**
 * Mode is stored separately because it's a UI preference (which workspace are
 * we currently viewing) not workspace data. It always lives in localStorage
 * even when a remote backend is in use.
 */
export interface ModeAdapter {
  loadMode(): "user" | "demo" | "unset";
  saveMode(mode: "user" | "demo" | "unset"): void;
}
