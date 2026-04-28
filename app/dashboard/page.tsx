"use client";
import { useState } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/shared/EmptyState";
import AddAssetModal from "@/components/forms/AddAssetModal";
import AddKitModal from "@/components/forms/AddKitModal";
import AddTeamMemberModal from "@/components/forms/AddTeamMemberModal";
import CSVUploadModal from "@/components/forms/CSVUploadModal";
import AddShootModal from "@/components/forms/AddShootModal";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";

const PAGES: Record<string, string> = {
  cage: "Cage status", checkouts: "Active checkouts",
  assets: "All assets", kits: "Kits", shoots: "Shoots", flags: "Service flags",
  settings: "Settings",
  badges: "Staff badges", guests: "Guest tokens",
  "kiosk-admin": "Kiosk devices", integrations: "Integrations",
  audit: "Audit log", billing: "Billing",
};

export default function DashboardPage() {
  const isMobile = useIsMobile();
  const { data, mode, hydrated, isReadOnly, isEmpty, stats, resetWorkspace, setBarcodePrefix, setFilterableFields } = useWorkspace();
  const [activeKey, setActiveKey] = useState("cage");
  const [assetFilter, setAssetFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openModal, setOpenModal] = useState<"asset" | "kit" | "team" | "csv" | "shoot" | null>(null);
  const [sortField, setSortField] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

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
      { label: "Active checkouts", key: "checkouts", count: data.checkouts.length || null, countStyle: data.checkouts.some(c => c.status === "overdue") ? "warn" : null },
    ]},
    { section: "Inventory", items: [
      { label: "All assets", key: "assets", count: data.assets.length || null, countStyle: null },
      { label: "Kits", key: "kits", count: data.kits.length || null, countStyle: null },
      { label: "Shoots", key: "shoots", count: data.shoots.length || null, countStyle: null },
      { label: "Service flags", key: "flags", count: stats.serviceFlags || null, countStyle: stats.serviceFlags > 0 ? "alert" : null },
    ]},
    { section: "Add", items: [
      { label: "+ Asset", key: "_asset", count: null, countStyle: null, action: "asset" },
      { label: "+ Build kit", key: "_kit", count: null, countStyle: null, action: "kit" },
      { label: "+ Team member", key: "_team", count: null, countStyle: null, action: "team" },
      { label: "+ Schedule shoot", key: "_shoot", count: null, countStyle: null, action: "shoot" },
      { label: "↑ Upload CSV", key: "_csv", count: null, countStyle: null, action: "csv" },
    ]},
    { section: "Admin", items: [
      { label: "Settings", key: "settings", count: null, countStyle: null },
      { label: "Audit log", key: "audit", count: null, countStyle: null },
      { label: "Billing", key: "billing", count: null, countStyle: null },
    ]},
  ];

  function handleSidebarClick(item: SidebarItem) {
    if (item.action) {
      setOpenModal(item.action as "asset" | "kit" | "team" | "csv" | "shoot");
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

  if (!hydrated) {
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
            { key: "checkouts", label: "Checkouts", badge: data.checkouts.length },
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
              background: "rgba(226,245,92,0.06)", border: "1px solid rgba(226,245,92,0.2)",
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
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap: isMobile ? 8 : 10, marginBottom: 16 }}>
                {[
                  { label: "Checked in", value: stats.checkedIn, sub: `of ${stats.totalAssets}`, color: "var(--green)" },
                  { label: "Checked out", value: stats.checkedOut, sub: data.checkouts.length > 0 ? `${data.checkouts.length} active` : "—", color: "var(--amber)" },
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
                  {data.checkouts.length > 0 ? (
                    <Card style={{ marginBottom: 14 }}>
                      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Live checkouts</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--green)" }}>
                          <span className="animate-live" style={{ width: 5, height: 5, background: "var(--green)", borderRadius: "50%", display: "inline-block" }} />LIVE
                        </div>
                      </div>
                      {data.checkouts.map(co => (
                        <Link key={co.id} href={`/profile/${co.initials}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                                {co.kits.join(" · ")} → {co.shoot}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: co.status === "overdue" ? "var(--red)" : "var(--t3)" }}>{co.checkedOutAt}</span>
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
                              background: assetFilter === f ? "rgba(226,245,92,0.08)" : "transparent",
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
                            {filteredAssets.slice(0, 12).map(a => (
                              <tr key={a.id} style={{ borderBottom: "1px solid var(--b1)" }}>
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
                            background: al.type === "critical" ? "rgba(255,79,79,0.12)" : al.type === "warning" ? "rgba(245,166,35,0.12)" : "rgba(90,160,240,0.12)" }}>
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
                    <button key={f} onClick={() => setAssetFilter(f)} style={{ padding: "9px 14px", borderRadius: 6, fontSize: 12, fontFamily: "'DM Mono', monospace", border: `1px solid ${assetFilter === f ? "var(--acc)" : "var(--b1)"}`, background: assetFilter === f ? "rgba(226,245,92,0.08)" : "transparent", color: assetFilter === f ? "var(--acc)" : "var(--t2)", cursor: "pointer", flexShrink: 0, minHeight: 40, whiteSpace: "nowrap" }}>{f}</button>
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
                            background: active ? "rgba(226,245,92,0.06)" : "var(--s2)",
                            color: active ? "var(--acc)" : "var(--t2)",
                            cursor: "pointer", minHeight: 36,
                            appearance: "none",
                            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%238c8880' stroke-width='1.5' fill='none'/></svg>\")",
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 10px center",
                          }}
                        >
                          <option value="">{field.charAt(0).toUpperCase() + field.slice(1)}: all</option>
                          {values.map(v => <option key={v} value={v}>{v}</option>)}
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
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAssets.map(a => (
                        <tr key={a.id} style={{ borderBottom: "1px solid var(--b1)" }}>
                          <td style={{ padding: "11px 14px", fontSize: 12 }}>{a.name}</td>
                          <td style={{ padding: "11px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{a.barcode}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: "var(--t2)" }}>{a.category}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, color: "var(--t2)" }}>{a.make || "—"}</td>
                          <td style={{ padding: "11px 14px" }}><Badge variant={a.status === "in" ? "green" : a.status === "out" ? "amber" : "red"}>{a.status}</Badge></td>
                          <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.location || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.kitId || "—"}</td>
                          <td style={{ padding: "11px 14px", fontSize: 12 }}>{a.lastUser || "—"}</td>
                        </tr>
                      ))}
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
                <Card key={kit.id} accentColor={kit.status === "available" ? "var(--green)" : kit.status === "out" ? "var(--amber)" : "var(--blue)"}>
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
              ))}
            </div>
          )}

          {activeKey === "shoots" && (
            <div className="animate-fade-up">
              {data.shoots.length === 0 ? (
                <Card>
                  <div style={{ padding: isMobile ? "32px 20px" : "44px 32px", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                    <div style={{ width: 56, height: 56, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 16px" }}>⬡</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 19 : 22, fontWeight: 700, marginBottom: 8 }}>No shoots scheduled yet</div>
                    <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
                      Shoots tie together a client, a date, your team, and the kits they&apos;ll need. Schedule one and the kiosk will surface it when crew check out gear.
                    </div>
                    {!isReadOnly && (
                      <button onClick={() => setOpenModal("shoot")} style={{
                        background: "var(--acc)", color: "var(--bg)", border: "none",
                        padding: "12px 22px", borderRadius: 7,
                        fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700,
                        cursor: "pointer", minHeight: 44,
                      }}>+ Schedule a shoot</button>
                    )}
                  </div>
                </Card>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 12,
                }}>
                  {data.shoots.map(sh => {
                    const lead = sh.leadInitials ? data.profiles.find(p => p.initials === sh.leadInitials) : null;
                    const teamProfiles = sh.assignedTeam.map(i => data.profiles.find(p => p.initials === i)).filter(Boolean);
                    const kits = sh.assignedKits.map(id => data.kits.find(k => k.id === id)).filter(Boolean);
                    const accent =
                      sh.status === "active" ? "var(--green)" :
                      sh.status === "scheduled" ? "var(--blue)" :
                      sh.status === "completed" ? "var(--t3)" :
                      "var(--red)";
                    return (
                      <Card key={sh.id} accentColor={accent}>
                        <div style={{ padding: "16px 18px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{sh.title}</div>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>{sh.client}</div>
                            </div>
                            <Badge variant={sh.status === "active" ? "green" : sh.status === "scheduled" ? "blue" : sh.status === "completed" ? "gray" : "red"}>{sh.status}</Badge>
                          </div>

                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginBottom: 12, lineHeight: 1.5 }}>
                            {sh.startsAt}{sh.endsAt ? ` → ${sh.endsAt}` : ""}
                            {sh.location && <><br />📍 {sh.location}</>}
                          </div>

                          {teamProfiles.length > 0 && (
                            <div style={{ marginBottom: 12, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
                              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Team ({teamProfiles.length})</div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                {teamProfiles.map(p => (
                                  <Link key={p!.initials} href={`/profile/${p!.initials}`} style={{ textDecoration: "none" }}>
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
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeKey === "flags" && (
            <div className="animate-fade-up">
              <Card>
                {data.assets.filter(a => a.serviceFlag).length === 0 ? (
                  <div style={{ padding: 32, textAlign: "center" }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>✓</div>
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>All clear</div>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>No service flags right now.</div>
                  </div>
                ) : (
                  data.assets.filter(a => a.serviceFlag).map(a => (
                    <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: isMobile ? "wrap" : "nowrap" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 7, background: a.serviceFlag!.severity === "critical" ? "rgba(255,79,79,0.12)" : "rgba(245,166,35,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚠</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                          <Badge variant={a.serviceFlag!.severity === "critical" ? "red" : "amber"}>{a.serviceFlag!.severity}</Badge>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--t2)" }}>{a.serviceFlag!.reason}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>{a.barcode} · Last user: {a.lastUser}</div>
                      </div>
                    </div>
                  ))
                )}
              </Card>
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
                            background: active ? "rgba(226,245,92,0.06)" : "transparent",
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
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Reset</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
                      Permanently delete all assets, kits, team members, and shoots in this workspace.
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
            </div>
          )}

          {["badges","guests","kiosk-admin","integrations","audit","billing"].includes(activeKey) && (
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
    </div>
  );
}
