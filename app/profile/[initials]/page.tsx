"use client";
import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { formatShootRange } from "@/lib/timezone";

const LEVEL_BAR: Record<string, { pct: number; color: string }> = {
  novice: { pct: 25, color: "var(--t3)" },
  familiar: { pct: 50, color: "var(--amber)" },
  proficient: { pct: 75, color: "var(--blue)" },
  master: { pct: 100, color: "var(--acc)" },
};

export default function ProfileDetailPage({ params }: { params: Promise<{ initials: string }> }) {
  const isMobile = useIsMobile();
  const { data, hydrated } = useWorkspace();
  const { initials } = use(params);

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

  const profile = data.profiles.find(p => p.initials === initials);
  if (!profile) return notFound();

  const nextLevel = profile.expertise.find(e => e.level !== "master");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: isMobile ? "16px 14px 60px" : "28px 28px 80px",
          paddingBottom: `max(${isMobile ? 60 : 80}px, var(--safe-bottom))`,
        }} className="animate-fade-up">

          {/* Back nav */}
          <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", textDecoration: "none", marginBottom: 16, padding: "6px 0", minHeight: 32 }}>
            ← All profiles
          </Link>

          {/* Hero */}
          <div style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "flex-start",
            gap: isMobile ? 14 : 22,
            marginBottom: 24,
          }}>
            <div style={{
              width: isMobile ? 64 : 80,
              height: isMobile ? 64 : 80,
              borderRadius: 14,
              background: "var(--s3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isMobile ? 22 : 28,
              fontWeight: 700, fontFamily: "'Syne', sans-serif",
              color: profile.color, flexShrink: 0,
              border: `2px solid ${profile.color}30`,
            }}>
              {profile.initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 800, letterSpacing: -0.5, color: "var(--t1)" }}>{profile.name}</h1>
                {profile.isGuest && <Badge variant="purple">GUEST</Badge>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 14, flexWrap: "wrap", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>
                <span>{profile.role}</span>
                <span style={{ color: "var(--t3)" }}>·</span>
                <span>{profile.department}</span>
                {!isMobile && <span style={{ color: "var(--t3)" }}>·</span>}
                {!isMobile && <span>{profile.location}</span>}
                <span style={{ color: "var(--t3)" }}>·</span>
                <span>Since {profile.joinedAt}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, width: isMobile ? "100%" : "auto" }}>
              <button style={{ padding: "10px 14px", borderRadius: 6, fontSize: 12, background: "transparent", border: "1px solid var(--b1)", color: "var(--t2)", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", flex: isMobile ? 1 : "0 0 auto", minHeight: 40 }}>
                Message
              </button>
              <button style={{ padding: "10px 14px", borderRadius: 6, fontSize: 12, background: "var(--acc)", color: "var(--bg)", border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontWeight: 500, flex: isMobile ? 1 : "0 0 auto", minHeight: 40 }}>
                Assign to shoot
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${data.managerMode ? 5 : 3}, 1fr)`,
            gap: isMobile ? 8 : 10,
            marginBottom: 24,
          }}>
            {[
              { label: "Checkouts", value: profile.totalCheckouts, sub: "lifetime", color: "var(--blue)", managerOnly: false },
              { label: "Hours", value: profile.totalHours, sub: "lifetime", color: "var(--blue)", managerOnly: false },
              { label: "Shoots / yr", value: profile.shootsWorkedThisYear, sub: "2026 YTD", color: "var(--acc)", managerOnly: false },
              { label: "Condition", value: profile.conditionScore, sub: "return quality", color: profile.conditionScore >= 95 ? "var(--green)" : profile.conditionScore >= 85 ? "var(--amber)" : "var(--red)", managerOnly: true },
              { label: "Reliability", value: profile.reliabilityScore, sub: "on-time", color: profile.reliabilityScore >= 95 ? "var(--green)" : profile.reliabilityScore >= 85 ? "var(--amber)" : "var(--red)", managerOnly: true },
            ]
              .filter(s => !s.managerOnly || data.managerMode)
              .map(s => (
                <Card key={s.label} accentColor={s.color}>
                  <div style={{ padding: isMobile ? "12px 14px" : "14px 16px" }}>
                    <div style={{ fontSize: 10, color: "var(--t2)", fontFamily: "'DM Mono', monospace", marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 22 : 26, fontWeight: 700, letterSpacing: -1, lineHeight: 1, color: "var(--t1)" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{s.sub}</div>
                  </div>
                </Card>
              ))}
          </div>

          {/* Two column main content */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 320px",
            gap: 18,
          }}>
            {/* LEFT */}
            <div>
              {/* Expertise */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Expertise</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700 }}>Where they shine</div>
                  </div>
                  {nextLevel && !isMobile && (
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)" }}>
                      Next milestone: <span style={{ color: "var(--acc)" }}>{nextLevel.category}</span>
                    </div>
                  )}
                </div>
                <Card>
                  {profile.expertise.map((e, i) => (
                    <div key={e.category} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < profile.expertise.length - 1 ? "1px solid var(--b1)" : "none" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 600 }}>{e.category}</div>
                          {e.rank === 1 && <Badge variant="green" style={{ fontSize: 9 }}>#1 IN SHOP</Badge>}
                          {e.rank === 2 && <Badge variant="blue" style={{ fontSize: 9 }}>#{e.rank} IN SHOP</Badge>}
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: LEVEL_BAR[e.level].color, textTransform: "capitalize" }}>{e.level}</div>
                      </div>
                      <div style={{ height: 4, background: "var(--s3)", borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
                        <div style={{ width: `${LEVEL_BAR[e.level].pct}%`, height: "100%", background: LEVEL_BAR[e.level].color, transition: "width 0.4s ease" }} />
                      </div>
                      <div style={{ display: "flex", gap: isMobile ? 10 : 14, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", flexWrap: "wrap" }}>
                        <span><span style={{ color: "var(--t3)" }}>Checkouts</span> {e.checkoutCount}</span>
                        <span><span style={{ color: "var(--t3)" }}>Hours</span> {e.hoursLogged}</span>
                        {!isMobile && e.signatureAsset && <span><span style={{ color: "var(--t3)" }}>Signature</span> {e.signatureAsset}</span>}
                        <span style={{ marginLeft: "auto", color: "var(--t3)" }}>{e.lastUsed}</span>
                      </div>
                      {isMobile && e.signatureAsset && (
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", marginTop: 4 }}>
                          <span style={{ color: "var(--t3)" }}>Signature</span> {e.signatureAsset}
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>

              {/* Upcoming shoots from workspace */}
              {(() => {
                const upcomingShoots = data.shoots.filter(s =>
                  (s.status === "active" || s.status === "scheduled") &&
                  (s.assignedTeam.includes(profile.initials) || s.leadInitials === profile.initials)
                );
                if (upcomingShoots.length === 0) return null;
                return (
                  <div style={{ marginBottom: 22 }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>On the calendar</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Upcoming shoots</div>
                    <Card>
                      {upcomingShoots.map((sh, i) => (
                        <div key={sh.id} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < upcomingShoots.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ width: 4, alignSelf: "stretch", flexShrink: 0, background: sh.status === "active" ? "var(--green)" : "var(--blue)", borderRadius: 2 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>
                                {sh.title}
                                {sh.leadInitials === profile.initials && <span style={{ color: "var(--acc)", marginLeft: 6, fontSize: 11 }}>★ lead</span>}
                              </div>
                              <Badge variant={sh.status === "active" ? "green" : "blue"}>{sh.status}</Badge>
                            </div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginBottom: sh.notes ? 6 : 0 }}>
                              {sh.client} · {formatShootRange(sh.startsAt, sh.endsAt, data.timezone)}{sh.location ? ` · ${sh.location}` : ""}
                            </div>
                            {sh.notes && (
                              <div style={{ fontSize: 11, color: "var(--t3)", lineHeight: 1.5 }}>{sh.notes}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </Card>
                  </div>
                );
              })()}

              {/* History */}
              <div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Activity</div>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Recent shoots</div>
                <Card>
                  {profile.history.length === 0 && (
                    <div style={{ padding: 32, textAlign: "center", fontSize: 12, color: "var(--t3)", fontFamily: "'DM Mono', monospace" }}>No shoot history yet</div>
                  )}
                  {profile.history.map((h, i) => (
                    <div key={h.id} style={{ padding: isMobile ? "12px 14px" : "14px 16px", borderBottom: i < profile.history.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", gap: 12 }}>
                      <div style={{ width: 4, flexShrink: 0, background: h.incident?.severity === "major" ? "var(--red)" : h.incident?.severity === "minor" ? "var(--amber)" : h.notesAdded ? "var(--acc)" : "var(--b2)", borderRadius: 2 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600 }}>{h.shoot}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)" }}>{h.date}</div>
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)", marginBottom: 6 }}>
                          {h.client} · {h.durationHours}h · {h.kitIds.length} kit{h.kitIds.length !== 1 ? "s" : ""}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {h.kitIds.slice(0, 3).map(id => {
                            const kit = data.kits.find(k => k.id === id);
                            return (
                              <span key={id} style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t2)", background: "var(--s2)", padding: "2px 7px", borderRadius: 3 }}>
                                {kit?.name ?? id}
                              </span>
                            );
                          })}
                          {h.conditionOnReturn !== "none" && (
                            <Badge variant={h.conditionOnReturn === "excellent" ? "green" : h.conditionOnReturn === "good" ? "blue" : h.conditionOnReturn === "fair" ? "amber" : "red"}>
                              returned {h.conditionOnReturn}
                            </Badge>
                          )}
                          {h.notesAdded && <Badge variant="green" style={{ fontSize: 9 }}>+ SOP NOTES</Badge>}
                          {h.incident && (
                            <Badge variant={h.incident.severity === "major" ? "red" : "amber"} style={{ fontSize: 9 }}>
                              {h.incident.severity === "major" ? "INCIDENT" : "minor note"}
                            </Badge>
                          )}
                        </div>
                        {h.incident && (
                          <div style={{ marginTop: 8, padding: "7px 10px", background: h.incident.severity === "major" ? "rgba(255,79,79,0.06)" : "rgba(245,166,35,0.06)", border: `1px solid ${h.incident.severity === "major" ? "rgba(255,79,79,0.2)" : "rgba(245,166,35,0.2)"}`, borderRadius: 5, fontSize: 11, color: h.incident.severity === "major" ? "var(--red)" : "var(--amber)", fontFamily: "'DM Mono', monospace", lineHeight: 1.4 }}>
                            {h.incident.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              </div>
            </div>

            {/* RIGHT */}
            <div>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>At a glance</div>
                <Card>
                  <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>SOPs contributed</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: profile.sopsContributed > 5 ? "var(--acc)" : "var(--t1)" }}>{profile.sopsContributed}</div>
                  </div>
                  {data.managerMode && (
                    <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--b1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontSize: 12, color: "var(--t2)" }}>Drift incidents</div>
                      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: profile.driftIncidents === 0 ? "var(--green)" : profile.driftIncidents > 2 ? "var(--red)" : "var(--amber)" }}>{profile.driftIncidents}</div>
                    </div>
                  )}
                  <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: "var(--t2)" }}>Active badges</div>
                    <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700 }}>{profile.badgeCount}</div>
                  </div>
                </Card>
              </div>

              {profile.frequentCollaborators.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Works often with</div>
                  <Card>
                    {profile.frequentCollaborators.map((c, i) => {
                      const collabProfile = data.profiles.find(p => p.initials === c.initials);
                      return (
                        <Link key={c.name} href={collabProfile ? `/profile/${c.initials}` : "#"} style={{ textDecoration: "none" }}>
                          <div style={{ padding: "12px 14px", borderBottom: i < profile.frequentCollaborators.length - 1 ? "1px solid var(--b1)" : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", minHeight: 56 }}>
                            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "'Syne', sans-serif", color: c.color }}>{c.initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, color: "var(--t1)" }}>{c.name}</div>
                              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{c.sharedShoots} shared shoots</div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </Card>
                </div>
              )}

              {profile.certifications.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Certifications</div>
                  <Card>
                    {profile.certifications.map((c, i) => (
                      <div key={c.name} style={{ padding: "12px 14px", borderBottom: i < profile.certifications.length - 1 ? "1px solid var(--b1)" : "none" }}>
                        <div style={{ fontSize: 12, color: "var(--t1)", marginBottom: 2, lineHeight: 1.4 }}>{c.name}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)" }}>
                          Issued {c.issuedAt}{c.expiresAt ? ` · Expires ${c.expiresAt}` : " · No expiry"}
                        </div>
                      </div>
                    ))}
                  </Card>
                </div>
              )}

              {profile.certifications.length === 0 && profile.expertise.length > 0 && (
                <div>
                  <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Certifications</div>
                  <Card>
                    <div style={{ padding: 18, textAlign: "center" }}>
                      <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 8 }}>No certifications on file yet</div>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", lineHeight: 1.5 }}>
                        Based on checkout patterns, consider pursuing certifications for their top expertise areas.
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
