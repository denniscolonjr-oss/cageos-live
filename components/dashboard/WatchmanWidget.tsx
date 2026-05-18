"use client";

/**
 * WatchmanWidget — the dashboard "what needs your attention" panel (iter-28a).
 *
 * Visibility: Manager+ only. Crew/Viewer don't see it at all.
 *
 * Render strategy: if there are zero visible issues (post-snooze) and the
 * AI scan has no findings, the widget renders NOTHING. Dashboard stays
 * calm when there's nothing to do. The widget only takes screen real
 * estate when there's actually a signal worth attending to.
 *
 * Severity colors match the existing service-flag pattern:
 *   - critical: red (var(--red))
 *   - warning: amber (var(--amber))
 *   - info: subtle (var(--t2))
 *
 * AI scan controls:
 *   A "Scan SOPs for contradictions" button at the bottom triggers the
 *   /api/ai/scan-sop-contradictions route. Rate-limited to 20/day per
 *   workspace (enforced server-side and reflected in client-side UI
 *   disabled state when limit reached).
 */

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { getSupabaseClient } from "@/lib/supabase/client";
import { runWatchman } from "@/lib/watchman";
import type { WatchmanIssue } from "@/lib/watchman";
import { toast } from "@/components/ui/Toast";

interface AIFindingFromServer {
  sopId: string;
  sopTitle: string;
  summary: string;
  confidence: "high" | "medium" | "low";
}

