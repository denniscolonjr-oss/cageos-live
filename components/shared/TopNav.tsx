"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

const TABS = [
  { href: "/dashboard", label: "Dashboard", short: "Dash" },
  { href: "/kiosk", label: "Kiosk", short: "Kiosk" },
  { href: "/profile", label: "Team", short: "Team" },
  { href: "/product", label: "Product", short: "Product" },
];

export default function TopNav() {
  const path = usePathname();
  const isMobile = useIsMobile();

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

      {/* Tabs - scrollable on mobile */}
      <div className={isMobile ? "scroll-x" : ""} style={{
        display: "flex",
        gap: 2,
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        borderRadius: 7,
        padding: 3,
        flexShrink: isMobile ? 1 : 0,
        minWidth: 0,
        maxWidth: "100%",
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {isMobile ? t.short : t.label}
            </Link>
          );
        })}
      </div>

      {/* Right side chips */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: isMobile ? 9 : 11, color: "var(--t3)", background: "var(--s1)", border: "1px solid var(--b1)", padding: "4px 8px", borderRadius: 4, whiteSpace: "nowrap" }}>
          {isMobile ? "MMG · DC" : "MMG Production · DC"}
        </div>
      </div>
    </nav>
  );
}
