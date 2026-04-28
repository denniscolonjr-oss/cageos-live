"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace, nextBarcode } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";
import type { Asset } from "@/lib/data";

const CATEGORIES = ["Video", "Audio", "Lighting", "Grip", "Power", "Misc Prod", "IT / Network"];

export default function AddAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, addAsset } = useWorkspace();
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("Video");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [location, setLocation] = useState("");
  const [kitId, setKitId] = useState("");
  const [cost, setCost] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Auto-suggest barcode using the workspace's configured prefix
  const suggestedBarcode = nextBarcode(data.assets, data.barcodePrefix);

  function reset() {
    setName(""); setBarcode(""); setCategory("Video"); setMake(""); setModel("");
    setLocation(""); setKitId(""); setCost("");
  }

  function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    const finalBarcode = barcode.trim() || suggestedBarcode;
    const asset: Asset = {
      id: finalBarcode,
      name: name.trim(),
      barcode: finalBarcode,
      category,
      make: make.trim(),
      model: model.trim(),
      location: location.trim(),
      kitId: kitId || null,
      status: "in",
      lifecycle: "active",
      lastUser: null,
      lastUpdated: null,
      cost: cost ? parseFloat(cost) : null,
      eolDate: null,
      serialNumber: null,
      serviceFlag: null,
    };
    addAsset(asset);
    toast(`${asset.name} added`, { detail: `Barcode ${asset.barcode}` });
    reset();
    setSubmitting(false);
    onClose();
  }

  const inputStyle = {
    width: "100%", background: "var(--s2)", border: "1px solid var(--b1)",
    borderRadius: 7, padding: "10px 12px",
    color: "var(--t1)", outline: "none",
    fontFamily: "'DM Sans',sans-serif", fontSize: 14,
    minHeight: 44,
  };
  const labelStyle = {
    fontFamily: "'DM Mono',monospace", fontSize: 10,
    color: "var(--t3)", letterSpacing: "0.08em",
    textTransform: "uppercase" as const, marginBottom: 6,
    display: "block",
  };

  return (
    <Modal open={open} onClose={onClose} title="Add asset">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={labelStyle}>Name *</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sony FX9 #3" autoFocus />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Barcode</label>
            <input style={inputStyle} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder={suggestedBarcode} />
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 4 }}>
              Auto: {suggestedBarcode}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Make</label>
            <input style={inputStyle} value={make} onChange={e => setMake(e.target.value)} placeholder="Sony" />
          </div>
          <div>
            <label style={labelStyle}>Model</label>
            <input style={inputStyle} value={model} onChange={e => setModel(e.target.value)} placeholder="FX9" />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={labelStyle}>Location</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="Cage A" />
          </div>
          <div>
            <label style={labelStyle}>Cost ($)</label>
            <input style={inputStyle} type="number" value={cost} onChange={e => setCost(e.target.value)} placeholder="0.00" />
          </div>
        </div>

        {data.kits.length > 0 && (
          <div>
            <label style={labelStyle}>Assign to kit (optional)</label>
            <select style={inputStyle} value={kitId} onChange={e => setKitId(e.target.value)}>
              <option value="">— No kit —</option>
              {data.kits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
        )}

        <div style={{
          display: "flex", gap: 8, paddingTop: 10,
          borderTop: "1px solid var(--b1)",
          marginTop: 4,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t2)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 14,
            minHeight: 44,
          }}>
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!name.trim() || submitting} style={{
            flex: 1, padding: "12px 18px", borderRadius: 7,
            background: name.trim() ? "var(--acc)" : "var(--s3)",
            border: "none",
            color: name.trim() ? "var(--bg)" : "var(--t3)",
            cursor: name.trim() ? "pointer" : "not-allowed",
            fontFamily: "'Syne',sans-serif", fontSize: 14, fontWeight: 700,
            minHeight: 44,
          }}>
            Add asset
          </button>
        </div>
      </div>
    </Modal>
  );
}
