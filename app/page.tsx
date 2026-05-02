"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { mode, hydrated, switchMode } = useWorkspace();
  const { session, loading: authLoading, supabaseEnabled, activeWorkspaceId } = useAuth();

  useEffect(() => {
    if (!authLoading && session && activeWorkspaceId) {
      router.push("/dashboard");
    }
  }, [authLoading, session, activeWorkspaceId, router]);

  useEffect(() => {
    if (!supabaseEnabled && hydrated && mode !== "unset") {
      router.push("/dashboard");
    }
  }, [supabaseEnabled, hydrated, mode, router]);

  function tryDemo() {
    switchMode("demo");
    router.push("/dashboard");
  }

  if (authLoading || !hydrated) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", background: "var(--bg)", padding: 24,
      paddingTop: `max(24px, var(--safe-top))`,
      paddingBottom: `max(24px, var(--safe-bottom))`,
    }}>
      <div style={{ textAlign: "center", maxWidth: 540, width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 24 : 32 }}>
          <div style={{
            width: isMobile ? 40 : 48, height: isMobile ? 40 : 48,
            background: "var(--acc)", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "'DM Mono',monospace",
            fontSize: isMobile ? 14 : 16, fontWeight: 500, color: "var(--bg)",
          }}>CO</div>
          <div style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: isMobile ? 26 : 32,
            fontWeight: 800, letterSpacing: -1, color: "var(--t1)",
          }}>CageOS</div>
        </div>
        <div style={{
          fontSize: isMobile ? 14 : 16, color: "var(--t2)",
          lineHeight: 1.6, marginBottom: isMobile ? 28 : 40, padding: "0 8px",
        }}>
          The first equipment checkout system built for{" "}
          <strong style={{ color: "var(--t1)", fontWeight: 500 }}>production shops</strong> — not adapted from IT.
        </div>

        {supabaseEnabled ? (
          <>
            <div style={{
              display: "flex", flexDirection: isMobile ? "column" : "row",
              gap: 10, justifyContent: "center", marginBottom: 16,
              padding: isMobile ? "0 12px" : 0,
            }}>
              <Link href="/signup" style={{
                background: "var(--acc)", color: "var(--bg)", border: "none",
                padding: "14px 28px", borderRadius: 8,
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700,
                cursor: "pointer", minHeight: 52, textDecoration: "none",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>Create your workspace →</Link>
              <Link href="/login" style={{
                background: "transparent", color: "var(--t1)",
                border: "1px solid var(--b2)", padding: "14px 28px", borderRadius: 8,
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600,
                cursor: "pointer", minHeight: 52, textDecoration: "none",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>Sign in</Link>
            </div>
            <div style={{ marginBottom: 18 }}>
              <button onClick={tryDemo} style={{
                background: "transparent", color: "var(--t2)", border: "none",
                padding: "8px 16px", fontFamily: "'DM Mono',monospace",
                fontSize: 12, cursor: "pointer", textDecoration: "underline",
              }}>Or try the demo without signing up</button>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
              Demo mode lets you explore CageOS with sample data.<br />
              Sign up to start tracking your real inventory.
            </div>
          </>
        ) : (
          <>
            <div style={{
              display: "flex", flexDirection: isMobile ? "column" : "row",
              gap: 10, justifyContent: "center", marginBottom: 20,
              padding: isMobile ? "0 12px" : 0,
            }}>
              <button onClick={() => { switchMode("user"); router.push("/dashboard"); }} style={{
                background: "var(--acc)", color: "var(--bg)", border: "none",
                padding: "14px 28px", borderRadius: 8,
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 700,
                cursor: "pointer", minHeight: 52,
              }}>Start with a clean workspace →</button>
              <button onClick={tryDemo} style={{
                background: "transparent", color: "var(--t1)",
                border: "1px solid var(--b2)", padding: "14px 28px", borderRadius: 8,
                fontFamily: "'Syne',sans-serif", fontSize: 15, fontWeight: 600,
                cursor: "pointer", minHeight: 52,
              }}>See a populated example</button>
            </div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
              Clean workspace = build your own inventory, kits, and team.<br />
              Populated example = explore CageOS with sample data.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
