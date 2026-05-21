"use client";

/**
 * AuditCard — Settings → Audit (iter-28d).
 *
 * Manager+ generates a workspace inventory audit. Each asset is scored
 * on how close its current state is to its original CSV upload state.
 * Output: workspace-wide score, summary counts, per-asset table, CSV
 * download, and "Print" (browser Save-as-PDF) button.
 *
 * Auditable assets = active assets with a csvBaseline (came from CSV
 * import). Manual-add assets appear in the table marked "No baseline"
 * and are excluded from the workspace score. Archived assets appear
 * marked "Archived" and are also excluded.
 *
 * Generate is on-demand (button) rather than auto on render. Auditing
 * 1000+ assets takes a few ms but it's wasted work if the user isn't
 * looking at this card. The "generated at" timestamp on the audit
 * makes it clear the result is a snapshot, not live.
 */

import { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import Card from "@/components/ui/Card";
import { runAudit, auditToCSV } from "@/lib/auditEngine";
import type { WorkspaceAudit } from "@/lib/auditEngine";

export default function AuditCard() {
  const auth = useAuth();
  const { data } = useWorkspace();
  const [audit, setAudit] = useState<WorkspaceAudit | null>(null);
  const [generating, setGenerating] = useState(false);

  const canRun = auth.currentRole === "owner" || auth.currentRole === "manager";

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    // Use setTimeout to yield to the render loop so the button can
    // visibly enter the "generating" state before the (synchronous)
    // audit runs. For small workspaces it's instant; for larger ones
    // the user sees a brief flicker but no jank.
    setTimeout(() => {
      try {
        const result = runAudit(data);
        setAudit(result);
      } catch (err) {
        console.error("[AuditCard] audit failed:", err);
        toast("Audit failed", { variant: "error", detail: err instanceof Error ? err.message : "Unexpected error" });
      } finally {
        setGenerating(false);
      }
    }, 30);
  }, [data]);

  const handleDownloadCSV = useCallback(() => {
    if (!audit) return;
    const csv = auditToCSV(audit, data.orgName);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename: cageos-audit-<orgname>-<date>.csv
    const datePart = new Date(audit.generatedAt).toISOString().slice(0, 10);
    const safeOrgName = (data.orgName || "workspace").replace(/[^a-zA-Z0-9_-]/g, "_");
    a.download = `cageos-audit-${safeOrgName}-${datePart}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast("CSV downloaded");
  }, [audit, data.orgName]);

  const handlePrint = useCallback(() => {
    // window.print() picks up the print stylesheet below.
    // Browser's Save-as-PDF turns the print output into a PDF.
    window.print();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        /* iter-28d: print stylesheet for the audit table */
        @media print {
          body * {
            visibility: hidden;
          }
          .audit-print-region, .audit-print-region * {
            visibility: visible;
          }
          .audit-print-region {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
            background: white !important;
            color: black !important;
          }
          .audit-print-region table {
            page-break-inside: auto;
          }
          .audit-print-region tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          .audit-print-region .no-print {
            display: none !important;
          }
          .audit-table-scroll {
            max-height: none !important;
            overflow: visible !important;
          }
        }
      ` }} />

      <Card>
        <div style={{ padding: 20 }} className="audit-print-region">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600 }}>Audit</div>
            {audit && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                Generated {formatDateTime(audit.generatedAt)}
              </div>
            )}
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
            Inventory audit scored against original CSV upload values. Captures status, last used, location, service flags, and drift from baseline.
          </div>

          {/* Generate / re-generate buttons */}
          <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: audit ? 18 : 0 }}>
            {canRun && (
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: "10px 18px", borderRadius: 6,
                  background: generating ? "var(--s3)" : "var(--acc)",
                  color: generating ? "var(--t3)" : "var(--bg)",
                  border: "none", cursor: generating ? "not-allowed" : "pointer",
                  fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
                  minHeight: 40,
                }}
              >
                {generating ? "Generating..." : audit ? "Re-generate audit" : "Generate audit"}
              </button>
            )}
            {audit && (
              <>
                <button
                  onClick={handleDownloadCSV}
                  style={secondaryBtnStyle()}
                >
                  Download CSV
                </button>
                <button
                  onClick={handlePrint}
                  style={secondaryBtnStyle()}
                >
                  Print / Save as PDF
                </button>
              </>
            )}
          </div>

          {!canRun && !audit && (
            <div style={{
              padding: "12px 14px", background: "var(--s2)", border: "1px dashed var(--b1)",
              borderRadius: 6, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
              textAlign: "center",
            }}>
              Audit generation is restricted to managers and owners.
            </div>
          )}

          {audit && <AuditResultDisplay audit={audit} workspaceName={data.orgName} />}
        </div>
      </Card>
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Audit result display
// ──────────────────────────────────────────────────────────────────────

