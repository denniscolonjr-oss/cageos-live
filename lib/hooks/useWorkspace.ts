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
  type UserProfile,
} from "@/lib/data";
import { localStorageAdapter, localStorageModeAdapter } from "@/lib/storage/localStorageAdapter";
import type { StorageAdapter, ModeAdapter } from "@/lib/storage/StorageAdapter";
import type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout } from "./workspaceTypes";

// Re-export types so existing imports from useWorkspace keep working
export type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout };

/**
 * Active storage adapter. To swap backends, replace this single line.
 * In a multi-tenant build, you'd inject this from a provider based on org config.
 */
const adapter: StorageAdapter = localStorageAdapter;
const modeAdapter: ModeAdapter = localStorageModeAdapter;

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
  timezone: "auto",
  managerMode: false,
};

// Demo shoots use real ISO timestamps. Built dynamically so "today" is always today.
function buildDemoShoots(): Shoot[] {
  const now = new Date();
  function atTime(daysFromNow: number, hour: number, minute = 0): string {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }
  return [
    {
      id: "sh-001",
      title: "DOI Interview B-Roll",
      client: "Dept of Interior",
      startsAt: atTime(0, 10),
      endsAt: atTime(0, 16),
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
      startsAt: atTime(0, 14),
      endsAt: atTime(0, 19),
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
      startsAt: atTime(1, 9),
      endsAt: atTime(1, 13),
      location: "LMG05",
      leadInitials: "DC",
      assignedTeam: ["DC", "BS", "JY"],
      assignedKits: ["MMG-0000576"],
      notes: "Studio portraits with lighting setup.",
      status: "scheduled",
    },
  ];
}

function buildDemoWorkspace(): WorkspaceData {
  return {
    assets: DEMO_ASSETS,
    kits: DEMO_KITS,
    checkouts: DEMO_CHECKOUTS,
    alerts: DEMO_ALERTS,
    profiles: DEMO_PROFILES,
    shoots: buildDemoShoots(),
    orgName: "MMG Production",
    orgLocation: "DC",
    barcodePrefix: "MMG",
    filterableFields: ["category", "make", "location"],
    timezone: "auto",
    managerMode: false,
  };
}

export function useWorkspace() {
  const [mode, setMode] = useState<WorkspaceMode>("unset");
  const [userData, setUserData] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const m = modeAdapter.loadMode();
    const stored = adapter.load();
    if (stored) setUserData(stored);
    setMode(m);
    setHydrated(true);
  }, []);

  const data: WorkspaceData = mode === "demo" ? buildDemoWorkspace() : userData;
  const isReadOnly = mode === "demo";

  const switchMode = useCallback((m: WorkspaceMode) => {
    setMode(m);
    modeAdapter.saveMode(m);
  }, []);

  const updateUserData = useCallback((updater: (d: WorkspaceData) => WorkspaceData) => {
    setUserData(prev => {
      const next = updater(prev);
      adapter.save(next);
      return next;
    });
  }, []);

  // --- Asset / Kit / Profile / Shoot mutators ---

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

  const setTimezone = useCallback((tz: string) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, timezone: tz }));
  }, [isReadOnly, updateUserData]);

  const setManagerMode = useCallback((on: boolean) => {
    if (isReadOnly) return;
    updateUserData(d => ({ ...d, managerMode: on }));
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

  // --- Checkout / Return ---

  /**
   * Check out one or more kits (with their components) to a user.
   * - Marks each kit's status to "out"
   * - Marks each kit component asset's status to "out", sets lastUser/lastUpdated
   * - Adds a new ActiveCheckout entry to data.checkouts
   */
  const checkoutKits = useCallback((args: {
    user: { name: string; initials: string; color: string; isGuest?: boolean };
    kitIds: string[];
    shootTitle: string;
    shootId?: string;
    dueBackHoursFromNow?: number;
  }): ActiveCheckout | null => {
    if (isReadOnly) return null;
    const dueBackHours = args.dueBackHoursFromNow ?? 8;
    const now = new Date();
    const due = new Date(now.getTime() + dueBackHours * 60 * 60 * 1000);

    let createdCheckout: ActiveCheckout | null = null;

    updateUserData(d => {
      const targetKits = d.kits.filter(k => args.kitIds.includes(k.id));
      if (targetKits.length === 0) return d;

      const allComponentIds = targetKits.flatMap(k => k.componentIds);

      const checkout: ActiveCheckout = {
        id: `co-${now.getTime()}`,
        checkedOutAtISO: now.toISOString(),
        checkedOutAtLabel: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        dueBackISO: due.toISOString(),
        dueBackLabel: due.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
        user: args.user.name,
        initials: args.user.initials,
        color: args.user.color,
        shoot: args.shootTitle,
        shootId: args.shootId,
        kits: targetKits.map(k => k.name),
        kitIds: args.kitIds,
        assetIds: allComponentIds,
        status: "active",
        isGuest: args.user.isGuest,
      };
      createdCheckout = checkout;

      return {
        ...d,
        kits: d.kits.map(k => args.kitIds.includes(k.id) ? { ...k, status: "out" } : k),
        assets: d.assets.map(a => allComponentIds.includes(a.id)
          ? { ...a, status: "out", lastUser: args.user.name, lastUpdated: checkout.checkedOutAtLabel }
          : a),
        checkouts: [...d.checkouts, checkout],
      };
    });

    return createdCheckout;
  }, [isReadOnly, updateUserData]);

  /**
   * Return a checkout — by id. Reverses the checkoutKits effects.
   */
  const returnCheckout = useCallback((checkoutId: string) => {
    if (isReadOnly) return;
    const now = new Date();
    updateUserData(d => {
      const co = d.checkouts.find(c => c.id === checkoutId);
      if (!co) return d;
      // Only ActiveCheckout has structured ids — guard against demo CheckoutRecord
      const active = co as ActiveCheckout;
      const kitIds = active.kitIds ?? [];
      const assetIds = active.assetIds ?? [];

      return {
        ...d,
        kits: d.kits.map(k => kitIds.includes(k.id) ? { ...k, status: "available" } : k),
        assets: d.assets.map(a => assetIds.includes(a.id)
          ? { ...a, status: "in", lastUpdated: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }
          : a),
        checkouts: d.checkouts.map(c => c.id === checkoutId
          ? ({ ...active, status: "returned", returnedAtISO: now.toISOString() } as ActiveCheckout)
          : c),
      };
    });
  }, [isReadOnly, updateUserData]);

  const resetWorkspace = useCallback(() => {
    adapter.clear();
    setUserData(EMPTY_WORKSPACE);
  }, []);

  // --- Computed ---

  const activeCheckouts = data.checkouts.filter(c => {
    // demo records use string status; active records do too
    return c.status === "active" || c.status === "overdue";
  });

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
    activeCheckouts,
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
    setTimezone,
    setManagerMode,
    checkoutKits,
    returnCheckout,
    resetWorkspace,
    adapterName: adapter.name,
  };
}

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

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
