"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import {
  countOwnedWorkspaces, createWorkspace, FREE_TIER_OWNED_WORKSPACE_CAP,
} from "@/lib/supabase/membership";

const TABS = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/kiosk", label: "Kiosk", short: "Kiosk" },
  { href: "/profile", label: "Team", short: "Team" },
];

export default function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { mode, data, switchMode, canUseDemo, inboxUnreadCount } = useWorkspace();
  const { session, user, supabaseEnabled, signOut, workspaces, activeWorkspaceId, setActiveWorkspaceId, refreshWorkspaces } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  /**
   * Number of workspaces this user owns. Used to gate the "Create new workspace"
   * action against FREE_TIER_OWNED_WORKSPACE_CAP. Refreshed whenever the
   * dropdown opens (cheap query, kept fresh) and whenever the workspaces list
   * changes (e.g. after creating one).
   */
  const [ownedCount, setOwnedCount] = useState<number>(0);
  useEffect(() => {
    if (!session || !supabaseEnabled) return;
    countOwnedWorkspaces().then(setOwnedCount).catch(() => { /* ignore */ });
  }, [session, supabaseEnabled, workspaces]);

  const atOwnedCap = ownedCount >= FREE_TIER_OWNED_WORKSPACE_CAP;

  async function handleSignOut() {
    await signOut();
    setMenuOpen(false);
    router.push("/");
  }

  const orgLabel = mode === "demo"
    ? (isMobile ? "MMG · DEMO" : "MMG Production · DEMO")
    : (isMobile
        ? `${data.orgName.length > 10 ? data.orgName.slice(0, 10) + "…" : data.orgName}`
        : `${data.orgName} · ${data.orgLocation}`);

  function handleSwitch(m: "user" | "demo") {
    switchMode(m);
    setMenuOpen(false);
    // Bounce them to dashboard so they immediately see the new workspace
    if (path !== "/dashboard") router.push("/dashboard");
  }

  return (
    <nav style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 50,
      padding: `0 ${isMobile ? 12 : 20}px`,
      paddingLeft: `max(${isMobile ? 12 : 20}px, var(--safe-left))`,
      paddingRight: `max(${isMobile ? 12 : 20}px, var(--safe-right))`,
      borderBottom: "1px solid var(--b1)",
      background: "var(--bg)",
      flexShrink: 0,
      zIndex: 50,
      gap: 8,
    }}>
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
        <div style={{ width: 28, height: 28, background: "var(--acc)", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 500, color: "var(--bg)" }}>CO</div>
        {!isMobile && (
          <span style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 800, letterSpacing: -0.5, color: "var(--t1)" }}>CageOS</span>
        )}
      </Link>

      {/* Tabs */}
      <div className={isMobile ? "scroll-x" : ""} style={{
        display: "flex", gap: 2, background: "var(--s1)", border: "1px solid var(--b1)",
        borderRadius: 7, padding: 3,
        flexShrink: isMobile ? 1 : 0, minWidth: 0, maxWidth: "100%",
      }}>
        {TABS.map(t => {
          const active = path.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} style={{
              padding: isMobile ? "7px 12px" : "5px 16px",
              borderRadius: 5,
              fontSize: isMobile ? 13 : 12,
              fontWeight: 500,
              color: active ? "var(--t1)" : "var(--t2)",
              background: active ? "var(--s3)" : "transparent",
              textDecoration: "none",
              transition: "all 0.15s",
              fontFamily: "'DM Sans',sans-serif",
              whiteSpace: "nowrap",
              minHeight: isMobile ? 36 : "auto",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {isMobile ? t.short : t.label}
            </Link>
          );
        })}
      </div>

      {/*
       * Inbox bell — shows count of unread @mentions.
       *
       * Only visible when signed in (no session = no inbox to surface).
       * Pulses via the badge color so unread counts catch the eye without
       * being obnoxious. Click → /inbox.
       *
       * The bell is intentionally simple — no dropdown preview. The full
       * inbox view is one click away and shows everything in context.
       * If the preview ends up being useful we can add it later.
       */}
      {session && supabaseEnabled && (
        <Link href="/inbox" aria-label="Inbox" style={{
          position: "relative",
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 6,
          background: path.startsWith("/inbox") ? "var(--s3)" : "var(--s1)",
          border: `1px solid var(--b1)`,
          color: path.startsWith("/inbox") ? "var(--t1)" : "var(--t2)",
          textDecoration: "none",
          flexShrink: 0,
        }}>
          {/* Bell SVG, currentColor follows the link's color */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {inboxUnreadCount > 0 && (
            <span style={{
              position: "absolute",
              top: -4, right: -4,
              minWidth: 16, height: 16,
              padding: "0 4px", borderRadius: 8,
              background: "var(--acc)", color: "var(--bg)",
              fontFamily: "'DM Mono',monospace",
              fontSize: 9, fontWeight: 700, lineHeight: "16px",
              textAlign: "center",
              boxShadow: "0 0 0 2px var(--bg)",  // ring so badge separates from button
            }}>
              {inboxUnreadCount > 99 ? "99+" : inboxUnreadCount}
            </span>
          )}
        </Link>
      )}

      {/* Workspace switcher */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{
          display: "flex", alignItems: "center", gap: 6,
          fontFamily: "'DM Mono',monospace",
          fontSize: isMobile ? 9 : 11,
          color: mode === "demo" ? "var(--acc)" : "var(--t3)",
          background: mode === "demo" ? "rgba(236,255,112,0.08)" : "var(--s1)",
          border: `1px solid ${mode === "demo" ? "rgba(236,255,112,0.3)" : "var(--b1)"}`,
          padding: "5px 10px",
          borderRadius: 4,
          whiteSpace: "nowrap",
          cursor: "pointer",
          minHeight: 32,
        }}>
          {orgLabel}
          <span style={{ fontSize: 9, opacity: 0.6 }}>▾</span>
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 99 }} />
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0,
              minWidth: 220,
              background: "var(--s1)", border: "1px solid var(--b1)",
              borderRadius: 8, overflow: "hidden",
              zIndex: 100,
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}>
              <div style={{ padding: "8px 12px 6px", fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Workspaces
              </div>
              {/*
               * Multi-workspace switcher. Each row is one workspace the user is a
               * member of. Clicking switches the active workspace, which causes
               * useWorkspace to reload data via the new adapter (see iter-9).
               * Falls back to "Your workspace" placeholder when running without
               * Supabase (local dev).
               */}
              {workspaces.length > 0 ? (
                workspaces.map((ws, idx) => {
                  const isActive = mode === "user" && ws.id === activeWorkspaceId;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setActiveWorkspaceId(ws.id);
                        if (mode !== "user") handleSwitch("user");
                        setMenuOpen(false);
                      }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 12px",
                        background: isActive ? "var(--s2)" : "transparent",
                        border: "none",
                        borderTop: idx > 0 ? "1px solid var(--b1)" : "none",
                        cursor: "pointer",
                        color: "var(--t1)", fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13, minHeight: 44,
                      }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ws.name}</span>
                        {isActive && <span style={{ color: "var(--acc)", fontSize: 11, flexShrink: 0 }}>✓ active</span>}
                      </div>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2, letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        {ws.role}
                      </div>
                    </button>
                  );
                })
              ) : (
                <button onClick={() => handleSwitch("user")} style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px",
                  background: mode === "user" ? "var(--s2)" : "transparent",
                  border: "none", cursor: "pointer",
                  color: "var(--t1)", fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13, minHeight: 44,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500 }}>{data.orgName}</span>
                    {mode === "user" && <span style={{ color: "var(--acc)", fontSize: 11 }}>✓ active</span>}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                    Your workspace
                  </div>
                </button>
              )}
              {/*
               * "Create new workspace" action.
               *
               * Always visible to authenticated users when Supabase is wired up.
               * Disabled (with a friendly upgrade hint) when the user is at the
               * FREE_TIER_OWNED_WORKSPACE_CAP — surfacing the upgrade path
               * without actively nagging.
               *
               * Discovery placement: bottom of the switcher dropdown. Users
               * stumble on it organically when they've already absorbed the
               * mental model of "this dropdown is where I switch workspaces."
               * No tour, no onboarding nudge — invited users land in the right
               * workspace, see the dropdown when they need it.
               */}
              {session && supabaseEnabled && (
                <button
                  onClick={() => {
                    if (atOwnedCap) return;
                    setMenuOpen(false);
                    setShowCreateModal(true);
                  }}
                  disabled={atOwnedCap}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 12px",
                    background: "transparent",
                    border: "none", borderTop: "1px solid var(--b1)",
                    cursor: atOwnedCap ? "default" : "pointer",
                    color: atOwnedCap ? "var(--t3)" : "var(--t1)",
                    fontFamily: "'DM Sans',sans-serif",
                    fontSize: 13, minHeight: 44,
                  }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 500 }}>+ Create new workspace</span>
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2, lineHeight: 1.4 }}>
                    {atOwnedCap
                      ? `Free plan supports ${FREE_TIER_OWNED_WORKSPACE_CAP} workspace · upgrade for more`
                      : "Start a fresh workspace where you're Owner"}
                  </div>
                </button>
              )}
              {canUseDemo && (
                <button onClick={() => handleSwitch("demo")} style={{
                  display: "block", width: "100%", textAlign: "left",
                  padding: "10px 12px",
                  background: mode === "demo" ? "var(--s2)" : "transparent",
                  border: "none", borderTop: "1px solid var(--b1)", cursor: "pointer",
                  color: "var(--t1)", fontFamily: "'DM Sans',sans-serif",
                  fontSize: 13, minHeight: 44,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 500 }}>MMG Production · DC</span>
                    {mode === "demo" && <span style={{ color: "var(--acc)", fontSize: 11 }}>✓ active</span>}
                  </div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
                    Sample data · admin only
                  </div>
                </button>
              )}

              {supabaseEnabled && (
                <>
                  <div style={{ padding: "8px 12px 6px", borderTop: "1px solid var(--b1)", fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    Account
                  </div>
                  {session ? (
                    <>
                      <div style={{ padding: "8px 12px", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)" }}>
                        {user?.email}
                      </div>
                      <button onClick={handleSignOut} style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "10px 12px",
                        background: "transparent", border: "none",
                        borderTop: "1px solid var(--b1)", cursor: "pointer",
                        color: "var(--red)", fontFamily: "'DM Sans',sans-serif",
                        fontSize: 13, minHeight: 44,
                      }}>
                        Sign out
                      </button>
                    </>
                  ) : (
                    <Link href="/login" onClick={() => setMenuOpen(false)} style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 12px",
                      color: "var(--acc)", fontFamily: "'DM Sans',sans-serif",
                      fontSize: 13, minHeight: 44, textDecoration: "none",
                    }}>
                      Sign in
                    </Link>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/*
       * Create new workspace modal — mounted as sibling of nav so it overlays
       * the entire page. Self-gates on `showCreateModal` state. After successful
       * creation, refreshes the workspace list and switches to the new one.
       */}
      {showCreateModal && (
        <CreateWorkspaceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async (newId) => {
            setShowCreateModal(false);
            // Refresh workspace list (so the new one appears in switcher) and
            // make it the active workspace BEFORE navigation. Order matters:
            // setActiveWorkspaceId triggers data adapter to switch, then the
            // dashboard renders with the new workspace's data.
            await refreshWorkspaces();
            setActiveWorkspaceId(newId);
            // IMPORTANT: navigate to /dashboard, NOT /onboarding.
            // /onboarding is the "you have no workspaces yet" flow; sending
            // a user there after they just created a workspace causes them
            // to be prompted to create ANOTHER one (and another profile,
            // and another team setup) — chain of duplicates.
            router.push("/dashboard");
          }}
        />
      )}
    </nav>
  );
}

