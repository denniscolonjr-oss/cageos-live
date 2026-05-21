"use client";

/**
 * CSVUploadModal — bulk import assets via CSV with dedup preview (iter-28c).
 *
 * Three-screen flow:
 *   1. PICK FILE — drag/drop or file picker. Parses on selection.
 *   2. PREVIEW + DECISIONS — shows summary ("X new, Y duplicates") and a
 *      per-row decision UI for each duplicate (Skip / Overwrite / Import
 *      as new). Mass-action buttons apply a default to all duplicates.
 *   3. CONFIRM — final review with counts. Commits via recordCSVImport.
 *
 * Dedup uses lib/csvDedup.ts — barcode-primary with make+model+serial
 * fallback when barcode is missing.
 */

import { useState, useMemo, useCallback, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { useAuth } from "@/lib/supabase/AuthContext";
import { toast } from "@/components/ui/Toast";
import { analyzeDuplicates } from "@/lib/csvDedup";
import type { ParsedRow, DedupDecision, DuplicateMatch } from "@/lib/csvDedup";
import type { Asset } from "@/lib/data";

type Stage = "pick" | "preview" | "confirm" | "done";

export default function CSVUploadModal({ open, onClose }: {
  open: boolean;
  onClose: () => void;
}) {
  const auth = useAuth();
  const { data, recordCSVImport } = useWorkspace();

  const [stage, setStage] = useState<Stage>("pick");
  const [filename, setFilename] = useState("");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Map<number, DedupDecision>>(new Map());
  const [committing, setCommitting] = useState(false);
  const [summary, setSummary] = useState<{ created: number; overwritten: number; skipped: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploaderInitials = useMemo(() => {
    if (!auth.user) return "—";
    const profile = data.profiles.find(p => p.email === auth.user?.email);
    return profile?.initials ?? "—";
  }, [auth.user, data.profiles]);

  const analysis = useMemo(() => {
    if (parsedRows.length === 0) return { unique: [] as ParsedRow[], duplicates: [] as DuplicateMatch[] };
    return analyzeDuplicates(parsedRows, data.assets);
  }, [parsedRows, data.assets]);

  function resetAll() {
    setStage("pick"); setFilename(""); setParsedRows([]); setParseError(null);
    setDecisions(new Map()); setCommitting(false); setSummary(null);
  }
  function handleClose() {
    if (committing) return;
    resetAll();
    onClose();
  }

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setParseError("File must be a .csv");
      return;
    }
    setFilename(file.name);
    setParseError(null);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length === 0) { setParseError("CSV is empty or has no data rows."); return; }
      setParsedRows(rows);
      const init = new Map<number, DedupDecision>();
      const a = analyzeDuplicates(rows, data.assets);
      for (const dup of a.duplicates) init.set(dup.row.rowIndex, "skip");
      setDecisions(init);
      setStage("preview");
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Couldn't parse the CSV.");
    }
  }, [data.assets]);

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  }

  function setRowDecision(rowIndex: number, d: DedupDecision) {
    setDecisions(prev => { const next = new Map(prev); next.set(rowIndex, d); return next; });
  }
  function applyAll(d: DedupDecision) {
    setDecisions(prev => {
      const next = new Map(prev);
      for (const dup of analysis.duplicates) next.set(dup.row.rowIndex, d);
      return next;
    });
  }

  const stagedCounts = useMemo(() => {
    let skipped = 0, overwrites = 0, importedAsNew = 0;
    for (const dup of analysis.duplicates) {
      const dec = decisions.get(dup.row.rowIndex) ?? "skip";
      if (dec === "skip") skipped++;
      else if (dec === "overwrite") overwrites++;
      else importedAsNew++;
    }
    const newRows = analysis.unique.length + importedAsNew;
    return { newRows, skipped, overwrites, importedAsNew };
  }, [analysis, decisions]);

  function handleCommit() {
    setCommitting(true);
    const toCreate: Asset[] = [];
    const nowISO = new Date().toISOString();
    for (const row of analysis.unique) toCreate.push(rowToAsset(row, nowISO));
    const overwrites: Array<{ existingAssetId: string; row: ParsedRow }> = [];
    for (const dup of analysis.duplicates) {
      const dec = decisions.get(dup.row.rowIndex) ?? "skip";
      if (dec === "skip") continue;
      if (dec === "import_as_new") toCreate.push(rowToAsset(dup.row, nowISO));
      else if (dec === "overwrite") overwrites.push({ existingAssetId: dup.matchedAsset.id, row: dup.row });
    }
    const importId = recordCSVImport({
      filename, uploaderInitials,
      newAssets: toCreate, overwrites,
      rowsTotal: parsedRows.length, rowsSkipped: stagedCounts.skipped,
    });
    setCommitting(false);
    if (!importId) {
      toast("Couldn't commit import", { variant: "error", detail: "Read-only or permission denied." });
      return;
    }
    setSummary({ created: toCreate.length, overwritten: overwrites.length, skipped: stagedCounts.skipped });
    setStage("done");
    toast(`Imported ${toCreate.length} asset${toCreate.length === 1 ? "" : "s"}`);
  }

  return (
    <Modal open={open} onClose={handleClose} title={stage === "done" ? "Import complete" : "Import assets from CSV"} maxWidth={800}>
      {stage === "pick" && <PickFileStage onFile={handleFile} parseError={parseError} fileInputRef={fileInputRef} onFileInput={onFileInput} />}
      {stage === "preview" && <PreviewStage filename={filename} analysis={analysis} decisions={decisions} stagedCounts={stagedCounts} onSetRowDecision={setRowDecision} onApplyAll={applyAll} onBack={() => setStage("pick")} onNext={() => setStage("confirm")} />}
      {stage === "confirm" && <ConfirmStage filename={filename} stagedCounts={stagedCounts} onBack={() => setStage("preview")} onCommit={handleCommit} committing={committing} />}
      {stage === "done" && summary && <DoneStage summary={summary} onClose={handleClose} />}
    </Modal>
  );
}

