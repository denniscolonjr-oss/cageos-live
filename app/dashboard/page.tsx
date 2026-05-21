"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/shared/EmptyState";
import AddAssetModal from "@/components/forms/AddAssetModal";
import AddKitModal from "@/components/forms/AddKitModal";
import AddTeamMemberModal from "@/components/forms/AddTeamMemberModal";
import CSVUploadModal from "@/components/forms/CSVUploadModal";
import AddShootModal from "@/components/forms/AddShootModal";
import FlagItemModal from "@/components/forms/FlagItemModal";
import FlagDetailModal from "@/components/forms/FlagDetailModal";
import MembersCard from "@/components/shared/MembersCard";
import CalendarExportCard from "@/components/shared/CalendarExportCard";
import PasscodesCard from "@/components/shared/PasscodesCard";
import FirstTimeProfileModal from "@/components/shared/FirstTimeProfileModal";
import WatchmanWidget from "@/components/dashboard/WatchmanWidget";
import CSVImportsCard from "@/components/settings/CSVImportsCard";
import AuditCard from "@/components/settings/AuditCard";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { deleteWorkspace } from "@/lib/supabase/membership";
import { formatShootRange, getTimezoneOptions, timezoneShortLabel, resolveTimezone } from "@/lib/timezone";
import { toast } from "@/components/ui/Toast";
import type { Project } from "@/lib/hooks/workspaceTypes";
import type { Asset } from "@/lib/data";

const flagBadgeStyle: React.CSSProperties = {
  fontSize: 9, padding: "2px 7px", borderRadius: 3,
  fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
};

