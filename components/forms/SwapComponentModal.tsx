"use client";

/**
 * SwapComponentModal — replace one component in a kit with another asset.
 *
 * Pre-filtered to assets of the same category as the component being swapped.
 * Single-select. Calls swapKitComponent which removes old and adds new in one atomic
 * operation with a single audit event.
 */

import { useState, useMemo } from "react";
import Modal from "@/components/ui/Modal";
import { useWorkspace } from "@/lib/hooks/useWorkspace";
import { toast } from "@/components/ui/Toast";

interface Props {
  open: boolean;
  onClose: () => void;
  oldAssetId: string | null;
  category: string | null;
  kitName: string;
}

export default function SwapComponentModal({ open, onClose, oldAssetId, category, kitName }: Props) {
  const { data, swapKitComponent } = useWorkspace();
  const [selectedNewId, setSelectedNewId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const oldAsset = oldAssetId ? data.assets.find(a => a.id === oldAssetId) : null;

  const candidates = useMemo(() => {
    if (!category) return [];
    return data.assets.filter(a => {
      if (a.archivedAt) return false;
      if (a.id === oldAssetId) return false;
      if (a.category !== category) return false;
      if (!showAll && a.kitId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !a.barcode.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data.assets, oldAssetId, category, showAll, search]);

  function handleSubmit() {
    if (!oldAssetId || !selectedNewId) return;
    const newAsset = data.assets.find(a => a.id === selectedNewId);
    swapKitComponent(oldAssetId, selectedNewId, "Manager");
    toast(`Swapped ${oldAsset?.name ?? "component"} for ${newAsset?.name ?? "replacement"}`);
    setSelectedNewId(null);
    setSearch("");
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`Swap component in ${kitName}`} maxWidth={580}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {oldAsset && (
          <div style={{
            padding: "10px 12px",
            background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              Replacing
            </div>
            <div style={{ fontSize: 13, color: "var(--t1)" }}>{oldAsset.name}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)", marginTop: 2 }}>
              {oldAsset.barcode} · {oldAsset.category}
            </div>
          </div>
        )}

        <div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${category ?? ""} assets`}
            autoFocus
            style={{
              width: "100%",
              background: "var(--s2)", border: "1px solid var(--b1)",
              borderRadius: 6, padding: "8px 10px",
              color: "var(--t1)", outline: "none",
              fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 36,
              colorScheme: "dark",
            }}
          />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--t2)", fontFamily: "'DM Mono',monospace", cursor: "pointer" }}>
          <input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} />
          Include assets that are already in other kits
        </label>

        <div style={{
          maxHeight: 320, overflow: "auto",
          background: "var(--s2)", border: "1px solid var(--b1)", borderRadius: 7,
        }}>
          {candidates.length === 0 ? (
            <div style={{ padding: "32px 18px", textAlign: "center", fontFamily: "'DM Mono',monospace", fontSize: 11, color: "var(--t3)" }}>
              No replacement candidates found in {category}.
              {!showAll && " Try toggling on assets in other kits."}
            </div>
          ) : (
            candidates.map((a, i) => {
              const isSelected = selectedNewId === a.id;
              return (
                <div
                  key={a.id}
                  onClick={() => setSelectedNewId(a.id)}
                  style={{
                    padding: "10px 14px",
                    borderBottom: i < candidates.length - 1 ? "1px solid var(--b1)" : "none",
                    display: "flex", gap: 12, alignItems: "center",
                    cursor: "pointer",
                    background: isSelected ? "rgba(226,245,92,0.08)" : "transparent",
                  }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: 9,
                    border: `1.5px solid ${isSelected ? "var(--acc)" : "var(--b2)"}`,
                    background: isSelected ? "var(--acc)" : "transparent",
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--t1)", marginBottom: 2 }}>{a.name}</div>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: "var(--t3)" }}>
                      {a.barcode} · {a.category}{a.kitId ? " · in another kit" : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{
            padding: "10px 16px", borderRadius: 7,
            background: "transparent", border: "1px solid var(--b1)",
            color: "var(--t1)", cursor: "pointer",
            fontFamily: "'DM Sans',sans-serif", fontSize: 13, minHeight: 40,
          }}>Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={!selectedNewId}
            style={{
              padding: "10px 16px", borderRadius: 7,
              background: !selectedNewId ? "var(--s3)" : "var(--acc)",
              border: "none",
              color: !selectedNewId ? "var(--t3)" : "var(--bg)",
              cursor: !selectedNewId ? "not-allowed" : "pointer",
              fontFamily: "'Syne',sans-serif", fontSize: 13, fontWeight: 700, minHeight: 40,
            }}>
            Swap
          </button>
        </div>
      </div>
    </Modal>
  );
}
