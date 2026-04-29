"use client";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import { formatShootRange } from "@/lib/timezone";

interface Props {
  open: boolean;
  onClose: () => void;
  profileInitials: string;
  profileName: string;
}

export default function AssignToShootModal({ open, onClose, profileInitials, profileName }: Props) {
  const { data, updateShoot } = useWorkspace();

  // Eligible: scheduled or active, person not already on it
  const eligibleShoots = data.shoots.filter(s =>
    (s.status === "scheduled" || s.status === "active") &&
    !s.assignedTeam.includes(profileInitials) &&
    s.leadInitials !== profileInitials
  );

  function handleAssign(shootId: string, shootTitle: string) {
    const shoot = data.shoots.find(s => s.id === shootId);
    if (!shoot) return;
    updateShoot(shootId, {
      assignedTeam: [...shoot.assignedTeam, profileInitials],
    });
    toast(`${profileName} added to ${shootTitle}`, { detail: shoot.client });
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Assign ${profileName.split(" ")[0]} to a shoot`}>
      {data.shoots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, opacity: 0.4, marginBottom: 10 }}>⬡</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No shoots scheduled</div>
          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 16 }}>
            Schedule a shoot first, then you can assign team to it.
          </div>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 7, background: "var(--acc)",
            border: "none", color: "var(--bg)", cursor: "pointer",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
          }}>OK</button>
        </div>
      ) : eligibleShoots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>✓</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Already assigned to everything</div>
          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.5, marginBottom: 16 }}>
            {profileName.split(" ")[0]} is already on every active or scheduled shoot.
          </div>
          <button onClick={onClose} style={{
            padding: "10px 20px", borderRadius: 7, background: "var(--acc)",
            border: "none", color: "var(--bg)", cursor: "pointer",
            fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
          }}>OK</button>
        </div>
      ) : (
        <>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14, lineHeight: 1.5 }}>
            Pick a shoot to add {profileName.split(" ")[0]} to.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
            {eligibleShoots.map(s => (
              <button key={s.id} onClick={() => handleAssign(s.id, s.title)} style={{
                background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8,
                padding: "12px 14px", cursor: "pointer", textAlign: "left",
                fontFamily: "'DM Sans',sans-serif", minHeight: 60,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 4, alignSelf: "stretch", flexShrink: 0,
                  background: s.status === "active" ? "var(--green)" : "var(--blue)",
                  borderRadius: 2,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)" }}>{s.title}</span>
                    <span style={{
                      fontSize: 9, padding: "2px 6px", borderRadius: 3,
                      fontFamily: "'DM Mono',monospace", textTransform: "uppercase",
                      background: s.status === "active" ? "rgba(74,222,128,0.12)" : "rgba(90,160,240,0.12)",
                      color: s.status === "active" ? "var(--green)" : "var(--blue)",
                    }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "var(--t2)" }}>
                    {s.client} · {formatShootRange(s.startsAt, s.endsAt, data.timezone)}
                  </div>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", marginTop: 3 }}>
                    {s.assignedTeam.length} team · {s.assignedKits.length} kit{s.assignedKits.length === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ fontSize: 16, color: "var(--t3)", flexShrink: 0 }}>+</div>
              </button>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