const PAGES: Record<string, string> = {
  cage: "Cage status", checkouts: "Active checkouts",
  assets: "All assets", kits: "Kits", projects: "Projects", flags: "Service flags",
  settings: "Settings",
  badges: "Staff badges", guests: "Guest tokens",
  "kiosk-admin": "Kiosk devices", integrations: "Integrations",
  audit: "Audit log", billing: "Billing",
};

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, mode, hydrated, isReadOnly, isEmpty, stats, activeCheckouts, openFlags, resetWorkspace, setBarcodePrefix, setFilterableFields, setTimezone, archivedAssets, archivedKits, restoreAsset, restoreKit, role, ensureMyProfile } = useWorkspace();
  const [activeKey, setActiveKey] = useState("cage");
  const [assetFilter, setAssetFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openModal, setOpenModal] = useState<"asset" | "kit" | "team" | "csv" | "shoot" | null>(null);
  /*
   * iter-26: project clicks navigate to /projects/[id] now instead of
   * opening ShootDetailModal here. Dashboard no longer needs selectedShoot
   * state or the ShootDetailModal mount. AddShootModal still uses
   * setOpenModal("shoot") for the "+ Schedule project" sidebar action.
   */
  const [flagAssetTarget, setFlagAssetTarget] = useState<Asset | null>(null);
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null);
  const selectedFlag = selectedFlagId ? data.flags.find(f => f.id === selectedFlagId) ?? null : null;
  const [flagFilter, setFlagFilter] = useState<"open" | "in_repair" | "resolved" | "all">("open");
  const [auditFilter, setAuditFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  /**
   * Delete workspace modal. Only opens for owners via the Danger Zone card
   * at the bottom of Settings. Modal-state lives on the dashboard rather
   * than its own component so it shares the toast + router + workspace
   * switching plumbing already wired up here.
   */
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  function clearColumnFilter(field: string) {
    setColumnFilters(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function toggleSort(field: string) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  // Get unique values for a field — used to build filter dropdowns
  function uniqueValues(field: string): string[] {
    const set = new Set<string>();
    for (const a of data.assets) {
      const val = (a as unknown as Record<string, unknown>)[field];
      if (typeof val === "string" && val.trim()) set.add(val.trim());
    }
    return Array.from(set).sort();
  }

  // Apply: search + status filter + per-column filters + sort
  const filteredAssets = (() => {
    let list = data.assets.filter(a => {
      const matchStatus =
        assetFilter === "all" ? true :
        assetFilter === "out" ? a.status === "out" :
        assetFilter === "flagged" ? a.status === "flagged" :
        assetFilter === "in" ? a.status === "in" : true;
      const matchSearch = search === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.barcode.toLowerCase().includes(search.toLowerCase());
      const matchColumns = Object.entries(columnFilters).every(([field, val]) => {
        if (!val) return true;
        const fieldVal = (a as unknown as Record<string, unknown>)[field];
        return typeof fieldVal === "string" && fieldVal === val;
      });
      return matchStatus && matchSearch && matchColumns;
    });
    // Sort
    list = [...list].sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortField];
      const bVal = (b as unknown as Record<string, unknown>)[sortField];
      const aStr = aVal == null ? "" : String(aVal).toLowerCase();
      const bStr = bVal == null ? "" : String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  })();

  type SidebarItem = { label: string; key: string; count: number | null; countStyle: string | null; action?: string };
  const SIDEBAR: { section: string; items: SidebarItem[] }[] = [
    { section: "Overview", items: [
      { label: "Cage status", key: "cage", count: null, countStyle: null },
      { label: "Active checkouts", key: "checkouts", count: activeCheckouts.length || null, countStyle: activeCheckouts.some(c => c.status === "overdue") ? "warn" : null },
    ]},
    { section: "Inventory", items: [
      { label: "All assets", key: "assets", count: data.assets.length || null, countStyle: null },
      { label: "Kits", key: "kits", count: data.kits.length || null, countStyle: null },
      { label: "Projects", key: "projects", count: data.projects.length || null, countStyle: null },
      { label: "SOPs", key: "sops", count: data.sops.length || null, countStyle: null },
      { label: "Service flags", key: "flags", count: stats.serviceFlags || null, countStyle: stats.serviceFlags > 0 ? "alert" : null },
      ...(data.managerMode && (archivedAssets.length > 0 || archivedKits.length > 0)
        ? [{ label: "Archived", key: "archived", count: archivedAssets.length + archivedKits.length, countStyle: null }]
        : []),
    ]},
    { section: "Add", items: [
      { label: "+ Asset", key: "_asset", count: null, countStyle: null, action: "asset" },
      { label: "+ Build kit", key: "_kit", count: null, countStyle: null, action: "kit" },
      { label: "+ Team member", key: "_team", count: null, countStyle: null, action: "team" },
      { label: "+ Schedule project", key: "_shoot", count: null, countStyle: null, action: "shoot" },
      { label: "↑ Upload CSV", key: "_csv", count: null, countStyle: null, action: "csv" },
    ]},
    { section: "Admin", items: [
      { label: "Settings", key: "settings", count: null, countStyle: null },
      { label: "Audit log", key: "audit", count: data.events.length || null, countStyle: null },
      // Billing is a placeholder until real billing exists — show only in demo to signal roadmap
      ...(mode === "demo" ? [{ label: "Billing", key: "billing", count: null, countStyle: null }] : []),
    ]},
  ];

  function handleSidebarClick(item: SidebarItem) {
    if (item.action) {
      setOpenModal(item.action as "asset" | "kit" | "team" | "csv" | "shoot");
    } else if (item.key === "checkouts") {
      /*
       * "Active checkouts" navigates to the dedicated /checkouts page added
       * in iter-21 rather than switching the dashboard tab. The dashboard
       * tab was a no-op (same view as "Cage status") which made the sidebar
       * feel broken. The dedicated page is the right surface for this view
       * — filter tabs, stat strip, sortable rows, drill-into-detail.
       */
      router.push("/checkouts");
    } else if (item.key === "projects") {
      /*
       * "Projects" navigates to the /projects calendar view added in iter-24.
       * The dashboard's project list block is still useful as a quick glance
       * (rendered when activeKey === "projects" is the default tab on dash)
       * but the sidebar item is now a teleport to the dedicated calendar
       * page — same pattern as Active Checkouts.
       */
      router.push("/projects");
    } else if (item.key === "sops") {
      /*
       * "SOPs" navigates to the /sops library added in iter-27a. Same
       * pattern as the previous dedicated-page nav items (Active checkouts,
       * Projects) — sidebar teleports rather than switching dashboard tabs.
       */
      router.push("/sops");
    } else {
      setActiveKey(item.key);
    }
    setMobileSidebarOpen(false);
  }

  const sidebarContent = (
    <>
      {SIDEBAR.map(section => (
        <div key={section.section} style={{ padding: "0 10px", marginBottom: 20 }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 8px", marginBottom: 5 }}>
            {section.section}
          </div>
          {section.items.map(item => {
            const isAction = !!item.action;
            if (isAction && isReadOnly) return null;
            return (
              <button key={item.key} onClick={() => handleSidebarClick(item)} style={{
                display: "flex", alignItems: "center", gap: 9,
                padding: isMobile ? "11px 10px" : "7px 8px",
                borderRadius: 6,
                color: activeKey === item.key ? "var(--t1)" : isAction ? "var(--acc)" : "var(--t2)",
                background: activeKey === item.key ? "var(--s2)" : "transparent",
                cursor: "pointer", fontSize: 13,
                border: "none", width: "100%", textAlign: "left",
                fontFamily: "'DM Sans', sans-serif", transition: "all 0.1s",
                minHeight: isMobile ? 44 : "auto",
              }}>
                {!isAction && <span style={{ width: 5, height: 5, borderRadius: "50%", background: activeKey === item.key ? "var(--acc)" : "var(--b2)", flexShrink: 0 }} />}
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.count !== null && (
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 10,
                    background: "var(--s2)", padding: "2px 6px", borderRadius: 3,
                    color: item.countStyle === "alert" ? "var(--red)" : item.countStyle === "warn" ? "var(--amber)" : "var(--t3)",
                  }}>{item.count}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  // Auto-create the current user's team profile if they don't have one yet.
  // Runs whenever the workspace finishes hydrating and we have an authed user.
  // No-op if the profile already exists. Critical for the invite/passcode flow:
  // newly-joined members get a placeholder profile they fill in on first login.
  useEffect(() => {
    if (hydrated && !auth.loading && auth.user && !isReadOnly) {
      ensureMyProfile();
    }
  }, [hydrated, auth.loading, auth.user, isReadOnly, ensureMyProfile]);

  // Gate the dashboard render on BOTH auth.loading completing AND workspace hydration.
  // Without auth.loading we'd render with the localStorage adapter's empty state
  // briefly before the Supabase adapter takes over, causing a "demo flash" effect.
  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />

      {isMobile && (
        <div className="scroll-x" style={{ display: "flex", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--b1)", background: "var(--bg)", flexShrink: 0 }}>
          <button onClick={() => setMobileSidebarOpen(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 6,
            background: "var(--s2)", border: "1px solid var(--b1)", color: "var(--t2)",
            fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
            flexShrink: 0, minHeight: 36, whiteSpace: "nowrap",
          }}>☰ All</button>
          {[
            { key: "cage", label: "Cage" },
            { key: "checkouts", label: "Checkouts", badge: activeCheckouts.length },
            { key: "assets", label: "Assets", badge: data.assets.length },
            { key: "kits", label: "Kits", badge: data.kits.length },
            { key: "flags", label: "Flags", badge: stats.serviceFlags, badgeColor: "var(--red)" },
          ].filter(c => (c.badge ?? 0) > 0 || c.key === "cage").map(c => (
            <button key={c.key} onClick={() => setActiveKey(c.key)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 6,
              background: activeKey === c.key ? "var(--s3)" : "var(--s1)",
              border: `1px solid ${activeKey === c.key ? "var(--acc)" : "var(--b1)"}`,
              color: activeKey === c.key ? "var(--t1)" : "var(--t2)",
              fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer",
              flexShrink: 0, minHeight: 36, whiteSpace: "nowrap",
            }}>
              {c.label}
              {c.badge !== undefined && c.badge !== null && c.badge > 0 && (
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: c.badgeColor || "var(--t3)" }}>{c.badge}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isMobile && mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100, animation: "fade-up 0.15s ease" }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: 280, maxWidth: "85vw",
            background: "var(--bg)", borderRight: "1px solid var(--b1)", padding: "16px 0",
            paddingTop: `max(16px, var(--safe-top))`, paddingBottom: `max(16px, var(--safe-bottom))`,
            overflowY: "auto", animation: "slide-in-left 0.2s cubic-bezier(0.22,1,0.36,1)",
          }}>
            <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700 }}>Sections</span>
              <button onClick={() => setMobileSidebarOpen(false)} style={{ background: "none", border: "none", color: "var(--t2)", fontSize: 18, cursor: "pointer", padding: 4, minHeight: 36, minWidth: 36 }}>×</button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <div style={{ display: isMobile ? "block" : "grid", gridTemplateColumns: isMobile ? "none" : "210px 1fr", flex: 1, overflow: "hidden" }}>
        {!isMobile && (
          <aside style={{ borderRight: "1px solid var(--b1)", padding: "16px 0", overflowY: "auto", background: "var(--bg)" }}>
            {sidebarContent}
          </aside>
        )}

        <main style={{
          padding: isMobile ? "16px 12px" : "24px 28px",
          paddingBottom: `max(${isMobile ? 16 : 24}px, var(--safe-bottom))`,
          overflowY: "auto", background: "var(--bg)", height: "100%",
        }} className="animate-fade-up">

          {isReadOnly && (
            <div style={{
              background: "rgba(236,255,112,0.06)", border: "1px solid rgba(236,255,112,0.2)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: 10, flexWrap: "wrap",
            }}>
              <div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--acc)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Demo workspace · read-only</div>
                <div style={{ fontSize: 12, color: "var(--t2)" }}>Sample data from MMG Production. Switch workspaces (top right) to start your own.</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "flex-end", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 18 : 20, fontWeight: 700, letterSpacing: -0.5 }}>{PAGES[activeKey] || "Dashboard"}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginTop: 3 }}>
                {data.orgName}{data.orgLocation && ` · ${data.orgLocation}`}
              </div>
            </div>
            {!isReadOnly && (
              <div style={{ display: "flex", gap: 8 }}>
                {!isMobile && (
                  <Link href="/kiosk" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "var(--t2)", border: "1px solid var(--b1)", background: "transparent", textDecoration: "none", fontFamily: "'DM Sans', sans-serif", minHeight: 36 }}>
                    Open kiosk ↗
                  </Link>
                )}
                <button onClick={() => setOpenModal("asset")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "var(--acc)", color: "var(--bg)", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", minHeight: 36 }}>
                  + Add asset
                </button>
              </div>
            )}
          </div>

          {isEmpty && activeKey === "cage" && <EmptyState context="dashboard" />}
          {!isReadOnly && data.assets.length === 0 && activeKey === "assets" && <EmptyState context="assets" />}
          {!isReadOnly && data.kits.length === 0 && activeKey === "kits" && <EmptyState context="kits" />}

          {!isEmpty && (activeKey === "cage" || activeKey === "checkouts") && (
            <>
              {/*
               * iter-28a: Logistics Watchman widget. Renders ABOVE the stats
               * grid when there's something to surface. The widget is
               * self-gated to Manager+ only and returns null for Crew/Viewer
               * or when there are no active issues + no AI findings + no
               * snoozed items to report on. So it costs nothing when the
               * workspace is calm.
               */}
              <WatchmanWidget />
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 8 : 10, marginBottom: 16 }}>
                {[
                  { label: "Checked in", value: stats.checkedIn, sub: `of ${stats.totalAssets}`, color: "var(--green)" },
                  { label: "Checked out", value: stats.checkedOut, sub: activeCheckouts.length > 0 ? `${activeCheckouts.length} active` : "—", color: "var(--amber)" },
                  { label: "Service flags", value: stats.serviceFlags, sub: stats.criticalFlags > 0 ? `${stats.criticalFlags} critical` : "all clear", color: stats.serviceFlags > 0 ? "var(--red)" : "var(--green)" },
                  { label: "Kit drift", value: stats.kitDriftEvents, sub: stats.kitDriftEvents > 0 ? "unresolved" : "none", color: stats.kitDriftEvents > 0 ? "var(--blue)" : "var(--green)" },
                ].map(s => (
                  <Card key={s.label} accentColor={s.color}>
                    <div style={{ padding: isMobile ? "12px 14px" : "14px 16px" }}>
                      <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{s.label}</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{s.sub}</div>
                    </div>
                  </Card>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 310px", gap: 14 }}>
                <div>
                  {activeCheckouts.length > 0 ? (
                    <Card style={{ marginBottom: 14 }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Live checkouts</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--green)" }}>
                          <span className="animate-live" style={{ width: 5, height: 5, background: "var(--green)", borderRadius: "50%", display: "inline-block" }} />LIVE
                        </div>
                      </div>
                      {/*
                       * Active checkout row link. Routes to the checkout
                       * DETAIL page added in iter-21 so the user sees full
                       * context (kits, photos, condition, contact info,
                       * comments) instead of being bounced to the person's
                       * profile.
                       */}
                      {activeCheckouts.map(co => (
                        <Link key={co.id} href={`/checkouts/${encodeURIComponent(co.id)}`} style={{ textDecoration: "none", color: "inherit" }}>
                          <div style={{
                            padding: isMobile ? "13px 16px" : "11px 16px", borderBottom: "1px solid var(--b1)",
                            display: "flex", alignItems: "center", gap: 11,
                            opacity: co.status === "overdue" ? 0.75 : 1, cursor: "pointer", minHeight: isMobile ? 56 : "auto",
                          }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: co.color, flexShrink: 0 }}>{co.initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {co.user}
                                {co.isGuest && <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>}
                              </div>
                              <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {co.kits.join(" · ")} → {(co as { project?: string; shoot?: string }).project ?? (co as { shoot?: string }).shoot ?? ""}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: co.status === "overdue" ? "var(--red)" : "var(--t3)" }}>{("checkedOutAt" in co ? co.checkedOutAt : null) ?? ("checkedOutAtLabel" in co ? co.checkedOutAtLabel : "—")}</span>
                              {co.status === "overdue" && <Badge variant="red" style={{ fontSize: 9 }}>overdue</Badge>}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </Card>
                  ) : (
                    <Card style={{ marginBottom: 14 }}>
                      <div style={{ padding: "24px 16px", textAlign: "center" }}>
                        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 4 }}>No active checkouts</div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>Open the kiosk to check out gear</div>
                      </div>
                    </Card>
                  )}

                  {data.assets.length > 0 && (
                    <Card>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Recent activity</div>
                        <div className="scroll-x" style={{ display: "flex", gap: 6, maxWidth: "100%" }}>
                          {(["all","in","out","flagged"] as const).map(f => (
                            <button key={f} onClick={() => setAssetFilter(f)} style={{
                              padding: "5px 10px", borderRadius: 4, fontSize: 11, fontFamily: "'DM Mono', monospace",
                              border: `1px solid ${assetFilter === f ? "var(--acc)" : "var(--b1)"}`,
                              background: assetFilter === f ? "rgba(236,255,112,0.08)" : "transparent",
                              color: assetFilter === f ? "var(--acc)" : "var(--t3)",
                              cursor: "pointer", flexShrink: 0, minHeight: 32, whiteSpace: "nowrap",
                            }}>{f}</button>
                          ))}
                        </div>
                      </div>
                      <div className="scroll-x">
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 600 : "auto" }}>
                          <thead>
                            <tr>
                              {(isMobile ? ["Asset","Status","Last user","Time"] : ["Asset","Barcode","Status","Location","Last user","Updated"]).map(h => (
                                <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--b1)", fontWeight: 400, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {[...data.assets].sort((a, b) => {
                              if (!a.lastUpdated && !b.lastUpdated) return 0;
                              if (!a.lastUpdated) return 1;
                              if (!b.lastUpdated) return -1;
                              // lastUpdated is a free-form label like "9:14 AM" — compare as strings descending
                              return b.lastUpdated.localeCompare(a.lastUpdated);
                            }).slice(0, 12).map(a => (
                              <tr
                                key={a.id}
                                onClick={() => router.push(`/asset/${encodeURIComponent(a.barcode)}`)}
                                style={{ borderBottom: "1px solid var(--b1)", cursor: "pointer" }}
                              >
                                <td style={{ padding: "11px 14px", fontSize: 12 }}>
                                  {a.name}
                                  {isMobile && <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{a.barcode}</div>}
                                </td>
                                {!isMobile && <td style={{ padding: "11px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{a.barcode}</td>}
                                <td style={{ padding: "11px 14px" }}>
                                  <Badge variant={a.status === "in" ? "green" : a.status === "out" ? "amber" : "red"}>{a.status}</Badge>
                                </td>
                                {!isMobile && <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.location || "—"}</td>}
                                <td style={{ padding: "11px 14px", fontSize: 12 }}>{a.lastUser || "—"}</td>
                                <td style={{ padding: "11px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t3)" }}>{a.lastUpdated || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>

                {data.alerts.length > 0 && (
                  <div>
                    <Card>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Alerts</div>
                        <Badge variant="red">{data.alerts.filter(a => a.type !== "info").length} open</Badge>
                      </div>
                      {data.alerts.map(al => (
                        <div key={al.id} style={{ padding: "11px 14px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 10 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0,
                            background: al.type === "critical" ? "rgba(255,122,122,0.12)" : al.type === "warning" ? "rgba(251,194,92,0.12)" : "rgba(122,181,245,0.12)" }}>
                            {al.type === "critical" ? "⚠" : al.type === "warning" ? "⚑" : "ℹ"}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500 }}>{al.title}</div>
                            <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{al.detail}</div>
                          </div>
                        </div>
                      ))}
                    </Card>
                  </div>
                )}
              </div>
            </>
          )}

          {activeKey === "assets" && data.assets.length > 0 && (
            <div className="animate-fade-up">
              <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginBottom: 12 }}>
                <input
                  placeholder="Search by name or barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "10px 14px", color: "var(--t1)", outline: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 14, minHeight: 44 }}
                />
                <div className="scroll-x" style={{ display: "flex", gap: 8 }}>
                  {(["all","in","out","flagged"] as const).map(f => (
                    <button key={f} onClick={() => setAssetFilter(f)} style={{ padding: "9px 14px", borderRadius: 6, fontSize: 12, fontFamily: "'DM Mono', monospace", border: `1px solid ${assetFilter === f ? "var(--acc)" : "var(--b1)"}`, background: assetFilter === f ? "rgba(236,255,112,0.08)" : "transparent", color: assetFilter === f ? "var(--acc)" : "var(--t2)", cursor: "pointer", flexShrink: 0, minHeight: 40, whiteSpace: "nowrap" }}>{f}</button>
                  ))}
                </div>
              </div>

              {/* Per-column filter dropdowns */}
              {data.filterableFields.length > 0 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  {data.filterableFields.map(field => {
                    const values = uniqueValues(field);
                    if (values.length === 0) return null;
                    const active = !!columnFilters[field];
                    return (
                      <div key={field} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <select
                          value={columnFilters[field] || ""}
                          onChange={e => {
                            const val = e.target.value;
                            if (val) setColumnFilters({ ...columnFilters, [field]: val });
                            else clearColumnFilter(field);
                          }}
                          style={{
                            padding: "8px 28px 8px 12px",
                            borderRadius: 6, fontSize: 12,
                            fontFamily: "'DM Mono',monospace",
                            border: `1px solid ${active ? "var(--acc)" : "var(--b1)"}`,
                            backgroundColor: active ? "rgba(236,255,112,0.06)" : "var(--s2)",
                            color: active ? "var(--acc)" : "var(--t2)",
                            cursor: "pointer", minHeight: 36,
                            appearance: "none",
                            WebkitAppearance: "none",
                            colorScheme: "dark",
                            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23cdc8bc' stroke-width='1.5' fill='none'/></svg>\")",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 10px center",
                          }}
                        >
                          <option value="" style={{ backgroundColor: "var(--s2)", color: "var(--t1)" }}>{field.charAt(0).toUpperCase() + field.slice(1)}: all</option>
                          {values.map(v => <option key={v} value={v} style={{ backgroundColor: "var(--s2)", color: "var(--t1)" }}>{v}</option>)}
                        </select>
                      </div>
                    );
                  })}
                  {Object.keys(columnFilters).length > 0 && (
                    <button onClick={() => setColumnFilters({})} style={{
                      padding: "8px 14px", borderRadius: 6, fontSize: 12,
                      fontFamily: "'DM Mono',monospace",
                      background: "transparent", border: "1px solid var(--b1)",
                      color: "var(--t3)", cursor: "pointer", minHeight: 36, whiteSpace: "nowrap",
                    }}>Clear filters</button>
                  )}
                </div>
              )}

              <Card>
                <div className="scroll-x">
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 700 : "auto" }}>
                    <thead>
                      <tr>
                        {[
                          { label: "Asset", field: "name" },
                          { label: "Barcode", field: "barcode" },
                          { label: "Category", field: "category" },
                          { label: "Make", field: "make" },
                          { label: "Status", field: "status" },
                          { label: "Location", field: "location" },
                          { label: "Kit", field: "kitId" },
                          { label: "Last user", field: "lastUser" },
                        ].map(h => {
                          const isActive = sortField === h.field;
                          return (
                            <th key={h.field} onClick={() => toggleSort(h.field)} style={{
                              padding: "10px 14px", textAlign: "left",
                              fontSize: 10, fontFamily: "'DM Mono', monospace",
                              color: isActive ? "var(--acc)" : "var(--t3)",
                              letterSpacing: "0.05em", textTransform: "uppercase",
                              borderBottom: "1px solid var(--b1)", fontWeight: 400,
                              whiteSpace: "nowrap", cursor: "pointer",
                              userSelect: "none",
                            }}>
                              {h.label}
                              <span style={{ marginLeft: 5, opacity: isActive ? 1 : 0.3, fontSize: 9 }}>
                                {isActive ? (sortDir === "asc" ? "▲" : "▼") : "▲▼"}
                              </span>
                            </th>
                          );
                        })}
                        {data.managerMode && !isReadOnly && (
                          <th style={{
                            padding: "10px 14px", textAlign: "right",
                            fontSize: 10, fontFamily: "'DM Mono', monospace",
                            color: "var(--t3)",
                            letterSpacing: "0.05em", textTransform: "uppercase",
                            borderBottom: "1px solid var(--b1)", fontWeight: 400,
                            whiteSpace: "nowrap",
                          }}>
                            Actions
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map(a => {
                        const hasOpenFlag = openFlags.some(f => f.assetId === a.id);
                        return (
                        <tr
                          key={a.id}
                          onClick={() => router.push(`/asset/${encodeURIComponent(a.barcode)}`)}
                          style={{ borderBottom: "1px solid var(--b1)", cursor: "pointer" }}
                        >
                          <td style={{ padding: "11px 14px", fontSize: 12 }}>
                            {a.name}
                            {hasOpenFlag && (
                              <span title="Has an open service flag" style={{ color: "var(--red)", marginLeft: 6, fontSize: 11 }}>⚠</span>
                            )}
                          </td>
                          <td style={{ padding: "11px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{a.barcode}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: "var(--t2)" }}>{a.category}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: "var(--t2)" }}>{a.make || "—"}</td>
                          <td style={{ padding: "11px 14px" }}><Badge variant={a.status === "in" ? "green" : a.status === "out" ? "amber" : "red"}>{a.status}</Badge></td>
                          <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.location || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.kitId || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12 }}>{a.lastUser || "—"}</td>
                          {data.managerMode && !isReadOnly && (
                            <td style={{ padding: "8px 14px", textAlign: "right" }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); setFlagAssetTarget(a); }}
                                disabled={hasOpenFlag}
                                title={hasOpenFlag ? "Already has an open flag" : "Flag this asset for service"}
                                style={{
                                  padding: "5px 10px", borderRadius: 5,
                                  background: "transparent",
                                  border: `1px solid ${hasOpenFlag ? "var(--b2)" : "var(--red)"}`,
                                  color: hasOpenFlag ? "var(--t3)" : "var(--red)",
                                  cursor: hasOpenFlag ? "not-allowed" : "pointer",
                                  fontFamily: "'DM Mono',monospace", fontSize: 10,
                                  whiteSpace: "nowrap",
                                }}>
                                ⚠ Flag
                              </button>
                            </td>
                          )}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--b1)", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>
                  {filteredAssets.length} of {data.assets.length} assets · sorted by {sortField} ({sortDir})
                </div>
              </Card>
            </div>
          )}

          {activeKey === "kits" && data.kits.length > 0 && (
            <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {data.kits.map(kit => (
                <div key={kit.id} onClick={() => router.push(`/kit/${encodeURIComponent(kit.barcode)}`)} style={{ cursor: "pointer" }}>
                <Card accentColor={kit.status === "available" ? "var(--green)" : kit.status === "out" ? "var(--amber)" : "var(--blue)"}>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10, gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{kit.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{kit.barcode}</div>
                      </div>
                      <Badge variant={kit.status === "available" ? "green" : kit.status === "out" ? "amber" : "blue"}>{kit.status}</Badge>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>
                      {kit.componentIds.length} components · {kit.location}
                    </div>
                    <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 10 }}>
                      {data.assets.filter(a => kit.componentIds.includes(a.id)).slice(0, 4).map(a => (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>
                          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--b2)", flexShrink: 0 }} />
                          {a.name}
                          {a.serviceFlag && <span style={{ color: "var(--red)", fontSize: 10 }}>⚠</span>}
                        </div>
                      ))}
                      {kit.componentIds.length > 4 && (
                        <div style={{ fontSize: 10, color: "var(--t3)", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>+{kit.componentIds.length - 4} more</div>
                      )}
                    </div>
                  </div>
                </Card>
                </div>
              ))}
            </div>
          )}

          {activeKey === "projects" && (
            <div className="animate-fade-up">
              {data.projects.length === 0 ? (
                <Card>
                  <div style={{ padding: isMobile ? "32px 20px" : "44px 32px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                    <div style={{ width: 56, height: 56, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>⬡</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 8 }}>No projects scheduled yet</div>
                    <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
                      Projects tie together a client, a date, your team, and the kits they&apos;ll need. Schedule one and the kiosk will surface it when crew check out gear.
                    </div>
                    {!isReadOnly && (
                      <button onClick={() => setOpenModal("shoot")} style={{
                        background: "var(--acc)", color: "var(--bg)", border: "none",
                        padding: "12px 22px", borderRadius: 7,
                        fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700,
                        cursor: "pointer", minHeight: 44,
                      }}>+ Schedule a project</button>
                    )}
                  </div>
                </Card>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 12,
                }}>
                  {data.projects.map(sh => {
                    const lead = sh.leadInitials ? data.profiles.find(p => p.initials === sh.leadInitials) : null;
                    const teamProfiles = sh.assignedTeam.map(i => data.profiles.find(p => p.initials === i)).filter(Boolean);
                    const kits = sh.assignedKits.map(id => data.kits.find(k => k.id === id)).filter(Boolean);
                    const accent =
                      sh.status === "active" ? "var(--green)" :
                      sh.status === "scheduled" ? "var(--blue)" :
                      sh.status === "completed" ? "var(--t3)" :
                      "var(--red)";
                    return (
                      <div key={sh.id} onClick={() => router.push(`/projects/${encodeURIComponent(sh.id)}`)} style={{ cursor: "pointer" }}>
                      <Card accentColor={accent}>
                        <div style={{ padding: "16px 18px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{sh.title}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>{sh.client}</div>
                            </div>
                            <Badge variant={sh.status === "active" ? "green" : sh.status === "scheduled" ? "blue" : sh.status === "completed" ? "gray" : "red"}>{sh.status}</Badge>
                          </div>

                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginBottom: 12, lineHeight: 1.5 }}>
                            {formatShootRange(sh.startsAt, sh.endsAt, data.timezone)}
                            {sh.location && <><br />📍 {sh.location}</>}
                          </div>

                          {teamProfiles.length > 0 && (
                            <div style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Team ({teamProfiles.length})</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {teamProfiles.map(p => (
                                  <Link
                                    key={p!.initials}
                                    href={`/profile/${encodeURIComponent(p!.initials)}`}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{ textDecoration: "none" }}
                                  >
                                    <div title={p!.name} style={{
                                      display: "flex", alignItems: "center", gap: 5,
                                      padding: "4px 8px 4px 4px", borderRadius: 14,
                                      background: "var(--s2)", border: "1px solid var(--b1)",
                                      cursor: "pointer",
                                    }}>
                                      <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: p!.color, flexShrink: 0 }}>{p!.initials}</div>
                                      <span style={{ fontSize: 11, color: "var(--t2)" }}>
                                        {p!.name.split(" ")[0]}
                                        {sh.leadInitials === p!.initials && <span style={{ color: "var(--acc)", marginLeft: 4 }}>★</span>}
                                      </span>
                                    </div>
                                  </Link>
                                ))}
                              </div>
                              {lead && (
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 6 }}>
                                  ★ Lead: <span style={{ color: "var(--acc)" }}>{lead.name}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {kits.length > 0 && (
                            <div style={{ paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Kits ({kits.length})</div>
                              {kits.map(k => (
                                <div key={k!.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>
                                  <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--b2)", flexShrink: 0 }} />
                                  {k!.name}
                                </div>
                              ))}
                            </div>
                          )}

                          {sh.notes && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--b1)", fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>
                              {sh.notes}
                            </div>
                          )}
                        </div>
                      </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeKey === "flags" && (
            <div className="animate-fade-up">
              {(() => {
                const FILTER_OPTIONS: { key: typeof flagFilter; label: string }[] = [
                  { key: "open", label: "Open" },
                  { key: "in_repair", label: "In repair" },
                  { key: "resolved", label: "Resolved" },
                  { key: "all", label: "All" },
                ];
                const filtered = flagFilter === "all"
                  ? data.flags
                  : data.flags.filter(f => f.status === flagFilter);
                // Sort: critical first, then most recent
                const sorted = [...filtered].sort((a, b) => {
                  if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
                  return b.flaggedAtISO.localeCompare(a.flaggedAtISO);
                });
                const counts = {
                  open: data.flags.filter(f => f.status === "open").length,
                  in_repair: data.flags.filter(f => f.status === "in_repair").length,
                  resolved: data.flags.filter(f => f.status === "resolved").length,
                  all: data.flags.length,
                };

                return (
                  <>
                    {/* Stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
                      <Card accentColor="var(--red)">
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>Critical open</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: openFlags.filter(f => f.severity === "critical").length > 0 ? "var(--red)" : "var(--t1)" }}>
                            {openFlags.filter(f => f.severity === "critical").length}
                          </div>
                        </div>
                      </Card>
                      <Card accentColor="var(--amber)">
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>Warning open</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "var(--t1)" }}>
                            {openFlags.filter(f => f.severity === "warning").length}
                          </div>
                        </div>
                      </Card>
                      <Card accentColor="var(--blue)">
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>In repair</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "var(--t1)" }}>
                            {counts.in_repair}
                          </div>
                        </div>
                      </Card>
                      <Card accentColor="var(--green)">
                        <div style={{ padding: "12px 14px" }}>
                          <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>Resolved</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, color: "var(--t1)" }}>
                            {counts.resolved}
                          </div>
                        </div>
                      </Card>
                    </div>

                    {/* Filter chips */}
                    <div className="scroll-x" style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                      {FILTER_OPTIONS.map(opt => {
                        const isActive = flagFilter === opt.key;
                        const count = counts[opt.key];
                        return (
                          <button key={opt.key} onClick={() => setFlagFilter(opt.key)} style={{
                            padding: "8px 14px", borderRadius: 6, fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            border: `1px solid ${isActive ? "var(--acc)" : "var(--b1)"}`,
                            background: isActive ? "rgba(236,255,112,0.08)" : "transparent",
                            color: isActive ? "var(--acc)" : "var(--t2)",
                            cursor: "pointer", flexShrink: 0, minHeight: 36, whiteSpace: "nowrap",
                          }}>
                            {opt.label}{count > 0 && <span style={{ marginLeft: 6, color: "var(--t3)" }}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {/* List */}
                    {sorted.length === 0 ? (
                      <Card>
                        <div style={{ padding: 36, textAlign: "center" }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>{flagFilter === "open" ? "✓" : "—"}</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                            {flagFilter === "open" ? "All clear" : `No ${flagFilter === "all" ? "" : flagFilter === "in_repair" ? "in-repair " : flagFilter + " "}flags`}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t2)" }}>
                            {flagFilter === "open"
                              ? "No open service flags right now."
                              : flagFilter === "all" && data.flags.length === 0
                                ? "Flag an asset from the All Assets table to start tracking service issues."
                                : "Try a different filter."}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card>
                        {sorted.map((f, i) => {
                          const asset = data.assets.find(a => a.id === f.assetId);
                          const sevColor = f.severity === "critical" ? "var(--red)" : "var(--amber)";
                          const statusColor =
                            f.status === "resolved" ? "var(--green)" :
                            f.status === "in_repair" ? "var(--amber)" : "var(--red)";
                          const flaggedAt = new Date(f.flaggedAtISO);
                          const ago = Math.floor((Date.now() - flaggedAt.getTime()) / (1000 * 60 * 60));
                          const agoLabel = ago < 1 ? "just now" : ago < 24 ? `${ago}h ago` : `${Math.floor(ago / 24)}d ago`;
                          const flagsForThisAsset = data.flags.filter(x => x.assetId === f.assetId).length;
                          return (
                            <div key={f.id} onClick={() => setSelectedFlagId(f.id)} style={{
                              padding: "14px 16px",
                              borderBottom: i < sorted.length - 1 ? "1px solid var(--b1)" : "none",
                              cursor: "pointer",
                              display: "flex", gap: 12, alignItems: "flex-start",
                            }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 7, flexShrink: 0,
                                background: `${sevColor}20`,
                                color: sevColor,
                                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
                              }}>{f.status === "resolved" ? "✓" : "⚠"}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                                  <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600 }}>
                                    {asset?.name ?? "Unknown asset"}
                                  </span>
                                  <span style={{ ...flagBadgeStyle, background: `${sevColor}20`, color: sevColor }}>
                                    {f.severity}
                                  </span>
                                  <span style={{ ...flagBadgeStyle, background: `${statusColor}20`, color: statusColor }}>
                                    {f.status.replace(/_/g, " ")}
                                  </span>
                                  {flagsForThisAsset > 1 && (
                                    <span style={{ ...flagBadgeStyle, background: "var(--s3)", color: "var(--t2)" }}>
                                      {flagsForThisAsset}× flagged
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 5,
                                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                                }}>
                                  {f.reason}
                                </div>
                                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                                  {asset?.barcode} · flagged {agoLabel} by {f.flaggedBy}
                                  {f.repairNotes.length > 0 && ` · ${f.repairNotes.length} repair note${f.repairNotes.length === 1 ? "" : "s"}`}
                                </div>
                              </div>
                              <div style={{ fontSize: 14, color: "var(--t3)", alignSelf: "center", flexShrink: 0 }}>›</div>
                            </div>
                          );
                        })}
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {activeKey === "archived" && data.managerMode && (
            <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
                <h2 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700 }}>Archived</h2>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                  {archivedAssets.length} asset{archivedAssets.length === 1 ? "" : "s"} · {archivedKits.length} kit{archivedKits.length === 1 ? "" : "s"}
                </div>
              </div>

              {archivedAssets.length === 0 && archivedKits.length === 0 ? (
                <Card>
                  <div style={{ padding: "40px 20px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t3)" }}>
                    Nothing archived yet. Archived assets and kits will appear here for review or restoration.
                  </div>
                </Card>
              ) : (
                <>
                  {archivedAssets.length > 0 && (
                    <Card>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--b1)", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700 }}>
                        Archived assets ({archivedAssets.length})
                      </div>
                      {archivedAssets.map((a, i) => (
                        <div key={a.id} style={{
                          padding: "12px 18px",
                          borderBottom: i < archivedAssets.length - 1 ? "1px solid var(--b1)" : "none",
                          display: "flex", gap: 12, alignItems: "center",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Link href={`/asset/${encodeURIComponent(a.barcode)}`} style={{ textDecoration: "none" }}>
                              <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 3 }}>{a.name}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                                {a.barcode} · {a.category} · archived {a.archivedAt ? new Date(a.archivedAt).toLocaleDateString() : ""}
                                {a.archivedBy && ` by ${a.archivedBy}`}
                              </div>
                            </Link>
                          </div>
                          <button
                            onClick={() => { restoreAsset(a.id, "Manager"); }}
                            style={{
                              padding: "6px 12px", borderRadius: 5,
                              background: "transparent", border: "1px solid var(--green)",
                              color: "var(--green)", cursor: "pointer",
                              fontFamily: "'DM Mono',monospace", fontSize: 11,
                              minHeight: 32,
                            }}>
                            ↺ Restore
                          </button>
                        </div>
                      ))}
                    </Card>
                  )}

                  {archivedKits.length > 0 && (
                    <Card>
                      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--b1)", fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700 }}>
                        Archived kits ({archivedKits.length})
                      </div>
                      {archivedKits.map((k, i) => (
                        <div key={k.id} style={{
                          padding: "12px 18px",
                          borderBottom: i < archivedKits.length - 1 ? "1px solid var(--b1)" : "none",
                          display: "flex", gap: 12, alignItems: "center",
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Link href={`/kit/${encodeURIComponent(k.barcode)}`} style={{ textDecoration: "none" }}>
                              <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 3 }}>{k.name}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                                {k.barcode} · archived {k.archivedAt ? new Date(k.archivedAt).toLocaleDateString() : ""}
                                {k.archivedBy && ` by ${k.archivedBy}`}
                              </div>
                            </Link>
                          </div>
                          <button
                            onClick={() => { restoreKit(k.id, "Manager"); }}
                            style={{
                              padding: "6px 12px", borderRadius: 5,
                              background: "transparent", border: "1px solid var(--green)",
                              color: "var(--green)", cursor: "pointer",
                              fontFamily: "'DM Mono',monospace", fontSize: 11,
                              minHeight: 32,
                            }}>
                            ↺ Restore
                          </button>
                        </div>
                      ))}
                    </Card>
                  )}
                </>
              )}
            </div>
          )}

          {activeKey === "settings" && (
            <div className="animate-fade-up" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Card>
                <div style={{ padding: 20 }}>
                  <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Workspace</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
                    Currently: {mode === "demo" ? "Demo (MMG)" : data.orgName} · {data.assets.length} assets · {data.profiles.length} team · {data.kits.length} kits
                  </div>
                </div>
              </Card>

              {!isReadOnly && (
                <Card>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Barcode prefix</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
                      Used when auto-generating barcodes. Letters and numbers only.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <input
                        defaultValue={data.barcodePrefix}
                        onBlur={e => {
                          const v = e.target.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
                          if (v && v !== data.barcodePrefix) setBarcodePrefix(v);
                        }}
                        maxLength={6}
                        style={{
                          width: 110, background: "var(--s2)", border: "1px solid var(--b1)",
                          borderRadius: 7, padding: "10px 12px",
                          color: "var(--t1)", outline: "none",
                          fontFamily: "'DM Mono',monospace", fontSize: 14, minHeight: 44,
                          textTransform: "uppercase",
                        }}
                      />
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t3)" }}>
                        next: {data.barcodePrefix}-{String((data.assets.length + 1)).padStart(7, "0")}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {!isReadOnly && (
                <Card>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Asset filters</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
                      Which fields appear as filter dropdowns on the assets page.
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[
                        { key: "category", label: "Category" },
                        { key: "make", label: "Make" },
                        { key: "model", label: "Model" },
                        { key: "location", label: "Location" },
                        { key: "status", label: "Status" },
                      ].map(opt => {
                        const active = data.filterableFields.includes(opt.key);
                        return (
                          <button key={opt.key} onClick={() => {
                            const next = active
                              ? data.filterableFields.filter(f => f !== opt.key)
                              : [...data.filterableFields, opt.key];
                            setFilterableFields(next);
                          }} style={{
                            padding: "8px 14px", borderRadius: 6, fontSize: 12,
                            fontFamily: "'DM Mono',monospace",
                            border: `1px solid ${active ? "var(--acc)" : "var(--b1)"}`,
                            background: active ? "rgba(236,255,112,0.06)" : "transparent",
                            color: active ? "var(--acc)" : "var(--t3)",
                            cursor: "pointer", minHeight: 36,
                          }}>
                            {active ? "✓ " : ""}{opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              )}

              {!isReadOnly && (
                <Card>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Time zone</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
                      How project dates and times are displayed across the app. Projects are stored as absolute moments and converted on display.
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <select
                        value={data.timezone}
                        onChange={e => setTimezone(e.target.value)}
                        style={{
                          minWidth: 240, backgroundColor: "var(--s2)", border: "1px solid var(--b1)",
                          borderRadius: 7, padding: "10px 12px", color: "var(--t1)", outline: "none",
                          fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44, colorScheme: "dark",
                        }}
                      >
                        {getTimezoneOptions().map(opt => (
                          <option key={opt.value} value={opt.value} style={{ backgroundColor: "var(--s2)", color: "var(--t1)" }}>{opt.label}</option>
                        ))}
                      </select>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                        currently {timezoneShortLabel(data.timezone)} · {resolveTimezone(data.timezone)}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {!isReadOnly && role && (
                <Card>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Your role</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.55 }}>
                      {role === "owner" && "You're the workspace Owner. You have full control: inventory, settings, member management, and billing."}
                      {role === "manager" && "You're a Manager. Full control over inventory and settings. Cannot change billing or other members' roles."}
                      {role === "crew" && "You're Crew. You can check gear in and out, flag service issues, and view the audit log."}
                      {role === "viewer" && "You're a Viewer. Read-only access across the workspace."}
                    </div>
                    <div style={{
                      display: "inline-block",
                      padding: "6px 12px", borderRadius: 6,
                      background: "rgba(236,255,112,0.08)",
                      border: "1px solid var(--acc)",
                      color: "var(--acc)",
                      fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                      letterSpacing: "0.04em", textTransform: "uppercase",
                    }}>
                      {role}
                    </div>
                  </div>
                </Card>
              )}

              {/* Multi-user: members + passcodes management. Only renders when there's an active workspace; PasscodesCard self-gates to Owner only. */}
              {!isReadOnly && <MembersCard />}
              {!isReadOnly && <PasscodesCard />}

              {/* Reset is Owner-only — destructive and irreversible. */}
              {!isReadOnly && role === "owner" && (
                <Card>
                  <div style={{ padding: 20 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Reset</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
                      Permanently delete all assets, kits, team members, and projects in this workspace.
                    </div>
                    <button
                      onClick={() => {
                        if (confirm("Reset your workspace? This can't be undone.")) {
                          resetWorkspace();
                        }
                      }}
                      style={{
                        padding: "10px 16px", borderRadius: 6, background: "transparent",
                        border: "1px solid var(--red)", color: "var(--red)", cursor: "pointer",
                        fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
                      }}>Reset workspace</button>
                  </div>
                </Card>
              )}

              {/*
               * Calendar export — iCal subscription feed for projects + active
               * checkouts. Visible to everyone in the workspace (anyone can copy
               * the URL); only owners can generate, rotate, or disable.
               * Real-mode only since the demo workspace shouldn't expose calendar
               * tokens.
               */}
              {mode === "user" && <CalendarExportCard />}

              {/*
               * CSV imports history (iter-28c) — past asset uploads with safe
               * rollback. Manager+ sees a list of every CSV upload and can
               * delete entire batches. Assets currently in active kits or
               * checkouts are preserved by the delete logic.
               */}
              {!isReadOnly && <CSVImportsCard />}

              {/*
               * Audit export (iter-28d) — workspace inventory audit with
               * completeness scoring vs CSV-import baseline. Manager+ only.
               * Manual-add assets and pre-baseline assets are noted in the
               * export but excluded from the score. Outputs CSV download +
               * browser print (Save-as-PDF).
               */}
              {!isReadOnly && <AuditCard />}

              {/*
               * Danger Zone — Delete the entire workspace.
               *
               * Different from Reset:
               *   - Reset wipes the workspace's DATA but keeps the workspace itself
               *     and your membership. Useful when starting over with the same
               *     team but a clean inventory.
               *   - Delete REMOVES THE WORKSPACE ENTIRELY. All members lose access.
               *     The owner gets switched to another workspace or sent to /onboarding.
               *
               * Only the owner sees this. Real-mode only (you can't delete the demo
               * workspace — it's seed data shared across users).
               */}
              {!isReadOnly && role === "owner" && mode === "user" && (
                <Card>
                  <div style={{ padding: 20, borderLeft: "3px solid var(--red)", marginLeft: -1 }}>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4, color: "var(--red)" }}>
                      Danger zone: Delete workspace
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.6 }}>
                      Permanently delete <strong style={{ color: "var(--t1)" }}>{data.orgName}</strong> and all of its data — assets, kits, team members, projects, audit log, comments, photos. Everyone in the workspace loses access immediately. This cannot be undone.
                    </div>
                    <button
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteModalOpen(true);
                      }}
                      style={{
                        padding: "10px 16px", borderRadius: 6,
                        background: "var(--red)", color: "var(--bg)",
                        border: "none", cursor: "pointer",
                        fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                        minHeight: 40,
                      }}>Delete this workspace</button>
                  </div>
                </Card>
              )}
            </div>
          )}

          {activeKey === "audit" && (
            <div className="animate-fade-up">
              {(() => {
                const CATEGORIES: { key: string; label: string }[] = [
                  { key: "all", label: "All events" },
                  { key: "checkout", label: "Checkouts" },
                  { key: "return", label: "Returns" },
                  { key: "shoot_scheduled", label: "Projects scheduled" },
                  { key: "shoot_status_changed", label: "Project status" },
                  { key: "shoot_updated", label: "Project edits" },
                  { key: "shoot_deleted", label: "Project deletions" },
                  { key: "asset_added", label: "Assets added" },
                  { key: "kit_added", label: "Kits built" },
                  { key: "team_added", label: "Team added" },
                  { key: "manager_mode", label: "Manager mode" },
                ];
                /*
                 * Audit filter. For project categories, match both the
                 * legacy shoot_* and new project_* prefixes so users can
                 * filter the combined timeline (iter-23 locked decision:
                 * keep historical entries with their original category).
                 */
                function categoryMatches(eventCat: string, filterKey: string): boolean {
                  if (filterKey === eventCat) return true;
                  if (filterKey.startsWith("shoot_")) {
                    const tail = filterKey.slice("shoot_".length);
                    return eventCat === `project_${tail}`;
                  }
                  return false;
                }
                const filtered = auditFilter === "all"
                  ? data.events
                  : data.events.filter(e => categoryMatches(e.category, auditFilter));
                const categoryColor = (c: string) => {
                  if (c === "checkout") return "var(--amber)";
                  if (c === "return") return "var(--green)";
                  // Match both shoot_* (legacy entries) and project_* (iter-23+)
                  if (c.startsWith("shoot") || c.startsWith("project")) return "var(--blue)";
                  if (c === "asset_added" || c === "kit_added") return "var(--acc)";
                  if (c === "team_added") return "var(--purple)";
                  return "var(--t3)";
                };

                return (
                  <>
                    <div className="scroll-x" style={{ display: "flex", gap: 6, marginBottom: 14, paddingBottom: 4 }}>
                      {CATEGORIES.map(c => {
                        const isActive = auditFilter === c.key;
                        const count = c.key === "all" ? data.events.length : data.events.filter(e => categoryMatches(e.category, c.key)).length;
                        return (
                          <button key={c.key} onClick={() => setAuditFilter(c.key)} style={{
                            padding: "8px 14px", borderRadius: 6, fontSize: 11,
                            fontFamily: "'DM Mono',monospace",
                            border: `1px solid ${isActive ? "var(--acc)" : "var(--b1)"}`,
                            background: isActive ? "rgba(236,255,112,0.08)" : "transparent",
                            color: isActive ? "var(--acc)" : "var(--t2)",
                            cursor: "pointer", flexShrink: 0, minHeight: 36, whiteSpace: "nowrap",
                          }}>
                            {c.label}{count > 0 && <span style={{ marginLeft: 6, color: "var(--t3)" }}>{count}</span>}
                          </button>
                        );
                      })}
                    </div>

                    {filtered.length === 0 ? (
                      <Card>
                        <div style={{ padding: "40px 20px", textAlign: "center" }}>
                          <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 10 }}>⬡</div>
                          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                            {auditFilter === "all" ? "No events yet" : "No events in this category"}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--t2)" }}>
                            {auditFilter === "all"
                              ? "Activity will populate here as you add assets, build kits, schedule projects, and run kiosk transactions."
                              : "Try a different category."}
                          </div>
                        </div>
                      </Card>
                    ) : (
                      <Card>
                        {filtered.map((e, i) => {
                          const ts = new Date(e.timestamp);
                          const dt = new Intl.DateTimeFormat("en-US", {
                            month: "short", day: "numeric",
                            hour: "numeric", minute: "2-digit",
                          }).format(ts);
                          return (
                            <div key={e.id} style={{
                              padding: "13px 16px",
                              borderBottom: i < filtered.length - 1 ? "1px solid var(--b1)" : "none",
                              display: "flex", alignItems: "flex-start", gap: 12,
                            }}>
                              <div style={{
                                width: 6, alignSelf: "stretch", flexShrink: 0,
                                background: categoryColor(e.category), borderRadius: 2,
                                marginTop: 2, marginBottom: 2,
                              }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 3 }}>
                                  <div style={{ fontSize: 13, color: "var(--t1)" }}>{e.summary}</div>
                                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", whiteSpace: "nowrap" }}>{dt}</div>
                                </div>
                                {e.detail && (
                                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 3 }}>{e.detail}</div>
                                )}
                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{
                                    fontSize: 9, padding: "1px 6px", borderRadius: 3,
                                    fontFamily: "'DM Mono',monospace",
                                    textTransform: "uppercase", letterSpacing: "0.05em",
                                    background: "var(--s2)",
                                    color: categoryColor(e.category),
                                  }}>{e.category.replace(/_/g, " ")}</span>
                                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{e.actor}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--b1)", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>
                          {filtered.length} event{filtered.length === 1 ? "" : "s"} {auditFilter !== "all" ? `· filtered to ${CATEGORIES.find(c => c.key === auditFilter)?.label}` : ""}
                        </div>
                      </Card>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {["badges","guests","kiosk-admin","integrations","billing"].includes(activeKey) && (
            <div className="animate-fade-up">
              <Card>
                <div style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>Coming soon</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{PAGES[activeKey]}</div>
                  <div style={{ fontSize: 13, color: "var(--t2)" }}>Under active development.</div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      <AddAssetModal open={openModal === "asset"} onClose={() => setOpenModal(null)} />
      <AddKitModal open={openModal === "kit"} onClose={() => setOpenModal(null)} />
      <AddTeamMemberModal open={openModal === "team"} onClose={() => setOpenModal(null)} />
      <CSVUploadModal open={openModal === "csv"} onClose={() => setOpenModal(null)} />
      <AddShootModal open={openModal === "shoot"} onClose={() => setOpenModal(null)} />
      <FlagItemModal open={!!flagAssetTarget} onClose={() => setFlagAssetTarget(null)} asset={flagAssetTarget} />
      <FlagDetailModal open={!!selectedFlag} onClose={() => setSelectedFlagId(null)} flag={selectedFlag} />
      {/* Self-gates on pendingSetup; renders nothing if profile already complete */}
      <FirstTimeProfileModal />

      {/*
       * Delete workspace confirmation modal. Owner-only. Requires the user to
       * type the workspace name exactly before the destructive button enables —
       * GitHub-style "type-the-name" pattern protects against muscle-memory
       * clicks. On success, refresh workspaces + switch to another (or send
       * to /onboarding if this was the last one).
       */}
      {deleteModalOpen && (
        <div
          /*
           * iter-26: removed click-outside-to-close on this overlay entirely.
           * Deletion is destructive enough that an accidental dismiss isn't
           * the worst case — but a stray click that loses the typed
           * confirmation text IS frustrating. Force explicit Cancel or × to
           * close. Escape key (handled below) is fine since it requires
           * deliberate intent.
           */
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, backdropFilter: "blur(6px)",
          }}
        >
          <div
            style={{
              background: "var(--s1)",
              border: "1px solid var(--red)",
              borderRadius: 12,
              maxWidth: 480, width: "100%", padding: 28,
            }}
          >
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: "var(--red)", marginBottom: 8 }}>
              Delete workspace?
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 20 }}>
              You&apos;re about to permanently delete <strong style={{ color: "var(--t1)" }}>{data.orgName}</strong>. Every team member, asset, kit, project, comment, photo, and audit entry will be gone. <strong style={{ color: "var(--red)" }}>This cannot be undone.</strong>
            </div>

            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Type the workspace name to confirm
            </label>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 8 }}>
              Workspace name: <span style={{ color: "var(--t1)", fontWeight: 700 }}>{data.orgName}</span>
            </div>
            <input
              autoFocus
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder={data.orgName}
              disabled={deleting}
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b2)",
                borderRadius: 6, color: "var(--t1)",
                fontFamily: "'DM Mono',monospace", fontSize: 13,
                outline: "none", marginBottom: 18,
                boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleting}
                style={{
                  padding: "10px 16px", borderRadius: 6,
                  background: "transparent", border: "1px solid var(--b2)",
                  color: "var(--t1)", cursor: deleting ? "not-allowed" : "pointer",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                Cancel
              </button>
              <button
                disabled={deleting || deleteConfirmText !== data.orgName}
                onClick={async () => {
                  if (!auth.activeWorkspaceId) return;
                  setDeleting(true);
                  const result = await deleteWorkspace(auth.activeWorkspaceId);
                  if (!result.ok) {
                    toast("Delete failed", { variant: "error", detail: result.error });
                    setDeleting(false);
                    return;
                  }
                  toast("Workspace deleted", { detail: `${data.orgName} is gone.` });
                  // Refresh workspace list. If user has another workspace, switch
                  // to it; otherwise route to onboarding. AuthContext's
                  // refreshWorkspaces handles the active-id reconciliation.
                  await auth.refreshWorkspaces();
                  const remaining = auth.workspaces.filter(w => w.id !== auth.activeWorkspaceId);
                  if (remaining.length > 0) {
                    auth.setActiveWorkspaceId(remaining[0].id);
                    router.push("/dashboard");
                  } else {
                    router.push("/onboarding");
                  }
                }}
                style={{
                  padding: "10px 18px", borderRadius: 6,
                  background: deleteConfirmText === data.orgName && !deleting ? "var(--red)" : "var(--s3)",
                  color: deleteConfirmText === data.orgName && !deleting ? "var(--bg)" : "var(--t3)",
                  border: "none",
                  cursor: deleteConfirmText === data.orgName && !deleting ? "pointer" : "not-allowed",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                }}
              >
                {deleting ? "Deleting..." : "Delete workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
