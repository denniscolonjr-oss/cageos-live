"use client";

/**
 * Settings card for managing calendar export.
 *
 * Visibility:
 *   - Anyone in the workspace can see and copy the URLs (they already have
 *     read access to the underlying data)
 *   - Only Owners can generate, rotate, or disable the token
 *
 * States:
 *   - Disabled (no token): non-owner sees "Calendar export is disabled —
 *     ask the owner to enable it." Owner sees a "Generate token" button.
 *   - Enabled (token present): everyone sees the subscription URLs with
 *     copy buttons. Owner additionally sees "Rotate token" and "Disable"
 *     buttons.
 *
 * Loading: fetches the token on mount. Loading state shows a skeleton.
 */

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import { useAuth } from "@/lib/supabase/AuthContext";
import {
  getCalendarToken,
  rotateCalendarToken,
  disableCalendarToken,
} from "@/lib/supabase/membership";
import { toast } from "@/components/ui/Toast";

export default function CalendarExportCard() {
  const auth = useAuth();
  const workspaceId = auth.activeWorkspaceId;
  const isOwner = auth.currentRole === "owner";

  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fetch the current token on mount. Re-fetch when the workspace changes.
  useEffect(() => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCalendarToken(workspaceId).then(t => {
      if (!cancelled) {
        setToken(t);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [workspaceId]);

  async function handleGenerate() {
    if (!workspaceId) return;
    setBusy(true);
    const result = await rotateCalendarToken(workspaceId);
    setBusy(false);
    if (!result.ok) {
      toast("Failed to enable export", { variant: "error", detail: result.error });
      return;
    }
    setToken(result.token ?? null);
    toast("Calendar export enabled", { detail: "Copy the URLs and subscribe in your calendar app." });
  }

  async function handleRotate() {
    if (!workspaceId) return;
    if (!confirm("Rotate the calendar token?\n\nAnyone currently subscribed with the old URL will stop receiving updates. They'll need the new URL.")) return;
    setBusy(true);
    const result = await rotateCalendarToken(workspaceId);
    setBusy(false);
    if (!result.ok) {
      toast("Rotation failed", { variant: "error", detail: result.error });
      return;
    }
    setToken(result.token ?? null);
    toast("Token rotated", { detail: "Share the new URLs with your team." });
  }

  async function handleDisable() {
    if (!workspaceId) return;
    if (!confirm("Disable calendar export?\n\nAll existing subscriptions will start showing empty calendars.")) return;
    setBusy(true);
    const result = await disableCalendarToken(workspaceId);
    setBusy(false);
    if (!result.ok) {
      toast("Disable failed", { variant: "error", detail: result.error });
      return;
    }
    setToken(null);
    toast("Calendar export disabled");
  }

  if (!workspaceId) return null;

  return (
    <Card>
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          Calendar export
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 16, lineHeight: 1.6 }}>
          Subscribe to your projects and active checkouts in Google Calendar, Apple Calendar, Outlook, or any iCal-compatible app. Read-only — schedule changes happen in CageOS.
        </div>

        {loading ? (
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            Loading...
          </div>
        ) : !token ? (
          <DisabledState isOwner={isOwner} onGenerate={handleGenerate} busy={busy} />
        ) : (
          <EnabledState
            workspaceId={workspaceId}
            token={token}
            isOwner={isOwner}
            onRotate={handleRotate}
            onDisable={handleDisable}
            busy={busy}
          />
        )}
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// State: token disabled
// ──────────────────────────────────────────────────────────────────────────

function DisabledState({ isOwner, onGenerate, busy }: {
  isOwner: boolean;
  onGenerate: () => void;
  busy: boolean;
}) {
  if (!isOwner) {
    return (
      <div style={{
        padding: "12px 14px",
        background: "var(--s2)", borderRadius: 6,
        fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
      }}>
        Calendar export is currently disabled. Ask the workspace owner to enable it.
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)", marginBottom: 12 }}>
        Export is not yet enabled for this workspace.
      </div>
      <button
        onClick={onGenerate}
        disabled={busy}
        style={{
          padding: "10px 18px", borderRadius: 6,
          background: busy ? "var(--s3)" : "var(--acc)",
          color: busy ? "var(--t3)" : "var(--bg)",
          border: "none", cursor: busy ? "not-allowed" : "pointer",
          fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
          minHeight: 40,
        }}
      >
        {busy ? "Enabling..." : "Enable calendar export"}
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// State: token enabled
// ──────────────────────────────────────────────────────────────────────────

function EnabledState({ workspaceId, token, isOwner, onRotate, onDisable, busy }: {
  workspaceId: string;
  token: string;
  isOwner: boolean;
  onRotate: () => void;
  onDisable: () => void;
  busy: boolean;
}) {
  /**
   * Build the public URLs. We use window.location.origin so that local dev
   * (localhost:3000) gets the right base URL automatically. Falls back to
   * "https://cageos.app" if window isn't available (SSR — shouldn't happen
   * since this component is "use client", but defensive).
   */
  const origin = typeof window !== "undefined" ? window.location.origin : "https://cageos.app";
  const projectsUrl = `${origin}/api/calendar/${workspaceId}/projects.ics?token=${token}`;
  const checkoutsUrl = `${origin}/api/calendar/${workspaceId}/checkouts.ics?token=${token}`;

  return (
    <div>
      <FeedRow label="Projects feed" url={projectsUrl} />
      <FeedRow label="Active checkouts feed" url={checkoutsUrl} />

      <details style={{ marginTop: 14 }}>
        <summary style={{
          fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)",
          cursor: "pointer", userSelect: "none",
        }}>
          How to subscribe
        </summary>
        <div style={{
          marginTop: 10, padding: "12px 14px",
          background: "var(--s2)", borderRadius: 6,
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)",
          lineHeight: 1.7,
        }}>
          <strong>Google Calendar:</strong> Other calendars → Add → From URL → paste a feed URL above.
          <br /><br />
          <strong>Apple Calendar (Mac):</strong> File → New Calendar Subscription → paste URL → Subscribe.
          <br /><br />
          <strong>Apple Calendar (iPhone):</strong> Settings → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar → paste URL.
          <br /><br />
          <strong>Outlook:</strong> Calendar → Add calendar → Subscribe from web → paste URL.
          <br /><br />
          Refresh frequency depends on the calendar app (Google ~24h, Apple ~hourly, Outlook ~3h). CageOS serves the feed in real-time on every fetch.
        </div>
      </details>

      {isOwner && (
        <div style={{
          marginTop: 18, paddingTop: 14,
          borderTop: "1px solid var(--b1)",
          display: "flex", gap: 8, flexWrap: "wrap",
        }}>
          <button
            onClick={onRotate}
            disabled={busy}
            style={{
              padding: "9px 14px", borderRadius: 6,
              background: "transparent", border: "1px solid var(--b2)",
              color: "var(--t1)", cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12,
              minHeight: 36,
            }}
          >
            {busy ? "Working..." : "Rotate token"}
          </button>
          <button
            onClick={onDisable}
            disabled={busy}
            style={{
              padding: "9px 14px", borderRadius: 6,
              background: "transparent", border: "1px solid var(--red)",
              color: "var(--red)", cursor: busy ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 12,
              minHeight: 36,
            }}
          >
            Disable
          </button>
          <div style={{
            flex: 1, minWidth: 200, alignSelf: "center",
            fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)",
            lineHeight: 1.4,
          }}>
            Rotate to invalidate the old URL. Disable to stop export entirely.
          </div>
        </div>
      )}
    </div>
  );
}

function FeedRow({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback for browsers without clipboard API access (rare)
      toast("Couldn't copy", { variant: "error", detail: "Select and copy manually." });
    }
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
        color: "var(--t3)", letterSpacing: "0.08em",
        textTransform: "uppercase", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        display: "flex", gap: 6, alignItems: "center",
        background: "var(--s2)", border: "1px solid var(--b1)",
        borderRadius: 6, padding: "6px 8px 6px 12px",
      }}>
        <span style={{
          flex: 1, minWidth: 0,
          fontFamily: "'DM Mono',monospace", fontSize: 11,
          color: "var(--t2)",
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {url}
        </span>
        <button
          onClick={handleCopy}
          style={{
            flexShrink: 0, padding: "5px 11px", borderRadius: 4,
            background: copied ? "var(--green)" : "var(--s3)",
            color: copied ? "var(--bg)" : "var(--t1)",
            border: "none", cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.05em", textTransform: "uppercase",
          }}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