function PickFileStage({ onFile, parseError, fileInputRef, onFileInput }: {
  onFile: (f: File) => void; parseError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0]; if (file) onFile(file);
  }

  function downloadTemplate() {
    const csv = buildCSVTemplate();
    // BOM for Excel encoding safety (same trick as audit export)
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cageos-asset-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Intro line — short, no longer trying to list every column */}
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
        Upload a CSV with one asset per row. Required columns: <strong style={{ color: "var(--t1)" }}>name</strong> and <strong style={{ color: "var(--t1)" }}>category</strong>. Common header names like &quot;Item Name&quot; or &quot;Asset Type&quot; are recognized automatically.
      </div>

      {/* Format guide bar with template download */}
      <div style={{
        padding: "10px 12px",
        background: "var(--s2)",
        border: "1px solid var(--b1)",
        borderRadius: 6,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        gap: 10, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => setGuideOpen(o => !o)}
            style={{
              background: "transparent", border: "none", padding: 0,
              color: "var(--acc)", cursor: "pointer",
              fontFamily: "'DM Mono',monospace", fontSize: 11, fontWeight: 700,
              letterSpacing: "0.04em",
            }}
          >
            {guideOpen ? "▾ Hide column guide" : "▸ See all supported columns"}
          </button>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            padding: "5px 11px", borderRadius: 4,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t1)", cursor: "pointer",
            fontFamily: "'DM Mono',monospace", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.04em", minHeight: 27,
          }}
        >
          ↓ Download template
        </button>
      </div>

      {/* Expandable column reference */}
      {guideOpen && (
        <div style={{
          border: "1px solid var(--b1)",
          borderRadius: 6,
          overflow: "hidden",
          maxHeight: 280, overflowY: "auto",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ background: "var(--s2)", position: "sticky", top: 0 }}>
              <tr>
                <th style={tableHeaderStyle()}>Field</th>
                <th style={tableHeaderStyle()}>Required?</th>
                <th style={tableHeaderStyle()}>Accepted header names</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(COLUMN_SYNONYMS) as Array<keyof typeof COLUMN_SYNONYMS>).map((field, i) => {
                const required = field === "name" || field === "category";
                return (
                  <tr key={field} style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--b1)",
                  }}>
                    <td style={{
                      padding: "8px 10px",
                      fontFamily: "'DM Mono',monospace", fontSize: 11,
                      color: "var(--t1)", fontWeight: 700,
                      verticalAlign: "top",
                    }}>{field}</td>
                    <td style={{
                      padding: "8px 10px",
                      fontFamily: "'DM Mono',monospace", fontSize: 10,
                      color: required ? "var(--red)" : "var(--t3)",
                      verticalAlign: "top",
                    }}>{required ? "required" : "optional"}</td>
                    <td style={{
                      padding: "8px 10px",
                      fontFamily: "'DM Sans',sans-serif", fontSize: 11,
                      color: "var(--t2)", lineHeight: 1.5,
                      verticalAlign: "top",
                    }}>{COLUMN_SYNONYMS[field].join(", ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        style={{
          padding: "40px 20px",
          background: isDragging ? "color-mix(in srgb, var(--acc) 8%, var(--s2))" : "var(--s2)",
          border: `1px dashed ${isDragging ? "var(--acc)" : "var(--b1)"}`,
          borderRadius: 8, textAlign: "center", cursor: "pointer",
          transition: "background 0.12s, border-color 0.12s",
        }}
      >
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "var(--t1)", marginBottom: 4 }}>
          {isDragging ? "Drop your CSV" : "Drop CSV here or click to select"}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>.csv files only</div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileInput} style={{ display: "none" }} />
      </div>

      {/* Parse error display */}
      {parseError && (
        <div style={{
          padding: "12px 14px",
          background: "color-mix(in srgb, var(--red) 8%, var(--s2))",
          border: "1px solid var(--red)", borderRadius: 6,
          fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "var(--t1)",
          lineHeight: 1.6,
        }}>
          <div style={{
            fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
            color: "var(--red)", letterSpacing: "0.1em", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Couldn&apos;t parse this CSV
          </div>
          {parseError}
          <div style={{ marginTop: 8, fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
            Tip: download the template above to see the expected format, or click &quot;See all supported columns&quot; to find which header name to rename.
          </div>
        </div>
      )}
    </div>
  );
}

function tableHeaderStyle(): React.CSSProperties {
  return {
    padding: "8px 10px",
    textAlign: "left",
    fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
    color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
    borderBottom: "1px solid var(--b1)",
    background: "var(--s2)",
  };
}

function PreviewStage({ filename, analysis, decisions, stagedCounts, onSetRowDecision, onApplyAll, onBack, onNext }: {
  filename: string;
  analysis: { unique: ParsedRow[]; duplicates: DuplicateMatch[] };
  decisions: Map<number, DedupDecision>;
  stagedCounts: { newRows: number; skipped: number; overwrites: number; importedAsNew: number };
  onSetRowDecision: (rowIndex: number, d: DedupDecision) => void;
  onApplyAll: (d: DedupDecision) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: "10px 12px", background: "var(--s2)",
        border: "1px solid var(--b1)", borderRadius: 6,
        fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t2)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ color: "var(--t1)", fontWeight: 600 }}>{filename}</span>
        <span>{analysis.unique.length + analysis.duplicates.length} rows parsed</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        <SummaryStat label="New" value={analysis.unique.length} tint="green" />
        <SummaryStat label="Duplicates" value={analysis.duplicates.length} tint={analysis.duplicates.length > 0 ? "amber" : "neutral"} />
        <SummaryStat label="Will commit" value={stagedCounts.newRows + stagedCounts.overwrites} tint="acc" />
      </div>
      {analysis.duplicates.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Duplicates to review ({analysis.duplicates.length})
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <ApplyAllButton label="Skip all" onClick={() => onApplyAll("skip")} />
              <ApplyAllButton label="Overwrite all" onClick={() => onApplyAll("overwrite")} />
              <ApplyAllButton label="Import all as new" onClick={() => onApplyAll("import_as_new")} />
            </div>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--b1)", borderRadius: 6, padding: 8 }}>
            {analysis.duplicates.map(dup => (
              <DuplicateRow key={dup.row.rowIndex} dup={dup} decision={decisions.get(dup.row.rowIndex) ?? "skip"} onChange={(d) => onSetRowDecision(dup.row.rowIndex, d)} />
            ))}
          </div>
        </div>
      )}
      {analysis.duplicates.length === 0 && (
        <div style={{
          padding: "12px 14px",
          background: "color-mix(in srgb, var(--green, #16a34a) 8%, var(--s2))",
          border: "1px solid color-mix(in srgb, var(--green, #16a34a) 40%, var(--b1))",
          borderRadius: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t1)",
        }}>
          No duplicates detected. All {analysis.unique.length} rows are new — ready to import.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
        <button onClick={onBack} style={secondaryBtnStyle()}>← Back</button>
        <button onClick={onNext} disabled={stagedCounts.newRows + stagedCounts.overwrites === 0} style={primaryBtnStyle(stagedCounts.newRows + stagedCounts.overwrites === 0)}>Review and commit →</button>
      </div>
    </div>
  );
}