function AuditResultDisplay({ audit, workspaceName }: { audit: WorkspaceAudit; workspaceName: string }) {
  // Sort: drifted first (worst score), then no-baseline, then archived, then clean
  const sortedRows = useMemo(() => {
    return [...audit.rows].sort((a, b) => {
      // archived to the bottom
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      // no baseline second-to-bottom (within non-archived)
      if (a.noBaseline !== b.noBaseline) return a.noBaseline ? 1 : -1;
      // by score ascending (worst first)
      const aScore = a.score ?? 100;
      const bScore = b.score ?? 100;
      return aScore - bScore;
    });
  }, [audit.rows]);

  return (
    <div>
      {/* Workspace header in print mode only */}
      <div style={{ display: "none" }} className="print-only">
        <h1>{workspaceName} — Audit</h1>
      </div>

      {/* Workspace score banner */}
      <div style={{
        padding: "16px 18px",
        background: scoreBackground(audit.workspaceScore),
        border: `1px solid ${scoreBorder(audit.workspaceScore)}`,
        borderRadius: 8,
        marginBottom: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Workspace score
          </div>
          <div style={{
            fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 700,
            color: scoreColor(audit.workspaceScore), letterSpacing: "-0.02em",
          }}>
            {audit.workspaceScore === null ? "N/A" : `${audit.workspaceScore}%`}
          </div>
          {audit.workspaceScore === null && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
              No assets with CSV baseline. Import via CSV to enable scoring.
            </div>
          )}
        </div>
      </div>

      {/* Summary stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 6, marginBottom: 14,
      }}>
        <StatCell label="Total" value={audit.totalAssets} />
        <StatCell label="Auditable" value={audit.auditableAssets} />
        <StatCell label="No baseline" value={audit.noBaselineAssets} tint={audit.noBaselineAssets > 0 ? "warn" : "neutral"} />
        <StatCell label="Archived" value={audit.archivedAssets} />
        <StatCell label="Drifted" value={audit.driftedAssets} tint={audit.driftedAssets > 0 ? "warn" : "neutral"} />
        <StatCell label="Flagged" value={audit.flaggedAssets} tint={audit.flaggedAssets > 0 ? "warn" : "neutral"} />
      </div>

      {/* Per-asset table */}
      <div style={{
        border: "1px solid var(--b1)",
        borderRadius: 6,
        overflow: "hidden",
        marginBottom: 8,
      }}>
        <div style={{ maxHeight: 480, overflowY: "auto" }} className="audit-table-scroll">
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontFamily: "'DM Sans',sans-serif", fontSize: 12,
          }}>
            <thead style={{
              position: "sticky", top: 0, zIndex: 1,
              background: "var(--s2)",
            }}>
              <tr>
                <Th>Asset</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th>Last used</Th>
                <Th>By</Th>
                <Th>Flag</Th>
                <Th align="right">Score</Th>
                <Th>Drift</Th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => (
                <tr key={row.assetId} style={{
                  borderTop: "1px solid var(--b1)",
                  background: row.archived ? "var(--s1)" : "transparent",
                  opacity: row.archived ? 0.6 : 1,
                }}>
                  <Td>
                    <div style={{ color: "var(--t1)", fontWeight: 600, fontSize: 12 }}>{row.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                      {row.barcode}
                    </div>
                  </Td>
                  <Td>{row.location || "—"}</Td>
                  <Td>
                    <StatusBadge status={row.status} archived={row.archived} />
                  </Td>
                  <Td mono>{formatRelativeShort(row.lastUsed)}</Td>
                  <Td mono>{row.lastUsedBy ?? "—"}</Td>
                  <Td>
                    {row.flagSummary ? (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--red)" }}>
                        {row.flagSummary}
                      </span>
                    ) : "—"}
                  </Td>
                  <Td align="right">
                    {row.noBaseline ? (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>—</span>
                    ) : (
                      <span style={{
                        fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700,
                        color: scoreColor(row.score),
                      }}>
                        {row.score}%
                      </span>
                    )}
                  </Td>
                  <Td>
                    {row.noBaseline ? (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", fontStyle: "italic" }}>
                        No baseline
                      </span>
                    ) : row.drift.length === 0 ? (
                      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                        —
                      </span>
                    ) : (
                      <details>
                        <summary style={{
                          cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10,
                          color: "var(--amber, #f59e0b)", fontWeight: 700,
                        }}>
                          {row.drift.length} field{row.drift.length === 1 ? "" : "s"}
                        </summary>
                        <div style={{ marginTop: 4, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)" }}>
                          {row.drift.map((d, i) => (
                            <div key={i}>
                              <strong style={{ color: "var(--t1)" }}>{d.field}:</strong> &quot;{d.baselineValue}&quot; → &quot;{d.currentValue}&quot;
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)",
        lineHeight: 1.5,
      }}>
        Score = percentage of CSV-import baseline fields that still match current values. Counts: name, category, make, model, location, serial, cost, EOL date. Notes and photos excluded — they legitimately change over time.
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────

function Th({ children, align }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th style={{
      padding: "9px 10px",
      textAlign: align ?? "left",
      fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
      color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
      borderBottom: "1px solid var(--b1)",
    }}>{children}</th>
  );
}

function Td({ children, align, mono }: { children: React.ReactNode; align?: "left" | "right"; mono?: boolean }) {
  return (
    <td style={{
      padding: "8px 10px",
      textAlign: align ?? "left",
      verticalAlign: "top",
      fontFamily: mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif",
      fontSize: mono ? 11 : 12,
      color: "var(--t1)",
    }}>{children}</td>
  );
}

function StatCell({ label, value, tint }: { label: string; value: number; tint?: "warn" | "neutral" }) {
  const color = tint === "warn" ? "var(--amber, #f59e0b)" : "var(--t1)";
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--s2)", border: "1px solid var(--b1)",
      borderRadius: 5, textAlign: "center",
    }}>
      <div style={{
        fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700,
        color, letterSpacing: "-0.01em", lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 8, fontWeight: 700,
        color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
        marginTop: 4,
      }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status, archived }: { status: string; archived: boolean }) {
  if (archived) {
    return <Badge label="archived" tint="muted" />;
  }
  if (status === "out") return <Badge label="out" tint="amber" />;
  if (status === "flagged") return <Badge label="flagged" tint="red" />;
  return <Badge label="in" tint="green" />;
}

function Badge({ label, tint }: { label: string; tint: "green" | "amber" | "red" | "muted" }) {
  const colors = {
    green: { bg: "rgba(22,163,74,0.12)", fg: "var(--green, #16a34a)", border: "rgba(22,163,74,0.4)" },
    amber: { bg: "rgba(245,158,11,0.12)", fg: "var(--amber, #f59e0b)", border: "rgba(245,158,11,0.4)" },
    red: { bg: "rgba(239,68,68,0.12)", fg: "var(--red, #ef4444)", border: "rgba(239,68,68,0.4)" },
    muted: { bg: "transparent", fg: "var(--t3)", border: "var(--b1)" },
  };
  const c = colors[tint];
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 7px", borderRadius: 3,
      background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
      fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase",
    }}>{label}</span>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function scoreColor(score: number | null): string {
  if (score === null) return "var(--t3)";
  if (score >= 95) return "var(--green, #16a34a)";
  if (score >= 80) return "var(--amber, #f59e0b)";
  return "var(--red, #ef4444)";
}
function scoreBackground(score: number | null): string {
  if (score === null) return "var(--s2)";
  if (score >= 95) return "color-mix(in srgb, var(--green, #16a34a) 6%, var(--s2))";
  if (score >= 80) return "color-mix(in srgb, var(--amber, #f59e0b) 6%, var(--s2))";
  return "color-mix(in srgb, var(--red, #ef4444) 6%, var(--s2))";
}
function scoreBorder(score: number | null): string {
  if (score === null) return "var(--b1)";
  if (score >= 95) return "color-mix(in srgb, var(--green, #16a34a) 40%, var(--b1))";
  if (score >= 80) return "color-mix(in srgb, var(--amber, #f59e0b) 40%, var(--b1))";
  return "color-mix(in srgb, var(--red, #ef4444) 40%, var(--b1))";
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

function formatRelativeShort(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = now - then;
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function secondaryBtnStyle(): React.CSSProperties {
  return {
    padding: "10px 16px", borderRadius: 6,
    background: "transparent", border: "1px solid var(--b2)",
    color: "var(--t1)", cursor: "pointer",
    fontFamily: "'DM Sans',sans-serif", fontSize: 13,
    minHeight: 40,
  };
}
