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
  projects: [],
  events: [],
  flags: [],
  notes: [],
  sops: [],
  orgName: "Your Org",
  orgLocation: "—",
  barcodePrefix: "AST",
  filterableFields: ["category", "location"],
  timezone: "auto",
  managerMode: false,
  // iter-28a
  watchmanSnoozes: [],
  aiUsage: {
    totalScans: 0,
    totalCostUsd: 0,
    dailyDate: new Date().toISOString().slice(0, 10),
    dailyScans: 0,
  },
  csvImports: [],
};

function migrate(legacy: Partial<WorkspaceData> & { shoots?: unknown[] }): WorkspaceData {
  /*
   * iter-23 rename: shoots -> projects.
   * Read from either key, write to the new one. Tolerates fully-migrated
   * data (only `projects` present), legacy data (only `shoots` present),
   * and dual-write transitional data (both keys present — `projects` wins).
   */
  const projectsFromLegacy = (legacy.projects ?? legacy.shoots ?? []) as WorkspaceData["projects"];

  /*
   * ActiveCheckout: rename shoot/shootId -> project/projectId. Apply per-row
   * so existing checkouts in storage keep displaying project context after
   * the field rename.
   */
  const migratedCheckouts = (legacy.checkouts ?? []).map(c => {
    /*
     * Type-cast through `unknown` because `CheckoutRecord | ActiveCheckout`
     * doesn't structurally overlap with `Record<string, unknown>` — TS demands
     * the two-step cast to acknowledge we're doing a "trust me, this object
     * may have unknown legacy fields" lookup.
     */
    const anyc = c as unknown as Record<string, unknown>;
    if (anyc.project === undefined && anyc.shoot !== undefined) {
      return {
        ...c,
        project: anyc.shoot,
        projectId: anyc.shootId,
      };
    }
    return c;
  }) as WorkspaceData["checkouts"];

  return {
    // iter-28d: backfill csvBaseline for legacy CSV-imported assets that
    // lack a baseline. See localStorageAdapter for full rationale.
    assets: (legacy.assets ?? []).map(a => {
      if (a.csvImportId && !a.csvBaseline) {
        return {
          ...a,
          csvBaseline: {
            name: a.name,
            category: a.category,
            barcode: a.barcode,
            make: a.make,
            model: a.model,
            location: a.location,
            serialNumber: a.serialNumber ?? "",
            cost: a.cost,
            eolDate: a.eolDate,
          },
        };
      }
      return a;
    }),
    kits: legacy.kits ?? [],
    checkouts: migratedCheckouts,
    alerts: legacy.alerts ?? [],
    profiles: legacy.profiles ?? [],
    projects: projectsFromLegacy,
    events: legacy.events ?? [],
    flags: legacy.flags ?? [],
    // Notes added in iter-17. iter-18a added readBy field; migrate legacy
    // notes without it so the inbox view doesn't crash on undefined.
    notes: (legacy.notes ?? []).map(n => ({
      ...n,
      readBy: n.readBy ?? [],
    })),
    /*
     * SOPs (iter-27a). Default to empty array for workspaces created before
     * SOPs existed. Each existing SOP gets defensive defaults for arrays.
     */
    sops: (legacy.sops ?? []).map(s => ({
      ...s,
      versions: s.versions ?? [],
      categories: s.categories ?? [],
      attachments: s.attachments ?? [],
      linkedAssetIds: s.linkedAssetIds ?? [],
      linkedKitIds: s.linkedKitIds ?? [],
      linkedProjectIds: s.linkedProjectIds ?? [],
    })),
    orgName: legacy.orgName ?? "Your Org",
    orgLocation: legacy.orgLocation ?? "—",
    barcodePrefix: legacy.barcodePrefix ?? "AST",
    filterableFields: legacy.filterableFields ?? ["category", "location"],
    timezone: legacy.timezone ?? "auto",
    managerMode: legacy.managerMode ?? false,
    // iter-28a: logistics watchman + AI usage. Default to empty/zero
    // on legacy reads so older workspaces hydrate cleanly.
    watchmanSnoozes: legacy.watchmanSnoozes ?? [],
    aiUsage: legacy.aiUsage ?? {
      totalScans: 0,
      totalCostUsd: 0,
      dailyDate: new Date().toISOString().slice(0, 10),
      dailyScans: 0,
    },
    csvImports: legacy.csvImports ?? [],
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