function DuplicateRow({ dup, decision, onChange }: {
  dup: DuplicateMatch; decision: DedupDecision; onChange: (d: DedupDecision) => void;
}) {
  const matchLabel = dup.matchType === "barcode" ? "Barcode match" : "Make+Model+Serial match";
  return (
    <div style={{
      padding: "10px 12px", background: "var(--s2)",
      border: "1px solid var(--b1)", borderRadius: 5,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "var(--t1)", fontWeight: 600 }}>
          {dup.row.name || "(unnamed)"}
        </div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
          {matchLabel} → existing: {dup.matchedAsset.name} ({dup.matchedAsset.barcode || "no barcode"})
        </div>
      </div>
      <select
        value={decision}
        onChange={(e) => onChange(e.target.value as DedupDecision)}
        style={{
          padding: "5px 8px", borderRadius: 4,
          background: "var(--s3)", border: "1px solid var(--b1)",
          color: "var(--t1)", fontFamily: "'DM Mono',monospace", fontSize: 11,
          cursor: "pointer", minHeight: 28,
        }}
      >
        <option value="skip">Skip</option>
        <option value="overwrite">Overwrite existing</option>
        <option value="import_as_new">Import as new</option>
      </select>
    </div>
  );
}

function SummaryStat({ label, value, tint }: { label: string; value: number; tint: "green" | "amber" | "neutral" | "acc" }) {
  const color = tint === "green" ? "var(--green, #16a34a)"
              : tint === "amber" ? "var(--amber, #f59e0b)"
              : tint === "acc" ? "var(--acc)"
              : "var(--t2)";
  return (
    <div style={{
      padding: "10px 12px", background: "var(--s2)",
      border: "1px solid var(--b1)", borderRadius: 6, textAlign: "center",
    }}>
      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 24, fontWeight: 700, color, letterSpacing: "-0.01em" }}>{value}</div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function ApplyAllButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 9px", borderRadius: 4,
      background: "transparent", border: "1px solid var(--b1)",
      color: "var(--t2)", fontFamily: "'DM Mono',monospace", fontSize: 10,
      cursor: "pointer", minHeight: 26,
    }}>{label}</button>
  );
}

