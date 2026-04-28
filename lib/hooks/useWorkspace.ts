"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ASSETS as DEMO_ASSETS,
  KITS as DEMO_KITS,
  CHECKOUTS as DEMO_CHECKOUTS,
  ALERTS as DEMO_ALERTS,
  PROFILES as DEMO_PROFILES,
  STATS as DEMO_STATS,
  SHOOTS as DEMO_SHOOTS_BASE,
  type Asset,
  type Kit,
  type CheckoutRecord,
  type Alert,
  type UserProfile,
} from "@/lib/data";

const STORAGE_KEY = "cageos:workspace:v2";
const LEGACY_STORAGE_KEY = "cageos:workspace:v1";
const MODE_KEY = "cageos:mode:v1";

export type WorkspaceMode = "user" | "demo" | "unset";

export interface Shoot {
  id: string;
  title: string;
  client: string;
  startsAt: string; // ISO date string or human label
  endsAt?: string;
  location?: string;
  leadInitials?: string; // initials of the lead operator
  assignedTeam: string[]; // initials
  assignedKits: string[]; // kit IDs
  notes?: string;
  status: "scheduled" | "active" | "completed" | "cancelled";
}

export interface WorkspaceData {
  assets: Asset[];
  kits: Kit[];
  checkouts: CheckoutRecord[];
  alerts: Alert[];
  profiles: UserProfile[];
  shoots: Shoot[];
  orgName: string;
  orgLocation: string;
  barcodePrefix: string; // e.g. "AST"
  filterableFields: string[]; // asset fields to expose as filters: "category" | "make" | "location" | "model"
}

const EMPTY_WORKSPACE: WorkspaceData = {
  assets: [],
  kits: [],
  checkouts: [],
  alerts: [],
  profiles: [],
  shoots: [],
  orgName: "Your Org",
  orgLocation: "—",
  barcodePrefix: "AST",
  filterableFields: ["category", "location"],
};

// Build demo shoots from the static SHOOTS list, attaching team/kit assignments
const DEMO_SHOOTS: Shoot[] = [
  {
    id: "sh-001",
    title: "DOI Interview B-Roll",
    client: "Dept of Interior",
    startsAt: "Today 10:00 AM",
    endsAt: "Today 4:00 PM",
    location: "DOI HQ",
    leadInitials: "DC",
    assignedTeam: ["DC", "TO"],
    assignedKits: ["MMG-0000576", "MMG-0000575"],
    notes: "Single subject interview, 3-camera setup, lavs.",
    status: "active",
  },
  {
    id: "sh-002",
    title: "Capitol Event Coverage",
    client: "Capitol Hill",
    startsAt: "Today 2:00 PM",
    endsAt: "Today 7:00 PM",
    location: "Capitol Building",
    leadInitials: "KS",
    assignedTeam: ["KS", "AB"],
    assignedKits: ["MMG-0000578"],
    notes: "Live event coverage with multiple speakers.",
    status: "scheduled",
  },
  {
    id: "sh-003",
    title: "Library Portrait Series",
    client: "Library of Congress",
    startsAt: "Tomorrow 9:00 AM",
    endsAt: "Tomorrow 1:00 PM",
    location: "LMG05",
    leadInitials: "DC",
    assignedTeam: ["DC", "BS", "JY"],
    assignedKits: ["MMG-0000576"],
    notes: "Studio portraits with lighting setup.",
    status: "scheduled",
  },
];

const DEMO_WORKSPACE: WorkspaceData = {
  assets: DEMO_ASSETS,
  kits: DEMO_KITS,
  checkouts: DEMO_CHECKOUTS,
  alerts: DEMO_ALERTS,
  profiles: DEMO_PROFILES,
  shoots: DEMO_SHOOTS,
  orgName: "MMG Production",
  orgLocation: "DC",
  barcodePrefix: "MMG",
  filterableFields: ["category", "make", "location"],
};

function migrateFromLegacy(legacy: Partial<WorkspaceData>): WorkspaceData {
  // Backfill any missing fields from EMPTY_WORKSPACE
  return {
    ...EMPTY_WORKSPACE,
    ...legacy,
    shoots: legacy.shoots ?? [],
    barcodePrefix: legacy.barcodePrefix ?? "AST",
    filterableFields: legacy.filterableFields ?? ["category", "location"],
  };
}

