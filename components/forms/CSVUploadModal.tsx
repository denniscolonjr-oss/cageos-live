"use client";
import { useState, useRef } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace, nextBarcode } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Asset } from "@/lib/data";

interface ParsedRow {
  [key: string]: string;
}

const TARGET_FIELDS = [
  { key: "name", label: "Asset name", required: true },
  { key: "barcode", label: "Barcode", required: false },
  { key: "category", label: "Category", required: false },
  { key: "make", label: "Make", required: false },
  { key: "model", label: "Model", required: false },
  { key: "location", label: "Location", required: false },
  { key: "serial", label: "Serial number", required: false },
  { key: "cost", label: "Cost", required: false },
];

// Smart auto-detect mapping based on common column names
function autoMap(columns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalized = columns.map(c => c.toLowerCase().replace(/[_\s-]/g, ""));

  const patterns: Record<string, string[]> = {
    name: ["name", "itemname", "assetname", "description", "item", "asset"],
    barcode: ["barcode", "tag", "tagid", "id", "assetid", "sku"],
    category: ["category", "type", "class", "group"],
    make: ["make", "brand", "manufacturer"],
    model: ["model", "modelnumber"],
    location: ["location", "loc", "where", "room", "building"],
    serial: ["serial", "serialnumber", "sn"],
    cost: ["cost", "price", "value", "amount"],
  };

  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < normalized.length; i++) {
      if (keywords.some(k => normalized[i] === k || normalized[i].includes(k))) {
        mapping[field] = columns[i];
        break;
      }
    }
  }
  return mapping;
}

// Simple CSV parser — handles quoted fields with commas
function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (c === "," && !inQuotes) {
        result.push(current); current = "";
      } else {
        current += c;
      }
    }
    result.push(current);
    return result.map(s => s.trim());
  }

  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const values = splitRow(line);
    const row: ParsedRow = {};
    headers.forEach((h, i) => { row[h] = values[i] || ""; });
    return row;
  });

  return { headers, rows };
}

type Stage = "upload" | "map" | "preview" | "filters" | "done";

const FILTER_OPTIONS: { key: string; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "location", label: "Location" },
  { key: "status", label: "Status" },
];

