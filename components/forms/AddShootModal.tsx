"use client";
import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Shoot } from "@/lib/hooks/workspaceTypes";
import { resolveTimezone, timezoneShortLabel, inputValueToISO, isoToInputValue } from "@/lib/timezone";

export default function AddShootModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addShoot } = useWorkspace();
  const tz = data.timezone;
  const tzLabel = useMemo(() => timezoneShortLabel(tz), [tz]);

  // Default start: today at next round hour. End: 4 hours later.
  const defaults = useMemo(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    now.setHours(now.getHours() + 1);
    const start = now.toISOString();
    const endDate = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    return { start, end: endDate.toISOString() };
  }, []);

  const [title, setTitle] = useState("");
  const [client, setClient] = useState("");
  const [startsAt, setStartsAt] = useState<string>(defaults.start); // ISO UTC
  const [endsAt, setEndsAt] = useState<string>(defaults.end);
  const [location, setLocation] = useState("");
  const [leadInitials, setLeadInitials] = useState("");
  const [assignedTeam, setAssignedTeam] = useState<Set<string>>(new Set());
  const [assignedKits, setAssignedKits] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  function reset() {
    setTitle(""); setClient(""); setStartsAt(defaults.start); setEndsAt(defaults.end);
    setLocation(""); setLeadInitials(""); setAssignedTeam(new Set()); setAssignedKits(new Set()); setNotes("");
  }

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

  /**
   * For each kit currently assigned in the form, find any other shoot whose time range
   * overlaps with this new shoot's time range. Returns conflicts as {kitId, kitName, conflicts[]}.
   *
   * Time ranges: each shoot has startsAt (ISO) and optionally endsAt (ISO). If endsAt is missing,
   * we treat the shoot as 8 hours long. We exclude completed and cancelled shoots — they
   * don't represent active claims on gear.
   */
  const kitConflicts = useMemo(() => {
    const newStart = new Date(startsAt).getTime();
    const newEndRaw = endsAt ? new Date(endsAt).getTime() : null;
    const newEnd = newEndRaw ?? newStart + 8 * 60 * 60 * 1000;

    const conflicts: { kitId: string; kitName: string; conflicts: { shootTitle: string; range: string }[] }[] = [];

    for (const kitId of assignedKits) {
      const kit = data.kits.find(k => k.id === kitId);
      if (!kit) continue;
      const overlapping: { shootTitle: string; range: string }[] = [];
      for (const otherShoot of data.shoots) {
        if (otherShoot.status === "completed" || otherShoot.status === "cancelled") continue;
        if (!otherShoot.assignedKits.includes(kitId)) continue;
        const otherStart = new Date(otherShoot.startsAt).getTime();
        const otherEnd = otherShoot.endsAt
          ? new Date(otherShoot.endsAt).getTime()
          : otherStart + 8 * 60 * 60 * 1000;
        // Overlap: newStart < otherEnd AND newEnd > otherStart
        if (newStart < otherEnd && newEnd > otherStart) {
          const startLabel = new Date(otherShoot.startsAt).toLocaleString([], {
            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
          });
          const endLabel = otherShoot.endsAt
            ? new Date(otherShoot.endsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "+8h";
          overlapping.push({ shootTitle: otherShoot.title, range: `${startLabel} – ${endLabel}` });
        }
      }
      if (overlapping.length > 0) {
        conflicts.push({ kitId, kitName: kit.name, conflicts: overlapping });
      }
    }

    return conflicts;
  }, [assignedKits, startsAt, endsAt, data.shoots, data.kits]);

  function handleSubmit() {
    if (!title.trim()) return;
    const shoot: Shoot = {
      id: `sh-${Date.now()}`,
      title: title.trim(),
      client: client.trim() || "Internal",
      startsAt,
      endsAt: endsAt || undefined,
      location: location.trim() || undefined,
      leadInitials: leadInitials || undefined,
      assignedTeam: Array.from(assignedTeam),
      assignedKits: Array.from(assignedKits),
      notes: notes.trim() || undefined,
      status: "scheduled",
    };
    addShoot(shoot);
    toast(`${shoot.title} scheduled`, {
      detail: `${shoot.assignedTeam.length} team · ${shoot.assignedKits.length} kit${shoot.assignedKits.length === 1 ? "" : "s"}`,
    });
    reset();
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

  if (data.profiles.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Schedule a shoot">
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 12 }}>⬡</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>You need a team first</div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
            Shoots assign team members and kits. Add at least one team member before scheduling a shoot.
          </div>
          <button onClick={onClose} style={{
            padding: "12px 24px", borderRadius: 7, background: "var(--acc)",
            border: "none", color: "var(--bg)", cursor: "pointer",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>OK</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Schedule a shoot" maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Shoot title *</label>
          <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Capitol Hearing Coverage" autoFocus />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Client</label>
            <input style={inputStyle} value={client} onChange={e => setClient(e.target.value)} placeholder="e.g. Dept of Interior" />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Studio A" />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Schedule</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
              entered as {tzLabel} · {resolveTimezone(tz)}
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
                value={isoToInputValue(endsAt, tz)}
                onChange={e => setEndsAt(inputValueToISO(e.target.value, tz))}
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
                  <div style={{ width: 28, height: 28, borderRadius: 5, background: "var(--s3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, fontFamily: "'Syne',sans-serif", color: p.color, flexShrink: 0 }}>{p.initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--t1)" }}>{p.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{p.role}</div>
                  </div>
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
                        {hasConflict && <span title="Time conflict with another shoot" style={{ color: "var(--amber)", marginLeft: 6, fontSize: 11 }}>⚠</span>}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 1 }}>{k.barcode} · {k.componentIds.length} components</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Conflict warnings */}
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
                      <span style={{ fontWeight: 600 }}>{c.kitName}</span> is already on{" "}
                      {c.conflicts.map((cc, i) => (
                        <span key={i}>
                          {i > 0 && ", "}
                          <span style={{ color: "var(--t1)" }}>{cc.shootTitle}</span>{" "}
                          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>({cc.range})</span>
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 6, lineHeight: 1.4 }}>
                  You can still save — but only one shoot will be able to actually check out the kit.
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
            placeholder="Setup details, special instructions, etc."
          />
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!title.trim()} style={{
            flex: 2, padding: "12px 18px", borderRadius: 7,
            background: title.trim() ? "var(--acc)" : "var(--s3)",
            border: "none",
            color: title.trim() ? "var(--bg)" : "var(--t3)",
            cursor: title.trim() ? "pointer" : "not-allowed",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>Schedule shoot</button>
        </div>
      </div>
    </Modal>
  );
}
