"use client";
import { ReactNode, useEffect, useRef } from "react";
import { useIsMobile } from "@/lib/hooks/useIsMobile";

export default function Modal({ open, onClose, title, children, maxWidth = 540 }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  const isMobile = useIsMobile();

  /**
   * Click-outside-to-close, fixed iter-26.
   *
   * Previous behavior: onClick on the overlay → close. Problem: click events
   * fire on mouseup, but the click TARGET is where mousedown happened. If a
   * user highlights text inside the modal (mousedown on content), drifts
   * outside while still pressing (e.g. selecting toward the edge), and
   * releases outside (mouseup on overlay) — that's a click on the overlay
   * from the browser's perspective. The modal closes mid-selection and the
   * user loses their work.
   *
   * Fix: track where mousedown started. Only treat the gesture as a close
   * if BOTH the mousedown AND the mouseup happened on the overlay itself,
   * outside the modal content. Mousedown inside the modal → never closes,
   * regardless of where mouseup lands.
   */
  const mouseDownOnOverlayRef = useRef(false);

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

  function handleOverlayMouseDown(e: React.MouseEvent) {
    // Did the mousedown happen directly on the overlay (not on a descendant)?
    // If e.target === e.currentTarget, the press started on the overlay.
    // If they differ, the press started on the modal content or a child.
    mouseDownOnOverlayRef.current = e.target === e.currentTarget;
  }

  function handleOverlayMouseUp(e: React.MouseEvent) {
    /*
     * Close only if BOTH:
     *   - mousedown was on the overlay (not bubbled up from modal content), AND
     *   - mouseup is on the overlay (current event target matches)
     *
     * Blocks the common annoying case: user highlights text inside the
     * modal and the mouse drifts outside while still pressing. mousedown was
     * inside → ref is false → close not fired. Selection is preserved.
     */
    const releasedOnOverlay = e.target === e.currentTarget;
    if (releasedOnOverlay && mouseDownOnOverlayRef.current) {
      onClose();
    }
    // Reset for next interaction
    mouseDownOnOverlayRef.current = false;
  }

  return (
    <div
      onMouseDown={handleOverlayMouseDown}
      onMouseUp={handleOverlayMouseUp}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: isMobile ? "flex-end" : "center",
        justifyContent: "center",
        zIndex: 200,
        padding: isMobile ? 0 : 20,
        backdropFilter: "blur(4px)",
        animation: "fade-up 0.15s ease",
      }}
    >
      <div style={{
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
