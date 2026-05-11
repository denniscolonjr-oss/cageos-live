"use client";
import { useState, useEffect, useCallback, createContext, useContext, useMemo, type ReactNode } from "react";
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
  type Note,
} from "@/lib/data";
import { localStorageAdapter, localStorageModeAdapter } from "@/lib/storage/localStorageAdapter";
import type { StorageAdapter } from "@/lib/storage/StorageAdapter";
import { useAuth, type WorkspaceRole } from "@/lib/supabase/AuthContext";
import { createSupabaseAdapter } from "@/lib/supabase/supabaseAdapter";
import type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory, ServiceFlag, RepairNote, FlagStatus, FlagSeverity, DeleteResult } from "./workspaceTypes";

// Re-export types so existing imports from useWorkspace keep working
export type { WorkspaceData, WorkspaceMode, Shoot, ActiveCheckout, AuditEvent, AuditCategory, ServiceFlag, RepairNote, FlagStatus, FlagSeverity, DeleteResult };

const modeAdapter = localStorageModeAdapter;

const EMPTY_WORKSPACE: WorkspaceData = {
  assets: [],
  kits: [],
  checkouts: [],
  alerts: [],
  profiles: [],
  shoots: [],
  events: [],
  flags: [],
  notes: [],
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
    notes: [],
    orgName: "MMG Production",
    orgLocation: "DC",
    barcodePrefix: "MMG",
    filterableFields: ["category", "make", "location"],
    timezone: "auto",
    managerMode: false,
  };
}

