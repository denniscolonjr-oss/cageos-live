"use client";

/**
 * /projects — Project calendar view (placeholder, iter-23)
 *
 * This route exists as a stable target for links generated in iter-23
 * (calendar export feeds, future deep-links, etc.) but the actual
 * calendar view lands in iter-24. For now it renders a simple list of
 * upcoming projects using the existing dashboard render logic, plus a
 * placeholder note that the calendar is coming.
 *
 * Once iter-24 lands, this file gets replaced with the month-grid +
 * agenda-view calendar component.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { formatShootRange } from "@/lib/timezone";

export default function ProjectsPage() {
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, hydrated } = useWorkspace();

  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  if (signedOut) {
    router.replace("/login");
    return null;
  }

  if (!hydrated || auth.loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Loading workspace...
        </div>
      </div>
    );
  }

  // Sort projects by start time, soonest first.
  const sortedProjects = [...data.projects].sort((a, b) => {
    const aT = new Date(a.startsAt).getTime();
    const bT = new Date(b.startsAt).getTime();
    return aT - bT;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 14px" : "32px 28px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 980, margin: "0 auto" }}>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 26, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
              Projects
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              Scheduled projects with their assigned crew and kits
            </div>
          </div>

          {/* Placeholder note — calendar view ships in iter-24 */}
          <Card style={{ marginBottom: 16, borderLeft: "3px solid var(--acc)" }}>
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--acc)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
                Coming next
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.5 }}>
                A full month-grid calendar view is landing in the next push. For now, this page lists upcoming projects sorted by start time.
              </div>
            </div>
          </Card>

          {sortedProjects.length === 0 ? (
            <Card>
              <div style={{
                padding: "48px 24px", textAlign: "center",
                color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 12,
              }}>
                No projects yet. Schedule one from the dashboard.
              </div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedProjects.map(p => (
                <Card key={p.id}>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 4 }}>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: "var(--t1)" }}>{p.title}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>· {p.client}</span>
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        background: p.status === "active" ? "rgba(236,255,112,0.1)" : "var(--s2)",
                        color: p.status === "active" ? "var(--acc)" : "var(--t2)",
                      }}>{p.status}</span>
                    </div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 4 }}>
                      📅 {formatShootRange(p.startsAt, p.endsAt, data.timezone)}
                      {p.location && <span style={{ marginLeft: 10 }}>📍 {p.location}</span>}
                    </div>
                    {p.assignedKits.length > 0 && (
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                        {p.assignedKits.length} kit{p.assignedKits.length === 1 ? "" : "s"} · {p.assignedTeam.length} team
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div style={{ marginTop: 20, textAlign: "center" }}>
            <Link href="/dashboard" style={{
              fontFamily: "'DM Mono',monospace", fontSize: 11,
              color: "var(--t3)", textDecoration: "none",
            }}>
              ← Back to dashboard
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
