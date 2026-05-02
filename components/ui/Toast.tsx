"use client";
import { useState, useEffect } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  /** Called when the user clicks the action. The toast dismisses immediately afterward. */
  onClick: () => void;
}

interface ToastEvent {
  id: number;
  message: string;
  detail?: string;
  variant: ToastVariant;
  action?: ToastAction;
  /** Auto-dismiss duration in ms. Defaults to 3500, or 10000 if action is provided. */
  durationMs: number;
}

type Listener = (toast: ToastEvent) => void;

let counter = 0;
const listeners: Set<Listener> = new Set();

export function toast(
  message: string,
  opts?: { detail?: string; variant?: ToastVariant; action?: ToastAction; durationMs?: number },
) {
  const evt: ToastEvent = {
    id: ++counter,
    message,
    detail: opts?.detail,
    variant: opts?.variant ?? "success",
    action: opts?.action,
    durationMs: opts?.durationMs ?? (opts?.action ? 10000 : 3500),
  };
  listeners.forEach(l => l(evt));
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastEvent[]>([]);

  useEffect(() => {
    const handler: Listener = (t) => {
      setToasts(prev => [...prev, t]);
      window.setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.durationMs);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  function dismiss(id: number) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "max(20px, var(--safe-bottom))",
      right: "max(20px, var(--safe-right))",
      left: "max(20px, var(--safe-left))",
      display: "flex",
      flexDirection: "column",
      gap: 8,
      pointerEvents: "none",
      zIndex: 300,
      alignItems: "flex-end",
    }}>
      {toasts.map(t => {
        const accent =
          t.variant === "success" ? "var(--green)" :
          t.variant === "error" ? "var(--red)" :
          "var(--blue)";
        const icon =
          t.variant === "success" ? "✓" :
          t.variant === "error" ? "⚠" :
          "ℹ";
        return (
          <div key={t.id} className="animate-slide-right" style={{
            pointerEvents: "auto",
            background: "var(--s1)",
            border: "1px solid var(--b1)",
            borderLeft: `3px solid ${accent}`,
            borderRadius: 8,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 420,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: 5,
              background: t.variant === "success" ? "rgba(74,222,128,0.12)" :
                          t.variant === "error" ? "rgba(255,79,79,0.12)" : "rgba(90,160,240,0.12)",
              color: accent,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, flexShrink: 0,
            }}>{icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)", lineHeight: 1.3 }}>{t.message}</div>
              {t.detail && (
                <div style={{ fontSize: 11, fontFamily: "'DM Mono',monospace", color: "var(--t3)", marginTop: 3 }}>{t.detail}</div>
              )}
            </div>
            {t.action && (
              <button
                onClick={() => { t.action!.onClick(); dismiss(t.id); }}
                style={{
                  flexShrink: 0,
                  padding: "6px 12px", borderRadius: 5,
                  background: "transparent", border: `1px solid ${accent}`,
                  color: accent, cursor: "pointer",
                  fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600,
                  minHeight: 32,
                }}>
                {t.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
