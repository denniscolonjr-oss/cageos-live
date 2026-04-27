"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useWorkspace } from "@/lib/hooks/useWorkspace";

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { mode, hydrated, switchMode } = useWorkspace();

  // If they've already chosen, skip splash
  useEffect(() => {
    if (hydrated && mode !== "unset") {
      router.push("/dashboard");
    }
  }, [hydrated, mode, router]);

  function start(m: "user" | "demo") {
    switchMode(m);
    router.push("/dashboard");
  }

  if (!hydrated) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "var(--bg)",
      padding: 24,
      paddingTop: `max(24px, var(--safe-top))`,
      paddingBottom: `max(24px, var(--safe-bottom))`,
    }}>
      <div style={{ textAlign: "center", maxWidth: 540, width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 24 : 32 }}>
          <div style={{
            width: isMobile ? 40 : 48,
            height: isMobile ? 40 : 48,
            background: "var(--acc)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'DM Mono',monospace",
            fontSize: isMobile ? 14 : 16,
            fontWeight: 500,
            color: "var(--bg)",
          }}>CO</div>
          <div style={{
            fontFamily: "'Syne',sans-serif",
            fontSize: isMobile ? 26 : 32,
            fontWeight: 800,
            letterSpacing: -1,
            color: "var(--t1)",
          }}>CageOS</div>
        </div>
        <div style={{
          fontSize: isMobile ? 14 : 16,
          color: "var(--t2)",
          lineHeight: 1.6,
          marginBottom: isMobile ? 28 : 40,
          padding: "0 8px",
        }}>
          The first equipment checkout system built for{" "}
          <strong style={{ color: "var(--t1)", fontWeight: 500 }}>production shops</strong> — not adapted from IT.
        </div>

        <div style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          gap: 10,
          justifyContent: "center",
          marginBottom: 20,
          padding: isMobile ? "0 12px" : 0,
        }}>
          <button onClick={() => start("user")} style={{
            background: "var(--acc)",
            color: "var(--bg)",
            border: "none",
            padding: "14px 28px",
            borderRadius: 8,
            fontFamily: "'Syne',sans-serif",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
            minHeight: 52,
            transition: "background 0.15s",
          }}>
            Start with a clean workspace →
          </button>
          <button onClick={() => start("demo")} style={{
            background: "transparent",
            color: "var(--t1)",
            border: "1px solid var(--b2)",
            padding: "14px 28px",
            borderRadius: 8,
            fontFamily: "'Syne',sans-serif",
            fontSize: 15,
            fontWeight: 600,
            cursor: "pointer",
            minHeight: 52,
            transition: "background 0.15s",
          }}>
            See a populated example
          </button>
        </div>

        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", lineHeight: 1.6 }}>
          Clean workspace = build your own inventory, kits, and team.<br />
          Populated example = explore CageOS with sample data from MMG Production.
        </div>
      </div>
    </div>
  );
}
