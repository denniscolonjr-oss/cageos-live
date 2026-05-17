"use client";

/**
 * /projects/[id] — Single project detail (iter-26)
 *
 * The canonical drilldown view for one project. Surfaces everything a
 * crew member or manager needs to know:
 *   - WHAT it is (title, client, status, location)
 *   - WHEN it's happening (dates/times, range)
 *   - WHO is on it (lead + team, each linked to their profile)
 *   - WHAT GEAR is assigned (kits, linked to their detail pages)
 *   - WHAT'S OUT NOW (active checkouts whose project ID matches this one)
 *   - NOTES (the project's notes field)
 *   - COMMENTS thread (parentType: "project")
 *   - HISTORY (audit events filtered to this project)
 *
 * Action buttons (Manager+ only):
 *   - Edit → opens ShootDetailModal (existing edit form)
 *   - Cancel project → flips status to "cancelled" with confirm
 *   - Delete project → removes entirely with confirm + undo toast
 *
 * Replaces the old click-to-edit behavior. Now: clicking a project anywhere
 * (calendar pill, agenda row, dashboard) navigates here. Edits happen via
 * the Edit button → modal.
 */

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/shared/TopNav";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import CommentsThread from "@/components/shared/CommentsThread";
import ProceduresSection from "@/components/shared/ProceduresSection";
import ShootDetailModal from "@/components/forms/ShootDetailModal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { formatShootRange } from "@/lib/timezone";
import { getSOPsForProject } from "@/lib/sopMatching";
import { toast } from "@/components/ui/Toast";
import type { Project, ActiveCheckout } from "@/lib/hooks/workspaceTypes";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isMobile = useIsMobile();
  const router = useRouter();
  const auth = useAuth();
  const { data, hydrated } = useWorkspace();

  /**
   * Signed-out redirect — same pattern as asset/kit/checkout pages.
   * useEffect inside; runs only when supabase is enabled and we're certain
   * the user has no session. Demo/local-only modes don't trigger.
   */
  const signedOut = auth.supabaseEnabled && !auth.loading && !auth.session;
  useEffect(() => {
    if (signedOut) router.replace("/login");
  }, [signedOut, router]);

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
  if (signedOut) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3)", fontFamily: "'DM Mono',monospace", fontSize: 11 }}>
          Signing out...
        </div>
      </div>
    );
  }

  const project = data.projects.find(p => p.id === id);

  if (!project) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
        <TopNav />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 24 }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 700, color: "var(--t1)" }}>
            Project not found
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            This project doesn&apos;t exist or has been deleted.
          </div>
          <Link href="/projects" style={{
            marginTop: 8, padding: "10px 18px",
            background: "var(--acc)", color: "var(--bg)",
            borderRadius: 6, textDecoration: "none",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
          }}>← Back to projects</Link>
        </div>
      </div>
    );
  }

  return <ProjectDetailBody project={project} isMobile={isMobile} router={router} />;
}

