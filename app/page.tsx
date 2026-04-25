"use client";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export default function Home() {
  const router = useRouter();
  const isMobile = useIsMobile();

  return (
    <div onClick={() => router.push("/dashboard")} style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "var(--bg)",
      cursor: "pointer",
      padding: 24,
      paddingTop: `max(24px, var(--safe-top))`,
      paddingBottom: `max(24px, var(--safe-bottom))`,
    }}>
      <div style={{ textAlign: "center", maxWidth: 520, width: "100%" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginBottom: isMobile ? 28 : 40 }}>
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
          marginBottom: isMobile ? 32 : 48,
          padding: "0 8px",
        }}>
          The first equipment checkout system built for{" "}
          <strong style={{ color: "var(--t1)", fontWeight: 500 }}>production shops</strong> — not adapted from IT.
        </div>
        <div className="animate-breathe" style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "var(--acc)",
          color: "var(--bg)",
          padding: isMobile ? "16px 28px" : "14px 32px",
          borderRadius: 8,
          fontFamily: "'Syne',sans-serif",
          fontSize: isMobile ? 14 : 15,
          fontWeight: 700,
          minHeight: 48,
        }}>
          {isMobile ? "Tap to start →" : "Touch anywhere to start →"}
        </div>
        <div style={{ marginTop: 24, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
          NAB Show 2026 · Las Vegas
        </div>
      </div>
    </div>
  );
}
