/**
 * Supabase storage adapter.
 *
 * Implements the StorageAdapter contract by reading and writing to a Supabase
 * project. Each user belongs to one or more workspaces; this adapter is bound
 * to a single active workspace_id at construction time.
 *
 * Strategy for v1: one row per workspace in the `workspaces` table holds the
 * full WorkspaceData blob as JSONB. Real-time subscriptions watch that row.
 *
 * Future iterations (Push 3) will normalize this into proper relational tables
 * for granular updates and partial real-time sync. For now, blob-in-JSONB is
 * fast to ship, easy to migrate, and good enough for early customers.
 */

import { getSupabaseClient } from "./client";
import type { StorageAdapter } from "@/lib/storage/StorageAdapter";
import type { WorkspaceData } from "@/lib/hooks/workspaceTypes";

const EMPTY: WorkspaceData = {
  assets: [],
  kits: [],
  checkouts: [],
  alerts: [],
  profiles: [],
  shoots: [],
  events: [],
  flags: [],
  orgName: "Your Org",
  orgLocation: "—",
  barcodePrefix: "AST",
  filterableFields: ["category", "location"],
  timezone: "auto",
  managerMode: false,
};

function migrate(legacy: Partial<WorkspaceData>): WorkspaceData {
  return {
    assets: legacy.assets ?? [],
    kits: legacy.kits ?? [],
    checkouts: legacy.checkouts ?? [],
    alerts: legacy.alerts ?? [],
    profiles: legacy.profiles ?? [],
    shoots: legacy.shoots ?? [],
    events: legacy.events ?? [],
    flags: legacy.flags ?? [],
    orgName: legacy.orgName ?? "Your Org",
    orgLocation: legacy.orgLocation ?? "—",
    barcodePrefix: legacy.barcodePrefix ?? "AST",
    filterableFields: legacy.filterableFields ?? ["category", "location"],
    timezone: legacy.timezone ?? "auto",
    managerMode: legacy.managerMode ?? false,
  };
}

export function createSupabaseAdapter(workspaceId: string): StorageAdapter {
  const client = getSupabaseClient();

  return {
    name: "supabase",

    async load(): Promise<WorkspaceData | null> {
      const { data, error } = await client
        .from("workspaces")
        .select("data")
        .eq("id", workspaceId)
        .maybeSingle();

      if (error) {
        console.error("Supabase load error:", error);
        return null;
      }
      if (!data) return null;
      // The `data` column is JSONB
      return migrate((data.data ?? {}) as Partial<WorkspaceData>);
    },

    async save(workspaceData: WorkspaceData): Promise<void> {
      const { error } = await client
        .from("workspaces")
        .update({
          data: workspaceData,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      if (error) {
        console.error("Supabase save error:", error);
        throw error;
      }
    },

    async clear(): Promise<void> {
      const { error } = await client
        .from("workspaces")
        .update({ data: EMPTY })
        .eq("id", workspaceId);

      if (error) {
        console.error("Supabase clear error:", error);
        throw error;
      }
    },

    /**
     * Subscribe to real-time changes on this workspace's row.
     * Returns an unsubscribe function.
     */
    subscribe(onChange: (data: WorkspaceData) => void): () => void {
      const channel = client
        .channel(`workspace:${workspaceId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "workspaces",
            filter: `id=eq.${workspaceId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const newRow = payload.new as { data?: Partial<WorkspaceData> };
            if (newRow?.data) {
              onChange(migrate(newRow.data));
            }
          },
        )
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    },
  };
}