export default function WatchmanWidget() {
  const auth = useAuth();
  const { data, snoozeWatchmanIssue, recordAIScan } = useWorkspace();
  const router = useRouter();

  // Permission gate. Crew/Viewer never see this widget.
  const canView = auth.currentRole === "owner" || auth.currentRole === "manager";

  // Resolve current user's initials for the audit trail on snooze
  const actorInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  /**
   * Run the watchman on every render. Pure, fast (<5ms for typical
   * workspaces). The result is automatically reactive — any change
   * to projects/checkouts/assets/sops re-derives the issues.
   */
  const result = useMemo(() => runWatchman(data), [data]);

  // AI scan state (session-only, not persisted)
  const [aiScanning, setAIScanning] = useState(false);
  const [aiFindings, setAIFindings] = useState<AIFindingFromServer[] | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);

  // Rate limit check (mirrored from server)
  const todayUTC = new Date().toISOString().slice(0, 10);
  const dailyScansSoFar =
    data.aiUsage?.dailyDate === todayUTC ? data.aiUsage.dailyScans : 0;
  const dailyLimitReached = dailyScansSoFar >= 20;

  const runAIScan = useCallback(async () => {
    setAIScanning(true);
    setAIError(null);
    setAIFindings(null);

    try {
      // Build the SOP payload — only SOPs with at least one link are
      // eligible (no link = nothing to contradict against)
      const eligibleSOPs = data.sops
        .filter(s =>
          s.linkedAssetIds.length > 0
          || s.linkedKitIds.length > 0
          || s.linkedProjectIds.length > 0
        )
        .map(s => ({
          id: s.id,
          title: s.title,
          body: s.body,
          linkedEntities: [
            ...s.linkedAssetIds.flatMap(id => {
              const a = data.assets.find(x => x.id === id);
              if (!a) return [];
              return [{
                type: "asset" as const,
                id: a.id,
                name: a.name,
                snippet: `${a.make ?? ""} ${a.model ?? ""} (${a.category}). ${a.notes ?? ""}`.trim(),
              }];
            }),
            ...s.linkedKitIds.flatMap(id => {
              const k = data.kits.find(x => x.id === id);
              if (!k) return [];
              const componentNames = k.componentIds
                .map(cid => data.assets.find(a => a.id === cid))
                .filter((a): a is NonNullable<typeof a> => !!a)
                .map(a => `${a.make ?? ""} ${a.model ?? a.name}`.trim())
                .join(", ");
              return [{
                type: "kit" as const,
                id: k.id,
                name: k.name,
                snippet: `Kit containing: ${componentNames || "(no components)"}`,
              }];
            }),
            ...s.linkedProjectIds.flatMap(id => {
              const p = data.projects.find(x => x.id === id);
              if (!p) return [];
              return [{
                type: "project" as const,
                id: p.id,
                name: p.title,
                snippet: `${p.client} project, ${p.assignedKits.length} kits, lead: ${p.leadInitials ?? "none"}`,
              }];
            }),
          ],
        }))
        .filter(s => s.linkedEntities.length > 0); // double-filter — entity may have been deleted

      if (eligibleSOPs.length === 0) {
        toast("No eligible SOPs", { detail: "Link some SOPs to assets/kits/projects first." });
        setAIScanning(false);
        return;
      }

      // Get auth token for the API call
      const sb = getSupabaseClient();
      if (!sb || !auth.activeWorkspaceId) {
        setAIError("Workspace not ready.");
        setAIScanning(false);
        return;
      }
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.access_token) {
        setAIError("Not signed in.");
        setAIScanning(false);
        return;
      }

      const res = await fetch("/api/ai/scan-sop-contradictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          workspaceId: auth.activeWorkspaceId,
          dailyScansSoFar,
          sops: eligibleSOPs,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        setAIError(payload.detail ?? payload.error ?? "Scan failed.");
        setAIScanning(false);
        return;
      }

      setAIFindings(payload.findings ?? []);
      recordAIScan({
        scansRun: payload.scanned ?? 0,
        costUsd: payload.costUsd ?? 0,
        findingsCount: (payload.findings ?? []).length,
        actorInitials,
      });

      const count = (payload.findings ?? []).length;
      if (count === 0) {
        toast("Scan complete · No contradictions found", { detail: `Scanned ${payload.scanned} SOP${payload.scanned === 1 ? "" : "s"}.` });
      } else {
        toast(`${count} potential contradiction${count === 1 ? "" : "s"} found`, { variant: "info" });
      }
    } catch (err) {
      console.error("[WatchmanWidget] AI scan error:", err);
      setAIError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setAIScanning(false);
    }
  }, [data, auth.activeWorkspaceId, dailyScansSoFar, recordAIScan, actorInitials]);

  function handleSnooze(issueId: string) {
    const ok = snoozeWatchmanIssue(issueId, actorInitials);
    if (!ok) {
      toast("Couldn't snooze", { variant: "error", detail: "Permission denied." });
      return;
    }
    toast("Snoozed for 24 hours");
  }

  if (!canView) return null;

  // Don't render if nothing to show AND no recent AI findings to display
  const hasIssues = result.total > 0;
  const hasFindings = (aiFindings?.length ?? 0) > 0;
  if (!hasIssues && !hasFindings && !aiError) {
    // Show a minimal "all clear" banner if there are snoozed items
    // (so the user knows there are dismissed things they'll see again)
    if (result.snoozedCount > 0) {
      return (
        <div style={{
          padding: "10px 14px",
          background: "var(--s1)",
          border: "1px solid var(--b1)",
          borderRadius: 8,
          marginBottom: 14,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
            Watchman: all clear · {result.snoozedCount} item{result.snoozedCount === 1 ? "" : "s"} snoozed
          </div>
          <AIScanButton
            scanning={aiScanning}
            disabled={dailyLimitReached || aiScanning}
            dailyScansSoFar={dailyScansSoFar}
            onRun={runAIScan}
            compact
          />
        </div>
      );
    }
    // Truly nothing to surface — render the AI scan button alone, in compact form
    return (
      <div style={{
        padding: "10px 14px",
        background: "var(--s1)",
        border: "1px solid var(--b1)",
        borderRadius: 8,
        marginBottom: 14,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
          Watchman: all clear
        </div>
        <AIScanButton
          scanning={aiScanning}
          disabled={dailyLimitReached || aiScanning}
          dailyScansSoFar={dailyScansSoFar}
          onRun={runAIScan}
          compact
        />
      </div>
    );
  }

  return (
    <div style={{
      padding: "14px 18px",
      background: "var(--s1)",
      border: "1px solid var(--b1)",
      borderRadius: 8,
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        gap: 10, flexWrap: "wrap", marginBottom: 12,
      }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.12em", textTransform: "uppercase",
            marginBottom: 2,
          }}>
            Watchman
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 17, fontWeight: 700, color: "var(--t1)" }}>
            {hasIssues ? `${result.total} item${result.total === 1 ? "" : "s"} need attention` : "Scan results"}
          </div>
        </div>
        <AIScanButton
          scanning={aiScanning}
          disabled={dailyLimitReached || aiScanning}
          dailyScansSoFar={dailyScansSoFar}
          onRun={runAIScan}
        />
      </div>

      {/* Deterministic issues */}
      {result.critical.length > 0 && (
        <IssueGroup title="Critical" tint="critical" issues={result.critical} onSnooze={handleSnooze} onNavigate={(href) => router.push(href)} />
      )}
      {result.warning.length > 0 && (
        <IssueGroup title="Needs attention" tint="warning" issues={result.warning} onSnooze={handleSnooze} onNavigate={(href) => router.push(href)} />
      )}
      {result.info.length > 0 && (
        <IssueGroup title="FYI" tint="info" issues={result.info} onSnooze={handleSnooze} onNavigate={(href) => router.push(href)} />
      )}

      {/* AI findings (session-only) */}
      {aiFindings !== null && aiFindings.length > 0 && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--b1)" }}>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--acc)", letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 8,
          }}>
            AI scan findings ({aiFindings.length}) · this session only
          </div>
          {aiFindings.map((f, idx) => (
            <div key={`${f.sopId}-${idx}`} style={{
              padding: "10px 12px",
              background: "var(--s2)",
              border: "1px solid var(--b1)",
              borderRadius: 6,
              marginBottom: 6,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <Link href={`/sops/${encodeURIComponent(f.sopId)}`} style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>
                  {f.sopTitle}
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t2)" }}>
                  {f.summary}
                </div>
              </Link>
              <span style={{
                fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
                padding: "2px 7px", borderRadius: 3, letterSpacing: "0.05em",
                background: confidenceBg(f.confidence),
                color: confidenceFg(f.confidence),
                border: `1px solid ${confidenceFg(f.confidence)}`,
                textTransform: "uppercase",
                flexShrink: 0,
              }}>
                {f.confidence}
              </span>
            </div>
          ))}
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)", marginTop: 6, fontStyle: "italic" }}>
            AI findings are advisory. Review each before acting.
          </div>
        </div>
      )}

      {aiError && (
        <div style={{
          marginTop: 12, padding: "10px 12px",
          background: "color-mix(in srgb, var(--red) 8%, var(--s2))",
          border: "1px solid var(--red)",
          borderRadius: 6,
          fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--red)",
        }}>
          AI scan: {aiError}
        </div>
      )}

      {/* Snoozed count footer */}
      {result.snoozedCount > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 8,
          borderTop: "1px dashed var(--b1)",
          fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)",
        }}>
          {result.snoozedCount} item{result.snoozedCount === 1 ? "" : "s"} snoozed
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────

