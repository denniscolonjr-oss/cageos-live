"use client";

/**
 * AuditCard — Settings → Audit (iter-28d + iter-28d-fix).
 *
 * Generates an inventory audit. Each asset is scored on closeness to
 * its CSV-import baseline. Each kit is scored on component presence
 * (present ÷ expected × 100).
 *
 * Output paths:
 *   - CSV download: BOM-prefixed UTF-8, ASCII-safe header text
 *   - Browser print: dedicated print stylesheet, cover header, page breaks
 *
 * Manager+ only for generation. Anyone signed in can view a generated
 * audit (read-only).
 */

import { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import Card from "@/components/ui/Card";
import { runAudit, auditToCSV } from "@/lib/auditEngine";
import type { WorkspaceAudit, KitAuditRow } from "@/lib/auditEngine";

export default function AuditCard() {
  const auth = useAuth();
  const { data } = useWorkspace();
  const [audit, setAudit] = useState<WorkspaceAudit | null>(null);
  const [generating, setGenerating] = useState(false);

  const canRun = auth.currentRole === "owner" || auth.currentRole === "manager";

  const handleGenerate = useCallback(() => {
    setGenerating(true);
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
    // BOM + utf-8 prevents Excel from decoding as Windows-1252.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
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
    window.print();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <Card>
        <div style={{ padding: 20 }}>
          <div className="audit-card-screen-header" style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 6, flexWrap: "wrap", gap: 8,
          }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 600 }}>Audit</div>
            {audit && (
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                Generated {formatDateTime(audit.generatedAt)}
              </div>
            )}
          </div>
          <div className="audit-card-screen-header" style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)", marginBottom: 14 }}>
            Inventory audit scored against original CSV upload values. Captures status, last used, location, service flags, and drift from baseline. Kits scored on component presence.
          </div>

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
                <button onClick={handleDownloadCSV} style={secondaryBtnStyle()}>Download CSV</button>
                <button onClick={handlePrint} style={secondaryBtnStyle()}>Print / Save as PDF</button>
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

      {/* Print-only document. Hidden on screen; shown on print via CSS. */}
      {audit && (
        <div className="audit-print-doc" aria-hidden="true">
          <PrintDocument audit={audit} workspaceName={data.orgName} />
        </div>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Screen result (Settings card body)
// ──────────────────────────────────────────────────────────────────────

function AuditResultDisplay({ audit, workspaceName }: { audit: WorkspaceAudit; workspaceName: string }) {
  const sortedAssetRows = useMemo(() => {
    return [...audit.rows].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (a.noBaseline !== b.noBaseline) return a.noBaseline ? 1 : -1;
      const aScore = a.score ?? 100;
      const bScore = b.score ?? 100;
      return aScore - bScore;
    });
  }, [audit.rows]);

  const sortedKitRows = useMemo(() => {
    return [...audit.kits].sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      return a.score - b.score; // worst first
    });
  }, [audit.kits]);

  return (
    <div className="audit-screen-content">
      {/* Workspace score banner */}
      <div style={{
        padding: "16px 18px",
        background: scoreBackground(audit.workspaceScore),
        border: `1px solid ${scoreBorder(audit.workspaceScore)}`,
        borderRadius: 8, marginBottom: 14,
        display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
            Workspace score
          </div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 32, fontWeight: 700, color: scoreColor(audit.workspaceScore), letterSpacing: "-0.02em" }}>
            {audit.workspaceScore === null ? "N/A" : `${audit.workspaceScore}%`}
          </div>
          {audit.workspaceScore === null && (
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
              No assets with CSV baseline. Import via CSV to enable scoring.
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 6, marginBottom: 14 }}>
        <StatCell label="Total assets" value={audit.totalAssets} />
        <StatCell label="Auditable" value={audit.auditableAssets} />
        <StatCell label="No baseline" value={audit.noBaselineAssets} tint={audit.noBaselineAssets > 0 ? "warn" : "neutral"} />
        <StatCell label="Drifted" value={audit.driftedAssets} tint={audit.driftedAssets > 0 ? "warn" : "neutral"} />
        <StatCell label="Flagged" value={audit.flaggedAssets} tint={audit.flaggedAssets > 0 ? "warn" : "neutral"} />
        <StatCell label="Kits" value={audit.totalKits} />
        <StatCell label="Kits complete" value={audit.completeKits} tint="good" />
        <StatCell label="Kits incomplete" value={audit.incompleteKits} tint={audit.incompleteKits > 0 ? "warn" : "neutral"} />
      </div>

      {/* Kits section */}
      <SectionHeader title="Kits" subtitle={`${audit.totalKits} kits · ${audit.completeKits} complete · ${audit.incompleteKits} incomplete`} />
      <KitsTable rows={sortedKitRows} />

      {/* Assets section */}
      <SectionHeader title="Assets" subtitle={`${audit.totalAssets} total · ${audit.auditableAssets} auditable`} />
      <AssetsTable rows={sortedAssetRows} />

      <div style={{
        fontFamily: "'DM Mono',monospace", fontSize: 9, color: "var(--t3)",
        lineHeight: 1.5, marginTop: 12,
      }}>
        Asset score = % of CSV-import baseline fields still matching. Kit score = present components ÷ expected. Workspace {workspaceName}.
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 8 }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: "var(--t1)", letterSpacing: "-0.01em" }}>
        {title}
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
        {subtitle}
      </div>
    </div>
  );
}

