"use client";
import { useState } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { ASSETS, CHECKOUTS, ALERTS, STATS, KITS } from "@/lib/data";

const SIDEBAR = [
  { section: "Overview", items: [
    { label: "Cage status", key: "cage", count: null, countStyle: null },
    { label: "Active checkouts", key: "checkouts", count: 7, countStyle: "warn" },
    { label: "Shoot schedule", key: "schedule", count: null, countStyle: null },
  ]},
  { section: "Inventory", items: [
    { label: "All assets", key: "assets", count: 600, countStyle: null },
    { label: "Kits", key: "kits", count: 14, countStyle: null },
    { label: "Service flags", key: "flags", count: 3, countStyle: "alert" },
    { label: "Kit drift log", key: "drift", count: 2, countStyle: "warn" },
    { label: "Untagged assets", key: "untagged", count: 2, countStyle: null },
  ]},
  { section: "People", items: [
    { label: "Staff badges", key: "badges", count: null, countStyle: null },
    { label: "Guest tokens", key: "guests", count: null, countStyle: null },
  ]},
  { section: "Admin", items: [
    { label: "Kiosk devices", key: "kiosk-admin", count: null, countStyle: null },
    { label: "Integrations", key: "integrations", count: null, countStyle: null },
    { label: "Audit log", key: "audit", count: null, countStyle: null },
    { label: "Billing", key: "billing", count: null, countStyle: null },
  ]},
];

const PAGES: Record<string, string> = {
  cage: "Cage status",
  checkouts: "Active checkouts",
  schedule: "Shoot schedule",
  assets: "All assets",
  kits: "Kits",
  flags: "Service flags",
  drift: "Kit drift log",
  untagged: "Untagged assets",
  badges: "Staff badges",
  guests: "Guest tokens",
  "kiosk-admin": "Kiosk devices",
  integrations: "Integrations",
  audit: "Audit log",
  billing: "Billing",
};