function ConfirmStage({ filename, stagedCounts, onBack, onCommit, committing }: {
  filename: string;
  stagedCounts: { newRows: number; skipped: number; overwrites: number; importedAsNew: number };
  onBack: () => void; onCommit: () => void; committing: boolean;
}) {
  const totalAffected = stagedCounts.newRows + stagedCounts.overwrites;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{
        padding: "16px 18px", background: "var(--s2)",
        border: "1px solid var(--b1)", borderRadius: 8,
      }}>
        <div style={{
          fontFamily: "'DM Mono',monospace", fontSize: 9, fontWeight: 700,
          color: "var(--t3)", letterSpacing: "0.1em", textTransform: "uppercase",
          marginBottom: 8,
        }}>Final review</div>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, color: "var(--t1)", fontWeight: 700, marginBottom: 12 }}>
          Ready to import {totalAffected} asset{totalAffected === 1 ? "" : "s"}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SummaryLine label="New assets" value={stagedCounts.newRows} />
          <SummaryLine label="Overwriting existing" value={stagedCounts.overwrites} />
          <SummaryLine label="Skipping" value={stagedCounts.skipped} muted />
        </div>
      </div>
      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", lineHeight: 1.6 }}>
        This import will be saved as a single batch under <strong style={{ color: "var(--t2)" }}>{filename}</strong>. You can roll it back from Settings → Imports if anything goes wrong. Assets in active kits or checkouts will be preserved on rollback.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 4 }}>
        <button onClick={onBack} disabled={committing} style={secondaryBtnStyle(committing)}>← Back</button>
        <button onClick={onCommit} disabled={committing || totalAffected === 0} style={primaryBtnStyle(committing || totalAffected === 0)}>
          {committing ? "Importing..." : "Confirm import"}
        </button>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      fontFamily: "'DM Sans',sans-serif", fontSize: 13,
      color: muted ? "var(--t3)" : "var(--t1)",
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function DoneStage({ summary, onClose }: {
  summary: { created: number; overwritten: number; skipped: number };
  onClose: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", padding: "10px 20px 4px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 28,
        background: "color-mix(in srgb, var(--green, #16a34a) 12%, var(--s2))",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Syne',sans-serif", fontSize: 28, color: "var(--green, #16a34a)",
      }}>✓</div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "var(--t1)" }}>Import complete</div>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
          {summary.created} created
          {summary.overwritten > 0 && ` · ${summary.overwritten} overwritten`}
          {summary.skipped > 0 && ` · ${summary.skipped} skipped`}
        </div>
      </div>
      <button onClick={onClose} style={{ ...primaryBtnStyle(false), marginTop: 8 }}>Close</button>
    </div>
  );
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const rawHeaders = lines[0].split(",").map(h => h.trim());
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const headerMap = new Map<string, number>();
  normalizedHeaders.forEach((h, i) => {
    // First occurrence wins — if the user has two columns that normalize
    // to the same key, ignore the second (parseable but ambiguous; we
    // prefer the leftmost).
    if (!headerMap.has(h)) headerMap.set(h, i);
  });

  /**
   * Find the first synonym that maps to a column index. Returns -1
   * if none of the synonyms match a header in the file.
   */
  const idxOfSynonyms = (synonyms: readonly string[]): number => {
    for (const syn of synonyms) {
      const i = headerMap.get(normalizeHeader(syn));
      if (i !== undefined) return i;
    }
    return -1;
  };

  const iName = idxOfSynonyms(COLUMN_SYNONYMS.name);
  const iCategory = idxOfSynonyms(COLUMN_SYNONYMS.category);
  if (iName === -1) {
    throw new Error(
      `We couldn't find a "name" column. Looked for: ${COLUMN_SYNONYMS.name.join(", ")}. ` +
      `Found these columns in your file: ${rawHeaders.join(", ") || "(none)"}.`
    );
  }
  if (iCategory === -1) {
    throw new Error(
      `We couldn't find a "category" column. Looked for: ${COLUMN_SYNONYMS.category.join(", ")}. ` +
      `Found these columns in your file: ${rawHeaders.join(", ") || "(none)"}.`
    );
  }
  const iBarcode = idxOfSynonyms(COLUMN_SYNONYMS.barcode);
  const iMake = idxOfSynonyms(COLUMN_SYNONYMS.make);
  const iModel = idxOfSynonyms(COLUMN_SYNONYMS.model);
  const iLocation = idxOfSynonyms(COLUMN_SYNONYMS.location);
  const iSerial = idxOfSynonyms(COLUMN_SYNONYMS.serialNumber);
  const iCost = idxOfSynonyms(COLUMN_SYNONYMS.cost);
  const iEol = idxOfSynonyms(COLUMN_SYNONYMS.eolDate);
  // Special-case `notes`: if "description" is being used as the NAME
  // column (no other name match), don't ALSO map it to notes — that
  // would duplicate the text. If iName matched a "description"-flavored
  // header, exclude that column index from the notes search.
  const iNotes = idxOfSynonyms(COLUMN_SYNONYMS.notes.filter(syn => {
    const synIdx = headerMap.get(normalizeHeader(syn));
    return synIdx !== iName; // skip if this synonym is what's serving as name
  }));

  const rows: ParsedRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = lines[li].split(",").map(c => c.trim());
    const name = (cells[iName] ?? "").trim();
    const category = (cells[iCategory] ?? "").trim();
    if (!name && !category) continue;
    const costRaw = iCost >= 0 ? (cells[iCost] ?? "").replace(/[$,]/g, "").trim() : "";
    const cost = costRaw ? parseFloat(costRaw) : null;
    rows.push({
      rowIndex: li, name, category,
      barcode: iBarcode >= 0 ? (cells[iBarcode] ?? "").trim() : "",
      make: iMake >= 0 ? (cells[iMake] ?? "").trim() : "",
      model: iModel >= 0 ? (cells[iModel] ?? "").trim() : "",
      location: iLocation >= 0 ? (cells[iLocation] ?? "").trim() : "",
      serialNumber: iSerial >= 0 ? (cells[iSerial] ?? "").trim() : "",
      cost: cost !== null && !Number.isNaN(cost) ? cost : null,
      eolDate: iEol >= 0 ? (cells[iEol] ?? "").trim() || null : null,
      notes: iNotes >= 0 ? (cells[iNotes] ?? "").trim() : "",
    });
  }
  return rows;
}