/**
 * Modal for creating a new workspace.
 *
 * Single field (name), submit fires createWorkspace(). On success, the parent
 * handles refresh + switch + redirect to onboarding. On failure (most likely
 * cap_reached or db_error), shows the error inline so the user can try again
 * or close.
 */
function CreateWorkspaceModal({
  onClose, onCreated,
}: {
  onClose: () => void;
  onCreated: (newWorkspaceId: string) => void;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Workspace name required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await createWorkspace({ name: trimmed });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.workspaceId);
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 200, padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--s1)", border: "1px solid var(--b1)", borderRadius: 10,
        maxWidth: 440, width: "100%", padding: 24,
      }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
          Create a new workspace
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 18, lineHeight: 1.55 }}>
          You&apos;ll be the Owner of this workspace and can invite teammates to join. You can switch between workspaces anytime from the dropdown.
        </div>

        <label style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6, display: "block" }}>
          Workspace name
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder="e.g. Acme Productions, My Freelance Setup"
          maxLength={80}
          style={{
            width: "100%", padding: "10px 12px",
            background: "var(--s2)", border: "1px solid var(--b2)",
            borderRadius: 6, color: "var(--t1)",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14,
            outline: "none",
          }}
        />

        {error && (
          <div style={{
            marginTop: 12,
            background: "rgba(255,122,122,0.08)", border: "1px solid rgba(255,122,122,0.25)",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, color: "var(--red)",
            fontFamily: "'DM Mono',monospace", lineHeight: 1.5,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 6,
            background: "transparent", border: "1px solid var(--b2)",
            color: "var(--t1)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13,
          }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name.trim()}
            style={{
              padding: "10px 18px", borderRadius: 6,
              background: submitting || !name.trim() ? "var(--s3)" : "var(--acc)",
              border: "none",
              color: submitting || !name.trim() ? "var(--t3)" : "var(--bg)",
              cursor: submitting || !name.trim() ? "not-allowed" : "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
            }}>
            {submitting ? "Creating..." : "Create workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