function ProjectDetailBody({
  project, isMobile, router,
}: {
  project: Project;
  isMobile: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const auth = useAuth();
  const { data, updateProject, deleteProject } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);

  const canEdit = auth.currentRole === "owner"
    || auth.currentRole === "manager";

  // Resolve lead profile by initials lookup
  const lead = project.leadInitials
    ? data.profiles.find(p => p.initials === project.leadInitials)
    : null;

  // Team profiles, ordered by their position in the project's assignedTeam
  // array (which is also the order they were assigned)
  const teamProfiles = project.assignedTeam
    .map(init => data.profiles.find(p => p.initials === init))
    .filter((p): p is NonNullable<typeof p> => p != null);

  // Kits resolved from IDs
  const kits = data.kits.filter(k => project.assignedKits.includes(k.id));

  // Active checkouts whose projectId matches this project. Legacy shoot data
  // may have shootId — handle that fallback too. We use a typed predicate so
  // the result narrows to ActiveCheckout[] (excluding the legacy CheckoutRecord
  // demo-only shape that lacks dueBackLabel etc.).
  const linkedCheckouts = data.checkouts.filter(
    (c): c is ActiveCheckout => {
      const co = c as ActiveCheckout & { shootId?: string };
      // CheckoutRecord lacks checkedOutAtISO, which is how we tell it apart.
      if (!("checkedOutAtISO" in co)) return false;
      if (co.status !== "active" && co.status !== "overdue") return false;
      const linkedId = co.projectId ?? co.shootId;
      return linkedId === project.id;
    }
  );

  // Audit events for this project. Match by parentId in the event's detail
  // string OR by detail containing the project title. Audit events don't have
  // a structured "project ID" field, so we fall back to title matching.
  // Reverse-chronological.
  const projectEvents = data.events.filter(e => {
    if (!e.category.startsWith("project_") && !e.category.startsWith("shoot_")) return false;
    return e.summary.includes(project.title) || (e.detail ?? "").includes(project.title);
  }).slice().reverse().slice(0, 20);

  // Status color mapping
  const statusColor = (() => {
    switch (project.status) {
      case "active":    return "var(--green)";
      case "scheduled": return "var(--blue)";
      case "completed": return "var(--t3)";
      case "cancelled": return "var(--red)";
      default:          return "var(--t3)";
    }
  })();

  function handleCancel() {
    if (!confirm(`Mark "${project.title}" as cancelled?\n\nThe project stays in the system but its status flips to cancelled. Anyone subscribed to the calendar feed will see it as cancelled.`)) return;
    updateProject(project.id, { status: "cancelled" });
    toast("Project cancelled", { detail: project.title });
  }

  function handleDelete() {
    if (!confirm(`Delete "${project.title}"?\n\nThis is irreversible — the project, its team assignments, kit assignments, and history are removed. Comments stay archived but become orphaned.`)) return;
    const undo = deleteProject(project.id);
    toast(`${project.title} deleted`, {
      action: undo ? { label: "Undo", onClick: () => { undo(); toast(`${project.title} restored`); } } : undefined,
    });
    router.push("/projects");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", maxHeight: "100dvh", overflow: "hidden" }}>
      <TopNav />
      <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "16px 14px" : "28px 28px", background: "var(--bg)" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>

          {/* Back link */}
          <Link href="/projects" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            fontFamily: "'DM Mono',monospace", fontSize: 11,
            color: "var(--t3)", textDecoration: "none",
            marginBottom: 12,
          }}>
            ← All projects
          </Link>

          {/* Header */}
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
                {project.title}
              </div>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                padding: "3px 8px", borderRadius: 3, letterSpacing: "0.08em",
                textTransform: "uppercase",
                background: `color-mix(in srgb, ${statusColor} 15%, transparent)`,
                color: statusColor,
                border: `1px solid ${statusColor}`,
              }}>{project.status}</span>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
              {project.client}
            </div>
          </div>

          {/* Action buttons (Manager+) */}
          {canEdit && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <button onClick={() => setEditOpen(true)} style={{
                background: "var(--acc)", color: "var(--bg)",
                border: "none", borderRadius: 6,
                padding: "10px 16px",
                fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 13,
                cursor: "pointer", minHeight: 40,
              }}>
                Edit project
              </button>
              {project.status !== "cancelled" && (
                <button onClick={handleCancel} style={{
                  background: "transparent", color: "var(--t1)",
                  border: "1px solid var(--b2)", borderRadius: 6,
                  padding: "10px 16px",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  cursor: "pointer", minHeight: 40,
                }}>
                  Cancel project
                </button>
              )}
              <button onClick={handleDelete} style={{
                background: "transparent", color: "var(--red)",
                border: "1px solid var(--red)", borderRadius: 6,
                padding: "10px 16px",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                cursor: "pointer", minHeight: 40,
              }}>
                Delete
              </button>
            </div>
          )}

          {/* Status strip */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
              padding: "16px 18px",
              gap: isMobile ? 14 : 0,
            }}>
              <Stat label="Schedule" value={formatShootRange(project.startsAt, project.endsAt, data.timezone)} />
              <Stat label="Location" value={project.location || "—"} />
              <Stat label="Lead" value={lead ? lead.name : project.leadInitials || "—"} color={lead?.color} />
            </div>
          </Card>

          {/* Team */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: "14px 18px" }}>
              <SectionLabel>Team ({teamProfiles.length})</SectionLabel>
              {teamProfiles.length === 0 ? (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                  No team assigned yet.{canEdit && " Click Edit project to add."}
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {teamProfiles.map(p => (
                    <Link key={p.initials} href={`/profile/${encodeURIComponent(p.initials)}`} style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "6px 10px 6px 6px",
                      background: "var(--s2)", border: "1px solid var(--b1)",
                      borderRadius: 20,
                      textDecoration: "none",
                      transition: "background 0.12s",
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: "var(--s3)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700,
                        color: p.color,
                      }}>{p.initials}</div>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)" }}>
                        {p.name}
                      </span>
                      {p.initials === project.leadInitials && (
                        <span style={{
                          fontFamily: "'DM Mono',monospace", fontSize: 8, fontWeight: 700,
                          padding: "1px 5px", borderRadius: 3, letterSpacing: "0.05em",
                          background: "var(--acc)", color: "var(--bg)",
                          textTransform: "uppercase",
                        }}>LEAD</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Kits */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: "14px 18px" }}>
              <SectionLabel>Kits ({kits.length})</SectionLabel>
              {kits.length === 0 ? (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
                  No kits assigned yet.{canEdit && " Click Edit project to assign."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {kits.map(k => (
                    <Link key={k.id} href={`/kit/${encodeURIComponent(k.barcode)}`} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      background: "var(--s2)", border: "1px solid var(--b1)",
                      borderRadius: 6, textDecoration: "none",
                      transition: "background 0.12s",
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
                          {k.name}
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                          {k.barcode} · {k.componentIds.length} component{k.componentIds.length === 1 ? "" : "s"}
                        </div>
                      </div>
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                        padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em",
                        background: k.status === "out" ? "rgba(245,158,11,0.12)" : "rgba(109,238,159,0.12)",
                        color: k.status === "out" ? "var(--amber)" : "var(--green)",
                        textTransform: "uppercase",
                      }}>{k.status}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, color: "var(--t3)" }}>→</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Active checkouts for this project */}
          {linkedCheckouts.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <SectionLabel>Currently checked out for this project</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {linkedCheckouts.map(co => (
                    <Link key={co.id} href={`/checkouts/${encodeURIComponent(co.id)}`} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 12px",
                      background: "var(--s2)", border: "1px solid var(--b1)",
                      borderLeft: `3px solid ${co.status === "overdue" ? "var(--red)" : "var(--amber)"}`,
                      borderRadius: 6, textDecoration: "none",
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "var(--s3)", flexShrink: 0,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "'Syne',sans-serif", fontSize: 10, fontWeight: 700,
                        color: co.color,
                      }}>{co.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>
                          {co.user}
                        </div>
                        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)", marginTop: 2 }}>
                          {co.kits.join(" · ")}
                        </div>
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: co.status === "overdue" ? "var(--red)" : "var(--t3)", textAlign: "right" }}>
                        {co.status === "overdue" ? "OVERDUE" : `Due ${co.dueBackLabel}`}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Notes */}
          {project.notes && (
            <Card style={{ marginBottom: 14 }}>
              <div style={{ padding: "14px 18px" }}>
                <SectionLabel>Notes</SectionLabel>
                <div style={{
                  fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                  color: "var(--t1)", lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {project.notes}
                </div>
              </div>
            </Card>
          )}

          {/* Procedures linked to this project (iter-27c) */}
          <Card style={{ marginBottom: 14 }}>
            <ProceduresSection
              targetType="project"
              targetId={project.id}
              targetName={project.title}
              sops={getSOPsForProject(project, data.sops)}
            />
          </Card>

          {/* Comments */}
          <Card style={{ marginBottom: 14 }}>
            <div style={{ padding: "14px 18px 18px" }}>
              <CommentsThread
                parentType="project"
                parentId={project.id}
                parentLabel={project.title}
              />
            </div>
          </Card>

          {/* History */}
          {projectEvents.length > 0 && (
            <Card>
              <div style={{ padding: "14px 18px" }}>
                <SectionLabel>History</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {projectEvents.map(e => (
                    <div key={e.id} style={{
                      display: "flex", gap: 10, alignItems: "baseline",
                      paddingBottom: 7,
                      borderBottom: "1px solid var(--b1)",
                    }}>
                      <div style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 10,
                        color: "var(--t3)",
                        minWidth: 100,
                      }}>
                        {formatRelative(e.timestamp)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)" }}>
                          {e.summary}
                        </div>
                        {e.detail && (
                          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                            {e.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>

      {/* Edit modal — reuses the existing ShootDetailModal */}
      <ShootDetailModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
      />
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: "'DM Mono',monospace", fontSize: 9,
      color: "var(--t3)", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 500, color: color ?? "var(--t1)" }}>
        {value}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
