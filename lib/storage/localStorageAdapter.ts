/**
 * LocalStorage adapter.
 *
 * Persists the workspace to the browser's localStorage. Per-device, no auth.
 * This is the only adapter shipped in v1.
 */

import type { StorageAdapter, ModeAdapter } from "./StorageAdapter";
import type { WorkspaceData, WorkspaceMode } from "@/lib/hooks/workspaceTypes";

const STORAGE_KEY = "cageos:workspace:v3";
const LEGACY_KEYS = ["cageos:workspace:v2", "cageos:workspace:v1"];
const MODE_KEY = "cageos:mode:v1";

function migrate(legacy: Partial<WorkspaceData> & { shoots?: unknown[] }): WorkspaceData {
  /*
   * iter-23 rename: shoots -> projects.
   * Read from either key, write to the new one. Tolerates fully-migrated
   * data (only `projects` present), legacy data (only `shoots` present),
   * and dual-write transitional data (both keys present — `projects` wins).
   *
   * The unknown[] cast on shoots is because the type was already removed
   * from WorkspaceData but we still want to read the old key during migration.
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
     * may have unknown legacy fields" lookup. The actual field reads are
     * safe because we check for `undefined` before using values.
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

  // iter-28e-fix: orphaned flag cleanup. Migrate assets first to get
  // their id set, then drop any flag whose assetId doesn't match.
  const migratedAssets = (legacy.assets ?? []).map(a => {
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
  });
  const validAssetIds = new Set(migratedAssets.map(a => a.id));
  // Drop any flag whose referenced asset doesn't exist anymore.
  // Pre-iter-28e-fix data may have orphaned flags from inventory resets
  // that didn't clear them. This shim filters them out on every read,
  // so the orphan disappears on next page load — no user action needed.
  const cleanedFlags = (legacy.flags ?? []).filter(f =>
    f.assetId && validAssetIds.has(f.assetId)
  );

  return {
    assets: migratedAssets,
    kits: legacy.kits ?? [],
    checkouts: migratedCheckouts,
    alerts: legacy.alerts ?? [],
    profiles: legacy.profiles ?? [],
    projects: projectsFromLegacy,
    events: legacy.events ?? [],
    flags: cleanedFlags,
    // Notes added in iter-17. iter-18a added readBy field; migrate legacy
    // notes without it so the inbox view doesn't crash on undefined.
    notes: (legacy.notes ?? []).map(n => ({
      ...n,
      readBy: n.readBy ?? [],
    })),
    /*
     * SOPs (iter-27a). Default to empty array for workspaces created before
     * SOPs existed. Each existing SOP gets its `versions` array initialized
     * to empty if missing (forward-compat for any pre-versioned data).
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
    // iter-28a: logistics watchman snoozes + AI usage tracking. Default
    // to empty/zero on legacy reads.
    watchmanSnoozes: legacy.watchmanSnoozes ?? [],
    aiUsage: legacy.aiUsage ?? {
      totalScans: 0,
      totalCostUsd: 0,
      dailyDate: new Date().toISOString().slice(0, 10),
      dailyScans: 0,
    },
    // iter-28c
    csvImports: legacy.csvImports ?? [],
  };
}

export const localStorageAdapter: StorageAdapter = {
  name: "localStorage",

  async load() {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw));

      // Walk legacy keys, migrate forward
      for (const key of LEGACY_KEYS) {
        const legacyRaw = localStorage.getItem(key);
        if (legacyRaw) {
          const migrated = migrate(JSON.parse(legacyRaw));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  async save(data) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or storage disabled — silently ignore.
    }
  },

  async clear() {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    } catch {}
  },
};

export const localStorageModeAdapter: ModeAdapter = {
  loadMode(): WorkspaceMode {
    if (typeof window === "undefined") return "unset";
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === "user" || m === "demo") return m;
      return "unset";
    } catch {
      return "unset";
    }
  },

  saveMode(m) {
    if (typeof window === "undefined") return;
    try {
      if (m === "unset") localStorage.removeItem(MODE_KEY);
      else localStorage.setItem(MODE_KEY, m);
    } catch {}
  },
};
