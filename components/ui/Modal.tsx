"use client";
import { ReactNode, useEffect } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export default function Modal({ open, onClose, title, children, maxWidth = 540 }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: isMobile ? "flex-end" : "center",
      justifyContent: "center",
      zIndex: 200,
      padding: isMobile ? 0 : 20,
      backdropFilter: "blur(4px)",
      animation: "fade-up 0.15s ease",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%",
        maxWidth: isMobile ? "100%" : maxWidth,
        maxHeight: isMobile ? "92vh" : "85vh",
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        borderRadius: isMobile ? "16px 16px 0 0" : 14,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: isMobile ? "slide-in-right 0.25s cubic-bezier(0.22,1,0.36,1)" : "pop-in 0.2s cubic-bezier(0.22,1,0.36,1)",
      }}>
        <div style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--b1)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{
            background: "none", border: "none",
            color: "var(--t2)", fontSize: 22, cursor: "pointer",
            padding: 4, minHeight: 36, minWidth: 36,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