function AIScanButton({ scanning, disabled, dailyScansSoFar, onRun, compact }: {
  scanning: boolean;
  disabled: boolean;
  dailyScansSoFar: number;
  onRun: () => void;
  compact?: boolean;
}) {
  const label = scanning
    ? "Scanning..."
    : compact
      ? "AI scan"
      : "Scan SOPs for contradictions";
  const remaining = 20 - dailyScansSoFar;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      <button
        onClick={onRun}
        disabled={disabled}
        style={{
          padding: compact ? "4px 10px" : "8px 14px",
          background: disabled ? "var(--s3)" : "transparent",
          color: disabled ? "var(--t3)" : "var(--acc)",
          border: `1px solid ${disabled ? "var(--b1)" : "var(--acc)"}`,
          borderRadius: 4,
          fontFamily: "'DM Mono',monospace",
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          letterSpacing: "0.05em",
          cursor: disabled ? "not-allowed" : "pointer",
          minHeight: compact ? 26 : 34,
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </button>
      {!compact && (
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)" }}>
          {remaining > 0 ? `${remaining}/20 scans left today` : "Daily limit reached"}
        </div>
      )}
    </div>
  );
}

function IssueGroup({ title, tint, issues, onSnooze, onNavigate }: {
  title: string;
  tint: "critical" | "warning" | "info";
  issues: WatchmanIssue[];
  onSnooze: (id: string) => void;
  onNavigate: (href: string) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
        color: tintFg(tint), letterSpacing: "0.1em", textTransform: "uppercase",
        marginBottom: 6,
      }}>
        {title} ({issues.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {issues.map(issue => (
          <IssueRow key={issue.id} issue={issue} onSnooze={() => onSnooze(issue.id)} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function IssueRow({ issue, onSnooze, onNavigate }: {
  issue: WatchmanIssue;
  onSnooze: () => void;
  onNavigate: (href: string) => void;
}) {
  const tint = issue.severity;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px",
      background: "var(--s2)",
      border: `1px solid ${tintBorder(tint)}`,
      borderRadius: 6,
    }}>
      <div style={{
        width: 3, alignSelf: "stretch",
        background: tintFg(tint),
        borderRadius: 2,
        flexShrink: 0,
      }} />
      <div
        onClick={() => issue.href && onNavigate(issue.href)}
        style={{
          flex: 1, minWidth: 0,
          cursor: issue.href ? "pointer" : "default",
        }}
      >
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
          color: "var(--t1)", marginBottom: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {issue.title}
        </div>
        <div style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "var(--t3)",
        }}>
          {issue.detail}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onSnooze(); }}
        title="Snooze for 24h"
        style={{
          padding: "4px 9px", borderRadius: 4,
          background: "transparent", border: "1px solid var(--b1)",
          color: "var(--t3)",
          fontFamily: "'DM Mono',monospace", fontSize: 10,
          cursor: "pointer", minHeight: 26,
          flexShrink: 0,
        }}
      >
        Snooze
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Color helpers — map severity tints to CSS variables
// ──────────────────────────────────────────────────────────────────────

function tintFg(tint: "critical" | "warning" | "info"): string {
  if (tint === "critical") return "var(--red)";
  if (tint === "warning") return "var(--amber, #f59e0b)";
  return "var(--t2)";
}

function tintBorder(tint: "critical" | "warning" | "info"): string {
  if (tint === "critical") return "color-mix(in srgb, var(--red) 40%, var(--b1))";
  if (tint === "warning") return "color-mix(in srgb, var(--amber, #f59e0b) 40%, var(--b1))";
  return "var(--b1)";
}

function confidenceBg(c: "high" | "medium" | "low"): string {
  if (c === "high") return "rgba(245,158,11,0.12)";
  if (c === "medium") return "rgba(245,158,11,0.06)";
  return "transparent";
}
function confidenceFg(c: "high" | "medium" | "low"): string {
  if (c === "high") return "var(--amber, #f59e0b)";
  if (c === "medium") return "var(--amber, #f59e0b)";
  return "var(--t3)";
}
