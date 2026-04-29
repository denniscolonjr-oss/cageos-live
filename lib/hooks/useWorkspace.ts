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
import type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory } from "./workspaceTypes";

// Re-export types so existing imports from useWorkspace keep working
export type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory };

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
  events: [],
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

function buildDemoEvents(): AuditEvent[] {
  const now = Date.now();
  function ago(mins: number): string { return new Date(now - mins * 60 * 1000).toISOString(); }
  return [
    { id: "ev-d1", timestamp: ago(8), category: "checkout", actor: "Dennis Colon Jr", summary: "Checked out Venice Cinema Kit", detail: "for DOI Interview B-Roll" },
    { id: "ev-d2", timestamp: ago(12), category: "checkout", actor: "Tom Odom", summary: "Checked out Sound Devices MixPre 6", detail: "for DOI Interview B-Roll" },
    { id: "ev-d3", timestamp: ago(34), category: "shoot_scheduled", actor: "Dennis Colon Jr", summary: "Scheduled Library Portrait Series", detail: "Library of Congress · tomorrow" },
    { id: "ev-d4", timestamp: ago(67), category: "return", actor: "Brittany Smith", summary: "Returned Aputure 600x kit", detail: "from Studio Setup" },
    { id: "ev-d5", timestamp: ago(124), category: "asset_added", actor: "Dennis Colon Jr", summary: "Added Sigma 85mm f/1.4 Art", detail: "MMG-0000412" },
    { id: "ev-d6", timestamp: ago(245), category: "shoot_status_changed", actor: "Kevin Silverman", summary: "Marked DOI Interview B-Roll active" },
    { id: "ev-d7", timestamp: ago(380), category: "team_added", actor: "Dennis Colon Jr", summary: "Added Joon Yi to team", detail: "Video Editor · JY" },
    { id: "ev-d8", timestamp: ago(720), category: "kit_added", actor: "Dennis Colon Jr", summary: "Built Venice Cinema Kit", detail: "8 components · MMG-0000576" },
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
    events: buildDemoEvents(),
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

  /** Append an audit event to data.events. Used internally by all auditable mutators. */
  function appendEvent(d: WorkspaceData, category: AuditCategory, summary: string, opts?: { actor?: string; detail?: string }): WorkspaceData {
    const evt: AuditEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      category,
      actor: opts?.actor ?? "—",
      summary,
      detail: opts?.detail,
    };
    return { ...d, events: [evt, ...d.events] };
  }

  // --- Asset / Kit / Profile / Shoot mutators ---

  const addAsset = useCallback((asset: Asset) => {
    if (isReadOnly) return;
    updateUserData(d => appendEvent(
      { ...d, assets: [...d.assets, asset] },
      "asset_added", `Added ${asset.name}`, { detail: asset.barcode },
    ));
  }, [isReadOnly, updateUserData]);

  const addAssets = useCallback((assets: Asset[]) => {
    if (isReadOnly || assets.length === 0) return;
    updateUserData(d => appendEvent(
      { ...d, assets: [...d.assets, ...assets] },
      "asset_added", `Imported ${assets.length} asset${assets.length === 1 ? "" : "s"}`,
      { detail: assets.length <= 3 ? assets.map(a => a.name).join(", ") : `${assets.slice(0, 3).map(a => a.name).join(", ")} +${assets.length - 3} more` },
    ));
  }, [isReadOnly, updateUserData]);

  const addKit = useCallback((kit: Kit) => {
    if (isReadOnly) return;
    updateUserData(d => appendEvent(
      { ...d, kits: [...d.kits, kit] },
      "kit_added", `Built ${kit.name}`,
      { detail: `${kit.componentIds.length} component${kit.componentIds.length === 1 ? "" : "s"} · ${kit.barcode}` },
    ));
  }, [isReadOnly, updateUserData]);

  const addProfile = useCallback((profile: UserProfile) => {
    if (isReadOnly) return;
    updateUserData(d => appendEvent(
      { ...d, profiles: [...d.profiles, profile] },
      "team_added", `Added ${profile.name} to team`,
      { detail: `${profile.role} · ${profile.initials}` },
    ));
  }, [isReadOnly, updateUserData]);

  const addProfiles = useCallback((profiles: UserProfile[]) => {
    if (isReadOnly || profiles.length === 0) return;
    updateUserData(d => appendEvent(
      { ...d, profiles: [...d.profiles, ...profiles] },
      "team_added", `Added ${profiles.length} team member${profiles.length === 1 ? "" : "s"}`,
    ));
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
    updateUserData(d => appendEvent(
      { ...d, managerMode: on },
      "manager_mode", on ? "Manager mode turned ON" : "Manager mode turned OFF",
    ));
  }, [isReadOnly, updateUserData]);

  const addShoot = useCallback((shoot: Shoot) => {
    if (isReadOnly) return;
    updateUserData(d => appendEvent(
      { ...d, shoots: [...d.shoots, shoot] },
      "shoot_scheduled", `Scheduled ${shoot.title}`,
      { detail: `${shoot.client} · ${shoot.assignedTeam.length} team · ${shoot.assignedKits.length} kit${shoot.assignedKits.length === 1 ? "" : "s"}` },
    ));
  }, [isReadOnly, updateUserData]);

  const updateShoot = useCallback((id: string, patch: Partial<Shoot>) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const before = d.shoots.find(s => s.id === id);
      const next = { ...d, shoots: d.shoots.map(s => s.id === id ? { ...s, ...patch } : s) };
      if (!before) return next;
      // Differentiate status change from generic edit
      if (patch.status && patch.status !== before.status) {
        return appendEvent(next, "shoot_status_changed",
          `${before.title} marked ${patch.status}`);
      }
      return appendEvent(next, "shoot_updated", `Updated ${before.title}`);
    });
  }, [isReadOnly, updateUserData]);

  const deleteShoot = useCallback((id: string) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const target = d.shoots.find(s => s.id === id);
      const next = { ...d, shoots: d.shoots.filter(s => s.id !== id) };
      if (!target) return next;
      return appendEvent(next, "shoot_deleted", `Deleted ${target.title}`);
    });
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

      const next = {
        ...d,
        kits: d.kits.map(k => args.kitIds.includes(k.id) ? { ...k, status: "out" as const } : k),
        assets: d.assets.map(a => allComponentIds.includes(a.id)
          ? { ...a, status: "out" as const, lastUser: args.user.name, lastUpdated: checkout.checkedOutAtLabel }
          : a),
        checkouts: [...d.checkouts, checkout],
      };
      return appendEvent(next, "checkout",
        `${args.user.name} checked out ${targetKits.length === 1 ? targetKits[0].name : `${targetKits.length} kits`}`,
        { actor: args.user.name, detail: `for ${args.shootTitle}` });
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

      const next = {
        ...d,
        kits: d.kits.map(k => kitIds.includes(k.id) ? { ...k, status: "available" as const } : k),
        assets: d.assets.map(a => assetIds.includes(a.id)
          ? { ...a, status: "in" as const, lastUpdated: now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }
          : a),
        checkouts: d.checkouts.map(c => c.id === checkoutId
          ? ({ ...active, status: "returned" as const, returnedAtISO: now.toISOString() } as ActiveCheckout)
          : c),
      };
      return appendEvent(next, "return",
        `${active.user} returned ${active.kits.length === 1 ? active.kits[0] : `${active.kits.length} kits`}`,
        { actor: active.user, detail: `from ${active.shoot}` });
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
