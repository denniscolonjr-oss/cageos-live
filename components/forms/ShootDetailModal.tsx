"use client";
import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import { formatShootRange, isoToInputValue, inputValueToISO, timezoneShortLabel } from "@/lib/timezone";
import type { Shoot } from "@/lib/hooks/workspaceTypes";

interface Props {
  open: boolean;
  onClose: () => void;
  shoot: Shoot | null;
}

export default function ShootDetailModal({ open, onClose, shoot }: Props) {
  const { data, updateShoot, deleteShoot, isReadOnly } = useWorkspace();
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
    if (shoot) {
      setTitle(shoot.title);
      setClient(shoot.client);
      setStartsAt(shoot.startsAt);
      setEndsAt(shoot.endsAt ?? "");
      setLocation(shoot.location ?? "");
      setLeadInitials(shoot.leadInitials ?? "");
      setAssignedTeam(new Set(shoot.assignedTeam));
      setAssignedKits(new Set(shoot.assignedKits));
      setNotes(shoot.notes ?? "");
      setEditing(false);
    }
  }, [shoot]);

  if (!shoot) return null;

  const teamProfiles = shoot.assignedTeam.map(i => data.profiles.find(p => p.initials === i)).filter(Boolean);
  const kits = shoot.assignedKits.map(id => data.kits.find(k => k.id === id)).filter(Boolean);
  const lead = shoot.leadInitials ? data.profiles.find(p => p.initials === shoot.leadInitials) : null;
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
    if (!shoot) return;
    if (!title.trim()) { toast("Title is required", { variant: "error" }); return; }
    updateShoot(shoot.id, {
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

  function handleStatusChange(newStatus: Shoot["status"]) {
    if (!shoot) return;
    updateShoot(shoot.id, { status: newStatus });
    const labels: Record<Shoot["status"], string> = {
      scheduled: "scheduled",
      active: "marked active",
      completed: "marked complete",
      cancelled: "cancelled",
    };
    toast(`${shoot.title} ${labels[newStatus]}`);
    if (newStatus === "completed" || newStatus === "cancelled") onClose();
  }

  function handleDelete() {
    if (!shoot) return;
    if (!confirm(`Delete "${shoot.title}"? This can't be undone.`)) return;
    deleteShoot(shoot.id);
    toast(`${shoot.title} deleted`);
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
      <Modal open={open} onClose={onClose} title={shoot.title} maxWidth={620}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Status badge + key fields */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--b1)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 3 }}>{shoot.client}</div>
              <div style={{ fontSize: 13, color: "var(--t1)" }}>
                {formatShootRange(shoot.startsAt, shoot.endsAt, tz)}
              </div>
              {shoot.location && (
                <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 3 }}>📍 {shoot.location}</div>
              )}
            </div>
            <span style={{
              fontSize: 10, padding: "3px 8px", borderRadius: 4,
              fontFamily: "'DM Mono',monospace", textTransform: "uppercase", letterSpacing: "0.05em",
              background:
                shoot.status === "active" ? "rgba(74,222,128,0.12)" :
                shoot.status === "scheduled" ? "rgba(90,160,240,0.12)" :
                shoot.status === "completed" ? "rgba(140,136,128,0.12)" :
                "rgba(255,79,79,0.12)",
              color:
                shoot.status === "active" ? "var(--green)" :
                shoot.status === "scheduled" ? "var(--blue)" :
                shoot.status === "completed" ? "var(--t3)" :
                "var(--red)",
            }}>{shoot.status}</span>
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
                      {shoot.leadInitials === p!.initials && <span style={{ color: "var(--acc)", marginLeft: 4 }}>★</span>}
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
          {shoot.notes && (
            <div>
              <div style={labelStyle}>Notes</div>
              <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7, padding: "10px 12px", fontSize: 12, color: "var(--t1)", lineHeight: 1.6 }}>
                {shoot.notes}
              </div>
            </div>
          )}

          {/* Status actions (manager mode features but allowed for v1) */}
          {!isReadOnly && (shoot.status === "scheduled" || shoot.status === "active") && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 6 }}>
              {shoot.status === "scheduled" && (
                <button onClick={() => handleStatusChange("active")} style={{
                  padding: "8px 14px", borderRadius: 6, fontSize: 12,
                  background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.3)",
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
              }}>Cancel shoot</button>
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
    <Modal open={open} onClose={onClose} title={`Edit · ${shoot.title}`} maxWidth={620}>
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
                  background: selected ? "rgba(226,245,92,0.07)" : "transparent",
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
                return (
                  <div key={k.id} onClick={() => toggleKit(k.id)} style={{
                    padding: "10px 12px", borderBottom: "1px solid var(--b1)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    background: selected ? "rgba(226,245,92,0.07)" : "transparent",
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--t1)" }}>{k.name}</div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{k.barcode}</div>
                    </div>
                  </div>
                );
              })}
            </div>
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
