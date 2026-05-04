"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";

const TABS = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/kiosk", label: "Kiosk", short: "Kiosk" },
  { href: "/profile", label: "Team", short: "Team" },
];

export default function TopNav() {
  const path = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { mode, data, switchMode, canUseDemo } = useWorkspace();
  const { session, user, supabaseEnabled, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

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
                Workspace
              </div>
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
                  Your workspace · saved on this device
                </div>
              </button>
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
    </nav>
  );
}
