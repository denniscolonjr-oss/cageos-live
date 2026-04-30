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

export const localStorageAdapter: StorageAdapter = {
  name: "localStorage",

  load() {
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

  save(data) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or storage disabled — silently ignore.
      // In a real backend adapter this would surface an error toast.
    }
  },

  clear() {
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
