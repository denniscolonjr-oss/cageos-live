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

/**
 * localStorage key for the user's cached "default profile" — the values they
 * filled in the FIRST time they did FirstTimeProfile setup. Used to pre-fill
 * the form when the user joins a NEW workspace, so they don't have to retype
 * name/initials/color/department/phone every time.
 *
 * Scoped by Supabase user id so different users on the same browser don't
 * see each other's defaults. We store a stringified JSON blob:
 *   { name, initials, color, department, phone }
 *
 * Updated on every successful completeMyProfile call. If the user changes
 * their name/initials/color in one workspace, the next workspace they join
 * gets pre-filled with the LATEST values.
 */
const PROFILE_DEFAULTS_KEY_PREFIX = "cageos:profile-defaults:";

interface ProfileDefaults {
  name?: string;
  initials?: string;
  color?: string;
  department?: string;
  phone?: string;
}

function loadProfileDefaults(userId: string): ProfileDefaults | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_DEFAULTS_KEY_PREFIX + userId);
    if (!raw) return null;
    return JSON.parse(raw) as ProfileDefaults;
  } catch {
    // Corrupted JSON or storage unavailable — fall through to a clean slate.
    return null;
  }
}

function saveProfileDefaults(userId: string, defaults: ProfileDefaults) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_DEFAULTS_KEY_PREFIX + userId, JSON.stringify(defaults));
  } catch {
    // Storage may be full or disabled (private browsing). Silent — pre-fill
    // just won't work next time, which is a non-fatal degradation.
  }
}

export default function FirstTimeProfileModal() {
  const { user, currentRole } = useAuth();
  const { data, completeMyProfile } = useWorkspace();
  const myProfile = user ? data.profiles.find(p => p.userId === user.id) : null;

  /**
   * Pre-fill defaults from the user's last completed profile, if any. Read
   * synchronously via useState initializer so the form is populated on the
   * first render (no flicker from "" → "Dennis Colon" on mount).
   *
   * Empty string fallbacks when nothing is cached or user is unauthenticated.
   */
  const cached = user ? loadProfileDefaults(user.id) : null;

  const [name, setName] = useState(cached?.name ?? "");
  const [initials, setInitials] = useState(cached?.initials ?? "");
  const [color, setColor] = useState(cached?.color ?? COLORS[0]);
  const [department, setDepartment] = useState(cached?.department ?? "");
  /**
   * Optional phone number. Surfaces on the active checkouts page so the
   * shop manager can text/call the person who has gear out. Free-form
   * string — no validation beyond max length, since users may include
   * extensions, regional formats, country codes, etc.
   */
  const [phone, setPhone] = useState(cached?.phone ?? "");
  // Tracks whether the user has manually edited initials. Used to suppress
  // the auto-suggest from name once they've typed their own. MUST be declared
  // here above any early returns — moving it below `if (!myProfile?.pendingSetup)`
  // crashes React with error #310 (rendered more hooks than previous render).
  //
  // Initialize to TRUE when we have cached initials, so the auto-suggest
  // doesn't overwrite the cached value when the user touches the name field.
  const [initialsTouched, setInitialsTouched] = useState(!!cached?.initials);

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
    const trimmedName = name.trim();
    const upperInitials = initials.toUpperCase();
    const trimmedDept = department.trim();
    const trimmedPhone = phone.trim() || undefined;

    completeMyProfile({
      name: trimmedName,
      initials: upperInitials,
      color,
      department: trimmedDept,
      phone: trimmedPhone,
    });

    // Cache for next workspace join — written AFTER successful submit so a
    // user who closes the tab mid-setup doesn't pollute their defaults.
    if (user) {
      saveProfileDefaults(user.id, {
        name: trimmedName,
        initials: upperInitials,
        color,
        department: trimmedDept,
        phone: trimmedPhone,
      });
    }
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
