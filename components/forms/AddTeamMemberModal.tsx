"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace, getInitials } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { UserProfile } from "@/lib/data";

const ROLES = [
  "Broadcast Engineer", "Camera Operator", "Audio Technician", "Audio Engineer",
  "Lighting Technician", "Gaffer", "Video Editor", "Post-Production Engineer",
  "DIT / Editor", "Producer", "Director", "Branch Chief", "Manager", "Other",
];

const DEPARTMENTS = ["Production", "Post", "Creative", "Leadership", "Guest", "Other"];

const COLORS = ["#60a5fa", "#f59e0b", "#4ade80", "#a78bfa", "#5aa0f0", "#ff8c42"];

export default function AddTeamMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addProfile, data } = useWorkspace();
  const [name, setName] = useState("");
  const [role, setRole] = useState("Camera Operator");
  const [department, setDepartment] = useState("Production");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [isGuest, setIsGuest] = useState(false);

  function reset() {
    setName(""); setRole("Camera Operator"); setDepartment("Production");
    setLocation(""); setEmail(""); setIsGuest(false);
  }

  function handleSubmit() {
    if (!name.trim()) return;
    let initials = getInitials(name);
    // Ensure uniqueness
    const existing = new Set(data.profiles.map(p => p.initials));
    if (existing.has(initials)) {
      let suffix = 2;
      while (existing.has(`${initials}${suffix}`)) suffix++;
      initials = `${initials}${suffix}`;
    }
    const color = COLORS[data.profiles.length % COLORS.length];
    const profile: UserProfile = {
      id: `u-${Date.now()}`,
      name: name.trim(),
      initials,
      color,
      role,
      department: isGuest ? "Guest" : department,
      location: location.trim() || "—",
      email: email.trim(),
      joinedAt: new Date().toLocaleString("en-US", { month: "short", year: "numeric" }),
      badgeCount: isGuest ? 0 : 1,
      isGuest,
      totalCheckouts: 0,
      totalHours: 0,
      shootsWorkedThisYear: 0,
      conditionScore: 100,
      reliabilityScore: 100,
      driftIncidents: 0,
      sopsContributed: 0,
      expertise: [],
      history: [],
      frequentCollaborators: [],
      certifications: [],
    };
    addProfile(profile);
    toast(`${profile.name} added to your team`, { detail: `${profile.role} · ${profile.initials}` });
    reset();
    onClose();
  }

  const inputStyle = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
    borderRadius: 7, padding: "10px 12px",
    color: "var(--t1)", outline: "none",
    fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
  };
  const labelStyle = {
    fontFamily: "'DM Mono',monospace", fontSize: 10,
    color: "var(--t3)", letterSpacing: "0.08em",
    textTransform: "uppercase" as const, marginBottom: 6, display: "block",
  };

  return (
    <Modal open={open} onClose={onClose} title="Add team member">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Full name *</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sarah Mitchell" autoFocus />
          {name.trim() && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
              Initials: <span style={{ color: "var(--acc)" }}>{getInitials(name)}</span>
            </div>
          )}
        </div>

        <div>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="sarah@yourorg.com" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} disabled={isGuest}>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Location</label>
          <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Washington DC" />
        </div>

        <label style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 12px",
          background: "var(--s2)",
          border: "1px solid var(--b1)",
          borderRadius: 7,
          cursor: "pointer",
          minHeight: 44,
        }}>
          <input type="checkbox" checked={isGuest} onChange={e => setIsGuest(e.target.checked)} style={{ width: 18, height: 18, accentColor: "var(--acc)" }} />
          <div>
            <div style={{ fontSize: 13, color: "var(--t1)" }}>Guest / freelancer</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
              No badge — uses a time-limited token
            </div>
          </div>
        </label>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim()} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: name.trim() ? "var(--acc)" : "var(--s3)",
            border: "none",
            color: name.trim() ? "var(--bg)" : "var(--t3)",
            cursor: name.trim() ? "pointer" : "not-allowed",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>
            Add member
          </button>
        </div>
      </div>
    </Modal>
  );
}