/**
 * Normalize a header name for matching: lowercase, trim, strip spaces,
 * underscores, dashes, hashes, slashes, and parentheses. "Item Name" →
 * "itemname". "Model #" → "model". "Serial / Number" → "serialnumber".
 * "S/N" → "sn".
 */
function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/[\s_\-#/()]/g, "");
}

/**
 * Header-name synonyms per field. First match wins when multiple
 * columns could map to the same field (leftmost in the CSV).
 *
 * Synonyms are matched via normalizeHeader, so "Item Name", "item_name",
 * "ITEM-NAME", "item name " all match "item name".
 */
const COLUMN_SYNONYMS = {
  name: ["name", "item name", "asset name", "title", "item"],
  category: ["category", "type", "asset type", "gear type", "kind", "classification"],
  barcode: ["barcode", "sku", "tag", "asset tag", "asset id", "id", "code", "qr"],
  make: ["make", "manufacturer", "brand", "vendor"],
  model: ["model", "model number", "model #"],
  location: ["location", "where", "room", "shelf", "storage", "location label"],
  serialNumber: ["serial number", "serial", "serial #", "sn", "s/n", "serialnumber"],
  cost: ["cost", "price", "value", "replacement cost", "msrp"],
  eolDate: ["eol date", "eol", "end of life", "retire by", "retirement date"],
  // "description" appears in both name and notes synonyms intentionally —
  // parser logic above gives name priority when both exist.
  notes: ["notes", "note", "description", "comments", "remarks"],
} as const;