function loadFromStorage(): WorkspaceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WorkspaceData;
    // Try legacy
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as Partial<WorkspaceData>;
      const migrated = migrateFromLegacy(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

function saveToStorage(data: WorkspaceData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function loadMode(): WorkspaceMode {
  if (typeof window === "undefined") return "unset";
  try {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "user" || m === "demo") return m;
    return "unset";
  } catch {
    return "unset";
  }
}

function saveMode(m: WorkspaceMode) {
  if (typeof window === "undefined") return;
  try {
    if (m === "unset") localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, m);
  } catch {}
}

export function useWorkspace() {
  const [mode, setMode] = useState<WorkspaceMode>("unset");
  const [userData, setUserData] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const m = loadMode();
    const stored = loadFromStorage();
    if (stored) setUserData(stored);
    setMode(m);
    setHydrated(true);
  }, []);

  const data: WorkspaceData = mode === "demo" ? DEMO_WORKSPACE : userData;
  const isReadOnly = mode === "demo";

  const switchMode = useCallback((m: WorkspaceMode) => {
    setMode(m);
    saveMode(m);
  }, []);

  const updateUserData = useCallback((updater: (d: WorkspaceData) => WorkspaceData) => {
    setUserData(prev => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, []);

  const addAsset = useCallback((asset: Asset) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, assets: [...d.assets, asset] }));
  }, [isReadOnly, updateUserData]);

  const addAssets = useCallback((assets: Asset[]) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, assets: [...d.assets, ...assets] }));
  }, [isReadOnly, updateUserData]);

  const addKit = useCallback((kit: Kit) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, kits: [...d.kits, kit] }));
  }, [isReadOnly, updateUserData]);

  const addProfile = useCallback((profile: UserProfile) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, profiles: [...d.profiles, profile] }));
  }, [isReadOnly, updateUserData]);

  const addProfiles = useCallback((profiles: UserProfile[]) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, profiles: [...d.profiles, ...profiles] }));
  }, [isReadOnly, updateUserData]);

  const updateOrg = useCallback((orgName: string, orgLocation: string) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, orgName, orgLocation }));
  }, [isReadOnly, updateUserData]);

  const setBarcodePrefix = useCallback((prefix: string) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, barcodePrefix: prefix }));
  }, [isReadOnly, updateUserData]);

  const setFilterableFields = useCallback((fields: string[]) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, filterableFields: fields }));
  }, [isReadOnly, updateUserData]);

  const addShoot = useCallback((shoot: Shoot) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, shoots: [...d.shoots, shoot] }));
  }, [isReadOnly, updateUserData]);

  const updateShoot = useCallback((id: string, patch: Partial<Shoot>) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, shoots: d.shoots.map(s => s.id === id ? { ...s, ...patch } : s) }));
  }, [isReadOnly, updateUserData]);

  const deleteShoot = useCallback((id: string) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, shoots: d.shoots.filter(s => s.id !== id) }));
  }, [isReadOnly, updateUserData]);

  const resetWorkspace = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}
    setUserData(EMPTY_WORKSPACE);
  }, []);

  const stats = mode === "demo" ? DEMO_STATS : {
    totalAssets: data.assets.length,
    checkedIn: data.assets.filter(a => a.status === "in").length,
    checkedOut: data.assets.filter(a => a.status === "out").length,
    serviceFlags: data.assets.filter(a => a.serviceFlag).length,
    criticalFlags: data.assets.filter(a => a.serviceFlag?.severity === "critical").length,
    kitDriftEvents: 0,
    knownInventoryValue: data.assets.reduce((sum, a) => sum + (a.cost || 0), 0),
  };

  return {
    data,
    mode,
    hydrated,
    isReadOnly,
    isEmpty: mode !== "demo" && data.assets.length === 0 && data.profiles.length === 0,
    stats,
    switchMode,
    addAsset,
    addAssets,
    addKit,
    addProfile,
    addProfiles,
    addShoot,
    updateShoot,
    deleteShoot,
    updateOrg,
    setBarcodePrefix,
    setFilterableFields,
    resetWorkspace,
  };
}

// Helper: generate next barcode using the workspace's prefix
export function nextBarcode(existingAssets: Asset[], prefix: string = "AST"): string {
  const safePrefix = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "AST";
  const escapedPrefix = safePrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escapedPrefix}-(\\d+)`);
  const numbers = existingAssets
    .map(a => {
      const m = a.barcode.match(re);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `${safePrefix}-${String(max + 1).padStart(7, "0")}`;
}

// Helper: get initials from name
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Suppress unused import warning — DEMO_SHOOTS_BASE kept for future migration
void DEMO_SHOOTS_BASE;
