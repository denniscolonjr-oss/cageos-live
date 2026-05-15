"use client";
import { useState, useEffect, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import { formatShootRange, isoToInputValue, inputValueToISO, timezoneShortLabel } from "@/lib/timezone";
import type { Project } from "@/lib/hooks/workspaceTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ShootDetailModal({ open, onClose, project }: Props) {
  const { data, updateProject, deleteProject, isReadOnly } = useWorkspace();
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [location, setLocation] = useState("");
  const [leadInitials, setLeadInitials] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<Set<string>>(new Set());
  const [assignedKits, setAssignedKits] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (project) {
      setTitle(project.title);
      setClient(project.client);
      setStartsAt(project.startsAt);
      setEndsAt(project.endsAt ?? "");
      setLocation(project.location ?? "");
      setLeadInitials(project.leadInitials ?? "");
      setAssignedTeam(new Set(project.assignedTeam));
      setAssignedKits(new Set(project.assignedKits));
      setNotes(project.notes ?? "");
      setEditing(false);
    }
  }, [project]);

  /**
   * Conflicts with OTHER projects only (not this one being edited).
   *
   * IMPORTANT: This hook MUST be declared before any early returns.
   * Hooks must run in the same order on every render — the previous version
   * of this file declared this useMemo AFTER `if (!project) return null;`,
   * which crashed React with error #310 (rendered more hooks than previous
   * render) the first time the modal opened with a non-null project.
   */
  const kitConflicts = useMemo(() => {
    if (!project) return [];
    if (!startsAt) return [];
    const newStart = new Date(startsAt).getTime();
    const newEndRaw = endsAt ? new Date(endsAt).getTime() : null;
    const newEnd = newEndRaw ?? newStart + 8 * 60 * 60 * 1000;

    const conflicts: { kitId: string; kitName: string; conflicts: { projectTitle: string; range: string }[] }[] = [];

    for (const kitId of assignedKits) {
      const kit = data.kits.find(k => k.id === kitId);
      if (!kit) continue;
      const overlapping: { projectTitle: string; range: string }[] = [];
      for (const otherProject of data.projects) {
        if (otherProject.id === project.id) continue;
        if (otherProject.status === "completed" || otherProject.status === "cancelled") continue;
        if (!otherProject.assignedKits.includes(kitId)) continue;
        const otherStart = new Date(otherProject.startsAt).getTime();
        const otherEnd = otherProject.endsAt
          ? new Date(otherProject.endsAt).getTime()
          : otherStart + 8 * 60 * 60 * 1000;
        if (newStart < otherEnd && newEnd > otherStart) {
          const startLabel = new Date(otherProject.startsAt).toLocaleString([], {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          });
          const endLabel = otherProject.endsAt
            ? new Date(otherProject.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "+8h";
          overlapping.push({ projectTitle: otherProject.title, range: `${startLabel} – ${endLabel}` });
        }
      }
      if (overlapping.length > 0) {
        conflicts.push({ kitId, kitName: kit.name, conflicts: overlapping });
      }
    }

    return conflicts;
  }, [assignedKits, startsAt, endsAt, data.projects, data.kits, project]);

  if (!project) return null;

  const teamProfiles = project.assignedTeam.map(i => data.profiles.find(p => p.initials === i)).filter(Boolean);
  const kits = project.assignedKits.map(id => data.kits.find(k => k.id === id)).filter(Boolean);
  const lead = project.leadInitials ? data.profiles.find(p => p.initials === project.leadInitials) : null;
  const tz = data.timezone;

  function toggleTeam(initials: string) {
    const next = new Set(assignedTeam);
    if (next.has(initials)) next.delete(initials); else next.add(initials);
    setAssignedTeam(next);
  }
  function toggleKit(id: string) {
    const next = new Set(assignedKits);
    if (next.has(id)) next.delete(id); else next.add(id);
    setAssignedKits(next);
  }

  function handleSaveEdit() {
    if (!project) return;
    if (!title.trim()) { toast("Title is required", { variant: "error" }); return; }
    updateProject(project.id, {
      title: title.trim(),
      client: client.trim() || "Internal",
      startsAt,
      endsAt: endsAt || undefined,
      location: location.trim() || undefined,
      leadInitials: leadInitials || undefined,
      assignedTeam: Array.from(assignedTeam),
      assignedKits: Array.from(assignedKits),
      notes: notes.trim() || undefined,
    });
    toast(`${title.trim()} updated`);
    setEditing(false);
  }

  function handleStatusChange(newStatus: Project["status"]) {
    if (!project) return;
    updateProject(project.id, { status: newStatus });
    const labels: Record<Project["status"], string> = {
      scheduled: "scheduled",
      active: "marked active",
      completed: "marked complete",
      cancelled: "cancelled",
    };
    toast(`${project.title} ${labels[newStatus]}`);
    if (newStatus === "completed" || newStatus === "cancelled") onClose();
  }

  function handleDelete() {
    if (!project) return;
    if (!confirm(`Delete "${project.title}"?`)) return;
    const projectTitle = project.title;
    const undo = deleteProject(project.id);
    toast(`${projectTitle} deleted`, {
      action: undo ? { label: "Undo", onClick: () => { undo(); toast(`${projectTitle} restored`); } } : undefined,
    });
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
    borderRadius: 7, padding: "10px 12px",
    color: "var(--t1)", outline: "none",
    fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
    colorScheme: "dark",
  };
  const labelStyle: React.CSSProperties = {
    fontFamily: "'DM Mono',monospace", fontSize: 10,
    color: "var(--t3)", letterSpacing: "0.08em",
    textTransform: "uppercase", marginBottom: 6, display: "block",
  };

  // ============ VIEW MODE ============
  if (!editing) {
    return (
      <Modal open={open} onClose={onClose} title={project.title} maxWidth={620}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Status badge + key fields */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--b1)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 3 }}>{project.client}</div>
              <div style={{ fontSize: 13, color: "var(--t1)" }}>
                {formatShootRange(project.startsAt, project.endsAt, tz)}
              </div>
              {project.location && (
                <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 3 }}>📍 {project.location}</div>
              )}
            </div>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4,
              fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
              background:
                project.status === "active" ? "rgba(109,238,159,0.12)" :
                project.status === "scheduled" ? "rgba(122,181,245,0.12)" :
                project.status === "completed" ? "rgba(205,200,188,0.12)" :
                "rgba(255,122,122,0.12)",
              color:
                project.status === "active" ? "var(--green)" :
                project.status === "scheduled" ? "var(--blue)" :
                project.status === "completed" ? "var(--t3)" :
                "var(--red)",
            }}>{project.status}</span>
          </div>

          {/* Team */}
          {teamProfiles.length > 0 && (
            <div>
              <div style={labelStyle}>Team ({teamProfiles.length})</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {teamProfiles.map(p => (
                  <div key={p!.initials} title={p!.name} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 10px 5px 5px", borderRadius: 16,
                    background: "var(--s2)", border: "1px solid var(--b1)",
                  }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: p!.color, flexShrink: 0 }}>{p!.initials}</div>
                    <span style={{ fontSize: 11, color: "var(--t1)" }}>
                      {p!.name.split(" ")[0]}
                      {project.leadInitials === p!.initials && <span style={{ color: "var(--acc)", marginLeft: 4 }}>★</span>}
                    </span>
                  </div>
                ))}
              </div>
              {lead && (
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 6 }}>
                  ★ Lead: <span style={{ color: "var(--acc)" }}>{lead.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Kits */}
          {kits.length > 0 && (
            <div>
              <div style={labelStyle}>Kits ({kits.length})</div>
              <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "8px 12px" }}>
                {kits.map(k => (
                  <div key={k!.id} style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "var(--t2)", padding: "3px 0" }}>
                    · {k!.name} <span style={{ color: "var(--t3)" }}>({k!.barcode})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div>
              <div style={labelStyle}>Notes</div>
              <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "10px 12px", fontSize: 12, color: "var(--t1)", lineHeight: 1.6 }}>
                {project.notes}
              </div>
            </div>
          )}

          {/* Status actions (manager mode features but allowed for v1) */}
          {!isReadOnly && (project.status === "scheduled" || project.status === "active") && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 6 }}>
              {project.status === "scheduled" && (
                <button onClick={() => handleStatusChange("active")} style={{
                  padding: "8px 14px", borderRadius: 6, fontSize: 12,
                  background: "rgba(109,238,159,0.08)", border: "1px solid rgba(109,238,159,0.3)",
                  color: "var(--green)", cursor: "pointer",
                  fontFamily: "'DM Mono',monospace", minHeight: 36,
                }}>▶ Mark active</button>
              )}
              <button onClick={() => handleStatusChange("completed")} style={{
                padding: "8px 14px", borderRadius: 6, fontSize: 12,
                background: "var(--s2)", border: "1px solid var(--b1)",
                color: "var(--t2)", cursor: "pointer",
                fontFamily: "'DM Mono',monospace", minHeight: 36,
              }}>✓ Mark complete</button>
              <button onClick={() => handleStatusChange("cancelled")} style={{
                padding: "8px 14px", borderRadius: 6, fontSize: 12,
                background: "transparent", border: "1px solid var(--b1)",
                color: "var(--t3)", cursor: "pointer",
                fontFamily: "'DM Mono',monospace", minHeight: 36,
              }}>Cancel project</button>
            </div>
          )}

          {/* Footer */}
          {!isReadOnly && (
            <div style={{ display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--b1)" }}>
              <button onClick={handleDelete} style={{
                padding: "10px 16px", borderRadius: 6,
                background: "transparent", border: "1px solid var(--red)",
                color: "var(--red)", cursor: "pointer",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
              }}>Delete</button>
              <div style={{ flex: 1 }} />
              <button onClick={() => setEditing(true)} style={{
                padding: "10px 18px", borderRadius: 7,
                background: "var(--acc)", border: "none", color: "var(--bg)",
                cursor: "pointer", fontFamily: "'Syne',sans-serif",
                fontSize: 13, fontWeight: 700, minHeight: 40,
              }}>Edit</button>
            </div>
          )}
        </div>
      </Modal>
    );
  }

  // ============ EDIT MODE ============
  return (
    <Modal open={open} onClose={onClose} title={`Edit · ${project.title}`} maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Client</label>
            <input style={inputStyle} value={client} onChange={e => setClient(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Schedule</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              entered as {timezoneShortLabel(tz)}
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>Starts</div>
              <input
                type="datetime-local"
                style={inputStyle}
                value={isoToInputValue(startsAt, tz)}
                onChange={e => setStartsAt(inputValueToISO(e.target.value, tz))}
              />
            </div>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", marginBottom: 4 }}>Ends</div>
              <input
                type="datetime-local"
                style={inputStyle}
                value={endsAt ? isoToInputValue(endsAt, tz) : ""}
                onChange={e => setEndsAt(e.target.value ? inputValueToISO(e.target.value, tz) : "")}
              />
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Lead operator</label>
          <select
            style={inputStyle}
            value={leadInitials}
            onChange={e => setLeadInitials(e.target.value)}
          >
            <option value="" style={{ background: "var(--s2)", color: "var(--t1)" }}>— No lead —</option>
            {data.profiles.map(p => (
              <option key={p.initials} value={p.initials} style={{ background: "var(--s2)", color: "var(--t1)" }}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={labelStyle}>Team ({assignedTeam.size} assigned)</label>
          <div style={{ maxHeight: 180, overflowY: "auto", background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7 }}>
            {data.profiles.map(p => {
              const selected = assignedTeam.has(p.initials);
              return (
                <div key={p.initials} onClick={() => toggleTeam(p.initials)} style={{
                  padding: "10px 12px", borderBottom: "1px solid var(--b1)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  background: selected ? "rgba(236,255,112,0.07)" : "transparent",
                  minHeight: 44,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${selected ? "var(--acc)" : "var(--b2)"}`,
                    background: selected ? "var(--acc)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--bg)", fontSize: 11, fontWeight: 700,
                  }}>{selected && "✓"}</div>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: p.color, flexShrink: 0 }}>{p.initials}</div>
                  <div style={{ flex: 1, fontSize: 13, color: "var(--t1)" }}>{p.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        {data.kits.length > 0 && (
          <div>
            <label style={labelStyle}>Kits ({assignedKits.size} assigned)</label>
            <div style={{ maxHeight: 180, overflowY: "auto", background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7 }}>
              {data.kits.map(k => {
                const selected = assignedKits.has(k.id);
                const hasConflict = kitConflicts.some(c => c.kitId === k.id);
                return (
                  <div key={k.id} onClick={() => toggleKit(k.id)} style={{
                    padding: "10px 12px", borderBottom: "1px solid var(--b1)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    background: selected ? (hasConflict ? "rgba(251,194,92,0.07)" : "rgba(236,255,112,0.07)") : "transparent",
                    minHeight: 44,
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4,
                      border: `1.5px solid ${selected ? (hasConflict ? "var(--amber)" : "var(--acc)") : "var(--b2)"}`,
                      background: selected ? (hasConflict ? "var(--amber)" : "var(--acc)") : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                      color: "var(--bg)", fontSize: 11, fontWeight: 700,
                    }}>{selected && "✓"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--t1)" }}>
                        {k.name}
                        {hasConflict && <span title="Time conflict with another project" style={{ color: "var(--amber)", marginLeft: 6, fontSize: 11 }}>⚠</span>}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{k.barcode}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {kitConflicts.length > 0 && (
              <div style={{
                background: "rgba(251,194,92,0.08)",
                border: "1px solid rgba(251,194,92,0.25)",
                borderRadius: 7, padding: "10px 12px", marginTop: 8,
              }}>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--amber)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
                  ⚠ Kit time conflict{kitConflicts.length === 1 ? "" : "s"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {kitConflicts.map(c => (
                    <div key={c.kitId} style={{ fontSize: 11, color: "var(--t1)", lineHeight: 1.5 }}>
                      <span style={{ fontWeight: 600 }}>{c.kitName}</span> is also on{" "}
                      {c.conflicts.map((cc, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          <span style={{ color: "var(--t1)" }}>{cc.projectTitle}</span>{" "}
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>({cc.range})</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>Notes</label>
          <textarea
            style={{ ...inputStyle, minHeight: 80, paddingTop: 10, fontFamily: "'DM Sans',sans-serif", resize: "vertical" }}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
          <button onClick={() => setEditing(false)} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
          }}>Cancel</button>
          <button onClick={handleSaveEdit} style={{
            flex: 2, padding: "12px 18px", borderRadius: 7,
            background: "var(--acc)", border: "none", color: "var(--bg)",
            cursor: "pointer", fontFamily: "'Syne',sans-serif",
            fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>Save changes</button>
        </div>
      </div>
    </Modal>
  );
}