/**
 * Build a downloadable example CSV. Used by the "Download template" button
 * in the upload modal. Three realistic broadcast-production rows with all
 * supported columns populated to varying degrees (one row has minimal data
 * to show optional fields are OK).
 */
export function buildCSVTemplate(): string {
  const header = [
    "Item Name", "Category", "Barcode", "Make", "Model",
    "Location", "Serial Number", "Cost", "EOL Date", "Notes",
  ];
  const rows = [
    ["Sony FX6 Camera", "Video", "MMG-1001", "Sony", "ILME-FX6",
     "Cage A Shelf 3", "SN-FX6-001", "5999", "2030", "Primary docs camera"],
    ["Sennheiser MKE 600", "Audio", "MMG-1002", "Sennheiser", "MKE 600",
     "Audio Drawer 2", "", "479", "", "Boom mic"],
    ["Aputure 300X", "Lighting", "MMG-1003", "Aputure", "300X Bi-Color",
     "Light Rack B", "A300X-2024-44", "1099", "", ""],
  ];
  const csvCell = (v: string) => /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  return [header, ...rows].map(r => r.map(csvCell).join(",")).join("\n");
}

function rowToAsset(row: ParsedRow, nowISO: string): Asset {
  const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${row.rowIndex}`;
  return {
    id,
    name: row.name,
    barcode: row.barcode || `AUTO-${id.slice(-8).toUpperCase()}`,
    category: row.category || "Uncategorized",
    make: row.make,
    model: row.model,
    location: row.location,
    kitId: null,
    status: "in",
    lifecycle: "active",
    lastUser: null,
    lastUpdated: nowISO,
    cost: row.cost,
    eolDate: row.eolDate,
    serialNumber: row.serialNumber || null,
    serviceFlag: null,
    notes: row.notes || undefined,
  };
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 18px", borderRadius: 6,
    background: disabled ? "var(--s3)" : "var(--acc)",
    color: disabled ? "var(--t3)" : "var(--bg)",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700,
    minHeight: 40,
  };
}

function secondaryBtnStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: "10px 16px", borderRadius: 6,
    background: "transparent", border: "1px solid var(--b2)",
    color: disabled ? "var(--t3)" : "var(--t1)",
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "'DM Sans',sans-serif", fontSize: 13,
    minHeight: 40,
  };
}