function KitsTable({ rows }: { rows: KitAuditRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: "12px 14px", background: "var(--s2)", border: "1px dashed var(--b1)",
        borderRadius: 6, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
        textAlign: "center",
      }}>
        No kits in this workspace.
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--b1)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ maxHeight: 360, overflowY: "auto" }} className="audit-table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--s2)" }}>
            <tr>
              <Th>Kit</Th>
              <Th>Location</Th>
              <Th align="right">Present / Expected</Th>
              <Th align="right">Out</Th>
              <Th align="right">Score</Th>
              <Th>Missing</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.kitId} style={{
                borderTop: "1px solid var(--b1)",
                background: row.archived ? "var(--s1)" : "transparent",
                opacity: row.archived ? 0.6 : 1,
              }}>
                <Td>
                  <div style={{ color: "var(--t1)", fontWeight: 600, fontSize: 12 }}>{row.name}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{row.barcode}</div>
                </Td>
                <Td>{row.location || "—"}</Td>
                <Td align="right" mono>
                  <span style={{ color: row.presentCount === row.expectedCount ? "var(--t1)" : "var(--amber, #f59e0b)" }}>
                    {row.presentCount}
                  </span>
                  <span style={{ color: "var(--t3)" }}> / {row.expectedCount}</span>
                </Td>
                <Td align="right" mono>{row.outCount > 0 ? row.outCount : "—"}</Td>
                <Td align="right">
                  <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: scoreColor(row.score) }}>
                    {row.score}%
                  </span>
                </Td>
                <Td>
                  {row.missing.length === 0 ? (
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>—</span>
                  ) : (
                    <details>
                      <summary style={{ cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--red)", fontWeight: 700 }}>
                        {row.missing.length} missing
                      </summary>
                      <div style={{ marginTop: 4, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)" }}>
                        {row.missing.map((m, i) => (
                          <div key={i}>
                            <strong style={{ color: "var(--t1)" }}>{m.name}</strong> ({m.barcode}) — {m.reason}
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
  );
}

type AssetRow = WorkspaceAudit["rows"][number];

function AssetsTable({ rows }: { rows: AssetRow[] }) {
  if (rows.length === 0) {
    return (
      <div style={{
        padding: "12px 14px", background: "var(--s2)", border: "1px dashed var(--b1)",
        borderRadius: 6, fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)",
        textAlign: "center",
      }}>
        No assets in this workspace.
      </div>
    );
  }
  return (
    <div style={{ border: "1px solid var(--b1)", borderRadius: 6, overflow: "hidden", marginBottom: 8 }}>
      <div style={{ maxHeight: 480, overflowY: "auto" }} className="audit-table-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--s2)" }}>
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
            {rows.map(row => (
              <tr key={row.assetId} style={{
                borderTop: "1px solid var(--b1)",
                background: row.archived ? "var(--s1)" : "transparent",
                opacity: row.archived ? 0.6 : 1,
              }}>
                <Td>
                  <div style={{ color: "var(--t1)", fontWeight: 600, fontSize: 12 }}>{row.name}</div>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>{row.barcode}</div>
                </Td>
                <Td>{row.location || "—"}</Td>
                <Td><StatusBadge status={row.status} archived={row.archived} /></Td>
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
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 12, fontWeight: 700, color: scoreColor(row.score) }}>
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
                    <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>—</span>
                  ) : (
                    <details>
                      <summary style={{ cursor: "pointer", fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--amber, #f59e0b)", fontWeight: 700 }}>
                        {row.drift.length} field{row.drift.length === 1 ? "" : "s"}
                      </summary>
                      <div style={{ marginTop: 4, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t2)" }}>
                        {row.drift.map((d, i) => (
                          <div key={i}>
                            <strong style={{ color: "var(--t1)" }}>{d.field}:</strong> &quot;{d.baselineValue}&quot; &rarr; &quot;{d.currentValue}&quot;
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
  );
}

// ──────────────────────────────────────────────────────────────────────
// Print document (hidden on screen, shown via @media print)
// ──────────────────────────────────────────────────────────────────────

function PrintDocument({ audit, workspaceName }: { audit: WorkspaceAudit; workspaceName: string }) {
  const sortedAssetRows = [...audit.rows].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    if (a.noBaseline !== b.noBaseline) return a.noBaseline ? 1 : -1;
    return (a.score ?? 100) - (b.score ?? 100);
  });
  const sortedKitRows = [...audit.kits].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1;
    return a.score - b.score;
  });

  return (
    <div className="audit-print-page">
      {/* Cover header */}
      <header className="audit-print-cover">
        <div className="audit-print-eyebrow">CageOS — Inventory Audit</div>
        <h1 className="audit-print-title">{workspaceName}</h1>
        <div className="audit-print-meta">
          Generated {formatDateTime(audit.generatedAt)}
        </div>

        <div className="audit-print-score-banner" style={{
          borderColor: printScoreBorder(audit.workspaceScore),
          background: printScoreBg(audit.workspaceScore),
        }}>
          <div className="audit-print-score-label">Workspace score</div>
          <div className="audit-print-score-value" style={{ color: printScoreFg(audit.workspaceScore) }}>
            {audit.workspaceScore === null ? "N/A" : `${audit.workspaceScore}%`}
          </div>
        </div>

        <div className="audit-print-stats">
          <PrintStat label="Total assets" value={audit.totalAssets} />
          <PrintStat label="Auditable" value={audit.auditableAssets} />
          <PrintStat label="No baseline" value={audit.noBaselineAssets} />
          <PrintStat label="Drifted" value={audit.driftedAssets} />
          <PrintStat label="Flagged" value={audit.flaggedAssets} />
          <PrintStat label="Kits" value={audit.totalKits} />
          <PrintStat label="Kits complete" value={audit.completeKits} />
          <PrintStat label="Kits incomplete" value={audit.incompleteKits} />
        </div>
      </header>

      {/* Kits section */}
      <section className="audit-print-section">
        <h2 className="audit-print-h2">Kits ({audit.totalKits})</h2>
        <table className="audit-print-table">
          <thead>
            <tr>
              <th>Kit</th><th>Barcode</th><th>Location</th>
              <th className="right">Present/Expected</th>
              <th className="right">Out</th>
              <th className="right">Score</th>
              <th>Missing</th>
            </tr>
          </thead>
          <tbody>
            {sortedKitRows.map((k, i) => (
              <tr key={k.kitId} className={i % 2 === 0 ? "stripe" : ""}>
                <td>{k.name}{k.archived ? " (archived)" : ""}</td>
                <td className="mono">{k.barcode}</td>
                <td>{k.location || "-"}</td>
                <td className="right mono">{k.presentCount} / {k.expectedCount}</td>
                <td className="right mono">{k.outCount > 0 ? k.outCount : "-"}</td>
                <td className="right mono" style={{ color: printScoreFg(k.score), fontWeight: 700 }}>{k.score}%</td>
                <td className="missing-cell">
                  {k.missing.length === 0 ? "-" : k.missing.map(m => `${m.name} (${m.reason})`).join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Assets section */}
      <section className="audit-print-section page-break-before">
        <h2 className="audit-print-h2">Assets ({audit.totalAssets})</h2>
        <table className="audit-print-table">
          <thead>
            <tr>
              <th>Asset</th><th>Barcode</th><th>Location</th>
              <th>Status</th><th>Last used</th><th>By</th>
              <th>Flag</th>
              <th className="right">Score</th>
              <th>Drift</th>
            </tr>
          </thead>
          <tbody>
            {sortedAssetRows.map((a, i) => (
              <tr key={a.assetId} className={i % 2 === 0 ? "stripe" : ""}>
                <td>{a.name}{a.archived ? " (archived)" : ""}</td>
                <td className="mono">{a.barcode}</td>
                <td>{a.location || "-"}</td>
                <td>{a.archived ? "archived" : a.status}</td>
                <td className="mono">{formatRelativeShort(a.lastUsed)}</td>
                <td className="mono">{a.lastUsedBy ?? "-"}</td>
                <td>{a.flagSummary ?? "-"}</td>
                <td className="right mono" style={a.score !== null ? { color: printScoreFg(a.score), fontWeight: 700 } : undefined}>
                  {a.noBaseline ? "no baseline" : `${a.score}%`}
                </td>
                <td className="drift-cell">
                  {a.noBaseline ? "-" : a.drift.length === 0 ? "-" :
                    a.drift.map(d => `${d.field}: "${d.baselineValue}" -> "${d.currentValue}"`).join("; ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="audit-print-footer">
        CageOS Inventory Audit · {workspaceName} · Generated {formatDateTime(audit.generatedAt)}
      </footer>
    </div>
  );
}

function PrintStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="audit-print-stat">
      <div className="audit-print-stat-value">{value}</div>
      <div className="audit-print-stat-label">{label}</div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// Sub-components shared
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

function StatCell({ label, value, tint }: { label: string; value: number; tint?: "warn" | "good" | "neutral" }) {
  const color = tint === "warn" ? "var(--amber, #f59e0b)"
              : tint === "good" ? "var(--green, #16a34a)"
              : "var(--t1)";
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--s2)", border: "1px solid var(--b1)",
      borderRadius: 5, textAlign: "center",
    }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color, letterSpacing: "-0.01em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 8, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status, archived }: { status: string; archived: boolean }) {
  if (archived) return <Badge label="archived" tint="muted" />;
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
      display: "inline-block", padding: "2px 7px", borderRadius: 3,
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

// Print uses fixed black/colors — no CSS variables (browsers don't always honor them in print)
function printScoreFg(score: number | null): string {
  if (score === null) return "#666";
  if (score >= 95) return "#15803d";
  if (score >= 80) return "#b45309";
  return "#b91c1c";
}
function printScoreBg(score: number | null): string {
  if (score === null) return "#f5f5f5";
  if (score >= 95) return "#f0fdf4";
  if (score >= 80) return "#fffbeb";
  return "#fef2f2";
}
function printScoreBorder(score: number | null): string {
  if (score === null) return "#d4d4d4";
  if (score >= 95) return "#86efac";
  if (score >= 80) return "#fcd34d";
  return "#fca5a5";
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

// ──────────────────────────────────────────────────────────────────────
// Print CSS (the fix for the blank black page)
// ──────────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  /* Print document is hidden on screen */
  .audit-print-doc {
    display: none;
  }

  @media print {
    /* Reset everything to white background, black text */
    @page {
      size: letter;
      margin: 0.5in;
    }
    html, body {
      background: white !important;
      color: black !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* Hide everything by default */
    body * {
      visibility: hidden;
    }

    /* Show only the print doc */
    .audit-print-doc, .audit-print-doc * {
      visibility: visible;
    }
    .audit-print-doc {
      display: block !important;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      background: white !important;
      color: black !important;
    }

    /* Page elements */
    .audit-print-page {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      color: #111;
      background: white;
      padding: 0;
    }

    .audit-print-cover {
      padding-bottom: 24px;
      border-bottom: 2px solid #111;
      margin-bottom: 24px;
    }

    .audit-print-eyebrow {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 8px;
    }

    .audit-print-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 6px 0;
      letter-spacing: -0.02em;
    }

    .audit-print-meta {
      font-size: 11px;
      color: #666;
      margin-bottom: 18px;
    }

    .audit-print-score-banner {
      padding: 14px 18px;
      border: 1.5px solid;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 16px;
    }

    .audit-print-score-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #555;
    }

    .audit-print-score-value {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .audit-print-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }

    .audit-print-stat {
      border: 1px solid #ddd;
      border-radius: 5px;
      padding: 8px 10px;
      text-align: center;
    }

    .audit-print-stat-value {
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
    }

    .audit-print-stat-label {
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #666;
      margin-top: 4px;
    }

    .audit-print-section {
      margin-top: 18px;
    }

    .page-break-before {
      page-break-before: always;
    }

    .audit-print-h2 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 10px 0;
      padding-bottom: 6px;
      border-bottom: 1px solid #ccc;
    }

    .audit-print-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9px;
    }

    .audit-print-table th {
      text-align: left;
      padding: 6px 6px;
      border-bottom: 1.5px solid #111;
      font-size: 8px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #555;
      background: #f5f5f5;
    }

    .audit-print-table th.right { text-align: right; }

    .audit-print-table td {
      padding: 5px 6px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }

    .audit-print-table td.right { text-align: right; }
    .audit-print-table td.mono { font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 9px; }
    .audit-print-table td.missing-cell, .audit-print-table td.drift-cell {
      font-size: 8px;
      color: #555;
      max-width: 220px;
    }

    .audit-print-table tr.stripe td {
      background: #fafafa;
    }

    /* Avoid breaking table rows across pages */
    .audit-print-table tr {
      page-break-inside: avoid;
    }

    /* Keep table header repeated on each page */
    .audit-print-table thead {
      display: table-header-group;
    }

    .audit-print-footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #ccc;
      font-size: 9px;
      color: #888;
      text-align: center;
    }
  }
`;