function useWorkspaceImpl() {
  const auth = useAuth();
  const [mode, setMode] = useState<WorkspaceMode>("unset");
  const [userData, setUserData] = useState<WorkspaceData>(EMPTY_WORKSPACE);
  const [hydrated, setHydrated] = useState(false);

  // Choose the right adapter for the current auth state:
  // - Authenticated user with active workspace → Supabase adapter for that workspace
  // - Otherwise → localStorage adapter (anonymous demo / dev)
  const adapter: StorageAdapter = useMemo(() => {
    if (auth.supabaseEnabled && auth.session && auth.activeWorkspaceId) {
      return createSupabaseAdapter(auth.activeWorkspaceId);
    }
    return localStorageAdapter;
  }, [auth.supabaseEnabled, auth.session, auth.activeWorkspaceId]);

  // Initial load + reload whenever the adapter changes (e.g., user logs in or switches workspace)
  useEffect(() => {
    if (auth.loading) return; // Wait for auth to resolve before loading
    // CRITICAL: when we have a session but activeWorkspaceId is still being
    // populated (refreshWorkspaces is async), the adapter is still localStorage.
    // Don't load from localStorage in that gap — it would cause a brief
    // empty-state flash before the Supabase adapter takes over.
    if (auth.session && !auth.activeWorkspaceId) {
      setHydrated(false);
      return;
    }
    let cancelled = false;
    setHydrated(false);
    // Mode resolution rules:
    // - If signed in → ALWAYS "user" mode (Supabase data wins; never flash demo)
    // - If signed out → respect stored mode (could be "user" or "demo")
    const storedMode = modeAdapter.loadMode();
    const resolvedMode: WorkspaceMode = auth.session ? "user" : storedMode;
    adapter.load().then(stored => {
      if (cancelled) return;
      if (stored) setUserData(stored);
      else setUserData(EMPTY_WORKSPACE);
      setMode(resolvedMode);
      setHydrated(true);
    }).catch(err => {
      console.error("Workspace load failed:", err);
      if (!cancelled) {
        setUserData(EMPTY_WORKSPACE);
        setMode(resolvedMode);
        setHydrated(true);
      }
    });
    return () => { cancelled = true; };
  }, [adapter, auth.loading, auth.session, auth.activeWorkspaceId]);

  // Cross-tab + real-time sync.
  // For localStorage: listens to the browser's storage event.
  // For Supabase: subscribes to row-level updates via the adapter.
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Real-time subscription if the adapter supports it (Supabase)
    if (adapter.subscribe) {
      const unsub = adapter.subscribe(newData => {
        setUserData(newData);
      });
      return unsub;
    }

    // Cross-tab fallback for localStorage
    function handleStorage(e: StorageEvent) {
      if (e.key === "cageos:workspace:v3") {
        adapter.load().then(stored => {
          if (stored) setUserData(stored);
        });
      } else if (e.key === "cageos:mode:v1") {
        setMode(modeAdapter.loadMode());
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [adapter]);

  /**
   * Role-based access derivation. The previous `data.managerMode` boolean
   * (toggled in Settings) is now derived from the user's role in the active
   * workspace:
   *
   *   - Owner   → managerMode = true (full control)
   *   - Manager → managerMode = true
   *   - Crew    → managerMode = false (kiosk + flagging only)
   *   - Viewer  → managerMode = false AND isReadOnly = true (cannot mutate)
   *
   * Demo mode forces isReadOnly = true regardless of role. Existing UI
   * checks like `data.managerMode && !isReadOnly` keep working without
   * modification — they read the derived value.
   */
  const role = auth.currentRole;
  const isManagerByRole = role === "owner" || role === "manager";
  const isViewerOrAbsent = role === "viewer" || role === null;

  // Demo mode produces a read-only data view; otherwise use real userData.
  // managerMode is OVERRIDDEN by the derived role-based value, ignoring whatever
  // is stored in the workspace JSON.
  const rawData = mode === "demo" ? buildDemoWorkspace() : userData;
  const data: WorkspaceData = { ...rawData, managerMode: isManagerByRole };
  const isReadOnly = mode === "demo" || isViewerOrAbsent;

  /**
   * Demo mode is gated to an email allowlist. Set NEXT_PUBLIC_DEMO_USERS
   * (comma-separated emails) in your env to control which accounts can enter
   * demo mode. Signed-out visitors cannot enter demo mode — keeps prospects
   * from accidentally landing in the populated sample on first visit.
   */
  const canUseDemo = useMemo(() => {
    const allowlist = (process.env.NEXT_PUBLIC_DEMO_USERS ?? "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (allowlist.length === 0) return false;
    const email = auth.user?.email?.toLowerCase() ?? "";
    if (!email) return false;
    return allowlist.includes(email);
  }, [auth.user?.email]);

  const switchMode = useCallback((m: WorkspaceMode) => {
    // Block demo mode for users not on the allowlist
    if (m === "demo" && !canUseDemo) {
      console.warn("[switchMode] demo mode is not available for this account");
      return;
    }
    setMode(m);
    modeAdapter.saveMode(m);
  }, [canUseDemo]);

  const updateUserData = useCallback((updater: (d: WorkspaceData) => WorkspaceData) => {
    setUserData(prev => {
      const next = updater(prev);
      adapter.save(next).catch(err => console.error("Workspace save failed:", err));
      return next;
    });
  }, [adapter]);

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
  /**
   * Delete an asset.
   *
   * Returns a result object indicating what happened:
   * - { kind: "blocked", reason } — asset is checked out or in upcoming shoots, no action taken
   * - { kind: "deleted", undo } — asset had no history, hard-deleted, undo restores
   * - { kind: "archived", undo } — asset had history, soft-deleted, undo restores to active
   *
   * Returns null if not allowed (read-only mode).
   */
  const deleteAsset = useCallback((assetId: string, actor: string = "—"): DeleteResult | null => {
    if (isReadOnly) return null;
    const target = data.assets.find(a => a.id === assetId);
    if (!target) return null;

    // Safety check: asset in active checkout?
    const inActiveCheckout = data.checkouts.some(c => {
      if (c.status !== "active" && c.status !== "overdue") return false;
      const ac = c as { assetIds?: string[] };
      // Also check if the asset is in a kit that's currently checked out
      const kitContainingThis = data.kits.find(k => k.componentIds.includes(assetId));
      if (kitContainingThis) {
        const ck = c as { kitIds?: string[] };
        if (ck.kitIds?.includes(kitContainingThis.id)) return true;
      }
      return ac.assetIds?.includes(assetId) ?? false;
    });
    if (inActiveCheckout) {
      return { kind: "blocked", reason: `${target.name} is part of an active checkout. Return it first.` };
    }

    // Safety check: kit containing this asset is assigned to upcoming/active shoots?
    const kitContainingThis = data.kits.find(k => k.componentIds.includes(assetId));
    if (kitContainingThis) {
      const upcomingShoots = data.shoots.filter(s =>
        (s.status === "scheduled" || s.status === "active") &&
        s.assignedKits.includes(kitContainingThis.id),
      );
      if (upcomingShoots.length > 0) {
        return {
          kind: "blocked",
          reason: `${target.name} is in ${kitContainingThis.name} which is assigned to ${upcomingShoots.length} upcoming shoot${upcomingShoots.length === 1 ? "" : "s"}. Remove from those shoots first.`,
        };
      }
    }

    // Decide between hard delete and archive.
    // Hard delete only if: never checked out, no flags ever, not in any kit
    const everCheckedOut = data.checkouts.some(c => {
      const ac = c as { assetIds?: string[] };
      return ac.assetIds?.includes(assetId);
    });
    const everFlagged = data.flags.some(f => f.assetId === assetId);
    const isInAnyKit = data.kits.some(k => k.componentIds.includes(assetId));
    const hasHistory = everCheckedOut || everFlagged || isInAnyKit;

    if (!hasHistory) {
      // Hard delete path
      let snapshot: WorkspaceData | null = null;
      updateUserData(d => {
        snapshot = d;
        const next = { ...d, assets: d.assets.filter(a => a.id !== assetId) };
        return appendEvent(next, "asset_archived", `Deleted ${target.name}`, { actor, detail: target.barcode });
      });
      if (!snapshot) return null;
      const captured = snapshot;
      return {
        kind: "deleted",
        undo: () => updateUserData(() => appendEvent(captured, "asset_restored", `Restored ${target.name}`, { actor })),
      };
    }

    // Archive path
    let snapshot: WorkspaceData | null = null;
    const now = new Date().toISOString();
    updateUserData(d => {
      snapshot = d;
      const next = {
        ...d,
        // Mark archived but keep the row
        assets: d.assets.map(a => a.id === assetId
          ? { ...a, archivedAt: now, archivedBy: actor, kitId: null }
          : a),
        // Auto-detach from any kit
        kits: d.kits.map(k => k.componentIds.includes(assetId)
          ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
          : k),
        // Resolve any open flags
        flags: d.flags.map(f => f.assetId === assetId && f.status !== "resolved"
          ? { ...f, status: "resolved" as const, resolvedAtISO: now, resolvedBy: actor, resolutionSummary: "Asset archived." }
          : f),
      };
      return appendEvent(next, "asset_archived", `Archived ${target.name}`, { actor, detail: target.barcode });
    });
    if (!snapshot) return null;
    const captured = snapshot;
    return {
      kind: "archived",
      undo: () => updateUserData(() => appendEvent(captured, "asset_restored", `Restored ${target.name}`, { actor })),
    };
  }, [isReadOnly, updateUserData, data]);

  /** Restore a previously archived asset to active inventory. */
  const restoreAsset = useCallback((assetId: string, actor: string = "—") => {
    if (isReadOnly) return;
    updateUserData(d => {
      const target = d.assets.find(a => a.id === assetId);
      if (!target || !target.archivedAt) return d;
      const next = {
        ...d,
        assets: d.assets.map(a => a.id === assetId
          ? { ...a, archivedAt: undefined, archivedBy: undefined, archivedReason: undefined, status: "in" as const }
          : a),
      };
      return appendEvent(next, "asset_restored", `Restored ${target.name} to active inventory`, { actor, detail: target.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /**
   * Permanently delete an asset. No archive, no undo. Use sparingly.
   *
   * Removes the asset row, strips it from any kit's componentIds, and
   * leaves audit log entries intact (they reference the id but the row
   * is gone — that's intentional). Caller is responsible for confirming
   * with the user; the mutator just executes.
   */
  const permanentDeleteAsset = useCallback((assetId: string, actor: string = "—") => {
    if (isReadOnly) return;
    // Permanent delete is destructive and irrecoverable — Owner only.
    // Managers can archive (recoverable); only Owners can hard-delete.
    if (role !== "owner") {
      console.warn("[permanentDeleteAsset] denied — owner role required");
      return;
    }
    updateUserData(d => {
      const target = d.assets.find(a => a.id === assetId);
      if (!target) return d;
      const next = {
        ...d,
        assets: d.assets.filter(a => a.id !== assetId),
        kits: d.kits.map(k => k.componentIds.includes(assetId)
          ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
          : k),
        flags: d.flags.filter(f => f.assetId !== assetId),
      };
      return appendEvent(next, "asset_archived", `Permanently deleted ${target.name}`, { actor, detail: target.barcode });
    });
  }, [isReadOnly, role, updateUserData]);

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

  /**
   * Delete a kit. Same safety + archival pattern as deleteAsset.
   */
  const deleteKit = useCallback((kitId: string, actor: string = "—"): DeleteResult | null => {
    if (isReadOnly) return null;
    const target = data.kits.find(k => k.id === kitId);
    if (!target) return null;

    // Safety: kit currently checked out?
    const isCheckedOut = data.checkouts.some(c => {
      if (c.status !== "active" && c.status !== "overdue") return false;
      const ck = c as { kitIds?: string[] };
      return ck.kitIds?.includes(kitId) ?? false;
    });
    if (isCheckedOut) {
      return { kind: "blocked", reason: `${target.name} is currently checked out. Return it first.` };
    }

    // Safety: assigned to upcoming/active shoots?
    const upcomingShoots = data.shoots.filter(s =>
      (s.status === "scheduled" || s.status === "active") && s.assignedKits.includes(kitId),
    );
    if (upcomingShoots.length > 0) {
      return {
        kind: "blocked",
        reason: `${target.name} is assigned to ${upcomingShoots.length} upcoming shoot${upcomingShoots.length === 1 ? "" : "s"}. Remove from those shoots first.`,
      };
    }

    // Hard delete only if kit has no checkout history AND no components
    const everCheckedOut = data.checkouts.some(c => {
      const ck = c as { kitIds?: string[] };
      return ck.kitIds?.includes(kitId);
    });
    const hasHistory = everCheckedOut || target.componentIds.length > 0;

    if (!hasHistory) {
      let snapshot: WorkspaceData | null = null;
      updateUserData(d => {
        snapshot = d;
        const next = { ...d, kits: d.kits.filter(k => k.id !== kitId) };
        return appendEvent(next, "kit_archived", `Deleted ${target.name}`, { actor, detail: target.barcode });
      });
      if (!snapshot) return null;
      const captured = snapshot;
      return {
        kind: "deleted",
        undo: () => updateUserData(() => appendEvent(captured, "kit_restored", `Restored ${target.name}`, { actor })),
      };
    }

    // Archive path
    let snapshot: WorkspaceData | null = null;
    const now = new Date().toISOString();
    updateUserData(d => {
      snapshot = d;
      const next = {
        ...d,
        kits: d.kits.map(k => k.id === kitId
          ? { ...k, archivedAt: now, archivedBy: actor }
          : k),
        // Detach assets from this kit
        assets: d.assets.map(a => a.kitId === kitId ? { ...a, kitId: null } : a),
        // Remove from any shoots
        shoots: d.shoots.map(s => s.assignedKits.includes(kitId)
          ? { ...s, assignedKits: s.assignedKits.filter(id => id !== kitId) }
          : s),
      };
      return appendEvent(next, "kit_archived", `Archived ${target.name}`, { actor, detail: target.barcode });
    });
    if (!snapshot) return null;
    const captured = snapshot;
    return {
      kind: "archived",
      undo: () => updateUserData(() => appendEvent(captured, "kit_restored", `Restored ${target.name}`, { actor })),
    };
  }, [isReadOnly, updateUserData, data]);

  /** Restore a previously archived kit. */
  const restoreKit = useCallback((kitId: string, actor: string = "—") => {
    if (isReadOnly) return;
    updateUserData(d => {
      const target = d.kits.find(k => k.id === kitId);
      if (!target || !target.archivedAt) return d;
      const next = {
        ...d,
        kits: d.kits.map(k => k.id === kitId
          ? { ...k, archivedAt: undefined, archivedBy: undefined, archivedReason: undefined }
          : k),
      };
      return appendEvent(next, "kit_restored", `Restored ${target.name}`, { actor, detail: target.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /** Permanently delete a kit. No archive, no undo. Owner only. */
  const permanentDeleteKit = useCallback((kitId: string, actor: string = "—") => {
    if (isReadOnly) return;
    if (role !== "owner") {
      console.warn("[permanentDeleteKit] denied — owner role required");
      return;
    }
    updateUserData(d => {
      const target = d.kits.find(k => k.id === kitId);
      if (!target) return d;
      const next = {
        ...d,
        kits: d.kits.filter(k => k.id !== kitId),
        assets: d.assets.map(a => a.kitId === kitId ? { ...a, kitId: null } : a),
        shoots: d.shoots.map(s => s.assignedKits.includes(kitId)
          ? { ...s, assignedKits: s.assignedKits.filter(id => id !== kitId) }
          : s),
      };
      return appendEvent(next, "kit_archived", `Permanently deleted ${target.name}`, { actor, detail: target.barcode });
    });
  }, [isReadOnly, role, updateUserData]);

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
      if (!asset) return d;
      // Find kit by walking componentIds — don't rely on asset.kitId being in sync
      const kit = d.kits.find(k => k.componentIds.includes(assetId));
      if (!kit) {
        // Asset isn't in any kit, but clear stale kitId if set
        if (asset.kitId) {
          return { ...d, assets: d.assets.map(a => a.id === assetId ? { ...a, kitId: null } : a) };
        }
        return d;
      }
      const next = {
        ...d,
        kits: d.kits.map(k => k.id === kit.id
          ? { ...k, componentIds: k.componentIds.filter(id => id !== assetId) }
          : k),
        assets: d.assets.map(a => a.id === assetId ? { ...a, kitId: null } : a),
      };
      return appendEvent(next, "kit_composition_changed", `Removed ${asset.name} from ${kit.name}`, { detail: kit.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /**
   * Attach multiple assets to a kit at once. Each asset is removed from any
   * prior kit it belonged to. One audit event for the whole batch.
   */
  const attachAssetsToKit = useCallback((assetIds: string[], kitId: string, actor: string = "—") => {
    if (isReadOnly || assetIds.length === 0) return;
    updateUserData(d => {
      const kit = d.kits.find(k => k.id === kitId);
      if (!kit) return d;
      const idSet = new Set(assetIds);
      const next = {
        ...d,
        // Mark each attached asset's kitId
        assets: d.assets.map(a => idSet.has(a.id) ? { ...a, kitId } : a),
        // Update each kit: remove these assets if they were elsewhere, add to target
        kits: d.kits.map(k => {
          if (k.id === kitId) {
            const merged = Array.from(new Set([...k.componentIds, ...assetIds]));
            return { ...k, componentIds: merged };
          }
          // Strip from other kits
          if (k.componentIds.some(id => idSet.has(id))) {
            return { ...k, componentIds: k.componentIds.filter(id => !idSet.has(id)) };
          }
          return k;
        }),
      };
      const summary = assetIds.length === 1
        ? `Added 1 component to ${kit.name}`
        : `Added ${assetIds.length} components to ${kit.name}`;
      return appendEvent(next, "kit_composition_changed", summary, { actor, detail: kit.barcode });
    });
  }, [isReadOnly, updateUserData]);

  /**
   * Swap one component in a kit for another. Atomic operation: old leaves,
   * new joins, single audit event documents both sides of the change.
   */
  /**
   * Swap one component in a kit for another. The old leaves, the new joins.
   * Implemented as one atomic state update for a single audit event.
   *
   * NOTE: This is a critical kit-prep path — when buggy, kits silently lose
   * components and shoots blow up. Logs are kept on so failures surface in
   * console rather than hiding silently.
   */
  const swapKitComponent = useCallback((oldAssetId: string, newAssetId: string, actor: string = "—") => {
    if (isReadOnly) {
      console.warn("[swapKitComponent] blocked: workspace is read-only");
      return;
    }
    updateUserData(d => {
      const oldAsset = d.assets.find(a => a.id === oldAssetId);
      const newAsset = d.assets.find(a => a.id === newAssetId);
      if (!oldAsset) {
        console.warn("[swapKitComponent] oldAsset not found:", oldAssetId);
        return d;
      }
      if (!newAsset) {
        console.warn("[swapKitComponent] newAsset not found:", newAssetId);
        return d;
      }
      // Find target kit by walking componentIds — don't trust asset.kitId
      const kit = d.kits.find(k => k.componentIds.includes(oldAssetId));
      if (!kit) {
        console.warn("[swapKitComponent] no kit contains oldAsset:", oldAssetId, "; available kits had components:", d.kits.map(k => ({ id: k.id, name: k.name, n: k.componentIds.length })));
        return d;
      }
      // Compose the new state in two passes for clarity:
      // 1. Update assets: clear oldAsset.kitId, set newAsset.kitId
      const nextAssets = d.assets.map(a => {
        if (a.id === oldAssetId) return { ...a, kitId: null };
        if (a.id === newAssetId) return { ...a, kitId: kit.id };
        return a;
      });
      // 2. Update kits:
      //    - target kit: replace oldAssetId with newAssetId in componentIds
      //    - any other kit that had newAssetId: remove it
      const nextKits = d.kits.map(k => {
        if (k.id === kit.id) {
          // Replace old with new. If new was already in this kit somehow, dedupe.
          const replaced = k.componentIds
            .map(id => id === oldAssetId ? newAssetId : id)
            .filter((id, i, arr) => arr.indexOf(id) === i);
          return { ...k, componentIds: replaced };
        }
        if (k.componentIds.includes(newAssetId)) {
          return { ...k, componentIds: k.componentIds.filter(id => id !== newAssetId) };
        }
        return k;
      });
      const next: WorkspaceData = { ...d, assets: nextAssets, kits: nextKits };
      console.log("[swapKitComponent] success:", {
        kit: kit.name,
        old: oldAsset.name,
        new: newAsset.name,
        kitComponentsBefore: kit.componentIds,
        kitComponentsAfter: nextKits.find(k => k.id === kit.id)?.componentIds,
      });
      return appendEvent(next, "kit_composition_changed",
        `Swapped ${oldAsset.name} for ${newAsset.name} in ${kit.name}`,
        { actor, detail: kit.barcode });
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

  /**
   * Ensure the currently signed-in user has a team profile in this workspace.
   * If not, auto-create a placeholder with `pendingSetup: true` so the
   * dashboard can prompt them to fill in their real details.
   *
   * Idempotent — safe to call multiple times. Skips entirely if the user
   * already has a profile, if there's no auth user, or if the workspace is
   * read-only.
   */
  const ensureMyProfile = useCallback(() => {
    if (isReadOnly) return;
    if (!auth.user) return;
    const userId = auth.user.id;
    const userEmail = auth.user.email ?? "";
    // Check if profile already exists (must use raw data, not derived)
    const existing = userData.profiles.find(p => p.userId === userId);
    if (existing) return;

    // Build a placeholder. Name and initials are blank until first-time setup.
    const placeholder: UserProfile = {
      id: `prof-${userId.slice(0, 8)}-${Date.now().toString(36)}`,
      userId,
      pendingSetup: true,
      name: "",
      initials: "",
      color: "#cdc8bc",
      role: auth.currentRole ?? "crew",
      joinedAt: new Date().toISOString(),
      email: userEmail,
      badgeCount: 0,
      department: "",
      location: "",
      totalCheckouts: 0,
      totalHours: 0,
      shootsWorkedThisYear: 0,
      conditionScore: 0,
      reliabilityScore: 0,
      driftIncidents: 0,
      sopsContributed: 0,
      expertise: [],
      history: [],
      frequentCollaborators: [],
      certifications: [],
    };
    updateUserData(d => {
      // Double-check inside updater in case another path already created one
      if (d.profiles.find(p => p.userId === userId)) return d;
      return appendEvent(
        { ...d, profiles: [...d.profiles, placeholder] },
        "team_added", `${userEmail || "New member"} joined the workspace`,
        { actor: userEmail, detail: placeholder.role },
      );
    });
  }, [isReadOnly, auth.user, auth.currentRole, userData.profiles, updateUserData]);

  /**
   * Mark the current user's profile as fully set up (name, initials, color
   * filled in). Called from the first-time setup modal after they save.
   *
   * Also fires off a branded welcome email via the /api/send-welcome route.
   * Email send is fire-and-forget — it doesn't block profile completion or
   * fail the operation if it errors out.
   */
  const completeMyProfile = useCallback((patch: Partial<UserProfile>) => {
    if (isReadOnly || !auth.user) return;
    const userId = auth.user.id;
    let savedName = "";
    let savedRole: WorkspaceRole | null = null;
    let workspaceName = "your team";
    updateUserData(d => {
      const idx = d.profiles.findIndex(p => p.userId === userId);
      if (idx === -1) return d;
      const updated = {
        ...d.profiles[idx],
        ...patch,
        pendingSetup: false,
      };
      const profiles = [...d.profiles];
      profiles[idx] = updated;
      savedName = updated.name;
      savedRole = (updated.role as WorkspaceRole) ?? auth.currentRole ?? "crew";
      workspaceName = d.orgName || "your team";
      return appendEvent(
        { ...d, profiles },
        "team_added", `${updated.name} completed their profile`,
        { actor: updated.name, detail: updated.initials },
      );
    });

    // Fire the welcome email AFTER the state update. The import is dynamic
    // to avoid pulling Supabase code into bundles that don't need it.
    if (savedName && savedRole) {
      void (async () => {
        try {
          const { sendWelcomeEmail } = await import("@/lib/supabase/membership");
          await sendWelcomeEmail({
            workspaceName,
            memberName: savedName,
            role: savedRole!,
          });
        } catch (e) {
          // Email send failures are non-fatal — profile is already saved.
          console.warn("[completeMyProfile] welcome email failed:", e);
        }
      })();
    }
  }, [isReadOnly, auth.user, auth.currentRole, updateUserData]);

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

  /**
   * @deprecated Manager mode is now derived from your workspace role.
   * Owners and Managers always have full access. Crew and Viewer cannot
   * elevate themselves. This setter remains as a no-op so existing UI
   * call sites don't crash; the toggle has been removed from Settings.
   */
  const setManagerMode = useCallback((_on: boolean) => {
    // No-op. Role determines manager access.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[setManagerMode] deprecated — manager mode is derived from role");
    }
  }, []);

  // ────────────────────────────────────────────────────────────────────────
  // Notes (comments) mutators
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Extract @mentioned initials from a markdown body. Tokens are `@XX` where
   * XX is 1-4 uppercase letters/digits. Returns deduplicated uppercase array.
   * Used to populate `mentionedInitials` for fast notification dispatch.
   */
  function extractMentions(body: string): string[] {
    const matches = body.match(/@([A-Z0-9]{1,4})\b/g) ?? [];
    const initials = matches.map(m => m.slice(1).toUpperCase());
    return Array.from(new Set(initials));
  }

  /**
   * Add a note (comment) to a parent entity. Author is automatically the
   * currently signed-in user; if there's no profile yet (edge case) we fall
   * back to email-derived placeholder values so the note still renders.
   *
   * Returns the created note's id so callers can scroll to it / focus it.
   */
  const addNote = useCallback((args: {
    parentType: "asset" | "kit" | "shoot" | "checkout" | "user";
    parentId: string;
    body: string;
    isTask?: boolean;
  }): string | null => {
    if (isReadOnly) return null;
    if (!auth.user) return null;
    if (!args.body.trim()) return null;

    const userId = auth.user.id;
    const userEmail = auth.user.email ?? "";
    const myProfile = userData.profiles.find(p => p.userId === userId);

    // Snapshot the author's current display info so the note survives later renames
    const authorName = myProfile?.name?.trim() || userEmail.split("@")[0] || "Unknown";
    const authorInitials = myProfile?.initials || "??";
    const authorColor = myProfile?.color || "#cdc8bc";

    const now = new Date().toISOString();
    const id = `note-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;

    const newNote: Note = {
      id,
      parentType: args.parentType,
      parentId: args.parentId,
      authorUserId: userId,
      authorName,
      authorInitials,
      authorColor,
      body: args.body.trim(),
      createdAt: now,
      editedAt: null,
      isTask: !!args.isTask,
      resolvedAt: null,
      resolvedBy: null,
      mentionedInitials: extractMentions(args.body),
      readBy: userId ? [userId] : [],  // author has implicitly "read" their own note
    };

    updateUserData(d => {
      const notes = [...(d.notes ?? []), newNote];
      return appendEvent(
        { ...d, notes },
        "note_added", `${authorName} commented on ${args.parentType}`,
        { actor: authorName, detail: args.body.slice(0, 60) },
      );
    });

    return id;
  }, [isReadOnly, auth.user, userData.profiles, updateUserData]);

  /**
   * Edit an existing note. Only the original author may edit. Updates body,
   * recomputes mentions, sets editedAt timestamp.
   */
  const editNote = useCallback((noteId: string, newBody: string) => {
    if (isReadOnly) return;
    if (!auth.user) return;
    if (!newBody.trim()) return;
    const userId = auth.user.id;

    updateUserData(d => {
      const notes = d.notes ?? [];
      const idx = notes.findIndex(n => n.id === noteId);
      if (idx === -1) return d;
      const existing = notes[idx];
      // Authorship enforcement: only original author can edit.
      if (existing.authorUserId !== userId) {
        console.warn("[editNote] denied — only the author can edit");
        return d;
      }
      const updated: Note = {
        ...existing,
        body: newBody.trim(),
        editedAt: new Date().toISOString(),
        mentionedInitials: extractMentions(newBody),
      };
      const next = [...notes];
      next[idx] = updated;
      return { ...d, notes: next };
    });
  }, [isReadOnly, auth.user, updateUserData]);

  /**
   * Delete a note. Author can delete their own; Manager+ can delete anyone's.
   * Crew can ONLY delete their own. Viewer cannot delete.
   */
  const deleteNote = useCallback((noteId: string) => {
    if (isReadOnly) return;
    if (!auth.user) return;
    const userId = auth.user.id;
    const isManager = role === "owner" || role === "manager";

    updateUserData(d => {
      const notes = d.notes ?? [];
      const target = notes.find(n => n.id === noteId);
      if (!target) return d;
      // Crew can only delete own; Manager+ can delete any
      if (target.authorUserId !== userId && !isManager) {
        console.warn("[deleteNote] denied — manager role required to delete others' notes");
        return d;
      }
      return { ...d, notes: notes.filter(n => n.id !== noteId) };
    });
  }, [isReadOnly, auth.user, role, updateUserData]);

  /**
   * Mark a task-flagged note as resolved (or un-resolve). Anyone with Crew+
   * can resolve. Toggles based on current state. Only valid on isTask notes;
   * silently no-ops otherwise.
   */
  const resolveNote = useCallback((noteId: string) => {
    if (isReadOnly) return;
    if (!auth.user) return;
    const userId = auth.user.id;
    const myProfile = userData.profiles.find(p => p.userId === userId);
    const resolverName = myProfile?.name?.trim() || auth.user.email?.split("@")[0] || "Unknown";

    updateUserData(d => {
      const notes = d.notes ?? [];
      const idx = notes.findIndex(n => n.id === noteId);
      if (idx === -1) return d;
      const existing = notes[idx];
      if (!existing.isTask) {
        console.warn("[resolveNote] note is not a task; resolve is no-op");
        return d;
      }
      const next = [...notes];
      // Toggle resolved state
      if (existing.resolvedAt) {
        next[idx] = { ...existing, resolvedAt: null, resolvedBy: null };
      } else {
        next[idx] = { ...existing, resolvedAt: new Date().toISOString(), resolvedBy: resolverName };
      }
      return { ...d, notes: next };
    });
  }, [isReadOnly, auth.user, userData.profiles, updateUserData]);

  /** Helper: get all notes for a given parent. */
  const notesForParent = useCallback((parentType: "asset" | "kit" | "shoot" | "checkout" | "user", parentId: string) => {
    const notes = data.notes ?? [];
    return notes
      .filter(n => n.parentType === parentType && n.parentId === parentId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [data]);

  /**
   * The current user's profile in this workspace. Returns null if not signed
   * in or profile doesn't exist yet. Used by the inbox selector to find
   * mentions targeting "me" — which we match on initials (since @mentions
   * are by initials in the body) AND on userId (to filter out self-mentions).
   */
  const myProfile = useMemo(() => {
    if (!auth.user) return null;
    return userData.profiles.find(p => p.userId === auth.user!.id) ?? null;
  }, [auth.user, userData.profiles]);

  /**
   * Notes where the current user is @mentioned. Used by the /inbox page.
   *
   * Match logic: a note mentions me if my profile's initials appear in
   * `mentionedInitials`. We exclude notes authored by me (so I don't see
   * my own self-mentions). Returns sorted newest-first since inbox is
   * latest-on-top.
   *
   * Each note carries a `readBy` array; the inbox uses this to compute
   * read/unread state per-user.
   */
  const myInboxNotes = useMemo(() => {
    if (!myProfile?.initials || !auth.user) return [];
    const myInitials = myProfile.initials.toUpperCase();
    const myUserId = auth.user.id;
    const notes = data.notes ?? [];
    return notes
      .filter(n =>
        n.mentionedInitials.includes(myInitials) &&
        n.authorUserId !== myUserId  // don't show my own mentions of myself
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myProfile?.initials, auth.user, data.notes]);

  /**
   * Count of unread @mentions for the current user. Drives the TopNav bell
   * badge. Computed from `myInboxNotes` minus ones where my userId is in
   * the note's `readBy` array.
   */
  const inboxUnreadCount = useMemo(() => {
    if (!auth.user) return 0;
    const myUserId = auth.user.id;
    return myInboxNotes.filter(n => !n.readBy.includes(myUserId)).length;
  }, [myInboxNotes, auth.user]);

  /**
   * Mark a specific note as read by the current user. Called from the inbox
   * row click handler before navigating, AND from the parent entity detail
   * page when a note is rendered (so visiting the asset/kit auto-clears
   * the unread state for any mentions visible there).
   */
  const markNoteRead = useCallback((noteId: string) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    updateUserData(d => {
      const notes = d.notes ?? [];
      const idx = notes.findIndex(n => n.id === noteId);
      if (idx === -1) return d;
      const existing = notes[idx];
      if (existing.readBy.includes(userId)) return d;  // already read, no-op
      const next = [...notes];
      next[idx] = { ...existing, readBy: [...existing.readBy, userId] };
      return { ...d, notes: next };
    });
  }, [auth.user, updateUserData]);

  /**
   * Mark all unread notes on a given parent as read by the current user.
   * Called when the user opens an asset/kit detail page, clearing the
   * inbox badge for everything visible there in one batched state update.
   */
  const markNotesReadForParent = useCallback((parentType: "asset" | "kit" | "shoot" | "checkout" | "user", parentId: string) => {
    if (!auth.user) return;
    const userId = auth.user.id;
    updateUserData(d => {
      const notes = d.notes ?? [];
      let mutated = false;
      const next = notes.map(n => {
        if (
          n.parentType === parentType &&
          n.parentId === parentId &&
          !n.readBy.includes(userId)
        ) {
          mutated = true;
          return { ...n, readBy: [...n.readBy, userId] };
        }
        return n;
      });
      if (!mutated) return d;  // skip the write if nothing changed
      return { ...d, notes: next };
    });
  }, [auth.user, updateUserData]);

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
    photoUrls?: string[];
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
        photoUrls: args.photoUrls && args.photoUrls.length > 0 ? args.photoUrls : undefined,
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
    photoUrls?: string[];
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
        photoUrls: args.photoUrls && args.photoUrls.length > 0 ? args.photoUrls : undefined,
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
    // CRITICAL: Reset is destructive and irreversible. Owner-only.
    // Crew/Manager/Viewer must not be able to wipe the workspace even if
    // some UI surface accidentally shows the button — this is the last line
    // of defense against catastrophic data loss.
    if (role !== "owner") {
      console.warn("[resetWorkspace] denied — owner role required");
      return;
    }
    adapter.clear().catch(err => console.error("Reset failed:", err));
    setUserData(EMPTY_WORKSPACE);
  }, [adapter, role]);

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

  /** Active (non-archived) kits with computed status. Used everywhere except detail page lookup. */
  const kits = data.kits
    .filter(k => !k.archivedAt)
    .map(k => ({ ...k, status: computeKitStatus(k) }));

  /** Active (non-archived) assets. */
  const assets = data.assets.filter(a => !a.archivedAt);

  /** Archived items, for the dashboard's Archived tab. */
  const archivedAssets = data.assets.filter(a => !!a.archivedAt);
  const archivedKits = data.kits.filter(k => !!k.archivedAt);

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
    totalAssets: assets.length,
    checkedIn: assets.filter(a => a.status === "in").length,
    checkedOut: assets.filter(a => a.status === "out").length,
    serviceFlags: openFlags.length,
    criticalFlags: openFlags.filter(f => f.severity === "critical").length,
    kitDriftEvents: 0,
    knownInventoryValue: assets.reduce((sum, a) => sum + (a.cost || 0), 0),
  };

  /**
   * `dataWithComputedKits` is the *active view* of workspace data. Most
   * surfaces should consume this — dashboard table, kit picker, kiosk, etc.
   *
   * Detail pages (asset/[barcode], kit/[barcode]) need to see archived items
   * too so URLs stay valid. They access `rawAssets` / `rawKits` instead.
   */
  const dataWithComputedKits: WorkspaceData = { ...data, assets, kits };

  return {
    data: dataWithComputedKits,
    /** Raw, unfiltered assets — includes archived. Detail pages use this for lookup. */
    rawAssets: data.assets,
    /** Raw, unfiltered kits — includes archived. Detail pages use this for lookup. */
    rawKits: data.kits,
    archivedAssets,
    archivedKits,
    mode,
    hydrated,
    isReadOnly,
    isEmpty: mode !== "demo" && data.assets.length === 0 && data.profiles.length === 0,
    canUseDemo,
    /** Current user's role in the active workspace. Null when no workspace. */
    role,
    // Notes (comments) — see iter-17 design notes in lib/data.ts
    addNote,
    editNote,
    deleteNote,
    resolveNote,
    notesForParent,
    // Inbox / mentions tracking — see iter-18a
    myInboxNotes,
    inboxUnreadCount,
    markNoteRead,
    markNotesReadForParent,
    stats,
    activeCheckouts,
    switchMode,
    addAsset,
    addAssets,
    updateAsset,
    deleteAsset,
    restoreAsset,
    permanentDeleteAsset,
    addKit,
    updateKit,
    deleteKit,
    restoreKit,
    permanentDeleteKit,
    attachAssetToKit,
    attachAssetsToKit,
    swapKitComponent,
    detachAssetFromKit,
    addProfile,
    addProfiles,
    ensureMyProfile,
    completeMyProfile,
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