export default function CSVUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addAssets, data, setFilterableFields } = useWorkspace();
  const [stage, setStage] = useState<Stage>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [chosenFilters, setChosenFilters] = useState<Set<string>>(new Set(data.filterableFields));
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function reset() {
    setStage("upload"); setHeaders([]); setRows([]); setMapping({}); setError(null); setImportedCount(0);
    setChosenFilters(new Set(data.filterableFields));
  }

  function handleClose() { reset(); onClose(); }

  function processFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".csv") && !file.name.toLowerCase().endsWith(".tsv") && !file.type.includes("text") && !file.type.includes("csv")) {
      setError("Please upload a CSV or TSV file. If you have an Excel file, save it as CSV first.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) {
          setError("Couldn't read any columns. Make sure your file has a header row.");
          return;
        }
        if (parsed.rows.length === 0) {
          setError("No data rows found. The file appears to only have headers.");
          return;
        }
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setMapping(autoMap(parsed.headers));
        setStage("map");
      } catch (err) {
        setError("Failed to parse the file. Make sure it's valid CSV.");
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function commitImport() {
    const nameCol = mapping["name"];
    if (!nameCol) { setError("You must map at least the 'Asset name' field."); return; }

    const prefix = data.barcodePrefix || "AST";
    const existingBarcodes = new Set(data.assets.map(a => a.barcode));
    const newAssets: Asset[] = [];

    // Seed the next-number using the existing nextBarcode helper, then increment locally
    let seedBarcode = nextBarcode(data.assets, prefix);
    let nextNum = parseInt(seedBarcode.split("-")[1] ?? "1", 10);

    for (const row of rows) {
      const name = (row[nameCol] || "").trim();
      if (!name) continue;

      let barcode = mapping["barcode"] ? (row[mapping["barcode"]] || "").trim() : "";
      if (!barcode || existingBarcodes.has(barcode)) {
        barcode = `${prefix}-${String(nextNum++).padStart(7, "0")}`;
      }
      existingBarcodes.add(barcode);

      const cost = mapping["cost"] ? parseFloat((row[mapping["cost"]] || "").replace(/[$,]/g, "")) : null;

      newAssets.push({
        id: barcode,
        name,
        barcode,
        category: mapping["category"] ? (row[mapping["category"]] || "Misc Prod").trim() : "Misc Prod",
        make: mapping["make"] ? (row[mapping["make"]] || "").trim() : "",
        model: mapping["model"] ? (row[mapping["model"]] || "").trim() : "",
        location: mapping["location"] ? (row[mapping["location"]] || "").trim() : "",
        kitId: null,
        status: "in",
        lifecycle: "active",
        lastUser: null,
        lastUpdated: null,
        cost: isNaN(cost as number) ? null : cost,
        eolDate: null,
        serialNumber: mapping["serial"] ? (row[mapping["serial"]] || "").trim() : null,
        serviceFlag: null,
      });
      // Suppress unused seedBarcode warning
      void seedBarcode;
    }

    addAssets(newAssets);
    setImportedCount(newAssets.length);
    setStage("filters");
  }

  function commitFilters() {
    setFilterableFields(Array.from(chosenFilters));
    setStage("done");
    toast(`${importedCount} asset${importedCount === 1 ? "" : "s"} imported`, {
      detail: chosenFilters.size > 0 ? `Filters: ${Array.from(chosenFilters).join(", ")}` : undefined,
    });
  }

  function toggleFilter(key: string) {
    const next = new Set(chosenFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    setChosenFilters(next);
  }

  const inputStyle = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
    borderRadius: 7, padding: "10px 12px",
    color: "var(--t1)", outline: "none",
    fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
  };
  const labelStyle = {
    fontFamily: "'DM Mono',monospace", fontSize: 10,
    color: "var(--t3)", letterSpacing: "0.08em",
    textTransform: "uppercase" as const, marginBottom: 6, display: "block",
  };

  return (
    <Modal open={open} onClose={handleClose} title="Upload assets from CSV" maxWidth={620}>
      {stage === "upload" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 14 }}>
            Drop a CSV or TSV file with your inventory. We&apos;ll auto-detect columns and let you confirm before importing. Excel users: save as CSV first.
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--acc)" : "var(--b2)"}`,
              borderRadius: 12,
              padding: "40px 20px",
              textAlign: "center",
              cursor: "pointer",
              background: dragOver ? "rgba(226,245,92,0.04)" : "var(--s2)",
              transition: "all 0.15s",
            }}>
            <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.6 }}>⬡</div>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Drop CSV here</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>or tap to browse</div>
            <input ref={fileRef} type="file" accept=".csv,.tsv,text/csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>
          {error && (
            <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)", borderRadius: 7, fontSize: 12, color: "var(--red)", fontFamily: "'DM Mono',monospace" }}>
              {error}
            </div>
          )}
          <div style={{ marginTop: 16, padding: "10px 12px", background: "var(--s2)", borderRadius: 7, fontSize: 11, color: "var(--t2)", fontFamily: "'DM Mono',monospace", lineHeight: 1.5 }}>
            <strong style={{ color: "var(--t1)" }}>Suggested columns:</strong> Name, Barcode, Category, Make, Model, Location, Serial, Cost
          </div>
        </div>
      )}

      {stage === "map" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 14 }}>
            Found <strong style={{ color: "var(--t1)" }}>{rows.length} rows</strong> and <strong style={{ color: "var(--t1)" }}>{headers.length} columns</strong>. Map your columns to CageOS fields.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
            {TARGET_FIELDS.map(field => (
              <div key={field.key} style={{ display: "grid", gridTemplateColumns: "1fr 20px 1.4fr", gap: 8, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "var(--t1)" }}>
                  {field.label}
                  {field.required && <span style={{ color: "var(--red)", marginLeft: 4 }}>*</span>}
                </div>
                <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 12 }}>←</div>
                <select
                  value={mapping[field.key] || ""}
                  onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">— Skip this field —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          {error && (
            <div style={{ marginBottom: 12, padding: "10px 12px", background: "rgba(255,79,79,0.08)", border: "1px solid rgba(255,79,79,0.25)", borderRadius: 7, fontSize: 12, color: "var(--red)" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => setStage("upload")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            }}>← Back</button>
            <button onClick={() => setStage("preview")} disabled={!mapping["name"]} style={{
              flex: 2, padding: "12px 18px", borderRadius: 7,
              background: mapping["name"] ? "var(--acc)" : "var(--s3)",
              border: "none",
              color: mapping["name"] ? "var(--bg)" : "var(--t3)",
              cursor: mapping["name"] ? "pointer" : "not-allowed",
              fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
            }}>
              Preview {rows.length} rows →
            </button>
          </div>
        </div>
      )}

      {stage === "preview" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 14 }}>
            Review the first few rows. Click import to add all <strong style={{ color: "var(--t1)" }}>{rows.length} assets</strong> to your workspace.
          </div>
          <div style={{ background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 8, overflow: "hidden", marginBottom: 14 }}>
            <div className="scroll-x" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr style={{ background: "var(--s1)" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", borderBottom: "1px solid var(--b1)", whiteSpace: "nowrap" }}>Name</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", borderBottom: "1px solid var(--b1)", whiteSpace: "nowrap" }}>Barcode</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", borderBottom: "1px solid var(--b1)", whiteSpace: "nowrap" }}>Category</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, fontFamily: "'DM Mono',monospace", color: "var(--t3)", borderBottom: "1px solid var(--b1)", whiteSpace: "nowrap" }}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} style={{ borderBottom: i < 4 ? "1px solid var(--b1)" : "none" }}>
                      <td style={{ padding: "8px 12px", fontSize: 12 }}>{(mapping.name && r[mapping.name]) || "—"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, fontFamily: "'DM Mono',monospace", color: "var(--t2)" }}>{(mapping.barcode && r[mapping.barcode]) || "auto"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--t2)" }}>{(mapping.category && r[mapping.category]) || "Misc Prod"}</td>
                      <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--t2)" }}>{(mapping.location && r[mapping.location]) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && (
              <div style={{ padding: "8px 12px", borderTop: "1px solid var(--b1)", fontSize: 11, fontFamily: "'DM Mono',monospace", color: "var(--t3)", textAlign: "center" }}>
                + {rows.length - 5} more rows
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => setStage("map")} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            }}>← Back</button>
            <button onClick={commitImport} style={{
              flex: 2, padding: "12px 18px", borderRadius: 7,
              background: "var(--acc)", border: "none", color: "var(--bg)",
              cursor: "pointer", fontFamily: "'Syne',sans-serif",
              fontSize: 14, fontWeight: 700, minHeight: 44,
            }}>
              Import {rows.length} assets
            </button>
          </div>
        </div>
      )}

      {stage === "filters" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 6 }}>
            Almost done. Which fields should be <strong style={{ color: "var(--t1)" }}>sortable filters</strong> on the assets page?
          </div>
          <div style={{ fontSize: 11, color: "var(--t3)", fontFamily: "'DM Mono',monospace", marginBottom: 14 }}>
            Pick the columns your team will want to slice by. You can change this later in Settings.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {FILTER_OPTIONS.map(opt => {
              const active = chosenFilters.has(opt.key);
              return (
                <label key={opt.key} onClick={() => toggleFilter(opt.key)} style={{
                  padding: "12px 14px",
                  background: active ? "rgba(226,245,92,0.06)" : "var(--s2)",
                  border: `1px solid ${active ? "var(--acc)" : "var(--b1)"}`,
                  borderRadius: 7,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  minHeight: 44,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${active ? "var(--acc)" : "var(--b2)"}`,
                    background: active ? "var(--acc)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--bg)", fontSize: 11, fontWeight: 700,
                  }}>{active && "✓"}</div>
                  <div style={{ fontSize: 13, color: "var(--t1)" }}>{opt.label}</div>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
            <button onClick={() => { setChosenFilters(new Set()); commitFilters(); }} style={{
              flex: 1, padding: "12px 18px", borderRadius: 7,
              background: "transparent", border: "1px solid var(--b1)",
              color: "var(--t2)", cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
            }}>Skip</button>
            <button onClick={commitFilters} style={{
              flex: 2, padding: "12px 18px", borderRadius: 7,
              background: "var(--acc)", border: "none", color: "var(--bg)",
              cursor: "pointer", fontFamily: "'Syne',sans-serif",
              fontSize: 14, fontWeight: 700, minHeight: 44,
            }}>
              Save filters{chosenFilters.size > 0 ? ` (${chosenFilters.size})` : ""}
            </button>
          </div>
        </div>
      )}

      {stage === "done" && (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div className="animate-pop" style={{ width: 64, height: 64, background: "rgba(74,222,128,0.1)", border: "1px solid var(--green)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px" }}>✓</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Imported {importedCount} assets</div>
          <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 18 }}>Your workspace now has {data.assets.length} total assets.</div>
          <button onClick={handleClose} style={{
            padding: "12px 28px", borderRadius: 7,
            background: "var(--acc)", border: "none", color: "var(--bg)",
            cursor: "pointer", fontFamily: "'Syne',sans-serif",
            fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>Done</button>
        </div>
      )}
    </Modal>
  );
}
