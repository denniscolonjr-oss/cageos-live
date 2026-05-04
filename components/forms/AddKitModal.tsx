"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace, nextBarcode } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Kit, Asset } from "@/lib/data";

export default function AddKitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addKit } = useWorkspace();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [location, setLocation] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  // Combine assets + kits for next-barcode lookup so we don't collide
  const combinedForBarcode = [
    ...data.assets,
    ...data.kits.map(k => ({ id: k.id, barcode: k.barcode } as Asset)),
  ];
  const suggestedBarcode = nextBarcode(combinedForBarcode, data.barcodePrefix);

  const availableAssets = data.assets.filter(a =>
    !a.kitId &&
    (search === "" || a.name.toLowerCase().includes(search.toLowerCase()) || a.barcode.toLowerCase().includes(search.toLowerCase()))
  );

  function reset() {
    setName(""); setBarcode(""); setLocation(""); setSelectedIds(new Set()); setSearch("");
  }

  function toggle(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function handleSubmit() {
    if (!name.trim() || selectedIds.size === 0) return;
    const finalBarcode = barcode.trim() || suggestedBarcode;
    const kit: Kit = {
      id: finalBarcode,
      name: name.trim(),
      barcode: finalBarcode,
      status: "available",
      location: location.trim() || "Unknown",
      componentIds: Array.from(selectedIds),
    };
    addKit(kit);
    toast(`${kit.name} created`, { detail: `${kit.componentIds.length} component${kit.componentIds.length === 1 ? "" : "s"}` });
    reset();
    onClose();
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

  if (data.assets.length === 0) {
    return (
      <Modal open={open} onClose={onClose} title="Build a kit">
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 32, opacity: 0.4, marginBottom: 12 }}>⬡</div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>You need assets first</div>
          <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 18 }}>
            Kits are made up of assets. Add some assets to your workspace, then come back to build kits.
          </div>
          <button onClick={onClose} style={{
            padding: "12px 24px", borderRadius: 7, background: "var(--acc)",
            border: "none", color: "var(--bg)", cursor: "pointer",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>OK</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Build a kit" maxWidth={620}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Kit name *</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Venice Cinema Kit" autoFocus />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Kit barcode</label>
            <input style={inputStyle} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder={suggestedBarcode} />
          </div>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="Cage A" />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Components ({selectedIds.size} selected)</label>
          <input style={{ ...inputStyle, marginBottom: 8 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets..." />
          <div style={{
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--s2)",
            border: "1px solid var(--b1)",
            borderRadius: 7,
          }}>
            {availableAssets.length === 0 && (
              <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 12, color: "var(--t3)" }}>
                {search ? "No matching assets" : "All assets are already in kits"}
              </div>
            )}
            {availableAssets.map(a => {
              const selected = selectedIds.has(a.id);
              return (
                <div key={a.id} onClick={() => toggle(a.id)} style={{
                  padding: "10px 12px",
                  borderBottom: "1px solid var(--b1)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  background: selected ? "rgba(236,255,112,0.07)" : "transparent",
                  minHeight: 44,
                }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${selected ? "var(--acc)" : "var(--b2)"}`,
                    background: selected ? "var(--acc)" : "transparent",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                    color: "var(--bg)", fontSize: 11, fontWeight: 700,
                  }}>{selected && "✓"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--t1)" }}>{a.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{a.barcode} · {a.category}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: "1px solid var(--b1)" }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14, minHeight: 44,
          }}>Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim() || selectedIds.size === 0} style={{
            flex: 2, padding: "12px 18px", borderRadius: 7,
            background: name.trim() && selectedIds.size > 0 ? "var(--acc)" : "var(--s3)",
            border: "none",
            color: name.trim() && selectedIds.size > 0 ? "var(--bg)" : "var(--t3)",
            cursor: name.trim() && selectedIds.size > 0 ? "pointer" : "not-allowed",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700, minHeight: 44,
          }}>
            Save kit{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
          </button>
        </div>
      </div>
    </Modal>
  );
}