export default function DashboardPage() {
  const [activeKey, setActiveKey] = useState("cage");
  const [assetFilter, setAssetFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredAssets = ASSETS.filter((a) => {
    const matchFilter =
      assetFilter === "all" ? true :
      assetFilter === "out" ? a.status === "out" :
      assetFilter === "flagged" ? a.status === "flagged" :
      assetFilter === "in" ? a.status === "in" : true;
    const matchSearch = search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.barcode.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", flex: 1, overflow: "hidden" }}>

        {/* SIDEBAR */}
        <aside style={{ borderRight: "1px solid var(--b1)", padding: "16px 0", overflowY: "auto", background: "var(--bg)" }}>
          {SIDEBAR.map((section) => (
            <div key={section.section} style={{ padding: "0 10px", marginBottom: 20 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 8px", marginBottom: 5 }}>
                {section.section}
              </div>
              {section.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setActiveKey(item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "7px 8px", borderRadius: 6,
                    color: activeKey === item.key ? "var(--t1)" : "var(--t2)",
                    background: activeKey === item.key ? "var(--s2)" : "transparent",
                    cursor: "pointer", fontSize: 13,
                    border: "none", width: "100%", textAlign: "left",
                    fontFamily: "'DM Sans', sans-serif", transition: "all 0.1s",
                  }}
                >
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: activeKey === item.key ? "var(--acc)" : "var(--b2)", flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.count !== null && (
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      background: "var(--s2)", padding: "1px 5px", borderRadius: 3,
                      color: item.countStyle === "alert" ? "var(--red)" : item.countStyle === "warn" ? "var(--amber)" : "var(--t3)",
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* MAIN */}
        <main style={{ padding: "24px 28px", overflowY: "auto", background: "var(--bg)" }} className="animate-fade-up">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{PAGES[activeKey]}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginTop: 3 }}>
                LMG05 · Adams · Mumford · Cellar — updated just now
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Link href="/kiosk" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, color: "var(--t2)", border: "1px solid var(--b1)", background: "transparent", textDecoration: "none", fontFamily: "'DM Sans', sans-serif" }}>
                Open kiosk ↗
              </Link>
              <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: "var(--acc)", color: "var(--bg)", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                + New guest token
              </button>
            </div>
          </div>

          {/* STAT CARDS */}
          {(activeKey === "cage" || activeKey === "checkouts") && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Checked in", value: STATS.checkedIn, sub: `of ${STATS.totalAssets} active assets`, color: "var(--green)" },
                { label: "Checked out", value: STATS.checkedOut, sub: "across 2 active shoots", color: "var(--amber)" },
                { label: "Service flags", value: STATS.serviceFlags, sub: `${STATS.criticalFlags} critical · ${STATS.serviceFlags - STATS.criticalFlags} warnings`, color: "var(--red)" },
                { label: "Kit drift events", value: STATS.kitDriftEvents, sub: "unresolved this week", color: "var(--blue)" },
              ].map((s) => (
                <Card key={s.label} accentColor={s.color}>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 7 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 700, letterSpacing: -1, lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 5, fontFamily: "'DM Mono', monospace" }}>{s.sub}</div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* CAGE / CHECKOUTS VIEW */}
          {(activeKey === "cage" || activeKey === "checkouts") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 310px", gap: 14 }}>
              <div>
                {/* Live feed */}
                <Card style={{ marginBottom: 14 }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Live checkouts</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--green)" }}>
                      <span className="animate-live" style={{ width: 5, height: 5, background: "var(--green)", borderRadius: "50%", display: "inline-block" }} />
                      LIVE
                    </div>
                  </div>
                  {CHECKOUTS.map((co) => (
                    <Link key={co.id} href={`/profile/${co.initials}`} style={{ textDecoration: "none", color: "inherit" }}>
                      <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", gap: 11, opacity: co.status === "overdue" ? 0.75 : 1, cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--s2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <div style={{ width: 30, height: 30, borderRadius: 6, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: co.color, flexShrink: 0 }}>{co.initials}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
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

                {/* Asset table */}
                <Card>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Recent activity</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["all","in","out","flagged"] as const).map((f) => (
                        <button key={f} onClick={() => setAssetFilter(f)} style={{ padding: "3px 9px", borderRadius: 4, fontSize: 10, fontFamily: "'DM Mono', monospace", border: `1px solid ${assetFilter === f ? "var(--acc)" : "var(--b1)"}`, background: assetFilter === f ? "rgba(226,245,92,0.08)" : "transparent", color: assetFilter === f ? "var(--acc)" : "var(--t3)", cursor: "pointer" }}>{f}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Asset","Barcode","Status","Location","Last user","Updated"].map((h) => (
                            <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--b1)", fontWeight: 400, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAssets.slice(0, 12).map((a) => (
                          <tr key={a.id} style={{ borderBottom: "1px solid var(--b1)", cursor: "pointer", transition: "background 0.1s" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--s2)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                            <td style={{ padding: "9px 14px", fontSize: 12 }}>{a.name}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{a.barcode}</td>
                            <td style={{ padding: "9px 14px" }}>
                              <Badge variant={a.status === "in" ? "green" : a.status === "out" ? "amber" : "red"}>
                                {a.status}
                              </Badge>
                            </td>
                            <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.location || "—"}</td>
                            <td style={{ padding: "9px 14px", fontSize: 12 }}>{a.lastUser || "—"}</td>
                            <td style={{ padding: "9px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t3)" }}>{a.lastUpdated || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* ALERTS */}
              <div>
                <Card>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>Alerts</div>
                    <Badge variant="red">{ALERTS.filter(a => a.type !== "info").length} open</Badge>
                  </div>
                  {ALERTS.map((al) => (
                    <div key={al.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 9, cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--s2)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ width: 26, height: 26, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, background: al.type === "critical" ? "rgba(255,79,79,0.12)" : al.type === "warning" ? "rgba(245,166,35,0.12)" : "rgba(90,160,240,0.12)" }}>
                        {al.type === "critical" ? "⚠" : al.type === "warning" ? "⚑" : "ℹ"}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{al.title}</div>
                        <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{al.detail}</div>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>
          )}

          {/* ASSETS PAGE */}
          {activeKey === "assets" && (
            <div className="animate-fade-up">
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                <input
                  placeholder="Search by name or barcode..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "9px 14px", color: "var(--t1)", outline: "none", fontFamily: "'DM Sans', sans-serif", fontSize: 13 }}
                />
                {(["all","in","out","flagged"] as const).map(f => (
                  <button key={f} onClick={() => setAssetFilter(f)} style={{ padding: "7px 14px", borderRadius: 6, fontSize: 12, fontFamily: "'DM Mono', monospace", border: `1px solid ${assetFilter === f ? "var(--acc)" : "var(--b1)"}`, background: assetFilter === f ? "rgba(226,245,92,0.08)" : "transparent", color: assetFilter === f ? "var(--acc)" : "var(--t2)", cursor: "pointer" }}>{f}</button>
                ))}
              </div>
              <Card>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Asset","Barcode","Category","Status","Location","Kit","Service flag","Last user"].map(h => (
                        <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono', monospace", color: "var(--t3)", letterSpacing: "0.05em", textTransform: "uppercase", borderBottom: "1px solid var(--b1)", fontWeight: 400, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map(a => (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--b1)", cursor: "pointer", transition: "background 0.1s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--s2)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <td style={{ padding: "9px 14px", fontSize: 12 }}>{a.name}</td>
                        <td style={{ padding: "9px 14px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{a.barcode}</td>
                        <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--t2)" }}>{a.category}</td>
                        <td style={{ padding: "9px 14px" }}><Badge variant={a.status === "in" ? "green" : a.status === "out" ? "amber" : "red"}>{a.status}</Badge></td>
                        <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.location || "—"}</td>
                        <td style={{ padding: "9px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t2)" }}>{a.kitId || "—"}</td>
                        <td style={{ padding: "9px 14px" }}>
                          {a.serviceFlag ? <Badge variant={a.serviceFlag.severity === "critical" ? "red" : "amber"}>{a.serviceFlag.severity}</Badge> : <span style={{ color: "var(--t3)", fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: "9px 14px", fontSize: 12 }}>{a.lastUser || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--b1)", fontSize: 11, fontFamily: "'DM Mono', monospace", color: "var(--t3)" }}>
                  Showing {filteredAssets.length} of {ASSETS.length} loaded assets · 600 total in system
                </div>
              </Card>
            </div>
          )}

          {/* KITS PAGE */}
          {activeKey === "kits" && (
            <div className="animate-fade-up">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {KITS.map(kit => (
                  <Card key={kit.id} accentColor={kit.status === "available" ? "var(--green)" : kit.status === "out" ? "var(--amber)" : "var(--blue)"}>
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{kit.name}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", marginTop: 2 }}>{kit.barcode}</div>
                        </div>
                        <Badge variant={kit.status === "available" ? "green" : kit.status === "out" ? "amber" : "blue"}>{kit.status}</Badge>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--t2)", marginBottom: 10 }}>
                        {kit.componentIds.length} components · {kit.location}
                      </div>
                      <div style={{ borderTop: "1px solid var(--b1)", paddingTop: 10 }}>
                        {ASSETS.filter(a => kit.componentIds.includes(a.id)).slice(0, 4).map(a => (
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
            </div>
          )}

          {/* SERVICE FLAGS */}
          {activeKey === "flags" && (
            <div className="animate-fade-up">
              <Card>
                {ASSETS.filter(a => a.serviceFlag).map(a => (
                  <div key={a.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 7, background: a.serviceFlag!.severity === "critical" ? "rgba(255,79,79,0.12)" : "rgba(245,166,35,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚠</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{a.name}</span>
                        <Badge variant={a.serviceFlag!.severity === "critical" ? "red" : "amber"}>{a.serviceFlag!.severity}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--t2)" }}>{a.serviceFlag!.reason}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>{a.barcode} · Last user: {a.lastUser}</div>
                    </div>
                    <button style={{ padding: "5px 12px", borderRadius: 5, fontSize: 11, background: "transparent", border: "1px solid var(--b1)", color: "var(--t2)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>Resolve</button>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* DRIFT LOG */}
          {activeKey === "drift" && (
            <div className="animate-fade-up">
              <Card>
                {[
                  { kit: "Venice Cinema Kit", asset: "SmallHD Monitor", type: "missing_on_return", checkout: "co-001", detectedAt: "2 days ago", user: "D. Colon Jr." },
                  { kit: "Shure ULXD Kit", asset: "ULXD1 Beltpack #3", type: "missing_on_return", checkout: "co-005", detectedAt: "Today", user: "T. Okafor" },
                ].map((d, i) => (
                  <div key={i} style={{ padding: "14px 16px", borderBottom: "1px solid var(--b1)", display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 7, background: "rgba(245,166,35,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>⚑</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{d.asset} missing from {d.kit}</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)" }}>{d.type.replace(/_/g, " ")} · {d.detectedAt} · {d.user}</div>
                    </div>
                    <Badge variant="amber">unresolved</Badge>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* PLACEHOLDER PAGES */}
          {["schedule","badges","guests","kiosk-admin","integrations","audit","billing","untagged"].includes(activeKey) && (
            <div className="animate-fade-up">
              <Card>
                <div style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t3)", marginBottom: 12 }}>Coming in v1.1</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{PAGES[activeKey]}</div>
                  <div style={{ fontSize: 13, color: "var(--t2)" }}>This section is under active development.</div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
