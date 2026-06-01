"use client";
import { useState } from "react";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/shared/EmptyState";
import AddTeamMemberModal from "@/components/forms/AddTeamMemberModal";
import UserAvatar from "@/components/profile/UserAvatar";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";

export default function ProfileIndexPage() {
  const isMobile = useIsMobile();
  const { data, hydrated, isReadOnly } = useWorkspace();
  const [openAdd, setOpenAdd] = useState(false);

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
      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg)" }}>
        <div style={{
          maxWidth: 1040,
          margin: "0 auto",
          padding: isMobile ? "20px 14px 60px" : "32px 28px 80px",
          paddingBottom: `max(${isMobile ? 60 : 80}px, var(--safe-bottom))`,
        }} className="animate-fade-up">
          <div style={{
            display: "flex",
            alignItems: isMobile ? "flex-start" : "flex-end",
            justifyContent: "space-between",
            marginBottom: isMobile ? 20 : 28,
            gap: 12, flexWrap: "wrap",
          }}>
            <div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--acc)", marginBottom: 8 }}>Crew · People layer</div>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: isMobile ? 24 : 28, fontWeight: 800, letterSpacing: -1, lineHeight: 1.1, marginBottom: 10 }}>Team profiles</h1>
              <p style={{ fontSize: isMobile ? 13 : 14, color: "var(--t2)", lineHeight: 1.6, maxWidth: 640 }}>
                Every checkout builds a pattern. Tap a profile to see what shoots they&apos;ve worked, what gear they&apos;ve mastered, and where they&apos;re the natural SME.
              </p>
            </div>
            {!isReadOnly && data.profiles.length > 0 && (
              <button onClick={() => setOpenAdd(true)} style={{
                background: "var(--acc)", color: "var(--bg)", border: "none",
                padding: "10px 18px", borderRadius: 7,
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500,
                cursor: "pointer", minHeight: 40, whiteSpace: "nowrap",
              }}>+ Add team member</button>
            )}
          </div>

          {data.profiles.length === 0 ? (
            <EmptyState context="team" />
          ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 12,
          }}>
            {data.profiles.map(p => {
              const masterCategories = p.expertise.filter(e => e.level === "master").length;
              const topCategory = p.expertise[0];
              return (
                <Link key={p.id} href={`/profile/${p.initials}`} style={{ textDecoration: "none" }}>
                  <Card style={{ cursor: "pointer", transition: "all 0.15s" }}>
                    <div style={{ padding: isMobile ? 14 : 18 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                        <UserAvatar profile={p} size={48} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, flexWrap: "wrap" }}>
                            <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "var(--t1)" }}>{p.name}</div>
                            {p.isGuest && <Badge variant="purple" style={{ fontSize: 9 }}>GUEST</Badge>}
                          </div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "var(--t2)" }}>{p.role}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>Since {p.joinedAt}</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "10px 0", borderTop: "1px solid var(--b1)", borderBottom: "1px solid var(--b1)", marginBottom: 12 }}>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>{p.totalCheckouts}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>checkouts</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>{p.shootsWorkedThisYear}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>shoots / yr</div>
                        </div>
                        <div>
                          <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 700, color: masterCategories > 0 ? "var(--acc)" : "var(--t1)" }}>{masterCategories}</div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "var(--t3)", marginTop: 2 }}>master lvl</div>
                        </div>
                      </div>

                      {topCategory && (
                        <div>
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Top expertise</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                            <div style={{ fontSize: 12, color: "var(--t1)" }}>{topCategory.category}</div>
                            <Badge variant={topCategory.level === "master" ? "green" : topCategory.level === "proficient" ? "blue" : topCategory.level === "familiar" ? "amber" : "gray"}>
                              {topCategory.level}{topCategory.rank === 1 ? " · #1" : ""}
                            </Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
          )}
        </div>
      </div>
      <AddTeamMemberModal open={openAdd} onClose={() => setOpenAdd(false)} />
    </div>
  );
}
