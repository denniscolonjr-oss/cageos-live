"use client";

/**
 * FirstTimeProfileModal
 *
 * Shown automatically the first time a newly-joined user lands on the
 * dashboard. Their profile was auto-created by the invite/passcode flow with
 * `pendingSetup: true`; this modal collects their real name, initials, and
 * a color so they show up properly in the audit log and team list.
 *
 * Non-dismissable until filled — the user CAN'T proceed without setting up
 * their profile. After saving, `pendingSetup` flips to false and they have
 * normal access (within their role's permissions).
 *
 * After setup, profile editing returns to Manager-only — Crew cannot revisit
 * this modal.
 */

import { useState } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { roleLabel } from "@/lib/supabase/permissions";

const COLORS = ["#7ab5f5", "#fbc25c", "#6dee9f", "#b89dfc", "#5aa0f0", "#ff9d57", "#ecff70", "#ff7a7a"];

export default function FirstTimeProfileModal() {
  const { user, currentRole } = useAuth();
  const { data, completeMyProfile } = useWorkspace();
  const myProfile = user ? data.profiles.find(p => p.userId === user.id) : null;

  const [name, setName] = useState("");
  const [initials, setInitials] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [department, setDepartment] = useState("");
  /**
   * Optional phone number. Surfaces on the active checkouts page so the
   * shop manager can text/call the person who has gear out. Free-form
   * string — no validation beyond max length, since users may include
   * extensions, regional formats, country codes, etc.
   */
  const [phone, setPhone] = useState("");
  // Tracks whether the user has manually edited initials. Used to suppress
  // the auto-suggest from name once they've typed their own. MUST be declared
  // here above any early returns — moving it below `if (!myProfile?.pendingSetup)`
  // crashes React with error #310 (rendered more hooks than previous render).
  const [initialsTouched, setInitialsTouched] = useState(false);

  // Only render if there's a profile awaiting setup. Otherwise stay invisible.
  if (!myProfile?.pendingSetup) return null;

  const initialsValid = initials.length >= 1 && initials.length <= 4;
  const nameValid = name.trim().length > 0;
  const valid = nameValid && initialsValid;

  // Auto-derive initials suggestion from name as user types (only if user
  // hasn't manually edited the initials field yet)
  function handleNameChange(v: string) {
    setName(v);
    if (!initialsTouched) {
      const auto = v.trim().split(/\s+/)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? "")
        .join("");
      setInitials(auto);
    }
  }

  function handleSubmit() {
    if (!valid) return;
    completeMyProfile({
      name: name.trim(),
      initials: initials.toUpperCase(),
      color,
      department: department.trim(),
      phone: phone.trim() || undefined,
    });
  }

  // Check for initials collision in the workspace
  const collision = data.profiles.some(p =>
    p.userId !== user?.id &&
    p.initials.toUpperCase() === initials.toUpperCase() &&
    initials.length > 0
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 20,
      backdropFilter: "blur(6px)",
    }}>
      <div style={{
        background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 12,
        maxWidth: 480, width: "100%", padding: 28,
      }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 22, fontWeight: 800, color: "var(--t1)", marginBottom: 6 }}>
          Welcome to CageOS
        </div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 22 }}>
          You&apos;ve joined as <strong style={{ color: "var(--t1)" }}>{roleLabel(currentRole)}</strong>. Set up your team profile so people know who&apos;s checking out gear and so the audit log attributes your activity correctly.
          <br /><br />
          You only need to do this once. After this, your workspace admin manages profile changes.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Your name *
            </label>
            <input
              autoFocus
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Brittany Smith"
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b2)",
                borderRadius: 6, color: "var(--t1)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 14,
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Initials *
            </label>
            <input
              value={initials}
              onChange={e => { setInitials(e.target.value.toUpperCase().slice(0, 4)); setInitialsTouched(true); }}
              placeholder="BS"
              maxLength={4}
              style={{
                width: 100, padding: "10px 12px",
                background: "var(--s2)",
                border: `1px solid ${collision ? "var(--red)" : "var(--b2)"}`,
                borderRadius: 6, color: "var(--t1)",
                fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 700,
                letterSpacing: "0.1em", textAlign: "center",
                outline: "none",
              }}
            />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: collision ? "var(--red)" : "var(--t3)", marginTop: 6, lineHeight: 1.5 }}>
              {collision ? "Those initials are already taken — pick something different." : "1-4 characters. Used as your tag on shoots and in the audit log."}
            </div>
          </div>

          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Department / Title (optional)
            </label>
            <input
              value={department}
              onChange={e => setDepartment(e.target.value)}
              placeholder="e.g. Production · Lead Camera"
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b2)",
                borderRadius: 6, color: "var(--t1)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          {/*
           * Phone number — used by the active checkouts page so a manager
           * can text/call the person who has gear out. Optional and
           * free-form (no E.164 normalization).
           */}
          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
              Phone (optional)
            </label>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 555-123-4567"
              inputMode="tel"
              autoComplete="tel"
              maxLength={32}
              style={{
                width: "100%", padding: "10px 12px",
                background: "var(--s2)", border: "1px solid var(--b2)",
                borderRadius: 6, color: "var(--t1)",
                fontFamily: "'DM Sans',sans-serif", fontSize: 13,
                outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8, display: "block" }}>
              Avatar color
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: c,
                    border: color === c ? "3px solid var(--t1)" : "1px solid var(--b1)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div style={{
            padding: 12, background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
            display: "flex", alignItems: "center", gap: 10, marginTop: 4,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--s3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
              color, flexShrink: 0,
            }}>
              {initials || "??"}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--t1)", fontWeight: 500 }}>{name || "Your name"}</div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                {roleLabel(currentRole)}{department ? ` · ${department}` : ""}
              </div>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!valid || collision}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 7,
              background: !valid || collision ? "var(--s3)" : "var(--acc)",
              border: "none",
              color: !valid || collision ? "var(--t3)" : "var(--bg)",
              cursor: !valid || collision ? "not-allowed" : "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
              marginTop: 6,
            }}>
            Save profile and get started
          </button>
        </div>
      </div>
    </div>
  );
}
