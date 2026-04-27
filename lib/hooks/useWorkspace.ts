"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ASSETS as DEMO_ASSETS,
  KITS as DEMO_KITS,
  CHECKOUTS as DEMO_CHECKOUTS,
  ALERTS as DEMO_ALERTS,
  PROFILES as DEMO_PROFILES,
  STATS as DEMO_STATS,
  type Asset,
  type Kit,
  type CheckoutRecord,
  type Alert,
  type UserProfile,
} from "@/lib/data";

const STORAGE_KEY = "cageos:workspace:v1";
const MODE_KEY = "cageos:mode:v1";

export type WorkspaceMode = "user" | "demo" | "unset";

export interface WorkspaceData {
  assets: Asset[];
  kits: Kit[];
  checkouts: CheckoutRecord[];
  alerts: Alert[];
  profiles: UserProfile[];
  orgName: string;
  orgLocation: string;
}

const EMPTY_WORKSPACE: WorkspaceData = {
  assets: [],
  kits: [],
  checkouts: [],
  alerts: [],
  profiles: [],
  orgName: "Your Org",
  orgLocation: "—",
};

const DEMO_WORKSPACE: WorkspaceData = {
  assets: DEMO_ASSETS,
  kits: DEMO_KITS,
  checkouts: DEMO_CHECKOUTS,
  alerts: DEMO_ALERTS,
  profiles: DEMO_PROFILES,
  orgName: "MMG Production",
  orgLocation: "DC",
};

function loadFromStorage(): WorkspaceData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceData;
  } catch {
    return null;
  }
}

function saveToStorage(data: WorkspaceData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or disabled — silently fail
  }
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    const m = loadMode();
    const stored = loadFromStorage();
    if (stored) setUserData(stored);
    setMode(m);
    setHydrated(true);
  }, []);

  // Active data depends on mode
  const data: WorkspaceData = mode === "demo" ? DEMO_WORKSPACE : userData;
  const isReadOnly = mode === "demo";

  // Switch mode
  const switchMode = useCallback((m: WorkspaceMode) => {
    setMode(m);
    saveMode(m);
  }, []);

  // Update user workspace (only in user mode)
  const updateUserData = useCallback((updater: (d: WorkspaceData) => WorkspaceData) => {
    setUserData(prev => {
      const next = updater(prev);
      saveToStorage(next);
      return next;
    });
  }, []);

  // Mutation helpers — all no-ops in demo mode
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

  const resetWorkspace = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setUserData(EMPTY_WORKSPACE);
  }, []);

  // Computed stats
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
    updateOrg,
    resetWorkspace,
  };
}

// Helper: generate next barcode in MMG-XXXXXXX format
export function nextBarcode(existingAssets: Asset[]): string {
  const numbers = existingAssets
    .map(a => {
      const m = a.barcode.match(/MMG-(\d+)/);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter(n => n > 0);
  const max = numbers.length > 0 ? Math.max(...numbers) : 0;
  return `MMG-${String(max + 1).padStart(7, "0")}`;
}

// Helper: get initials from name
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
