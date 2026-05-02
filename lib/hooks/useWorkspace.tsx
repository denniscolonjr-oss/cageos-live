"use client";
import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";
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
import type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory, ServiceFlag, RepairNote, FlagStatus, FlagSeverity } from "./workspaceTypes";

// Re-export types so existing imports from useWorkspace keep working
export type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory, ServiceFlag, RepairNote, FlagStatus, FlagSeverity };

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
  flags: [],
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

function buildDemoFlags(): ServiceFlag[] {
  const now = Date.now();
  function hoursAgo(h: number): string { return new Date(now - h * 60 * 60 * 1000).toISOString(); }
  return [
    {
      id: "fl-d1",
      assetId: "MMG-0000005", // Sigma 85MM
      severity: "critical",
      reason: "Front element scratched diagonally across the coating during teardown after the Capitol shoot last Friday. Visible in test images, soft focus on infinity, unusable for client deliverables.",
      flaggedBy: "Clay Foltz",
      flaggedAtISO: hoursAgo(28),
      status: "in_repair",
      repairNotes: [
        {
          id: "rn-d1a", timestamp: hoursAgo(26), author: "Dennis Colon Jr",
          actionType: "diagnostic",
          body: "Inspected under bright light, scratch confirmed approximately 4mm long across the front element. Also noted minor coating delamination near the edge of the scratch line.",
        },
        {
          id: "rn-d1b", timestamp: hoursAgo(20), author: "Dennis Colon Jr",
          actionType: "sent_to_vendor",
          body: "Shipped to Sigma USA service center in Ronkonkoma NY for front element replacement and recoating, RMA number 14223 issued, expected return in roughly fourteen business days.",
        },
      ],
    },
    {
      id: "fl-d2",
      assetId: "MMG-0000023", // ULXD2 Handheld
      severity: "warning",
      reason: "Battery contacts are oxidized and intermittent — receiver loses signal for two to three seconds at a time when handheld is rotated downward, traced to corroded battery terminal.",
      flaggedBy: "Brittany Smith",
      flaggedAtISO: hoursAgo(8),
      status: "open",
      repairNotes: [],
    },
    {
      id: "fl-d3",
      assetId: "MMG-0000002", // SmallHD Monitor
      severity: "warning",
      reason: "HDMI input one shows intermittent signal dropout when cable is wiggled at the connector, suspect internal board solder joint cold or hairline cracked, input two unaffected so far.",
      flaggedBy: "Dennis Colon Jr",
      flaggedAtISO: hoursAgo(140),
      status: "resolved",
      repairNotes: [
        {
          id: "rn-d3a", timestamp: hoursAgo(130), author: "Dennis Colon Jr",
          actionType: "diagnostic",
          body: "Confirmed dropout reproducible by flexing cable. Opened the unit and reflowed solder joints on the HDMI one input board. Tested across multiple cables successfully afterward.",
        },
        {
          id: "rn-d3b", timestamp: hoursAgo(120), author: "Dennis Colon Jr",
          actionType: "tested",
          body: "Ran a six-hour soak test feeding 4K signal continuously while flexing cable at random intervals. No dropouts observed, signal lock remained stable throughout the entire test period.",
        },
      ],
      resolvedAtISO: hoursAgo(118),
      resolvedBy: "Dennis Colon Jr",
      resolutionSummary: "Reflow on HDMI one input board solved the issue completely. Soak tested for six hours under stress with no signal dropout. Returned to active inventory ready for production.",
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
    events: buildDemoEvents(),
    flags: buildDemoFlags(),
    orgName: "MMG Production",
    orgLocation: "DC",
    barcodePrefix: "MMG",
    filterableFields: ["category", "make", "location"],
    timezone: "auto",
    managerMode: false,
  };
}

function useWorkspaceImpl() {
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

  // Cross-tab sync: when another tab on the same origin writes to localStorage,
  // the browser fires a `storage` event in this tab. Re-load and apply.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleStorage(e: StorageEvent) {
      // Only react to our keys; ignore unrelated localStorage activity.
      if (e.key === "cageos:workspace:v3") {
        const stored = adapter.load();
        if (stored) setUserData(stored);
      } else if (e.key === "cageos:mode:v1") {
        setMode(modeAdapter.loadMode());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
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

  /** Patch any subset of an asset's fields. Used by the asset detail editor. */
  const updateAsset = useCallback((assetId: string, patch: Partial<Asset>) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const before = d.assets.find(a => a.id === assetId);
      if (!before) return d;
      const next = { ...d, assets: d.assets.map(a => a.id === assetId ? { ...a, ...patch } : a) };
      return appendEvent(next, "asset_added", `Updated ${before.name}`, { detail: before.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /** Remove an asset entirely. Cleans up kit membership and any open flags too. */
  const deleteAsset = useCallback((assetId: string): (() => void) | null => {
    if (isReadOnly) return null;
    let snapshot: WorkspaceData | null = null;
    updateUserData(d => {
      const target = d.assets.find(a => a.id === assetId);
      if (!target) return d;
      snapshot = d; // capture pre-delete state
      const next = {
        ...d,
        assets: d.assets.filter(a => a.id !== assetId),
        kits: d.kits.map(k => k.componentIds.includes(assetId)
          ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
          : k),
        flags: d.flags.map(f => f.assetId === assetId && f.status !== "resolved"
          ? { ...f, status: "resolved" as const, resolvedAtISO: new Date().toISOString(), resolvedBy: "system", resolutionSummary: "Asset deleted." }
          : f),
      };
      return appendEvent(next, "asset_added", `Deleted ${target.name}`, { detail: target.barcode });
    });
    if (!snapshot) return null;
    const captured = snapshot;
    return () => updateUserData(() => appendEvent(captured, "asset_added", `Restored deleted asset`));
  }, [isReadOnly, updateUserData]);

  /** Patch a kit's fields. */
  const updateKit = useCallback((kitId: string, patch: Partial<Kit>) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const before = d.kits.find(k => k.id === kitId);
      if (!before) return d;
      const next = { ...d, kits: d.kits.map(k => k.id === kitId ? { ...k, ...patch } : k) };
      return appendEvent(next, "kit_added", `Updated ${before.name}`, { detail: before.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /** Delete a kit. Components stay in inventory but lose their kitId reference. */
  const deleteKit = useCallback((kitId: string): (() => void) | null => {
    if (isReadOnly) return null;
    let snapshot: WorkspaceData | null = null;
    updateUserData(d => {
      const target = d.kits.find(k => k.id === kitId);
      if (!target) return d;
      snapshot = d;
      const next = {
        ...d,
        kits: d.kits.filter(k => k.id !== kitId),
        assets: d.assets.map(a => a.kitId === kitId ? { ...a, kitId: null } : a),
        shoots: d.shoots.map(s => s.assignedKits.includes(kitId)
          ? { ...s, assignedKits: s.assignedKits.filter(id => id !== kitId) }
          : s),
      };
      return appendEvent(next, "kit_added", `Deleted ${target.name}`, { detail: target.barcode });
    });
    if (!snapshot) return null;
    const captured = snapshot;
    return () => updateUserData(() => appendEvent(captured, "kit_added", `Restored deleted kit`));
  }, [isReadOnly, updateUserData]);

  /** Attach a single asset to a kit. Removes from any prior kit first. */
  const attachAssetToKit = useCallback((assetId: string, kitId: string) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const asset = d.assets.find(a => a.id === assetId);
      const kit = d.kits.find(k => k.id === kitId);
      if (!asset || !kit) return d;
      const next = {
        ...d,
        // Remove asset from any prior kit's componentIds
        kits: d.kits.map(k => {
          if (k.id === kitId) {
            return k.componentIds.includes(assetId)
              ? k
              : { ...k, componentIds: [...k.componentIds, assetId] };
          }
          return k.componentIds.includes(assetId)
            ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
            : k;
        }),
        assets: d.assets.map(a => a.id === assetId ? { ...a, kitId } : a),
      };
      return appendEvent(next, "kit_added", `Added ${asset.name} to ${kit.name}`, { detail: kit.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /** Remove an asset from its kit. Asset stays in inventory. */
  const detachAssetFromKit = useCallback((assetId: string) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const asset = d.assets.find(a => a.id === assetId);
      if (!asset || !asset.kitId) return d;
      const kit = d.kits.find(k => k.id === asset.kitId);
      const next = {
        ...d,
        kits: d.kits.map(k => k.id === asset.kitId
          ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
          : k),
        assets: d.assets.map(a => a.id === assetId ? { ...a, kitId: null } : a),
      };
      return appendEvent(next, "kit_added", `Removed ${asset.name} from ${kit?.name ?? "kit"}`, { detail: kit?.barcode });
    });
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

  /** Patch any subset of a profile's fields. */
  const updateProfile = useCallback((profileId: string, patch: Partial<UserProfile>) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const before = d.profiles.find(p => p.id === profileId);
      if (!before) return d;
      const next = { ...d, profiles: d.profiles.map(p => p.id === profileId ? { ...p, ...patch } : p) };
      return appendEvent(next, "team_added", `Updated ${before.name}'s profile`, { detail: before.initials });
    });
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

  const deleteShoot = useCallback((id: string): (() => void) | null => {
    if (isReadOnly) return null;
    let snapshot: WorkspaceData | null = null;
    updateUserData(d => {
      const target = d.shoots.find(s => s.id === id);
      if (!target) return d;
      snapshot = d;
      const next = { ...d, shoots: d.shoots.filter(s => s.id !== id) };
      return appendEvent(next, "shoot_deleted", `Deleted ${target.title}`);
    });
    if (!snapshot) return null;
    const captured = snapshot;
    return () => updateUserData(() => appendEvent(captured, "shoot_scheduled", `Restored deleted shoot`));
  }, [isReadOnly, updateUserData]);

  // --- Service flag mutators ---

  /** Open a new flag on an asset. Reason should be 20+ words (UI enforces). */
  const flagAsset = useCallback((args: {
    assetId: string;
    severity: FlagSeverity;
    reason: string;
    flaggedBy: string;
  }): ServiceFlag | null => {
    if (isReadOnly) return null;
    let createdFlag: ServiceFlag | null = null;
    updateUserData(d => {
      const asset = d.assets.find(a => a.id === args.assetId);
      if (!asset) return d;
      const flag: ServiceFlag = {
        id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        assetId: args.assetId,
        severity: args.severity,
        reason: args.reason,
        flaggedBy: args.flaggedBy,
        flaggedAtISO: new Date().toISOString(),
        status: "open",
        repairNotes: [],
      };
      createdFlag = flag;
      // Also reflect on the asset itself for any UI still reading asset.serviceFlag
      const next = {
        ...d,
        flags: [flag, ...d.flags],
        assets: d.assets.map(a => a.id === args.assetId
          ? { ...a, status: "flagged" as const, serviceFlag: { severity: args.severity, reason: args.reason } }
          : a),
      };
      return appendEvent(next, "flag_opened",
        `${args.flaggedBy} flagged ${asset.name}`,
        { actor: args.flaggedBy, detail: `${args.severity} · ${asset.barcode}` });
    });
    return createdFlag;
  }, [isReadOnly, updateUserData]);

  /** Append a repair note to an existing flag. Body should be 20+ words. */
  const addRepairNote = useCallback((args: {
    flagId: string;
    author: string;
    actionType: RepairNote["actionType"];
    body: string;
  }) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const flag = d.flags.find(f => f.id === args.flagId);
      if (!flag) return d;
      const note: RepairNote = {
        id: `rn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        author: args.author,
        actionType: args.actionType,
        body: args.body,
      };
      const updatedFlag: ServiceFlag = {
        ...flag,
        repairNotes: [...flag.repairNotes, note],
        // sent_to_vendor implies status moves to in_repair if currently open
        status: (args.actionType === "sent_to_vendor" && flag.status === "open") ? "in_repair" : flag.status,
      };
      const next = {
        ...d,
        flags: d.flags.map(f => f.id === args.flagId ? updatedFlag : f),
      };
      const asset = d.assets.find(a => a.id === flag.assetId);
      const eventCategory: AuditCategory = (args.actionType === "sent_to_vendor" && flag.status === "open")
        ? "flag_status_changed" : "flag_note_added";
      const summary = (args.actionType === "sent_to_vendor" && flag.status === "open")
        ? `${asset?.name ?? "Asset"} sent for repair`
        : `Repair note added to ${asset?.name ?? "asset"}`;
      return appendEvent(next, eventCategory, summary,
        { actor: args.author, detail: args.actionType.replace(/_/g, " ") });
    });
  }, [isReadOnly, updateUserData]);

  /** Resolve a flag with a 20+ word resolution summary. */
  const resolveFlag = useCallback((args: {
    flagId: string;
    resolvedBy: string;
    resolutionSummary: string;
  }) => {
    if (isReadOnly) return;
    updateUserData(d => {
      const flag = d.flags.find(f => f.id === args.flagId);
      if (!flag) return d;
      const resolvedFlag: ServiceFlag = {
        ...flag,
        status: "resolved",
        resolvedAtISO: new Date().toISOString(),
        resolvedBy: args.resolvedBy,
        resolutionSummary: args.resolutionSummary,
      };

      // Recompute the asset's serviceFlag: the most recent OTHER open flag, or null
      const otherOpenFlag = d.flags
        .filter(f => f.id !== args.flagId && f.assetId === flag.assetId && f.status !== "resolved")
        .sort((a, b) => b.flaggedAtISO.localeCompare(a.flaggedAtISO))[0];

      const next = {
        ...d,
        flags: d.flags.map(f => f.id === args.flagId ? resolvedFlag : f),
        assets: d.assets.map(a => a.id === flag.assetId
          ? {
              ...a,
              status: otherOpenFlag ? "flagged" as const : "in" as const,
              serviceFlag: otherOpenFlag
                ? { severity: otherOpenFlag.severity, reason: otherOpenFlag.reason }
                : null,
            }
          : a),
      };
      const asset = d.assets.find(a => a.id === flag.assetId);
      return appendEvent(next, "flag_resolved",
        `${asset?.name ?? "Asset"} flag resolved`,
        { actor: args.resolvedBy, detail: asset?.barcode });
    });
  }, [isReadOnly, updateUserData]);

  // --- Checkout / Return ---

  /**
   * Check out one or more kits (with their components) to a user.
   * - Marks each kit's status to "out"
   * - Marks each kit component asset's status to "out", sets lastUser/lastUpdated
   * - Adds a new ActiveCheckout entry to data.checkouts
   *
   * Note: this does NOT check for blocking flags — call `getBlockingFlags(kitIds)`
   * before invoking this if you want to prevent flagged-asset checkouts.
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

  /**
   * Compute kit status from its components instead of trusting the stored field.
   * - All components "in" → "available"
   * - All components "out" → "out"
   * - Mixed → "partial"
   * - No components → "available" (empty kits)
   */
  function computeKitStatus(kit: Kit): "available" | "out" | "partial" {
    if (kit.componentIds.length === 0) return "available";
    const components = data.assets.filter(a => kit.componentIds.includes(a.id));
    if (components.length === 0) return "available";
    const out = components.filter(a => a.status === "out").length;
    if (out === 0) return "available";
    if (out === components.length) return "out";
    return "partial";
  }

  /** All kits with their status field overridden by the computed value. */
  const kits = data.kits.map(k => ({ ...k, status: computeKitStatus(k) }));

  /** All open or in-repair flags (anything not yet resolved). */
  const openFlags = data.flags.filter(f => f.status !== "resolved");

  /** All flag history for a given asset, newest first. */
  const flagsForAsset = useCallback((assetId: string): ServiceFlag[] => {
    return data.flags
      .filter(f => f.assetId === assetId)
      .sort((a, b) => b.flaggedAtISO.localeCompare(a.flaggedAtISO));
  }, [data.flags]);

  /** Returns the asset names that would block checkout because they have an open flag.
   *  Empty array means safe to proceed. */
  const getBlockingFlags = useCallback((kitIds: string[]): { assetName: string; severity: FlagSeverity; reason: string }[] => {
    const targetKits = data.kits.filter(k => kitIds.includes(k.id));
    const componentIds = new Set(targetKits.flatMap(k => k.componentIds));
    const blocked: { assetName: string; severity: FlagSeverity; reason: string }[] = [];
    for (const f of data.flags) {
      if (f.status === "resolved") continue;
      if (!componentIds.has(f.assetId)) continue;
      const asset = data.assets.find(a => a.id === f.assetId);
      blocked.push({
        assetName: asset?.name ?? f.assetId,
        severity: f.severity,
        reason: f.reason,
      });
    }
    return blocked;
  }, [data.flags, data.kits, data.assets]);

  const stats = mode === "demo" ? DEMO_STATS : {
    totalAssets: data.assets.length,
    checkedIn: data.assets.filter(a => a.status === "in").length,
    checkedOut: data.assets.filter(a => a.status === "out").length,
    serviceFlags: openFlags.length,
    criticalFlags: openFlags.filter(f => f.severity === "critical").length,
    kitDriftEvents: 0,
    knownInventoryValue: data.assets.reduce((sum, a) => sum + (a.cost || 0), 0),
  };

  // Override kits in returned data with computed-status versions
  const dataWithComputedKits: WorkspaceData = { ...data, kits };

  return {
    data: dataWithComputedKits,
    mode,
    hydrated,
    isReadOnly,
    isEmpty: mode !== "demo" && data.assets.length === 0 && data.profiles.length === 0,
    stats,
    activeCheckouts,
    switchMode,
    addAsset,
    addAssets,
    updateAsset,
    deleteAsset,
    addKit,
    updateKit,
    deleteKit,
    attachAssetToKit,
    detachAssetFromKit,
    addProfile,
    addProfiles,
    updateProfile,
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
    flagAsset,
    addRepairNote,
    resolveFlag,
    flagsForAsset,
    getBlockingFlags,
    openFlags,
    resetWorkspace,
    adapterName: adapter.name,
  };
}

// =============================================================
// Workspace context — single source of truth across the app
// =============================================================
//
// Every component that calls `useWorkspace()` reads from the same provider
// instance. Without this, each component held its own React state and got out
// of sync the moment any other component mutated localStorage.
//
// The `WorkspaceProvider` mounts once in the root layout. `useWorkspace`
// reads from it. The public API of `useWorkspace` is unchanged — the entire
// rest of the codebase keeps working without modification.

type WorkspaceContextValue = ReturnType<typeof useWorkspaceImpl>;
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const value = useWorkspaceImpl();
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

/**
 * Consume the workspace context. Public API identical to the previous hook —
 * every existing call site keeps working as-is.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error(
      "useWorkspace must be used inside <WorkspaceProvider>. Mount it in app/layout.tsx."
    );
  }
  return ctx;
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
